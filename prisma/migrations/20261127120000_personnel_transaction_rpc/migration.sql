CREATE OR REPLACE FUNCTION public.gateops_personnel_transaction(
  p_personnel_id text,
  p_gate_credential text,
  p_destination varchar(240),
  p_purpose varchar(500),
  p_actor_user_id text,
  p_actor_username varchar(80),
  p_actor_display_name varchar(160),
  p_actor_role "Role"
)
RETURNS TABLE(
  kind text,
  activity_id text,
  gate_name varchar(120),
  destination varchar(240),
  purpose varchar(500),
  exit_at timestamp(3),
  return_at timestamp(3),
  duration_seconds integer,
  presence_status "PresenceStatus",
  activity_status "ActivityStatus"
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked boolean;
  gate_row gates%ROWTYPE;
  personnel_row users%ROWTYPE;
  session_row sessions%ROWTYPE;
  activity_row activities%ROWTYPE;
  now_ts timestamp(3) := CURRENT_TIMESTAMP;
  duration_sec integer;
  gate_hash char(64);
BEGIN
  -- Advisory lock per personnel to prevent concurrent scan corruption
  SELECT pg_try_advisory_xact_lock(hashtextextended(p_personnel_id, 0)) INTO locked;
  IF NOT locked THEN
    RETURN QUERY SELECT 'BUSY'::text, NULL::text, NULL::varchar, NULL::varchar, NULL::varchar,
      NULL::timestamp(3), NULL::timestamp(3), NULL::integer, NULL::"PresenceStatus", NULL::"ActivityStatus";
    RETURN;
  END IF;

  -- Validate session
  SELECT id INTO session_row FROM sessions
   WHERE user_id = p_personnel_id AND expires_at > now_ts LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'SESSION_EXPIRED'::text, NULL::text, NULL::varchar, NULL::varchar, NULL::varchar,
      NULL::timestamp(3), NULL::timestamp(3), NULL::integer, NULL::"PresenceStatus", NULL::"ActivityStatus";
    RETURN;
  END IF;

  -- Hash gate credential and validate gate
  gate_hash := encode(digest(p_gate_credential, 'sha256'), 'hex');
  SELECT * INTO gate_row FROM gates
   WHERE qr_token_hash = gate_hash AND status = 'AKTIF' LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'INVALID_GATE'::text, NULL::text, NULL::varchar, NULL::varchar, NULL::varchar,
      NULL::timestamp(3), NULL::timestamp(3), NULL::integer, NULL::"PresenceStatus", NULL::"ActivityStatus";
    RETURN;
  END IF;

  -- Load personnel
  SELECT * INTO personnel_row FROM users
   WHERE id = p_personnel_id AND role = 'PERSONEL' LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'INVALID_PERSONNEL'::text, NULL::text, NULL::varchar, NULL::varchar, NULL::varchar,
      NULL::timestamp(3), NULL::timestamp(3), NULL::integer, NULL::"PresenceStatus", NULL::"ActivityStatus";
    RETURN;
  END IF;

  IF personnel_row.presence_status = 'DI_DALAM' THEN
    -- EXIT: create activity, set DI_LUAR
    IF p_destination IS NULL OR trim(p_destination) = '' OR p_purpose IS NULL OR trim(p_purpose) = '' THEN
      RETURN QUERY SELECT 'INVALID_FORM'::text, NULL::text, NULL::varchar, NULL::varchar, NULL::varchar,
        NULL::timestamp(3), NULL::timestamp(3), NULL::integer, NULL::"PresenceStatus", NULL::"ActivityStatus";
      RETURN;
    END IF;

    INSERT INTO activities (id, personnel_id, exit_gate_id, destination, purpose, status, exit_at, created_at, updated_at)
    VALUES (gen_random_uuid()::text, p_personnel_id, gate_row.id, trim(p_destination), trim(p_purpose),
            'AKTIF', now_ts, now_ts, now_ts)
    RETURNING * INTO activity_row;

    UPDATE users SET presence_status = 'DI_LUAR',
      gps_latitude = NULL, gps_longitude = NULL, gps_updated_at = NULL, gps_permission_revoked_at = NULL,
      updated_at = now_ts
    WHERE id = p_personnel_id;

    INSERT INTO audit_logs (id, actor_user_id, actor_username, actor_display_name, actor_role,
      action, entity_type, entity_id, metadata, created_at)
    VALUES (gen_random_uuid()::text, p_actor_user_id, p_actor_username, p_actor_display_name, p_actor_role,
      'PRESENCE_EXIT', 'ACTIVITY', activity_row.id,
      jsonb_build_object('direction', 'KELUAR', 'gate_id', gate_row.id, 'destination', trim(p_destination), 'purpose', trim(p_purpose)),
      now_ts);

    -- Re-check session before commit
    SELECT id INTO session_row FROM sessions
     WHERE user_id = p_personnel_id AND expires_at > now_ts LIMIT 1;
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'SESSION_EXPIRED'::text, NULL::text, NULL::varchar, NULL::varchar, NULL::varchar,
        NULL::timestamp(3), NULL::timestamp(3), NULL::integer, NULL::"PresenceStatus", NULL::"ActivityStatus";
      RETURN;
    END IF;

    RETURN QUERY SELECT 'EXIT'::text, activity_row.id, gate_row.name, activity_row.destination, activity_row.purpose,
      activity_row.exit_at, NULL::timestamp(3), NULL::integer, 'DI_LUAR'::"PresenceStatus", 'AKTIF'::"ActivityStatus";

  ELSIF personnel_row.presence_status = 'DI_LUAR' THEN
    -- RETURN: complete activity, set DI_DALAM
    SELECT * INTO activity_row FROM activities
     WHERE personnel_id = p_personnel_id AND status = 'AKTIF'
     ORDER BY exit_at DESC LIMIT 1;
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'INCONSISTENT_STATE'::text, NULL::text, NULL::varchar, NULL::varchar, NULL::varchar,
        NULL::timestamp(3), NULL::timestamp(3), NULL::integer, NULL::"PresenceStatus", NULL::"ActivityStatus";
      RETURN;
    END IF;

    duration_sec := floor(extract(epoch FROM (now_ts - activity_row.exit_at)))::integer;

    UPDATE activities SET return_gate_id = gate_row.id, return_at = now_ts,
      duration_seconds = duration_sec, status = 'SELESAI', updated_at = now_ts
    WHERE id = activity_row.id;

    UPDATE users SET presence_status = 'DI_DALAM',
      gps_latitude = NULL, gps_longitude = NULL, gps_updated_at = NULL, gps_permission_revoked_at = NULL,
      updated_at = now_ts
    WHERE id = p_personnel_id;

    INSERT INTO audit_logs (id, actor_user_id, actor_username, actor_display_name, actor_role,
      action, entity_type, entity_id, metadata, created_at)
    VALUES (gen_random_uuid()::text, p_actor_user_id, p_actor_username, p_actor_display_name, p_actor_role,
      'PRESENCE_RETURN', 'ACTIVITY', activity_row.id,
      jsonb_build_object('direction', 'KEMBALI', 'gate_id', gate_row.id, 'destination', activity_row.destination, 'purpose', activity_row.purpose, 'duration_seconds', duration_sec),
      now_ts);

    -- Re-check session before commit
    SELECT id INTO session_row FROM sessions
     WHERE user_id = p_personnel_id AND expires_at > now_ts LIMIT 1;
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'SESSION_EXPIRED'::text, NULL::text, NULL::varchar, NULL::varchar, NULL::varchar,
        NULL::timestamp(3), NULL::timestamp(3), NULL::integer, NULL::"PresenceStatus", NULL::"ActivityStatus";
      RETURN;
    END IF;

    RETURN QUERY SELECT 'RETURN'::text, activity_row.id, gate_row.name, activity_row.destination, activity_row.purpose,
      activity_row.exit_at, now_ts, duration_sec, 'DI_DALAM'::"PresenceStatus", 'SELESAI'::"ActivityStatus";

  ELSE
    RETURN QUERY SELECT 'INCONSISTENT_STATE'::text, NULL::text, NULL::varchar, NULL::varchar, NULL::varchar,
      NULL::timestamp(3), NULL::timestamp(3), NULL::integer, NULL::"PresenceStatus", NULL::"ActivityStatus";
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.gateops_personnel_transaction(text, text, varchar, varchar, text, varchar, varchar, "Role") FROM PUBLIC;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.gateops_personnel_transaction(text, text, varchar, varchar, text, varchar, varchar, "Role") TO service_role;
  END IF;
END;
$grant$;
