CREATE OR REPLACE FUNCTION public.gateops_create_account(
  p_username varchar(80),
  p_password_hash char(64),
  p_role "Role",
  p_display_name varchar(160),
  p_nrp varchar(40),
  p_rank varchar(100),
  p_position varchar(160),
  p_actor_user_id text,
  p_actor_username varchar(80),
  p_actor_display_name varchar(160),
  p_actor_role "Role"
)
RETURNS TABLE(
  id text, username varchar(80), role "Role", display_name varchar(160),
  nrp varchar(40), rank varchar(100), position varchar(160),
  must_change_password boolean, created_at timestamp(3), updated_at timestamp(3)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_user users%ROWTYPE;
BEGIN
  INSERT INTO users (id, username, password_hash, role, display_name, nrp, rank, position,
    presence_status, must_change_password, created_at, updated_at)
  VALUES (gen_random_uuid()::text, p_username, p_password_hash, p_role, p_display_name,
    NULLIF(p_nrp, ''), NULLIF(p_rank, ''), NULLIF(p_position, ''),
    'DI_DALAM', p_role = 'SUPER_ADMIN' OR p_role = 'KOMANDAN' OR p_role = 'PERSONEL',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  RETURNING * INTO created_user;

  INSERT INTO audit_logs (id, actor_user_id, actor_username, actor_display_name, actor_role,
    action, entity_type, entity_id, metadata, created_at)
  VALUES (gen_random_uuid()::text, p_actor_user_id, p_actor_username, p_actor_display_name, p_actor_role,
    'ACCOUNT_CREATED', 'ACCOUNT', created_user.id,
    jsonb_build_object('role', p_role::text, 'username', p_username),
    CURRENT_TIMESTAMP);

  RETURN QUERY SELECT created_user.id, created_user.username, created_user.role,
    created_user.display_name, created_user.nrp, created_user.rank, created_user.position,
    created_user.must_change_password, created_user.created_at, created_user.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.gateops_create_account(varchar, char, "Role", varchar, varchar, varchar, varchar, text, varchar, varchar, "Role") FROM PUBLIC;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.gateops_create_account(varchar, char, "Role", varchar, varchar, varchar, varchar, text, varchar, varchar, "Role") TO service_role;
  END IF;
END;
$grant$;

CREATE OR REPLACE FUNCTION public.gateops_update_account(
  p_id text,
  p_username varchar(80),
  p_display_name varchar(160),
  p_nrp varchar(40),
  p_rank varchar(100),
  p_position varchar(160),
  p_actor_user_id text,
  p_actor_username varchar(80),
  p_actor_display_name varchar(160),
  p_actor_role "Role"
)
RETURNS TABLE(
  id text, username varchar(80), role "Role", display_name varchar(160),
  nrp varchar(40), rank varchar(100), position varchar(160),
  must_change_password boolean, created_at timestamp(3), updated_at timestamp(3)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_user users%ROWTYPE;
  changed_fields text := '';
BEGIN
  UPDATE users SET
    username = COALESCE(p_username, username),
    display_name = COALESCE(p_display_name, display_name),
    nrp = COALESCE(NULLIF(p_nrp, ''), nrp),
    rank = COALESCE(NULLIF(p_rank, ''), rank),
    position = COALESCE(NULLIF(p_position, ''), position),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_id
  RETURNING * INTO updated_user;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  changed_fields := trim(both ',' FROM
    (CASE WHEN p_username IS NOT NULL THEN 'username' ELSE '' END) || ',' ||
    (CASE WHEN p_display_name IS NOT NULL THEN 'displayName' ELSE '' END) || ',' ||
    (CASE WHEN p_nrp IS NOT NULL THEN 'nrp' ELSE '' END) || ',' ||
    (CASE WHEN p_rank IS NOT NULL THEN 'rank' ELSE '' END) || ',' ||
    (CASE WHEN p_position IS NOT NULL THEN 'position' ELSE '' END)
  );

  INSERT INTO audit_logs (id, actor_user_id, actor_username, actor_display_name, actor_role,
    action, entity_type, entity_id, metadata, created_at)
  VALUES (gen_random_uuid()::text, p_actor_user_id, p_actor_username, p_actor_display_name, p_actor_role,
    'ACCOUNT_UPDATED', 'ACCOUNT', p_id,
    jsonb_build_object('changed_fields', changed_fields),
    CURRENT_TIMESTAMP);

  RETURN QUERY SELECT updated_user.id, updated_user.username, updated_user.role,
    updated_user.display_name, updated_user.nrp, updated_user.rank, updated_user.position,
    updated_user.must_change_password, updated_user.created_at, updated_user.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.gateops_update_account(text, varchar, varchar, varchar, varchar, varchar, text, varchar, varchar, "Role") FROM PUBLIC;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.gateops_update_account(text, varchar, varchar, varchar, varchar, varchar, text, varchar, varchar, "Role") TO service_role;
  END IF;
END;
$grant$;

CREATE OR REPLACE FUNCTION public.gateops_reset_password(
  p_target_id text,
  p_temporary_password_hash char(64),
  p_actor_user_id text,
  p_actor_username varchar(80),
  p_actor_display_name varchar(160),
  p_actor_role "Role"
)
RETURNS TABLE(
  target_id text, username varchar(80), requires_change boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user users%ROWTYPE;
BEGIN
  SELECT * INTO target_user FROM users WHERE id = p_target_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE users SET password_hash = p_temporary_password_hash, must_change_password = true, updated_at = CURRENT_TIMESTAMP
  WHERE id = p_target_id;

  DELETE FROM sessions WHERE user_id = p_target_id;

  INSERT INTO audit_logs (id, actor_user_id, actor_username, actor_display_name, actor_role,
    action, entity_type, entity_id, metadata, created_at)
  VALUES (gen_random_uuid()::text, p_actor_user_id, p_actor_username, p_actor_display_name, p_actor_role,
    'ACCOUNT_PASSWORD_RESET', 'ACCOUNT', p_target_id,
    jsonb_build_object('sessions_revoked', true, 'must_change_on_next_login', true),
    CURRENT_TIMESTAMP);

  RETURN QUERY SELECT p_target_id, target_user.username, true::boolean;
END;
$$;

REVOKE ALL ON FUNCTION public.gateops_reset_password(text, char, text, varchar, varchar, "Role") FROM PUBLIC;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.gateops_reset_password(text, char, text, varchar, varchar, "Role") TO service_role;
  END IF;
END;
$grant$;
