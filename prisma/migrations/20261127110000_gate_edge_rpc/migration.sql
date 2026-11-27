CREATE OR REPLACE FUNCTION public.gateops_create_gate(
  p_id text,
  p_name varchar(120),
  p_location varchar(240),
  p_status "GateStatus",
  p_qr_token_hash char(64),
  p_actor_user_id text,
  p_actor_username varchar(80),
  p_actor_display_name varchar(160),
  p_actor_role "Role"
)
RETURNS TABLE(id text, name varchar(120), location varchar(240), status "GateStatus", created_at timestamp(3), updated_at timestamp(3))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_gate gates%ROWTYPE;
BEGIN
  INSERT INTO gates (id, name, location, status, qr_token_hash, created_at, updated_at)
  VALUES (p_id, p_name, p_location, p_status, p_qr_token_hash, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  RETURNING * INTO created_gate;

  INSERT INTO audit_logs (
    id, actor_user_id, actor_username, actor_display_name, actor_role,
    action, entity_type, entity_id, metadata, created_at
  ) VALUES (
    gen_random_uuid()::text, p_actor_user_id, p_actor_username, p_actor_display_name, p_actor_role,
    'GATE_CREATED', 'GATE', created_gate.id,
    jsonb_build_object('name', created_gate.name, 'status', created_gate.status::text),
    CURRENT_TIMESTAMP
  );

  RETURN QUERY SELECT created_gate.id, created_gate.name, created_gate.location,
    created_gate.status, created_gate.created_at, created_gate.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.gateops_update_gate(
  p_id text,
  p_name varchar(120),
  p_location varchar(240),
  p_status "GateStatus",
  p_actor_user_id text,
  p_actor_username varchar(80),
  p_actor_display_name varchar(160),
  p_actor_role "Role"
)
RETURNS TABLE(id text, name varchar(120), location varchar(240), status "GateStatus", created_at timestamp(3), updated_at timestamp(3))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_gate gates%ROWTYPE;
BEGIN
  UPDATE gates SET name = p_name, location = p_location, status = p_status, updated_at = CURRENT_TIMESTAMP
  WHERE gates.id = p_id
  RETURNING * INTO updated_gate;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (
    id, actor_user_id, actor_username, actor_display_name, actor_role,
    action, entity_type, entity_id, metadata, created_at
  ) VALUES (
    gen_random_uuid()::text, p_actor_user_id, p_actor_username, p_actor_display_name, p_actor_role,
    'GATE_UPDATED', 'GATE', updated_gate.id,
    jsonb_build_object('name', updated_gate.name, 'status', updated_gate.status::text),
    CURRENT_TIMESTAMP
  );

  RETURN QUERY SELECT updated_gate.id, updated_gate.name, updated_gate.location,
    updated_gate.status, updated_gate.created_at, updated_gate.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.gateops_create_gate(text, varchar, varchar, "GateStatus", char, text, varchar, varchar, "Role") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gateops_update_gate(text, varchar, varchar, "GateStatus", text, varchar, varchar, "Role") FROM PUBLIC;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.gateops_create_gate(text, varchar, varchar, "GateStatus", char, text, varchar, varchar, "Role") TO service_role;
    GRANT EXECUTE ON FUNCTION public.gateops_update_gate(text, varchar, varchar, "GateStatus", text, varchar, varchar, "Role") TO service_role;
  END IF;
END;
$grant$;
