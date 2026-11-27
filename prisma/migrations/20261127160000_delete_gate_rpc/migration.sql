CREATE OR REPLACE FUNCTION public.gateops_delete_gate(
  p_id text,
  p_actor_user_id text,
  p_actor_username varchar(80),
  p_actor_display_name varchar(160),
  p_actor_role "Role"
)
RETURNS TABLE(id text, name varchar(120), location varchar(240), status "GateStatus", deleted_at timestamp(3))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_gate gates%ROWTYPE;
BEGIN
  DELETE FROM gates WHERE id = p_id RETURNING * INTO deleted_gate;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (id, actor_user_id, actor_username, actor_display_name, actor_role,
    action, entity_type, entity_id, metadata, created_at)
  VALUES (gen_random_uuid()::text, p_actor_user_id, p_actor_username, p_actor_display_name, p_actor_role,
    'GATE_DELETED', 'GATE', deleted_gate.id,
    jsonb_build_object('name', deleted_gate.name, 'location', deleted_gate.location, 'status', deleted_gate.status::text),
    CURRENT_TIMESTAMP);

  RETURN QUERY SELECT deleted_gate.id, deleted_gate.name, deleted_gate.location,
    deleted_gate.status, CURRENT_TIMESTAMP;
END;
$$;

REVOKE ALL ON FUNCTION public.gateops_delete_gate(text, text, varchar, varchar, "Role") FROM PUBLIC;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.gateops_delete_gate(text, text, varchar, varchar, "Role") TO service_role;
  END IF;
END;
$grant$;
