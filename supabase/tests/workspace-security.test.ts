import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenant = id(1), otherTenant = id(2), admin = id(3), client = id(4), collaborator = id(5);
const company = id(6), otherCompany = id(7), foreignCompany = id(8);
let db: PGlite;
const migration = (name: string) => readFileSync(resolve("supabase/migrations", name), "utf8");
const asUser = async (userId: string) => {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${userId}', false); SELECT set_config('request.jwt.claim.role', 'authenticated', false); SET ROLE authenticated;`);
};

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text NOT NULL, raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb);
    CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  `);
  await db.exec(migration("20260426000000_baseline_schema.sql"));
  await db.exec(`
    CREATE FUNCTION public.current_user_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE FUNCTION public.current_user_account_type() RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
    CREATE FUNCTION public.current_user_company_id() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE FUNCTION public.can_manage_current_tenant() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE public.invites(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, email text NOT NULL,
      full_name text, account_type text NOT NULL, company_id uuid, token text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'pending', invited_by uuid, accepted_by uuid, accepted_at timestamptz,
      expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'), created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
  `);
  await db.exec(migration("20260828113000_workspace_integration_settings.sql"));
  await db.exec(migration("20260828120000_integration_foundation_v01.sql"));
  await db.exec(migration("20260827100000_fiscal_obligations.sql"));
  // Emulate permissive legacy policies: the new guards must constrain them.
  await db.exec(`
    DO $$ DECLARE t text; BEGIN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('CREATE POLICY legacy_permissive ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
      END LOOP;
      FOREACH t IN ARRAY ARRAY['companies', 'documents', 'tasks', 'payments', 'invoices'] LOOP
        EXECUTE format('CREATE POLICY client_company_scope ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_manage_current_tenant() OR %I = public.current_user_company_id()) WITH CHECK (public.can_manage_current_tenant() OR %I = public.current_user_company_id())', t, CASE WHEN t = 'companies' THEN 'id' ELSE 'company_id' END, CASE WHEN t = 'companies' THEN 'id' ELSE 'company_id' END);
      END LOOP;
    END $$;
    CREATE POLICY legacy_storage_admin ON storage.objects FOR ALL TO authenticated USING (true) WITH CHECK (true);
    GRANT USAGE ON SCHEMA public, auth, storage TO authenticated, anon, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public, storage TO authenticated, service_role;
  `);
  await db.exec(migration("20260917120000_workspace_security_hardening.sql"));
  await db.exec(migration("20260917121000_document_cleanup_access.sql"));
  await db.exec(migration("20260917122000_document_path_integrity.sql"));
  await db.exec(migration("20260917130000_integration_event_engine.sql"));
  await db.exec(migration("20260917131000_domain_event_producers.sql"));
  // The focused fixture skips the historical audit enrichment migration.
  await db.exec("ALTER TABLE public.activity_logs ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL; ALTER TABLE public.activity_logs ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb");
  // Reproduce the historical trigger before the consolidation migration removes it.
  await db.exec(`
    CREATE FUNCTION public.log_activity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM NEW.company_id; RETURN NEW; END $$;
    CREATE TRIGGER audit_companies AFTER INSERT OR UPDATE OR DELETE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.log_activity();
  `);
  await db.exec(migration("20260917133000_registration_and_mutation_integrity.sql"));
  await db.exec(migration("20260917134000_audit_delete_integrity.sql"));
  await db.exec(migration("20260917135000_settings_invites_and_access_management.sql"));
  await db.exec(migration("20260917140000_admin_identity_and_workspace_defaults.sql"));
  await db.exec(migration("20260917141000_invite_delivery_tracking.sql"));
  await db.exec(migration("20260917142000_monthly_service_fee_invoices.sql"));
  await db.exec(migration("20260917143000_profile_avatar_storage.sql"));
  await db.exec(migration("20260917144000_workspace_settings_admin_writes.sql"));
  await db.exec(migration("20260917145000_restore_workspace_reads_and_sync.sql"));
  await db.exec(migration("20260917147000_schedule_monthly_service_fee_invoices.sql"));
  await db.exec(migration("20260917148000_collaborator_permissions.sql"));
  await db.exec(migration("20260917149000_internal_messaging.sql"));
  await db.exec(migration("20260917150000_fix_internal_messaging_guard.sql"));
  await db.exec(migration("20260917151000_message_receipts_and_member_directory.sql"));
  await db.exec(migration("20260917152000_message_notification_deep_links.sql"));
  await db.exec(migration("20260827090000_financial_reconciliation_invoice_sync.sql"));
  await db.exec(migration("20260923120000_client_periods.sql"));
  await db.exec(migration("20260923121000_client_period_steps.sql"));
  await db.exec(migration("20260923122000_operational_checklists.sql"));
  await db.exec(migration("20260923123000_document_requests.sql"));
  await db.exec(migration("20260923124000_document_request_overdue_alerts.sql"));
  await db.exec(migration("20260923125000_task_reviews.sql"));
  await db.exec(migration("20260923126000_fiscal_obligations_by_period.sql"));
  await db.exec(migration("20260923127000_operational_alert_engine.sql"));
  await db.exec(migration("20260923128000_document_status_and_stale_period_alerts.sql"));
  await db.exec(migration("20260923129000_notification_retention.sql"));
  await db.exec(migration("20260923130000_checklist_evidence_documents.sql"));
  await db.exec(migration("20260923131000_client_contracted_services.sql"));
  await db.exec(migration("20260923132000_checklist_item_owner_due_date.sql"));
  await db.exec(migration("20260923133000_workspace_template_overrides.sql"));
  await db.exec(migration("20260923134000_operational_comments.sql"));
  await db.exec(migration("20260923135000_task_blocked_reason.sql"));
  await db.exec(migration("20260924100000_client_email_claim_access.sql"));
  await db.exec(migration("20261109150000_task_delete_permission_fix.sql"));
  await db.exec(migration("20261114100000_normalize_financial_permission_key.sql"));
  await db.exec(migration("20261114140000_period_close_requirements.sql"));
  await db.exec(migration("20261114150000_financial_integrity_guards.sql"));
  await db.exec(migration("20261114160000_payment_cancellation.sql"));
  await db.exec(migration("20261114170000_document_request_integrity.sql"));
  await db.exec(migration("20261114180000_operational_audit_triggers.sql"));
  await db.exec(migration("20261114190000_positive_financial_amounts.sql"));
  // Seed auth identities before enabling the onboarding trigger. The initial
  // workspace fixture below owns their public profile/user records directly.
  await db.exec(`INSERT INTO auth.users(id, email) VALUES ('${admin}', 'admin@example.com'), ('${client}', 'client-owner@example.com'), ('${collaborator}', 'collaborator@example.com')`);
  await db.exec("CREATE TRIGGER trg_audit_companies AFTER INSERT OR UPDATE OR DELETE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.log_entity_activity()");
  await db.exec("CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()");
  await db.exec(`
    INSERT INTO tenants(id, name) VALUES ('${tenant}', 'Office A'), ('${otherTenant}', 'Office B');
    INSERT INTO users(id, tenant_id) VALUES ('${admin}', '${tenant}'), ('${client}', '${tenant}'), ('${collaborator}', '${tenant}');
    INSERT INTO companies(id, tenant_id, name, responsible_user_id) VALUES ('${company}', '${tenant}', 'Client A', '${collaborator}'), ('${otherCompany}', '${tenant}', 'Client B', '${admin}'), ('${foreignCompany}', '${otherTenant}', 'Foreign', NULL);
    INSERT INTO profiles(user_id, tenant_id, company_id, account_type) VALUES ('${admin}', '${tenant}', NULL, 'admin'), ('${client}', '${tenant}', '${company}', 'client'), ('${collaborator}', '${tenant}', NULL, 'collaborator');
    INSERT INTO documents(id, tenant_id, company_id, file_path) VALUES ('${id(9)}', '${tenant}', '${company}', '${tenant}/legacy-a.pdf'), ('${id(10)}', '${tenant}', '${otherCompany}', '${tenant}/legacy-b.pdf'), ('${id(11)}', '${otherTenant}', '${foreignCompany}', '${otherTenant}/foreign.pdf');
    INSERT INTO tasks(id, tenant_id, company_id, assigned_to, title) VALUES ('${id(12)}', '${tenant}', '${company}', '${client}', 'Assigned'), ('${id(13)}', '${tenant}', '${company}', '${admin}', 'Internal'), ('${id(14)}', '${otherTenant}', '${foreignCompany}', NULL, 'Foreign');
    INSERT INTO storage.objects(bucket_id, name) VALUES ('documents', '${tenant}/legacy-a.pdf'), ('documents', '${tenant}/legacy-b.pdf'), ('documents', '${otherTenant}/foreign.pdf');
    INSERT INTO integration_jobs(id, tenant_id, job_type, priority) VALUES ('${id(15)}', '${otherTenant}', 'health_check', 1), ('${id(16)}', '${tenant}', 'health_check', 10);
  `);
}, 60000);

beforeEach(async () => { await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false)"); });
afterAll(async () => { if (db) await db.close(); });

describe("workspace security regression", () => {
  it("scopes office admins despite permissive legacy policies", async () => {
    await asUser(admin);
    expect((await db.query("SELECT id FROM companies")).rows).toHaveLength(2);
    expect((await db.query("SELECT id FROM documents")).rows).toHaveLength(2);
    expect((await db.query("SELECT id FROM tasks")).rows).toHaveLength(2);
    expect((await db.query("SELECT id FROM tenants")).rows).toHaveLength(1);
  });
  it("keeps the legacy role helper usable by RLS without exposing other users' roles", async () => {
    await asUser(admin);
    expect((await db.query<{ is_admin: boolean }>("SELECT public.has_role(auth.uid(), 'admin'::public.app_role) AS is_admin")).rows).toEqual([{ is_admin: true }]);
    await asUser(collaborator);
    expect((await db.query<{ is_admin: boolean; other_is_admin: boolean }>(`SELECT public.has_role(auth.uid(), 'admin'::public.app_role) AS is_admin, public.has_role('${admin}', 'admin'::public.app_role) AS other_is_admin`)).rows).toEqual([{ is_admin: false, other_is_admin: false }]);
    expect((await db.query("SELECT id FROM companies")).rows).toHaveLength(2);
  });
  it("scopes clients to their company and assigned tasks", async () => {
    await asUser(client);
    expect((await db.query("SELECT id FROM companies")).rows).toHaveLength(1);
    expect((await db.query("SELECT id FROM documents")).rows).toHaveLength(1);
    expect((await db.query("SELECT id FROM tasks")).rows).toEqual([{ id: id(12) }]);
  });
  it("prevents clients listing, overwriting or deleting other companies' files", async () => {
    await asUser(client);
    expect((await db.query("SELECT name FROM storage.objects")).rows).toEqual([{ name: `${tenant}/legacy-a.pdf` }]);
    expect((await db.query("UPDATE storage.objects SET name = 'replaced' RETURNING id")).rows).toHaveLength(0);
    expect((await db.query("DELETE FROM storage.objects RETURNING id")).rows).toHaveLength(0);
  });
  it("allows own-company upload and cleanup of unregistered files", async () => {
    await asUser(client);
    const path = `${tenant}/${company}/${client}/orphan.pdf`;
    await db.query("INSERT INTO storage.objects(bucket_id, name) VALUES ('documents', $1)", [path]);
    expect((await db.query("DELETE FROM storage.objects WHERE name = $1 RETURNING name", [path])).rows).toHaveLength(1);
    await expect(db.query("INSERT INTO storage.objects(bucket_id, name) VALUES ('documents', $1)", [`${tenant}/${otherCompany}/${client}/bad.pdf`])).rejects.toThrow();
  });
  it("lets office staff clean orphaned files uploaded by another staff member", async () => {
    const path = `${tenant}/unassigned/${collaborator}/cleanup.pdf`;
    await db.query("INSERT INTO storage.objects(bucket_id, name) VALUES ('documents', $1)", [path]);
    await asUser(admin);
    expect((await db.query("DELETE FROM storage.objects WHERE name = $1 RETURNING name", [path])).rows).toHaveLength(1);
  });
  it("protects task content and permits assigned status changes", async () => {
    await asUser(client);
    await expect(db.query(`UPDATE tasks SET title = 'Changed' WHERE id = '${id(12)}'`)).rejects.toThrow(/only update assigned task status/);
    expect((await db.query(`UPDATE tasks SET status = 'completed' WHERE id = '${id(12)}' RETURNING id`)).rows).toHaveLength(1);
  });
  it("blocks cross-tenant foreign keys", async () => {
    await asUser(admin);
    await expect(db.query(`INSERT INTO documents(tenant_id, company_id) VALUES ('${tenant}', '${foreignCompany}')`)).rejects.toThrow(/Invalid workspace reference/);
  });
  it("prevents clients forging metadata to access another company's file", async () => {
    await asUser(client);
    await expect(db.query(`INSERT INTO documents(tenant_id, company_id, uploaded_by, file_path) VALUES ('${tenant}', '${company}', '${client}', '${tenant}/legacy-b.pdf')`)).rejects.toThrow(/only register their own company uploads/);
    const path = `${tenant}/${company}/${client}/own.pdf`;
    await db.query(`INSERT INTO documents(tenant_id, company_id, uploaded_by, file_path) VALUES ('${tenant}', '${company}', '${client}', $1)`, [path]);
  });
  it("prevents office admins forging paths into another workspace", async () => {
    await asUser(admin);
    await expect(db.query(`INSERT INTO documents(tenant_id, company_id, file_path) VALUES ('${tenant}', '${company}', '${otherTenant}/foreign.pdf')`)).rejects.toThrow(/path belongs to another workspace/);
  });
  it("rejects a message linked to another company's conversation", async () => {
    await db.query(`INSERT INTO conversations(id, tenant_id, company_id) VALUES ('${id(20)}', '${tenant}', '${otherCompany}')`);
    await asUser(client);
    await expect(db.query(`INSERT INTO messages(tenant_id, company_id, conversation_id, sender_id, message) VALUES ('${tenant}', '${company}', '${id(20)}', '${client}', 'Injected')`)).rejects.toThrow(/Invalid company reference/);
  });
  it("protects document metadata while allowing read receipts", async () => {
    await asUser(client);
    await expect(db.query(`UPDATE documents SET amount = 999 WHERE id = '${id(9)}'`)).rejects.toThrow(/only mark documents as read/);
    expect((await db.query(`UPDATE documents SET status = 'read', read_at = now() WHERE id = '${id(9)}' RETURNING id`)).rows).toHaveLength(1);
  });
  it("removes the obsolete audit trigger so company writes remain valid", async () => {
    expect((await db.query("SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.companies'::regclass AND tgname = 'audit_companies'")).rows).toHaveLength(0);
    await db.query(`UPDATE companies SET name = 'Client A updated' WHERE id = '${company}'`);
  });
  it("cannot re-parent a document with a stored file", async () => {
    await asUser(admin);
    await expect(db.query(`UPDATE documents SET company_id = '${otherCompany}' WHERE id = '${id(9)}'`)).rejects.toThrow(/Move the stored file/);
  });
  it("archives client companies instead of letting authenticated users delete history", async () => {
    await asUser(admin);
    await expect(db.query(`DELETE FROM companies WHERE id = '${otherCompany}'`)).rejects.toThrow(/archived instead of deleted/);
    expect((await db.query(`UPDATE companies SET status = 'inactive' WHERE id = '${otherCompany}' RETURNING id`)).rows).toHaveLength(1);
    expect((await db.query(`SELECT id FROM documents WHERE company_id = '${otherCompany}'`)).rows).toHaveLength(1);
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false)");
    await db.query(`UPDATE companies SET status = 'active' WHERE id = '${otherCompany}'`);
  });
  it("keeps an audit event when a service maintenance task removes an empty company", async () => {
    const emptyCompany = id(35);
    await db.query(`INSERT INTO companies(id, tenant_id, name) VALUES ('${emptyCompany}', '${tenant}', 'Empty')`);
    await db.query(`DELETE FROM companies WHERE id = '${emptyCompany}'`);
    expect((await db.query<{ company_id: string | null; deleted_company_id: string }>(`SELECT company_id, metadata->>'deleted_company_id' AS deleted_company_id FROM activity_logs WHERE entity_id = '${emptyCompany}' AND action = 'deleted'`)).rows).toEqual([{ company_id: null, deleted_company_id: emptyCompany }]);
  });
  it("normalizes CNPJ and rejects duplicates in the same workspace", async () => {
    const cnpjCompany = id(30), duplicateCompany = id(31);
    await db.query(`INSERT INTO companies(id, tenant_id, name, cnpj) VALUES ('${cnpjCompany}', '${tenant}', 'CNPJ A', '12.345.678/0001-95')`);
    expect((await db.query<{ cnpj: string }>(`SELECT cnpj FROM companies WHERE id = '${cnpjCompany}'`)).rows[0].cnpj).toBe("12345678000195");
    await expect(db.query(`INSERT INTO companies(id, tenant_id, name, cnpj) VALUES ('${duplicateCompany}', '${tenant}', 'CNPJ B', '12345678000195')`)).rejects.toThrow();
  });
  it("keeps legacy roles synchronized with the canonical profile", async () => {
    await db.query(`UPDATE profiles SET account_type = 'collaborator' WHERE user_id = '${client}'`);
    expect((await db.query<{ role: string }>(`SELECT role::text AS role FROM user_roles WHERE user_id = '${client}'`)).rows).toEqual([{ role: "collaborator" }]);
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false)");
    await db.query(`UPDATE profiles SET account_type = 'client' WHERE user_id = '${client}'`);
  });
  it("keeps internal conversations private and routes client messages only to the assigned responsible member", async () => {
    const conversationId = id(37);
    await asUser(admin);
    await db.query(`INSERT INTO conversations(id, tenant_id, channel, created_by, recipient_id) VALUES ('${conversationId}', '${tenant}', 'internal', '${admin}', '${collaborator}')`);
    await db.query(`INSERT INTO messages(tenant_id, conversation_id, sender_id, message) VALUES ('${tenant}', '${conversationId}', '${admin}', 'Private update')`);
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false)");
    expect((await db.query(`SELECT id FROM user_notifications WHERE user_id = '${collaborator}'`)).rows).toHaveLength(1);
    await asUser(client);
    expect((await db.query("SELECT id FROM conversations")).rows).toHaveLength(0);
    await db.query(`INSERT INTO conversations(tenant_id, company_id, channel, created_by, recipient_id) VALUES ('${tenant}', '${company}', 'internal', '${client}', '${collaborator}')`);
    await expect(db.query(`INSERT INTO conversations(tenant_id, company_id, channel, created_by, recipient_id) VALUES ('${tenant}', '${company}', 'internal', '${client}', '${admin}')`)).rejects.toThrow(/assigned responsible/);
  });
  it("marks a conversation read and clears its matching message notification", async () => {
    const recipient = id(38);
    const conversationId = id(39);
    const inviteId = id(40);
    await db.query(`INSERT INTO invites(id, tenant_id, email, account_type, token) VALUES ('${inviteId}', '${tenant}', 'receipt@example.com', 'collaborator', 'receipt-invite')`);
    await db.query("INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES ($1, $2, $3)", [recipient, "receipt@example.com", JSON.stringify({ invite_token: "receipt-invite" })]);
    await asUser(admin);
    await db.query(`INSERT INTO conversations(id, tenant_id, channel, created_by, recipient_id) VALUES ('${conversationId}', '${tenant}', 'internal', '${admin}', '${recipient}')`);
    const inserted = await db.query<{ id: string }>(`INSERT INTO messages(tenant_id, conversation_id, sender_id, message) VALUES ('${tenant}', '${conversationId}', '${admin}', 'Read me') RETURNING id`);
    await asUser(recipient);
    expect((await db.query(`SELECT public.mark_internal_conversation_read('${conversationId}') AS marked`)).rows).toEqual([{ marked: 1 }]);
    expect((await db.query<{ read_at: string | null }>(`SELECT read_at FROM messages WHERE id = '${inserted.rows[0].id}'`)).rows[0].read_at).not.toBeNull();
    expect((await db.query<{ read_at: string | null }>(`SELECT read_at FROM user_notifications WHERE user_id = '${recipient}' AND metadata ->> 'conversation_id' = '${conversationId}'`)).rows[0].read_at).not.toBeNull();
  });
  it("exposes only safe directory fields to a client and lets active users save their own avatar", async () => {
    await asUser(client);
    const directory = await db.query<{ user_id: string; avatar_url: string | null }>("SELECT * FROM public.list_workspace_member_directory()");
    expect(directory.rows.map((row) => row.user_id)).toEqual([collaborator]);
    await db.query("SELECT public.update_own_avatar($1)", ["https://example.supabase.co/storage/v1/object/public/avatars/client/avatar.png"]);
    expect((await db.query<{ avatar_url: string | null }>(`SELECT avatar_url FROM profiles WHERE user_id = '${client}'`)).rows[0].avatar_url).toContain("avatars/client/avatar.png");
  });
  it("does not allow an internal member to become a client account", async () => {
    await asUser(admin);
    await expect(db.query(`UPDATE profiles SET account_type = 'client' WHERE user_id = '${collaborator}'`)).rejects.toThrow(/only be a collaborator or administrator/);
  });
  it("rejects an invalid invitation instead of creating an unintended workspace", async () => {
    const invalidUser = id(32);
    await expect(db.query("INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES ($1, $2, $3)", [invalidUser, "invalid@example.com", JSON.stringify({ invite_token: "not-a-real-invite", account_type: "client" })])).rejects.toThrow(/Invitation is invalid/);
    expect((await db.query("SELECT id FROM profiles WHERE user_id = $1", [invalidUser])).rows).toHaveLength(0);
  });
  it("uses a valid client invitation to create the intended profile and role", async () => {
    const invitedUser = id(33), inviteId = id(34);
    await db.query(`INSERT INTO invites(id, tenant_id, email, account_type, company_id, token) VALUES ('${inviteId}', '${tenant}', 'client@example.com', 'client', '${company}', 'valid-client-invite')`);
    await db.query("INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES ($1, $2, $3)", [invitedUser, "client@example.com", JSON.stringify({ invite_token: "valid-client-invite", account_type: "admin" })]);
    expect((await db.query<{ tenant_id: string; company_id: string; account_type: string }>("SELECT tenant_id, company_id, account_type FROM profiles WHERE user_id = $1", [invitedUser])).rows[0]).toMatchObject({ tenant_id: tenant, company_id: company, account_type: "client" });
    expect((await db.query<{ role: string }>("SELECT role::text AS role FROM user_roles WHERE user_id = $1", [invitedUser])).rows).toEqual([{ role: "client" }]);
  });

  it("does not create a new workspace when a client requests email-based access", async () => {
    const claimUser = id(35);
    const before = await db.query<{ count: string }>("SELECT count(*) FROM tenants");
    await db.query("INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES ($1, $2, $3)", [
      claimUser,
      "client-claim@example.com",
      JSON.stringify({ account_type: "client", client_claim: true, full_name: "Cliente Claim" }),
    ]);
    expect((await db.query("SELECT user_id FROM profiles WHERE user_id = $1", [claimUser])).rows).toHaveLength(0);
    expect((await db.query<{ count: string }>("SELECT count(*) FROM tenants")).rows[0]).toEqual(before.rows[0]);
  });
  it("does not let collaborators read or manage invitations", async () => {
    await asUser(collaborator);
    expect((await db.query("SELECT id FROM invites")).rows).toHaveLength(0);
    await expect(db.query(`INSERT INTO invites(tenant_id, email, account_type, token) VALUES ('${tenant}', 'blocked@example.com', 'collaborator', 'blocked-invite')`)).rejects.toThrow();
  });
  it("lets an administrator create an invitation inside their own workspace", async () => {
    await asUser(admin);
    expect((await db.query(`INSERT INTO invites(tenant_id, email, account_type, token) VALUES ('${tenant}', 'new-collaborator@example.com', 'collaborator', 'admin-created-invite') RETURNING id`)).rows).toHaveLength(1);
  });
  it("creates settings for new workspaces and reserves identity updates for admins", async () => {
    const newTenant = id(36);
    await db.query(`INSERT INTO tenants(id, name) VALUES ('${newTenant}', 'New Office')`);
    expect((await db.query<{ office_name: string }>(`SELECT office_name FROM workspace_settings WHERE tenant_id = '${newTenant}'`)).rows).toEqual([{ office_name: "New Office" }]);
    await asUser(collaborator);
    expect((await db.query(`SELECT tenant_id FROM workspace_settings WHERE tenant_id = '${tenant}'`)).rows).toHaveLength(1);
    expect((await db.query(`UPDATE workspace_settings SET office_name = 'Blocked' WHERE tenant_id = '${tenant}' RETURNING tenant_id`)).rows).toHaveLength(0);
    expect((await db.query(`UPDATE profiles SET full_name = 'Changed' WHERE user_id = '${collaborator}' RETURNING user_id`)).rows).toHaveLength(0);
    await asUser(admin);
    expect((await db.query(`UPDATE profiles SET full_name = 'Office Admin' WHERE user_id = '${admin}' RETURNING user_id`)).rows).toHaveLength(1);
  });
  it("generates one monthly service-fee invoice per active client without duplicates", async () => {
    await asUser(admin);
    await db.query(`UPDATE companies SET service_fee = 500, status = 'active' WHERE id = '${company}'`);
    const first = await db.query(`SELECT id FROM generate_monthly_service_fee_invoices('2026-09-01')`);
    expect(first.rows).toHaveLength(1);
    expect((await db.query(`SELECT id FROM generate_monthly_service_fee_invoices('2026-09-01')`)).rows).toHaveLength(0);
  });
  it("lets only the scheduler generate idempotent fees across workspaces", async () => {
    await asUser(admin);
    await expect(db.query("SELECT * FROM generate_service_fee_invoices_for_all_workspaces('2026-10-01')")).rejects.toThrow(/permission denied/);
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false)");
    await db.query(`UPDATE companies SET service_fee = 750, status = 'active' WHERE id = '${otherCompany}'`);
    const first = await db.query<{ invoices_created: number }>("SELECT * FROM generate_service_fee_invoices_for_all_workspaces('2026-10-01')");
    expect(first.rows.reduce((total, row) => total + row.invoices_created, 0)).toBeGreaterThan(0);
    const second = await db.query<{ invoices_created: number }>("SELECT * FROM generate_service_fee_invoices_for_all_workspaces('2026-10-01')");
    expect(second.rows.reduce((total, row) => total + row.invoices_created, 0)).toBe(0);
  });
  it("persists collaborator permissions and uses them to restrict financial writes", async () => {
    await asUser(collaborator);
    expect((await db.query("SELECT * FROM workspace_member_permissions WHERE user_id = auth.uid()")).rows).toHaveLength(1);
    expect((await db.query("SELECT public.has_workspace_permission('tasks', 'create') AS allowed")).rows).toEqual([{ allowed: true }]);
    expect((await db.query("SELECT public.has_workspace_permission('financial', 'create') AS allowed")).rows).toEqual([{ allowed: false }]);
    await expect(db.query(`INSERT INTO payments(tenant_id, company_id, amount, direction, status) VALUES ('${tenant}', '${company}', 100, 'income', 'pending')`)).rejects.toThrow();
    await asUser(admin);
    await db.query(`UPDATE workspace_member_permissions SET permissions = jsonb_set(permissions, '{financial,create}', 'true'::jsonb) WHERE tenant_id = '${tenant}' AND user_id = '${collaborator}'`);
    await asUser(collaborator);
    expect((await db.query("SELECT public.has_workspace_permission('financial', 'create') AS allowed")).rows).toEqual([{ allowed: true }]);
  });
  it("keeps legacy payment permission data aligned with the financial resource", async () => {
    await asUser(admin);
    await db.query(`UPDATE workspace_member_permissions SET permissions = (permissions - 'financial') || jsonb_build_object('payments', jsonb_build_object('read', true, 'create', true, 'update', false, 'delete', false)) WHERE tenant_id = '${tenant}' AND user_id = '${collaborator}'`);
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false)");
    const permission = await db.query<{ has_financial: boolean; has_payments: boolean }>(`SELECT (permissions ? 'financial') AS has_financial, (permissions ? 'payments') AS has_payments FROM workspace_member_permissions WHERE tenant_id = '${tenant}' AND user_id = '${collaborator}'`);
    expect(permission.rows).toEqual([{ has_financial: false, has_payments: true }]);

    await db.exec(migration("20261114100000_normalize_financial_permission_key.sql"));
    const normalized = await db.query<{ has_financial: boolean; has_payments: boolean; can_create: boolean }>(`SELECT (permissions ? 'financial') AS has_financial, (permissions ? 'payments') AS has_payments, public.has_workspace_permission('financial', 'create') AS can_create FROM workspace_member_permissions WHERE tenant_id = '${tenant}' AND user_id = '${collaborator}'`);
    expect(normalized.rows).toEqual([{ has_financial: true, has_payments: false, can_create: true }]);
  });
  it("allows collaborator task deletion only when the task permission is enabled", async () => {
    const taskId = id(60);
    await asUser(admin);
    await db.query(
      `INSERT INTO tasks(id, tenant_id, company_id, assigned_to, title, status)
       VALUES ('${taskId}', '${tenant}', '${company}', '${collaborator}', 'Tarefa removível', 'pending')`,
    );

    await asUser(collaborator);
    expect((await db.query(`DELETE FROM tasks WHERE id = '${taskId}' RETURNING id`)).rows).toHaveLength(0);

    await asUser(admin);
    await db.query(`UPDATE workspace_member_permissions SET permissions = jsonb_set(permissions, '{tasks,delete}', 'true'::jsonb) WHERE tenant_id = '${tenant}' AND user_id = '${collaborator}'`);

    await asUser(collaborator);
    expect((await db.query(`DELETE FROM tasks WHERE id = '${taskId}' RETURNING id`)).rows).toEqual([{ id: taskId }]);
  });
  it("scopes monthly client periods to the workspace and client company", async () => {
    await asUser(admin);
    await db.query(`UPDATE companies SET status = 'active' WHERE id IN ('${company}', '${otherCompany}')`);
    await db.query(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 1, 2030, '${collaborator}', '${admin}')`);
    await db.query(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${otherCompany}', 1, 2030, '${admin}', '${admin}')`);
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false)");
    await db.query(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year) VALUES ('${otherTenant}', '${foreignCompany}', 1, 2030)`);

    await asUser(admin);
    expect((await db.query("SELECT id FROM client_periods ORDER BY company_id")).rows).toHaveLength(2);
    await asUser(client);
    expect((await db.query<{ company_id: string }>("SELECT company_id FROM client_periods")).rows).toEqual([{ company_id: company }]);
    expect((await db.query("SELECT id FROM client_period_steps")).rows).toHaveLength(6);
  });
  it("creates monthly period steps and recalculates progress from completed steps", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 3, 2030, '${collaborator}', '${admin}') RETURNING id`);
    const periodId = period.rows[0].id;
    expect((await db.query("SELECT id FROM client_period_steps WHERE client_period_id = $1", [periodId])).rows).toHaveLength(6);
    await db.query("UPDATE client_period_steps SET status = 'completed' WHERE client_period_id = $1 AND step_key = 'documents'", [periodId]);
    expect((await db.query<{ progress_percent: number; status: string }>("SELECT progress_percent, status FROM client_periods WHERE id = $1", [periodId])).rows[0]).toMatchObject({ progress_percent: 17, status: "in_progress" });
    await db.query("UPDATE client_period_steps SET status = 'completed' WHERE client_period_id = $1", [periodId]);
    expect((await db.query<{ progress_percent: number; status: string; closed_at: string | null }>("SELECT progress_percent, status, closed_at FROM client_periods WHERE id = $1", [periodId])).rows[0]).toMatchObject({ progress_percent: 100, status: "in_progress", closed_at: null });
  });
  it("generates checklist tasks by tax regime and keeps generation idempotent", async () => {
    await asUser(admin);
    await db.query(`UPDATE companies SET tax_regime = 'simples_nacional', status = 'active' WHERE id = '${company}'`);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 4, 2030, '${collaborator}', '${admin}') RETURNING id`);
    const periodId = period.rows[0].id;
    expect((await db.query("SELECT id FROM client_period_checklist_items WHERE client_period_id = $1", [periodId])).rows).toHaveLength(3);
    expect((await db.query("SELECT task_id FROM client_period_checklist_items WHERE client_period_id = $1 AND task_id IS NOT NULL", [periodId])).rows).toHaveLength(3);
    expect((await db.query<{ create_checklist_for_client_period: number }>("SELECT public.create_checklist_for_client_period($1)", [periodId])).rows[0].create_checklist_for_client_period).toBe(0);
  });
  it("syncs generated task completion back to checklist progress", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 5, 2030, '${collaborator}', '${admin}') RETURNING id`);
    const generated = await db.query<{ task_id: string }>("SELECT task_id FROM client_period_checklist_items WHERE client_period_id = $1 AND task_id IS NOT NULL ORDER BY sort_order LIMIT 1", [period.rows[0].id]);
    await db.query("UPDATE tasks SET status = 'completed' WHERE id = $1", [generated.rows[0].task_id]);
    expect((await db.query<{ status: string }>("SELECT status FROM client_period_checklist_items WHERE task_id = $1", [generated.rows[0].task_id])).rows[0]).toEqual({ status: "completed" });
    expect((await db.query<{ progress_percent: number; status: string }>("SELECT progress_percent, status FROM client_periods WHERE id = $1", [period.rows[0].id])).rows[0]).toMatchObject({ progress_percent: 33, status: "in_progress" });
  });
  it("links checklist evidence only when the document belongs to the same company", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 6, 2042, '${collaborator}', '${admin}') RETURNING id`);
    const item = await db.query<{ id: string }>(
      "SELECT id FROM client_period_checklist_items WHERE client_period_id = $1 AND requires_document = true LIMIT 1",
      [period.rows[0].id],
    );
    const documentId = id(49);
    await db.query(`INSERT INTO documents(id, tenant_id, company_id, file_path) VALUES ('${documentId}', '${tenant}', '${company}', '${tenant}/${company}/evidence.pdf')`);

    await db.query("UPDATE client_period_checklist_items SET document_id = $1 WHERE id = $2", [documentId, item.rows[0].id]);
    expect((await db.query<{ document_id: string | null }>("SELECT document_id FROM client_period_checklist_items WHERE id = $1", [item.rows[0].id])).rows[0]).toEqual({ document_id: documentId });
    await expect(db.query("UPDATE client_period_checklist_items SET document_id = $1 WHERE id = $2", [id(10), item.rows[0].id])).rejects.toThrow(/same workspace and company/);
  });
  it("updates checklist item planning and syncs the linked task", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 7, 2042, '${collaborator}', '${admin}') RETURNING id`);
    const item = await db.query<{ id: string; task_id: string }>(
      "SELECT id, task_id FROM client_period_checklist_items WHERE client_period_id = $1 AND task_id IS NOT NULL LIMIT 1",
      [period.rows[0].id],
    );

    await expect(db.query("UPDATE client_period_checklist_items SET assigned_to = $1 WHERE id = $2", [client, item.rows[0].id])).rejects.toThrow(/active internal workspace member/);
    await db.query("UPDATE client_period_checklist_items SET assigned_to = $1, due_date = '2042-07-22' WHERE id = $2", [admin, item.rows[0].id]);

    expect((await db.query<{ assigned_to: string | null; due_date: string }>("SELECT assigned_to, due_date::text AS due_date FROM client_period_checklist_items WHERE id = $1", [item.rows[0].id])).rows[0]).toEqual({ assigned_to: admin, due_date: "2042-07-22" });
    expect((await db.query<{ assigned_to: string | null; due_date: string }>("SELECT assigned_to, due_date::date::text AS due_date FROM tasks WHERE id = $1", [item.rows[0].task_id])).rows[0]).toEqual({ assigned_to: admin, due_date: "2042-07-22" });
  });
  it("routes critical checklist tasks through review before completion", async () => {
    await asUser(admin);
    await db.query(`UPDATE companies SET tax_regime = 'simples_nacional', status = 'active' WHERE id = '${company}'`);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 9, 2030, '${collaborator}', '${admin}') RETURNING id`);
    const reviewItem = await db.query<{ id: string; task_id: string }>(
      "SELECT id, task_id FROM client_period_checklist_items WHERE client_period_id = $1 AND requires_review = true AND task_id IS NOT NULL ORDER BY sort_order LIMIT 1",
      [period.rows[0].id],
    );

    await db.query("UPDATE tasks SET status = 'completed' WHERE id = $1", [reviewItem.rows[0].task_id]);
    expect((await db.query<{ status: string }>("SELECT status FROM client_period_checklist_items WHERE id = $1", [reviewItem.rows[0].id])).rows[0]).toEqual({ status: "in_review" });
    expect((await db.query<{ status: string; completed_at: string | null }>("SELECT status, completed_at FROM tasks WHERE id = $1", [reviewItem.rows[0].task_id])).rows[0]).toMatchObject({ status: "in_progress", completed_at: null });
    expect((await db.query<{ status: string }>("SELECT status FROM task_reviews WHERE task_id = $1", [reviewItem.rows[0].task_id])).rows).toEqual([{ status: "pending_review" }]);
    await expect(db.query("UPDATE client_periods SET status = 'closed' WHERE id = $1", [period.rows[0].id])).rejects.toThrow(/pending task reviews/);

    await db.query("UPDATE task_reviews SET status = 'approved', reviewer_id = $1, comment = 'Conferido' WHERE task_id = $2", [admin, reviewItem.rows[0].task_id]);
    expect((await db.query<{ status: string }>("SELECT status FROM client_period_checklist_items WHERE id = $1", [reviewItem.rows[0].id])).rows[0]).toEqual({ status: "completed" });
    expect((await db.query<{ status: string; completed_at: string | null }>("SELECT status, completed_at FROM tasks WHERE id = $1", [reviewItem.rows[0].task_id])).rows[0].status).toBe("completed");
  });
  it("records review rejection and returns the task to execution", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 10, 2030, '${collaborator}', '${admin}') RETURNING id`);
    const reviewItem = await db.query<{ id: string; task_id: string }>(
      "SELECT id, task_id FROM client_period_checklist_items WHERE client_period_id = $1 AND requires_review = true AND task_id IS NOT NULL ORDER BY sort_order LIMIT 1",
      [period.rows[0].id],
    );
    await db.query("UPDATE client_period_checklist_items SET status = 'in_review' WHERE id = $1", [reviewItem.rows[0].id]);
    await db.query("UPDATE task_reviews SET status = 'rejected', reviewer_id = $1, comment = 'Corrigir apuracao' WHERE task_id = $2", [admin, reviewItem.rows[0].task_id]);

    expect((await db.query<{ status: string }>("SELECT status FROM client_period_checklist_items WHERE id = $1", [reviewItem.rows[0].id])).rows[0]).toEqual({ status: "in_progress" });
    expect((await db.query<{ status: string; completed_at: string | null }>("SELECT status, completed_at FROM tasks WHERE id = $1", [reviewItem.rows[0].task_id])).rows[0]).toMatchObject({ status: "in_progress", completed_at: null });
    expect((await db.query<{ status: string; comment: string }>("SELECT status, comment FROM task_reviews WHERE task_id = $1", [reviewItem.rows[0].task_id])).rows[0]).toEqual({ status: "rejected", comment: "Corrigir apuracao" });
  });
  it("generates fiscal obligations with linked tasks when a monthly period starts", async () => {
    await asUser(admin);
    await db.query(`UPDATE companies SET tax_regime = 'simples_nacional', status = 'active' WHERE id = '${company}'`);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 11, 2030, '${collaborator}', '${admin}') RETURNING id`);

    const obligations = await db.query<{ name: string; task_id: string | null; client_period_id: string; requires_evidence: boolean }>(
      "SELECT name, task_id, client_period_id, requires_evidence FROM fiscal_obligations WHERE client_period_id = $1 ORDER BY name",
      [period.rows[0].id],
    );
    expect(obligations.rows.map((row) => row.name).sort()).toEqual(["Conferencia PGDAS", "DAS - Simples Nacional"].sort());
    expect(obligations.rows.every((row) => row.client_period_id === period.rows[0].id && row.task_id)).toBe(true);
    expect((await db.query<{ create_fiscal_obligations_for_client_period: number }>("SELECT public.create_fiscal_obligations_for_client_period($1)", [period.rows[0].id])).rows[0].create_fiscal_obligations_for_client_period).toBe(0);
  });
  it("syncs fiscal obligation task completion and requires evidence when configured", async () => {
    await asUser(admin);
    await db.query(`UPDATE companies SET tax_regime = 'simples_nacional', status = 'active' WHERE id = '${company}'`);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 12, 2030, '${collaborator}', '${admin}') RETURNING id`);
    const evidenceRequired = await db.query<{ id: string; task_id: string }>(
      "SELECT id, task_id FROM fiscal_obligations WHERE client_period_id = $1 AND requires_evidence = true LIMIT 1",
      [period.rows[0].id],
    );
    await expect(db.query("UPDATE tasks SET status = 'completed' WHERE id = $1", [evidenceRequired.rows[0].task_id])).rejects.toThrow(/requires evidence/);

    const docId = id(42);
    await db.query(`INSERT INTO documents(id, tenant_id, company_id, file_path) VALUES ('${docId}', '${tenant}', '${company}', '${tenant}/${company}/${admin}/das.pdf')`);
    await db.query("UPDATE fiscal_obligations SET document_id = $1 WHERE id = $2", [docId, evidenceRequired.rows[0].id]);
    await db.query("UPDATE tasks SET status = 'completed' WHERE id = $1", [evidenceRequired.rows[0].task_id]);
    expect((await db.query<{ status: string; completed_at: string | null }>("SELECT status, completed_at FROM fiscal_obligations WHERE id = $1", [evidenceRequired.rows[0].id])).rows[0]).toMatchObject({ status: "completed" });
  });
  it("creates internal alerts for due fiscal obligations and clears them when completed", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 1, 2040, '${collaborator}', '${admin}') RETURNING id`);
    const obligation = await db.query<{ id: string }>(
      `INSERT INTO fiscal_obligations(tenant_id, company_id, client_period_id, name, due_date, period_month, period_year, created_by) VALUES ('${tenant}', '${company}', '${period.rows[0].id}', 'Obrigacao vencida controlada', '2000-01-01', 1, 2040, '${admin}') RETURNING id`,
    );

    await asUser(collaborator);
    const alert = await db.query<{ user_id: string; read_at: string | null; href: string }>(
      "SELECT user_id, read_at, href FROM user_notifications WHERE kind = 'fiscal_obligation_due' AND metadata ->> 'fiscal_obligation_id' = $1",
      [obligation.rows[0].id],
    );
    expect(alert.rows).toEqual([{ user_id: collaborator, read_at: null, href: "/reports" }]);

    await asUser(admin);
    await db.query("UPDATE fiscal_obligations SET status = 'completed' WHERE id = $1", [obligation.rows[0].id]);
    await asUser(collaborator);
    expect((await db.query<{ read_at: string | null }>(
      "SELECT read_at FROM user_notifications WHERE kind = 'fiscal_obligation_due' AND metadata ->> 'fiscal_obligation_id' = $1",
      [obligation.rows[0].id],
    )).rows[0].read_at).not.toBeNull();
  });
  it("uses different checklist titles for MEI and Simples Nacional", async () => {
    await asUser(admin);
    await db.query(`UPDATE companies SET tax_regime = 'mei', status = 'active' WHERE id = '${otherCompany}'`);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${otherCompany}', 4, 2030, '${admin}', '${admin}') RETURNING id`);
    const titles = await db.query<{ title: string }>("SELECT title FROM client_period_checklist_items WHERE client_period_id = $1 ORDER BY sort_order", [period.rows[0].id]);
    expect(titles.rows.map((row) => row.title)).toContain("Conferir faturamento MEI");
    expect(titles.rows.map((row) => row.title)).not.toContain("Apurar receita e anexos do Simples");
  });
  it("uses contracted service areas to limit generated checklist items and obligations", async () => {
    await asUser(admin);
    await db.query(`UPDATE companies SET tax_regime = 'mei', status = 'active', service_areas = ARRAY['fiscal']::text[] WHERE id = '${otherCompany}'`);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${otherCompany}', 5, 2042, '${admin}', '${admin}') RETURNING id`);

    const checklistTitles = await db.query<{ title: string }>("SELECT title FROM client_period_checklist_items WHERE client_period_id = $1 ORDER BY sort_order", [period.rows[0].id]);
    expect(checklistTitles.rows.map((row) => row.title)).toContain("Conferir faturamento MEI");
    expect(checklistTitles.rows.map((row) => row.title)).not.toContain("Arquivar evidencias MEI");

    const obligationNames = await db.query<{ name: string }>("SELECT name FROM fiscal_obligations WHERE client_period_id = $1 ORDER BY name", [period.rows[0].id]);
    expect(obligationNames.rows.map((row) => row.name)).toContain("DAS-MEI");
    expect(obligationNames.rows.map((row) => row.name)).not.toContain("Relatorio mensal MEI");
  });
  it("lets admins clone checklist templates and uses workspace overrides for new periods", async () => {
    await asUser(admin);
    const cloned = await db.query<{ clone_operational_checklist_template: string }>(
      "SELECT public.clone_operational_checklist_template($1)",
      ["10000000-0000-4000-8000-000000000001"],
    );
    const clonedTemplateId = cloned.rows[0].clone_operational_checklist_template;
    expect(clonedTemplateId).toBeTruthy();

    await db.query(
      "UPDATE operational_checklist_items SET title = 'Conferir faturamento MEI - regra do escritorio', default_due_day = 7 WHERE template_id = $1 AND title = 'Conferir faturamento MEI'",
      [clonedTemplateId],
    );
    await db.query(`UPDATE companies SET tax_regime = 'mei', status = 'active', service_areas = ARRAY['fiscal']::text[] WHERE id = '${otherCompany}'`);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${otherCompany}', 8, 2042, '${admin}', '${admin}') RETURNING id`);

    const items = await db.query<{ title: string; due_date: string }>(
      "SELECT title, due_date::text AS due_date FROM client_period_checklist_items WHERE client_period_id = $1 ORDER BY sort_order, title",
      [period.rows[0].id],
    );
    expect(items.rows.map((row) => row.title)).toContain("Conferir faturamento MEI - regra do escritorio");
    expect(items.rows.map((row) => row.title)).not.toContain("Conferir faturamento MEI");
    expect(items.rows.find((row) => row.title === "Conferir faturamento MEI - regra do escritorio")?.due_date).toBe("2042-08-07");
  });
  it("lets admins clone fiscal obligation templates and disable a workspace override", async () => {
    await asUser(admin);
    const cloned = await db.query<{ clone_fiscal_obligation_template: string }>(
      "SELECT public.clone_fiscal_obligation_template($1)",
      ["10000000-0000-4000-8100-000000000001"],
    );
    const clonedTemplateId = cloned.rows[0].clone_fiscal_obligation_template;
    expect(clonedTemplateId).toBeTruthy();

    await db.query("UPDATE fiscal_obligation_templates SET active = false WHERE id = $1", [clonedTemplateId]);
    await db.query(`UPDATE companies SET tax_regime = 'mei', status = 'active', service_areas = ARRAY['fiscal']::text[] WHERE id = '${otherCompany}'`);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${otherCompany}', 9, 2042, '${admin}', '${admin}') RETURNING id`);

    const obligationNames = await db.query<{ name: string }>(
      "SELECT name FROM fiscal_obligations WHERE client_period_id = $1 ORDER BY name",
      [period.rows[0].id],
    );
    expect(obligationNames.rows.map((row) => row.name)).not.toContain("DAS-MEI");
  });
  it("keeps operational comments scoped to internal users and target company", async () => {
    await asUser(admin);
    const comment = await db.query<{ id: string; company_id: string | null; author_id: string | null }>(
      `INSERT INTO operational_comments(tenant_id, target_type, target_id, body, author_id)
       VALUES ('${tenant}', 'task', '${id(13)}', 'Conferir memoria de calculo antes da entrega', '${admin}')
       RETURNING id, company_id, author_id`,
    );
    expect(comment.rows[0]).toMatchObject({ company_id: company, author_id: admin });

    await expect(db.query(
      `INSERT INTO operational_comments(tenant_id, company_id, target_type, target_id, body, author_id)
       VALUES ('${tenant}', '${otherCompany}', 'task', '${id(13)}', 'Empresa errada', '${admin}')`,
    )).rejects.toThrow(/target company/);

    await asUser(collaborator);
    expect((await db.query("SELECT id FROM operational_comments WHERE target_id = $1", [id(13)])).rows).toHaveLength(1);
    await db.query(
      `INSERT INTO operational_comments(tenant_id, target_type, target_id, body, author_id)
       VALUES ('${tenant}', 'task', '${id(13)}', 'Ajuste registrado pela fila', '${collaborator}')`,
    );

    await asUser(client);
    expect((await db.query("SELECT id FROM operational_comments")).rows).toHaveLength(0);
    await expect(db.query(
      `INSERT INTO operational_comments(tenant_id, target_type, target_id, body, author_id)
       VALUES ('${tenant}', 'task', '${id(12)}', 'Comentario do cliente', '${client}')`,
    )).rejects.toThrow();
  });
  it("requires a reason for blocked standalone tasks and clears it when unblocked", async () => {
    await asUser(admin);
    const taskId = id(50);
    await db.query(
      `INSERT INTO tasks(id, tenant_id, company_id, assigned_to, title, status)
       VALUES ('${taskId}', '${tenant}', '${company}', '${collaborator}', 'Tarefa dependente de informacao externa', 'pending')`,
    );

    await expect(db.query("UPDATE tasks SET status = 'blocked' WHERE id = $1", [taskId])).rejects.toThrow(/require a reason/);
    await db.query("UPDATE tasks SET status = 'blocked', blocked_reason = 'Aguardando contrato assinado' WHERE id = $1", [taskId]);
    expect((await db.query<{ status: string; blocked_reason: string | null; completed_at: string | null }>(
      "SELECT status, blocked_reason, completed_at FROM tasks WHERE id = $1",
      [taskId],
    )).rows[0]).toMatchObject({ status: "blocked", blocked_reason: "Aguardando contrato assinado", completed_at: null });

    await db.query("UPDATE tasks SET status = 'in_progress' WHERE id = $1", [taskId]);
    expect((await db.query<{ status: string; blocked_reason: string | null }>(
      "SELECT status, blocked_reason FROM tasks WHERE id = $1",
      [taskId],
    )).rows[0]).toEqual({ status: "in_progress", blocked_reason: null });
  });
  it("scopes document requests and lets a client upload only to their own request", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 6, 2030, '${collaborator}', '${admin}') RETURNING id`);
    const ownRequest = await db.query<{ id: string }>(`INSERT INTO document_requests(tenant_id, company_id, client_period_id, requested_by, assigned_to, title, document_type, due_date) VALUES ('${tenant}', '${company}', '${period.rows[0].id}', '${admin}', '${client}', 'Enviar extrato bancario', 'extrato_bancario', '2030-06-05') RETURNING id`);
    await db.query(`INSERT INTO document_requests(tenant_id, company_id, requested_by, title) VALUES ('${tenant}', '${otherCompany}', '${admin}', 'Pedido de outro cliente')`);
    const docId = id(41);
    await db.query(`INSERT INTO documents(id, tenant_id, company_id, uploaded_by, file_path) VALUES ('${docId}', '${tenant}', '${company}', '${client}', '${tenant}/${company}/${client}/extrato.pdf')`);

    await asUser(client);
    expect((await db.query("SELECT id FROM document_requests")).rows).toEqual([{ id: ownRequest.rows[0].id }]);
    expect((await db.query("UPDATE document_requests SET status = 'uploaded', document_id = $1 WHERE id = $2 RETURNING status", [docId, ownRequest.rows[0].id])).rows).toEqual([{ status: "uploaded" }]);
    await expect(db.query("UPDATE document_requests SET title = 'Alterado pelo cliente' WHERE id = $1", [ownRequest.rows[0].id])).rejects.toThrow(/Clients can only attach/);
  });
  it("approval and rejection of document requests update the document step", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 7, 2030, '${collaborator}', '${admin}') RETURNING id`);
    const request = await db.query<{ id: string }>(`INSERT INTO document_requests(tenant_id, company_id, client_period_id, requested_by, title) VALUES ('${tenant}', '${company}', '${period.rows[0].id}', '${admin}', 'Enviar notas fiscais') RETURNING id`);
    await db.query("UPDATE document_requests SET status = 'rejected', rejection_reason = 'Arquivo ilegivel' WHERE id = $1", [request.rows[0].id]);
    expect((await db.query<{ status: string; blocked_reason: string | null }>("SELECT status, blocked_reason FROM client_period_steps WHERE client_period_id = $1 AND step_key = 'documents'", [period.rows[0].id])).rows[0]).toMatchObject({ status: "blocked", blocked_reason: "Ha documentos recusados nesta competencia." });
    const docId = id(52);
    await db.query(`INSERT INTO documents(id, tenant_id, company_id, file_path) VALUES ('${docId}', '${tenant}', '${company}', '${tenant}/${company}/${admin}/notas-fiscais.pdf')`);
    await db.query("UPDATE document_requests SET status = 'uploaded', document_id = $1 WHERE id = $2", [docId, request.rows[0].id]);
    await db.query("UPDATE document_requests SET status = 'approved' WHERE id = $1", [request.rows[0].id]);
    expect((await db.query<{ status: string }>("SELECT status FROM client_period_steps WHERE client_period_id = $1 AND step_key = 'documents'", [period.rows[0].id])).rows[0]).toEqual({ status: "completed" });
  });
  it("creates and clears internal alerts for overdue document requests", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 8, 2030, '${collaborator}', '${admin}') RETURNING id`);
    const request = await db.query<{ id: string }>(`INSERT INTO document_requests(tenant_id, company_id, client_period_id, requested_by, assigned_to, title, due_date) VALUES ('${tenant}', '${company}', '${period.rows[0].id}', '${admin}', '${client}', 'Enviar extrato vencido', '2000-01-01') RETURNING id`);

    await asUser(collaborator);
    const alert = await db.query<{ user_id: string; read_at: string | null; href: string }>(
      "SELECT user_id, read_at, href FROM user_notifications WHERE kind = 'document_request_overdue' AND metadata ->> 'document_request_id' = $1",
      [request.rows[0].id],
    );
    expect(alert.rows).toEqual([{ user_id: collaborator, read_at: null, href: "/documents" }]);

    await asUser(admin);
    const docId = id(53);
    await db.query(`INSERT INTO documents(id, tenant_id, company_id, file_path) VALUES ('${docId}', '${tenant}', '${company}', '${tenant}/${company}/${admin}/extrato-vencido.pdf')`);
    await db.query("UPDATE document_requests SET status = 'uploaded', document_id = $1 WHERE id = $2", [docId, request.rows[0].id]);
    await asUser(collaborator);
    expect((await db.query<{ read_at: string | null }>(
      "SELECT read_at FROM user_notifications WHERE kind = 'document_request_overdue' AND metadata ->> 'document_request_id' = $1",
      [request.rows[0].id],
    )).rows[0].read_at).not.toBeNull();
  });
  it("notifies the internal responsible member when a client uploads a requested document", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 5, 2041, '${collaborator}', '${admin}') RETURNING id`);
    const request = await db.query<{ id: string }>(`INSERT INTO document_requests(tenant_id, company_id, client_period_id, requested_by, assigned_to, title, due_date) VALUES ('${tenant}', '${company}', '${period.rows[0].id}', '${admin}', '${client}', 'Enviar folha de pagamento', '2041-05-05') RETURNING id`);
    const docId = id(45);
    await db.query(`INSERT INTO documents(id, tenant_id, company_id, uploaded_by, file_path) VALUES ('${docId}', '${tenant}', '${company}', '${client}', '${tenant}/${company}/${client}/folha.pdf')`);

    await asUser(client);
    await db.query("UPDATE document_requests SET status = 'uploaded', document_id = $1 WHERE id = $2", [docId, request.rows[0].id]);

    await asUser(collaborator);
    expect((await db.query<{ user_id: string; href: string; body: string }>(
      "SELECT user_id, href, body FROM user_notifications WHERE kind = 'document_request_uploaded' AND metadata ->> 'document_request_id' = $1",
      [request.rows[0].id],
    )).rows).toEqual([{ user_id: collaborator, href: "/documents", body: expect.stringContaining("Enviar folha de pagamento") }]);

    await asUser(admin);
    await db.query("UPDATE document_requests SET status = 'approved' WHERE id = $1", [request.rows[0].id]);
    await asUser(collaborator);
    expect((await db.query<{ read_at: string | null }>(
      "SELECT read_at FROM user_notifications WHERE kind = 'document_request_uploaded' AND metadata ->> 'document_request_id' = $1",
      [request.rows[0].id],
    )).rows[0].read_at).not.toBeNull();
  });
  it("notifies the client when a requested document is rejected and clears it after reupload", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 6, 2041, '${collaborator}', '${admin}') RETURNING id`);
    const request = await db.query<{ id: string }>(`INSERT INTO document_requests(tenant_id, company_id, client_period_id, requested_by, assigned_to, title, due_date) VALUES ('${tenant}', '${company}', '${period.rows[0].id}', '${admin}', '${client}', 'Enviar notas de entrada', '2041-06-05') RETURNING id`);
    await db.query("UPDATE document_requests SET status = 'rejected', rejection_reason = 'Arquivo sem assinatura' WHERE id = $1", [request.rows[0].id]);

    await asUser(client);
    expect((await db.query<{ user_id: string; href: string; body: string }>(
      "SELECT user_id, href, body FROM user_notifications WHERE kind = 'document_request_rejected' AND metadata ->> 'document_request_id' = $1",
      [request.rows[0].id],
    )).rows).toEqual([{ user_id: client, href: "/documents", body: expect.stringContaining("Arquivo sem assinatura") }]);

    const docId = id(46);
    await asUser(admin);
    await db.query(`INSERT INTO documents(id, tenant_id, company_id, uploaded_by, file_path) VALUES ('${docId}', '${tenant}', '${company}', '${client}', '${tenant}/${company}/${client}/notas-reenvio.pdf')`);
    await asUser(client);
    await db.query("UPDATE document_requests SET status = 'uploaded', document_id = $1 WHERE id = $2", [docId, request.rows[0].id]);
    expect((await db.query<{ read_at: string | null }>(
      "SELECT read_at FROM user_notifications WHERE kind = 'document_request_rejected' AND metadata ->> 'document_request_id' = $1",
      [request.rows[0].id],
    )).rows[0].read_at).not.toBeNull();
  });
  it("requires evidence and reasons for document request decisions", async () => {
    await asUser(admin);
    const requestId = id(50);
    const documentId = id(51);
    await db.query(`INSERT INTO document_requests(id, tenant_id, company_id, title, status) VALUES ('${requestId}', '${tenant}', '${company}', 'Extrato mensal', 'requested')`);
    await expect(db.query("UPDATE document_requests SET status = 'uploaded' WHERE id = $1", [requestId])).rejects.toThrow(/requires an attached document/);
    await expect(db.query("UPDATE document_requests SET status = 'approved' WHERE id = $1", [requestId])).rejects.toThrow(/requires an attached document/);
    await expect(db.query("UPDATE document_requests SET status = 'rejected' WHERE id = $1", [requestId])).rejects.toThrow(/require a reason/);
    await expect(db.query("UPDATE document_requests SET status = 'waived' WHERE id = $1", [requestId])).rejects.toThrow(/require a reason/);

    await db.query(`INSERT INTO documents(id, tenant_id, company_id, name, status) VALUES ('${documentId}', '${tenant}', '${company}', 'Extrato mensal.pdf', 'pending')`);
    await db.query("UPDATE document_requests SET status = 'uploaded', document_id = $1 WHERE id = $2", [documentId, requestId]);
    await db.query("UPDATE document_requests SET status = 'approved' WHERE id = $1", [requestId]);
    expect((await db.query("SELECT status, document_id FROM document_requests WHERE id = $1", [requestId])).rows).toEqual([{ status: "approved", document_id: documentId }]);
  });
  it("records operational period and document decisions in the activity log", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 9, 2042, '${collaborator}', '${admin}') RETURNING id`);
    const request = await db.query<{ id: string }>(`INSERT INTO document_requests(tenant_id, company_id, client_period_id, requested_by, title) VALUES ('${tenant}', '${company}', '${period.rows[0].id}', '${admin}', 'Balancete de setembro') RETURNING id`);
    expect((await db.query("SELECT entity, action FROM activity_logs WHERE entity = 'client_periods' AND entity_id = $1", [period.rows[0].id])).rows).toContainEqual({ entity: "client_periods", action: "created" });
    expect((await db.query("SELECT entity, action FROM activity_logs WHERE entity = 'document_requests' AND entity_id = $1", [request.rows[0].id])).rows).toContainEqual({ entity: "document_requests", action: "created" });

    await db.query("UPDATE document_requests SET status = 'rejected', rejection_reason = 'Arquivo incompleto' WHERE id = $1", [request.rows[0].id]);
    expect((await db.query<{ action: string; metadata: { new_status?: string } }>("SELECT action, metadata FROM activity_logs WHERE entity = 'document_requests' AND entity_id = $1 ORDER BY created_at DESC LIMIT 1", [request.rows[0].id])).rows[0]).toMatchObject({ action: "updated", metadata: { new_status: "rejected" } });
  });
  it("creates and clears task overdue alerts", async () => {
    await asUser(admin);
    const taskId = id(43);
    await db.query(`INSERT INTO tasks(id, tenant_id, company_id, assigned_to, title, due_date, status) VALUES ('${taskId}', '${tenant}', '${company}', '${collaborator}', 'Tarefa vencida controlada', '2000-01-01', 'pending')`);

    await asUser(collaborator);
    const alert = await db.query<{ user_id: string; read_at: string | null; href: string }>(
      "SELECT user_id, read_at, href FROM user_notifications WHERE kind = 'task_overdue' AND metadata ->> 'task_id' = $1",
      [taskId],
    );
    expect(alert.rows).toEqual([{ user_id: collaborator, read_at: null, href: "/work-queue" }]);

    await asUser(admin);
    await db.query("UPDATE tasks SET status = 'completed' WHERE id = $1", [taskId]);
    await asUser(collaborator);
    expect((await db.query<{ read_at: string | null }>(
      "SELECT read_at FROM user_notifications WHERE kind = 'task_overdue' AND metadata ->> 'task_id' = $1",
      [taskId],
    )).rows[0].read_at).not.toBeNull();
  });
  it("creates review rejected alerts for the assigned collaborator", async () => {
    await asUser(admin);
    await db.query(`UPDATE companies SET tax_regime = 'simples_nacional', status = 'active' WHERE id = '${company}'`);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 2, 2040, '${collaborator}', '${admin}') RETURNING id`);
    const reviewItem = await db.query<{ task_id: string }>(
      "SELECT task_id FROM client_period_checklist_items WHERE client_period_id = $1 AND requires_review = true AND task_id IS NOT NULL LIMIT 1",
      [period.rows[0].id],
    );
    await db.query("UPDATE client_period_checklist_items SET status = 'in_review' WHERE task_id = $1", [reviewItem.rows[0].task_id]);
    const review = await db.query<{ id: string }>("SELECT id FROM task_reviews WHERE task_id = $1", [reviewItem.rows[0].task_id]);
    await db.query("UPDATE task_reviews SET status = 'rejected', reviewer_id = $1, comment = 'Ajustar calculo' WHERE id = $2", [admin, review.rows[0].id]);

    await asUser(collaborator);
    expect((await db.query<{ user_id: string; href: string; body: string }>(
      "SELECT user_id, href, body FROM user_notifications WHERE kind = 'task_review_rejected' AND metadata ->> 'task_review_id' = $1",
      [review.rows[0].id],
    )).rows).toEqual([{ user_id: collaborator, href: "/work-queue", body: expect.stringContaining("Ajustar calculo") }]);
  });
  it("creates and clears blocked period alerts", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 3, 2040, '${collaborator}', '${admin}') RETURNING id`);
    await db.query("UPDATE client_periods SET status = 'blocked', blocked_reason = 'Documento critico ausente' WHERE id = $1", [period.rows[0].id]);

    await asUser(collaborator);
    expect((await db.query<{ user_id: string; href: string }>(
      "SELECT user_id, href FROM user_notifications WHERE kind = 'client_period_blocked' AND metadata ->> 'client_period_id' = $1",
      [period.rows[0].id],
    )).rows).toEqual([{ user_id: collaborator, href: "/periods" }]);

    await asUser(admin);
    await db.query("UPDATE client_periods SET status = 'in_progress' WHERE id = $1", [period.rows[0].id]);
    await asUser(collaborator);
    expect((await db.query<{ read_at: string | null }>(
      "SELECT read_at FROM user_notifications WHERE kind = 'client_period_blocked' AND metadata ->> 'client_period_id' = $1",
      [period.rows[0].id],
    )).rows[0].read_at).not.toBeNull();
  });
  it("creates and clears stale client period alerts", async () => {
    await asUser(admin);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, status, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 7, 2041, 'in_progress', '${collaborator}', '${admin}') RETURNING id`);
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false); ALTER TABLE public.client_periods DISABLE TRIGGER touch_client_periods");
    await db.query("UPDATE client_periods SET updated_at = '2000-01-01' WHERE id = $1", [period.rows[0].id]);
    await db.exec("ALTER TABLE public.client_periods ENABLE TRIGGER touch_client_periods");
    await db.query("SELECT public.sync_operational_alerts()");

    await asUser(collaborator);
    expect((await db.query<{ user_id: string; href: string; body: string }>(
      "SELECT user_id, href, body FROM user_notifications WHERE kind = 'client_period_stale' AND metadata ->> 'client_period_id' = $1",
      [period.rows[0].id],
    )).rows).toEqual([{ user_id: collaborator, href: "/periods", body: expect.stringContaining("sem atualização") }]);

    await asUser(admin);
    await db.query("UPDATE client_periods SET status = 'delivered' WHERE id = $1", [period.rows[0].id]);
    await asUser(collaborator);
    expect((await db.query<{ read_at: string | null }>(
      "SELECT read_at FROM user_notifications WHERE kind = 'client_period_stale' AND metadata ->> 'client_period_id' = $1",
      [period.rows[0].id],
    )).rows[0].read_at).not.toBeNull();
  });
  it("creates and clears invoice overdue alerts", async () => {
    await asUser(admin);
    const invoiceId = id(44);
    await db.query(`INSERT INTO invoices(id, tenant_id, company_id, number, amount, due_date, status) VALUES ('${invoiceId}', '${tenant}', '${company}', 'INV-44', 100, '2000-01-01', 'pending')`);

    await asUser(collaborator);
    expect((await db.query<{ user_id: string; href: string }>(
      "SELECT user_id, href FROM user_notifications WHERE kind = 'invoice_overdue' AND metadata ->> 'invoice_id' = $1",
      [invoiceId],
    )).rows).toEqual([{ user_id: collaborator, href: "/invoices" }]);

    await asUser(admin);
    await db.query(`INSERT INTO payments(id, tenant_id, company_id, invoice_id, amount, status, direction) VALUES ('${id(45)}', '${tenant}', '${company}', '${invoiceId}', 100, 'completed', 'income')`);
    await asUser(collaborator);
    expect((await db.query<{ read_at: string | null }>(
      "SELECT read_at FROM user_notifications WHERE kind = 'invoice_overdue' AND metadata ->> 'invoice_id' = $1",
      [invoiceId],
    )).rows[0].read_at).not.toBeNull();
  });
  it("protects invoice and reconciled payment financial invariants", async () => {
    await asUser(admin);
    const invoiceId = id(46);
    await db.query(`INSERT INTO invoices(id, tenant_id, company_id, amount, status) VALUES ('${invoiceId}', '${tenant}', '${company}', 100, 'pending')`);
    await expect(db.query("UPDATE invoices SET status = 'paid' WHERE id = $1", [invoiceId])).rejects.toThrow(/completed payment/);

    const paymentId = id(47);
    await db.query(`INSERT INTO payments(id, tenant_id, company_id, invoice_id, amount, status, paid_at, reconciled_at, direction) VALUES ('${paymentId}', '${tenant}', '${company}', '${invoiceId}', 100, 'completed', now(), now(), 'income')`);
    await expect(db.query("DELETE FROM payments WHERE id = $1", [paymentId])).rejects.toThrow(/Reconciled payments cannot be deleted/);
    await expect(db.query("UPDATE invoices SET status = 'pending' WHERE id = $1", [invoiceId])).rejects.toThrow(/cannot be reopened/);
    await expect(db.query("UPDATE invoices SET status = 'cancelled' WHERE id = $1", [invoiceId])).rejects.toThrow(/cannot be cancelled/);

    const cancellableInvoiceId = id(48);
    const cancellablePaymentId = id(49);
    await db.query(`INSERT INTO invoices(id, tenant_id, company_id, amount, status) VALUES ('${cancellableInvoiceId}', '${tenant}', '${company}', 75, 'pending')`);
    await db.query(`INSERT INTO payments(id, tenant_id, company_id, invoice_id, amount, status, direction) VALUES ('${cancellablePaymentId}', '${tenant}', '${company}', '${cancellableInvoiceId}', 75, 'pending', 'income')`);
    await db.query("UPDATE payments SET status = 'completed', paid_at = now() WHERE id = $1", [cancellablePaymentId]);
    expect((await db.query("SELECT status FROM invoices WHERE id = $1", [cancellableInvoiceId])).rows).toEqual([{ status: "paid" }]);
    await db.query("UPDATE payments SET status = 'cancelled', paid_at = NULL WHERE id = $1", [cancellablePaymentId]);
    expect((await db.query("SELECT status FROM invoices WHERE id = $1", [cancellableInvoiceId])).rows).toEqual([{ status: "pending" }]);
    await expect(db.query(`INSERT INTO invoices(id, tenant_id, company_id, amount, status) VALUES ('${id(54)}', '${tenant}', '${company}', 0, 'pending')`)).rejects.toThrow(/greater than zero/);
    await expect(db.query(`INSERT INTO payments(id, tenant_id, company_id, amount, status, direction) VALUES ('${id(55)}', '${tenant}', '${company}', -1, 'pending', 'expense')`)).rejects.toThrow(/greater than zero/);
  });
  it("archives only read notifications older than the retention window", async () => {
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false)");
    const oldReadId = id(47);
    const oldUnreadId = id(48);
    await db.query(`
      INSERT INTO user_notifications(id, tenant_id, user_id, kind, title, body, href, metadata, read_at, created_at)
      VALUES
        ('${oldReadId}', '${tenant}', '${collaborator}', 'system', 'Lida antiga', NULL, '/notifications', '{}'::jsonb, '2000-01-02', '2000-01-01'),
        ('${oldUnreadId}', '${tenant}', '${collaborator}', 'system', 'Nao lida antiga', NULL, '/notifications', '{}'::jsonb, NULL, '2000-01-01')
    `);

    expect((await db.query<{ archive_old_user_notifications: number }>("SELECT public.archive_old_user_notifications(30)")).rows[0].archive_old_user_notifications).toBe(1);
    expect((await db.query("SELECT id FROM archived_user_notifications WHERE id = $1", [oldReadId])).rows).toHaveLength(1);
    expect((await db.query("SELECT id FROM user_notifications WHERE id = $1", [oldReadId])).rows).toHaveLength(0);
    expect((await db.query("SELECT id FROM user_notifications WHERE id = $1", [oldUnreadId])).rows).toHaveLength(1);
  });
  it("keeps monthly client periods immutable for client accounts", async () => {
    await asUser(client);
    await expect(db.query(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year) VALUES ('${tenant}', '${company}', 2, 2030)`)).rejects.toThrow();
    expect((await db.query("UPDATE client_periods SET status = 'closed' RETURNING id")).rows).toHaveLength(0);
    expect((await db.query("DELETE FROM client_periods RETURNING id")).rows).toHaveLength(0);
    expect((await db.query("UPDATE client_period_steps SET status = 'completed' RETURNING id")).rows).toHaveLength(0);
  });
  it("applies collaborator permissions to monthly client period updates", async () => {
    await asUser(collaborator);
    expect((await db.query("SELECT id FROM client_periods WHERE period_month = 1 AND period_year = 2030")).rows).toHaveLength(2);
    expect((await db.query("UPDATE client_periods SET status = 'in_progress' WHERE company_id = $1 AND period_month = 1 AND period_year = 2030 RETURNING id", [company])).rows).toHaveLength(1);

    await asUser(admin);
    await db.query(`UPDATE workspace_member_permissions SET permissions = jsonb_set(jsonb_set(permissions, '{clients,update}', 'false'::jsonb), '{tasks,update}', 'false'::jsonb) WHERE tenant_id = '${tenant}' AND user_id = '${collaborator}'`);
    await asUser(collaborator);
    expect((await db.query("UPDATE client_periods SET status = 'closed' WHERE company_id = $1 AND period_month = 1 AND period_year = 2030 RETURNING id", [company])).rows).toHaveLength(0);
    await asUser(admin);
    await db.query(`UPDATE workspace_member_permissions SET permissions = jsonb_set(jsonb_set(permissions, '{clients,update}', 'true'::jsonb), '{tasks,update}', 'true'::jsonb) WHERE tenant_id = '${tenant}' AND user_id = '${collaborator}'`);
  });
  it("does not close a period with unresolved operational requirements", async () => {
    await asUser(admin);
    await db.query(`UPDATE companies SET tax_regime = 'simples_nacional', status = 'active' WHERE id = '${company}'`);
    const period = await db.query<{ id: string }>(`INSERT INTO client_periods(tenant_id, company_id, period_month, period_year, responsible_user_id, created_by) VALUES ('${tenant}', '${company}', 4, 2043, '${collaborator}', '${admin}') RETURNING id`);
    const periodId = period.rows[0].id;

    await expect(db.query("UPDATE client_periods SET status = 'closed' WHERE id = $1", [periodId])).rejects.toThrow(/pending steps/);

    await db.query("UPDATE client_period_steps SET status = 'completed' WHERE client_period_id = $1", [periodId]);
    await expect(db.query("UPDATE client_periods SET status = 'closed' WHERE id = $1", [periodId])).rejects.toThrow(/pending checklist items/);

    await db.query("UPDATE client_period_checklist_items SET status = 'completed' WHERE client_period_id = $1", [periodId]);
    await expect(db.query("UPDATE client_periods SET status = 'closed' WHERE id = $1", [periodId])).rejects.toThrow(/pending fiscal obligations/);

    await db.query("UPDATE fiscal_obligations SET status = 'cancelled' WHERE client_period_id = $1", [periodId]);
    await expect(db.query("UPDATE client_periods SET status = 'closed' WHERE id = $1", [periodId])).resolves.toBeDefined();
    expect((await db.query<{ status: string; progress_percent: number }>("SELECT status, progress_percent FROM client_periods WHERE id = $1", [periodId])).rows[0]).toMatchObject({ status: "closed", progress_percent: 100 });

    await db.query("UPDATE client_period_steps SET status = 'pending' WHERE client_period_id = $1 AND step_key = 'documents'", [periodId]);
    expect((await db.query<{ status: string }>("SELECT status FROM client_periods WHERE id = $1", [periodId])).rows[0]).toEqual({ status: "in_progress" });
  });
  it("rejects assigning a client to another company's task or an inactive user", async () => {
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false)");
    await expect(db.query(`INSERT INTO tasks(tenant_id, company_id, assigned_to, title) VALUES ('${tenant}', '${otherCompany}', '${client}', 'Wrong client task')`)).rejects.toThrow(/own company/);
    await db.query(`UPDATE profiles SET status = 'inactive' WHERE user_id = '${collaborator}'`);
    await expect(db.query(`INSERT INTO tasks(tenant_id, company_id, assigned_to, title) VALUES ('${tenant}', '${company}', '${collaborator}', 'Inactive task')`)).rejects.toThrow(/must be active/);
    await db.query(`UPDATE profiles SET status = 'active' WHERE user_id = '${collaborator}'`);
  });
  it("blocks collaborator privilege escalation and self-reactivation", async () => {
    await asUser(collaborator);
    expect((await db.query(`UPDATE profiles SET account_type = 'admin' WHERE user_id = '${collaborator}' RETURNING user_id`)).rows).toHaveLength(0);
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false)");
    await db.query(`UPDATE profiles SET status = 'inactive' WHERE user_id = '${collaborator}'`);
    await asUser(collaborator);
    expect((await db.query("SELECT id FROM companies")).rows).toHaveLength(0);
    expect((await db.query(`UPDATE profiles SET status = 'active' WHERE user_id = '${collaborator}' RETURNING user_id`)).rows).toHaveLength(0);
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role', 'service_role', false)");
    await db.query(`UPDATE profiles SET status = 'active' WHERE user_id = '${collaborator}'`);
  });
  it("reserves worker RPCs for service role and claims only the requested tenant", async () => {
    const grants = await db.query<{ allowed: boolean }>("SELECT has_function_privilege('authenticated', 'public.claim_workspace_integration_job(text,uuid)', 'EXECUTE') AS allowed");
    expect(grants.rows[0].allowed).toBe(false);
    const jobs = await db.query<{ tenant_id: string }>("SELECT * FROM claim_workspace_integration_job('test', $1)", [tenant]);
    expect(jobs.rows.map((job) => job.tenant_id)).toEqual([tenant]);
    expect((await db.query("SELECT * FROM claim_workspace_integration_job('another', $1)", [tenant])).rows).toHaveLength(0);
  });
  it("recovers abandoned processing leases", async () => {
    await db.query(`UPDATE integration_jobs SET locked_at = now() - interval '11 minutes' WHERE id = '${id(16)}'`);
    const jobs = await db.query<{ attempt_count: number }>("SELECT * FROM claim_workspace_integration_job('recovery', $1)", [tenant]);
    expect(jobs.rows[0].attempt_count).toBe(2);
  });
  it("dead-letters exhausted abandoned jobs instead of leaving permanent locks", async () => {
    await db.query(`UPDATE integration_jobs SET locked_at = now() - interval '11 minutes', attempt_count = max_attempts WHERE id = '${id(16)}'`);
    await db.query("SELECT * FROM claim_workspace_integration_job('exhausted', $1)", [tenant]);
    expect((await db.query<{ status: string }>(`SELECT status FROM integration_jobs WHERE id = '${id(16)}'`)).rows[0].status).toBe("dead_letter");
  });
  it("claims domain events by workspace and retries failures without cross-tenant access", async () => {
    await db.query(`INSERT INTO domain_events(id, tenant_id, event_type) VALUES ('${id(21)}', '${tenant}', 'document.received'), ('${id(22)}', '${otherTenant}', 'document.received')`);
    const claimed = await db.query<{ id: string }>("SELECT id FROM claim_workspace_domain_events('worker-a', $1, 100)", [tenant]);
    expect(claimed.rows.map((event) => event.id)).toContain(id(21));
    expect(claimed.rows.map((event) => event.id)).not.toContain(id(22));
    await db.query("SELECT fail_workspace_domain_event($1, $2, 'provider unavailable')", [id(21), tenant]);
    const failed = await db.query<{ status: string; locked_at: string | null; last_error: string }>("SELECT status, locked_at, last_error FROM domain_events WHERE id = $1", [id(21)]);
    expect(failed.rows[0]).toMatchObject({ status: "failed", locked_at: null, last_error: "provider unavailable" });
    expect((await db.query("SELECT id FROM domain_events WHERE id = $1", [id(22)])).rows).toHaveLength(1);
  });
  it("runs each task automation once and respects its conditions", async () => {
    await db.query(`INSERT INTO automation_rules(id, tenant_id, name, trigger_event_type, action_type, action_payload) VALUES ('${id(23)}', '${tenant}', 'Review document', 'document.received', 'create_task', '{"title":"Review"}')`);
    await db.query(`INSERT INTO domain_events(id, tenant_id, event_type, payload) VALUES ('${id(24)}', '${tenant}', 'document.received', '{"company_id":"${company}","kind":"invoice"}')`);
    await db.query("SELECT * FROM claim_workspace_domain_events('worker-b', $1, 10)", [tenant]);
    await db.query("SELECT execute_task_automation($1, $2, $3)", [id(24), id(23), tenant]);
    await db.query("SELECT execute_task_automation($1, $2, $3)", [id(24), id(23), tenant]);
    expect((await db.query("SELECT id FROM tasks WHERE title = 'Review'")).rows).toHaveLength(1);
    expect((await db.query("SELECT id FROM automation_runs WHERE rule_id = $1 AND domain_event_id = $2", [id(23), id(24)])).rows).toHaveLength(1);

    await db.query(`INSERT INTO automation_rules(id, tenant_id, name, trigger_event_type, action_type, conditions) VALUES ('${id(25)}', '${tenant}', 'Only receipts', 'document.received', 'create_task', '{"kind":"receipt"}')`);
    await db.query(`INSERT INTO domain_events(id, tenant_id, event_type, payload) VALUES ('${id(26)}', '${tenant}', 'document.received', '{"kind":"invoice"}')`);
    await db.query("SELECT * FROM claim_workspace_domain_events('worker-c', $1, 10)", [tenant]);
    await db.query("SELECT execute_task_automation($1, $2, $3)", [id(26), id(25), tenant]);
    expect((await db.query<{ status: string }>("SELECT status FROM automation_runs WHERE rule_id = $1 AND domain_event_id = $2", [id(25), id(26)])).rows[0].status).toBe("skipped");
  });
  it("emits one durable event for each supported operational fact", async () => {
    const invoiceId = id(27), paymentId = id(28), documentId = id(29);
    await db.query(`INSERT INTO invoices(id, tenant_id, company_id, amount, status) VALUES ('${invoiceId}', '${tenant}', '${company}', 100, 'pending')`);
    await db.query(`INSERT INTO payments(id, tenant_id, company_id, invoice_id, amount, status) VALUES ('${paymentId}', '${tenant}', '${company}', '${invoiceId}', 100, 'completed')`);
    await db.query(`UPDATE payments SET status = 'completed' WHERE id = '${paymentId}'`);
    await db.query(`INSERT INTO documents(id, tenant_id, company_id) VALUES ('${documentId}', '${tenant}', '${company}')`);
    const events = await db.query<{ event_type: string; origin_key: string }>("SELECT event_type, origin_key FROM domain_events WHERE origin_key IS NOT NULL ORDER BY origin_key");
    expect(events.rows.filter((event) => event.origin_key.includes(invoiceId))).toEqual([{ event_type: "invoice.created", origin_key: `invoice.created:${invoiceId}` }]);
    expect(events.rows.filter((event) => event.origin_key.includes(paymentId))).toEqual([{ event_type: "payment.completed", origin_key: `payment.completed:${paymentId}` }]);
    expect(events.rows.filter((event) => event.origin_key.includes(documentId))).toEqual([{ event_type: "document.received", origin_key: `document.received:${documentId}` }]);
  });
});
