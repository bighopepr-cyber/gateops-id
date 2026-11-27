CREATE OR REPLACE FUNCTION public.gateops_update_gps_location(
  p_personnel_id text,
  p_latitude float8,
  p_longitude float8,
  p_permission_revoked boolean,
  p_actor_user_id text,
  p_actor_username varchar(80),
  p_actor_display_name varchar(160),
  p_actor_role "Role"
)
RETURNS TABLE(
  saved boolean, personnel_id text, gps_updated_at timestamp(3)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts timestamp(3) := CURRENT_TIMESTAMP;
  updated_count integer;
BEGIN
  -- Verify personnel exists and is PERSONEL role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_personnel_id AND role = 'PERSONEL' LIMIT 1) THEN
    RETURN QUERY SELECT false::boolean, p_personnel_id, NULL::timestamp(3);
    RETURN;
  END IF;

  IF p_permission_revoked THEN
    UPDATE users SET gps_latitude = NULL, gps_longitude = NULL, gps_updated_at = now_ts,
      gps_permission_revoked_at = now_ts, updated_at = now_ts
    WHERE id = p_personnel_id AND role = 'PERSONEL';
  ELSE
    UPDATE users SET gps_latitude = p_latitude, gps_longitude = p_longitude, gps_updated_at = now_ts,
      gps_permission_revoked_at = NULL, updated_at = now_ts
    WHERE id = p_personnel_id AND role = 'PERSONEL' AND presence_status = 'DI_LUAR';
  END IF;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count = 0 THEN
    RETURN QUERY SELECT false::boolean, p_personnel_id, NULL::timestamp(3);
    RETURN;
  END IF;

  RETURN QUERY SELECT true::boolean, p_personnel_id, now_ts;
END;
$$;

REVOKE ALL ON FUNCTION public.gateops_update_gps_location(text, float8, float8, boolean, text, varchar, varchar, "Role") FROM PUBLIC;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.gateops_update_gps_location(text, float8, float8, boolean, text, varchar, varchar, "Role") TO service_role;
  END IF;
END;
$grant$;
