import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
// Checks the support chat policies with real roles: guests (anon) cannot read or write any chat
// directly (the support-chat function does that with the service role); a signed-in user sees
// only their own chat.
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/support-chat-rls.ts
const repo = Deno.args[0] ?? ".";
const db = new PGlite();
await db.exec(await Deno.readTextFile(new URL("./stubs.sql", import.meta.url)));
await db.exec(`CREATE TYPE app_role AS ENUM ('admin', 'owner', 'user');
  DROP FUNCTION has_role(uuid, text);
  CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role::text) $$;
  CREATE TABLE support_conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, session_id text, title text);
  CREATE TABLE support_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid, role text, content text);
  ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY; ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
  GRANT SELECT, INSERT, UPDATE ON support_conversations, support_messages TO anon, authenticated;
  GRANT SELECT ON test_ctx, user_roles TO anon, authenticated; GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  -- the old, leaky guest policy as it is live today
  CREATE POLICY "Users view own support conversations" ON support_conversations FOR SELECT
    USING ((auth.uid() IS NOT NULL AND auth.uid() = user_id) OR (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL AND length(session_id) >= 32));`);
const U = "00000000-0000-0000-0000-0000000000a1", V = "00000000-0000-0000-0000-0000000000a2";
const g = "guest-session-0123456789abcdef0123456789";
await db.exec(`INSERT INTO support_conversations (id, user_id, session_id, title) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, '${g}', 'gast'), ('00000000-0000-0000-0000-000000000002', '${U}', NULL, 'van U');
  INSERT INTO support_messages (conversation_id, role, content) VALUES ('00000000-0000-0000-0000-000000000001', 'user', 'geheim'), ('00000000-0000-0000-0000-000000000002', 'user', 'van U');`);
const as = async (role: "anon" | "authenticated", uid: string | null) => {
  await db.exec(`RESET ROLE; DELETE FROM test_ctx; INSERT INTO test_ctx VALUES (${uid ? `'${uid}'` : "NULL"}, '${role}'); SET ROLE ${role};`);
};
let ok = true;
const check = (l: string, p: boolean, gg?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(gg)); };
await as("anon", null);
const before = (await db.query("SELECT * FROM support_conversations")).rows.length;
check("before the fix: a guest can read the other guest's chat (the leak)", before === 1, before);
await db.exec("RESET ROLE");
const sql = await Deno.readTextFile(`${repo}/supabase/migrations/20261115150000_support_chat_rls.sql`);
await db.exec(sql); await db.exec(sql);
await as("anon", null);
check("after: guests read no conversations", (await db.query("SELECT * FROM support_conversations")).rows.length === 0);
check("after: guests read no messages", (await db.query("SELECT * FROM support_messages")).rows.length === 0);
let blocked = false;
try { await db.exec(`INSERT INTO support_conversations (user_id, session_id) VALUES (NULL, '${g}x')`); } catch { blocked = true; }
check("after: guests cannot create conversations directly", blocked);
const upd = await db.query("UPDATE support_conversations SET title = 'x' RETURNING id");
check("after: guests cannot change conversations", upd.rows.length === 0);
await as("authenticated", U);
const mine = (await db.query<{ title: string }>("SELECT title FROM support_conversations")).rows;
check("signed-in user sees only own chat", mine.length === 1 && mine[0].title === "van U", mine);
check("signed-in user sees only own messages", (await db.query("SELECT * FROM support_messages")).rows.length === 1);
await as("authenticated", V);
check("another user sees nothing", (await db.query("SELECT * FROM support_conversations")).rows.length === 0);
await db.exec("RESET ROLE");
Deno.exit(ok ? 0 : 1);
