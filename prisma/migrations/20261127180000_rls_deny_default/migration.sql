-- Baseline RLS: deny-by-default for anon and authenticated roles on all application tables.
-- service_role (used by Edge Functions and Prisma server-side) bypasses RLS.
-- Full RLS strategy with selective policies remains [PENDING] (PRD 25.8).

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Deny all access by default for anon
CREATE POLICY rls_deny_anon_all ON users FOR ALL TO anon USING (false);
CREATE POLICY rls_deny_anon_all ON sessions FOR ALL TO anon USING (false);
CREATE POLICY rls_deny_anon_all ON gates FOR ALL TO anon USING (false);
CREATE POLICY rls_deny_anon_all ON activities FOR ALL TO anon USING (false);
CREATE POLICY rls_deny_anon_all ON audit_logs FOR ALL TO anon USING (false);

-- Deny all access by default for authenticated
CREATE POLICY rls_deny_auth_all ON users FOR ALL TO authenticated USING (false);
CREATE POLICY rls_deny_auth_all ON sessions FOR ALL TO authenticated USING (false);
CREATE POLICY rls_deny_auth_all ON gates FOR ALL TO authenticated USING (false);
CREATE POLICY rls_deny_auth_all ON activities FOR ALL TO authenticated USING (false);
CREATE POLICY rls_deny_auth_all ON audit_logs FOR ALL TO authenticated USING (false);
