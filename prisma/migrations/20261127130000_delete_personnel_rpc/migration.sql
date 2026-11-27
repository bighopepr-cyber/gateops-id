CREATE OR REPLACE FUNCTION public.gateops_delete_personnel(
  p_target_id text,
  p_actor_user_id text,
  p_actor_username varchar(80),
  p_actor_display_name varchar(160),
  p_actor_role "Role"
)
RETURNS TABLE(
  deleted_personnel_id text,
  deleted_persit_accounts integer,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_row users%ROWTYPE;
  persit_count integer;
BEGIN
  -- Verify target is PERSONEL
  SELECT * INTO target_row FROM users
   WHERE id = p_target_id AND role = 'PERSONEL' LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Count and delete linked Persit accounts
  SELECT count(*) INTO persit_count FROM users
   WHERE role = 'PERSIT' AND linked_personnel_id = p_target_id;

  DELETE FROM users WHERE role = 'PERSIT' AND linked_personnel_id = p_target_id;

  -- Delete sessions for target
  DELETE FROM sessions WHERE user_id = p_target_id;

  -- Delete activities for target
  DELETE FROM activities WHERE personnel_id = p_target_id;

  -- Delete the personnel user
  DELETE FROM users WHERE id = p_target_id;

  -- Audit log
  INSERT INTO audit_logs (id, actor_user_id, actor_username, actor_display_name, actor_role,
    action, entity_type, entity_id, metadata, created_at)
  VALUES (gen_random_uuid()::text, p_actor_user_id, p_actor_username, p_actor_display_name, p_actor_role,
    'PERSONNEL_DELETED', 'PERSONNEL', p_target_id,
    jsonb_build_object('deleted_persit_accounts', persit_count, 'display_name', target_row.display_name, 'nrp', target_row.nrp),
    CURRENT_TIMESTAMP);

  RETURN QUERY SELECT p_target_id, persit_count,
    'Personel, akun Persit terhubung, dan seluruh sesi login terkait berhasil dihapus.'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.gateops_delete_personnel(text, text, varchar, varchar, "Role") FROM PUBLIC;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.gateops_delete_personnel(text, text, varchar, varchar, "Role") TO service_role;
  END IF;
END;
$grant$;
