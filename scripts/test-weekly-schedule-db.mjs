// Focused PostgreSQL integration harness. No production connection, no TCP listener.
// Authentication, evidence validation and watchdog are minimal fixtures; scheduling
// schema, audit, management RPCs and both check-in definitions come from migrations.
import { execFileSync, execFile, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
const candidates = [process.env.PG_BINDIR, "/opt/homebrew/opt/postgresql@14/bin", "/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/15/bin"].filter(Boolean);
const bin = candidates.find((dir) => existsSync(join(dir, "initdb")));
if (!bin) throw new Error("Set PG_BINDIR to a PostgreSQL installation containing initdb, pg_ctl and psql.");
const dir = mkdtempSync(join(tmpdir(), "weekly-schedule-test-"));
const readMigration = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const routine = (text, marker) => { const start = text.indexOf(marker); if (start < 0) throw new Error(`Missing ${marker}`); return text.slice(start, text.indexOf("$$;", start) + 3); };
let running = false;
try {
  execFileSync(join(bin, "initdb"), ["-D", join(dir, "data"), "-A", "trust", "--no-locale", "-E", "UTF8"], { stdio: "pipe" });
  execFileSync(join(bin, "pg_ctl"), ["-D", join(dir, "data"), "-l", join(dir, "server.log"), "-o", `-k ${dir} -h '' -p 55439`, "start"], { stdio: "pipe" });
  running = true;
  const bootstrap = `create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.profiles(id uuid primary key, display_name text, employee_code text, employment_status text default 'active');
create table public.roles(id uuid primary key default gen_random_uuid(), code text unique);
create table public.permissions(id uuid primary key default gen_random_uuid(), code text unique, module text, name text, description text, is_active boolean default true);
create table public.role_permissions(role_id uuid, permission_id uuid, granted_by uuid, primary key(role_id,permission_id));
create table public.audit_logs(id uuid default gen_random_uuid(),actor_user_id uuid,module text,action text,entity_type text,entity_id text,old_data jsonb,new_data jsonb,reason text,metadata jsonb);
create function public.has_permission(p text) returns boolean language sql stable as $$ select p = any(string_to_array(current_setting('test.permissions',true),',')) $$;
create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
`

    + readMigration("20260728152000_timekeeping_schedule_foundation.sql")
    + readMigration("20260728153000_timekeeping_schedule_management_workflows.sql")
    + `
create table public.time_entries(id uuid primary key default gen_random_uuid(),staff_id uuid references public.profiles(id),staff_shift_assignment_id uuid references public.staff_shift_assignments(id),work_date date,check_in_at timestamptz,check_in_mode text,status text,last_latitude numeric,last_longitude numeric,last_location_accuracy integer,last_location_at timestamptz);
create table public.time_entry_evidence(id uuid default gen_random_uuid(),time_entry_id uuid,event_type text,evidence_type text,gps_latitude numeric,gps_longitude numeric,gps_accuracy_meters integer,wifi_ssid text,wifi_bssid text);
create function public.is_user_teaching_assistant(uuid) returns boolean language sql as $$ select false $$;
create function public.run_teaching_assistant_timekeeping_watchdog() returns void language plpgsql as $$ begin end $$;
create function public.validate_offline_attendance_evidence(numeric,numeric,integer,text,text) returns void language plpgsql as $$ begin raise exception 'Offline validation stub must not run in these tests'; end $$;
`

    + routine(readMigration("20260904010000_owner_managed_attendance_verification.sql"), "create or replace function public.check_in_time_entry(")
    + `
create table public.attendance_exception_submissions(request_id uuid,staff_id uuid,operation text,time_entry_id uuid,reason text);
create table public.attendance_exception_reviews(time_entry_id uuid,check_in_reason text);
`

    + (existsSync(new URL("../supabase/migrations/20260915170000_timekeeping_endpoint_verification.sql", import.meta.url))
      ? routine(readMigration("20260915170000_timekeeping_endpoint_verification.sql"), "create function public.request_attendance_exception(") : "")
    + `
insert into public.profiles(id,display_name) values ('11111111-1111-4111-8111-111111111111','Manager'),('22222222-2222-4222-8222-222222222222','Staff');
insert into public.work_shifts(id,code,name,start_time,end_time) values ('33333333-3333-4333-8333-333333333333','DAY','Day','08:00','12:00');
insert into public.work_shifts(id,code,name,start_time,end_time,crosses_midnight) values ('44444444-4444-4444-8444-444444444444','NIGHT','Night','21:00','02:00',true);
insert into public.staff_shift_assignments(id,staff_id,work_shift_id,weekday,effective_from) values ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',extract(isodow from (now() at time zone 'Asia/Ho_Chi_Minh')::date)::smallint,(now() at time zone 'Asia/Ho_Chi_Minh')::date - 14);
`
;
  writeFileSync(join(dir, "bootstrap.sql"), bootstrap);
  const files = [join(dir, "bootstrap.sql"), new URL("../supabase/migrations/20260916100000_weekly_shift_assignments.sql", import.meta.url), new URL("../tests/database/weekly-shift-assignments.sql", import.meta.url)];
  for (const file of files) {
    execFileSync(join(bin, "psql"), ["-h", dir, "-p", "55439", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: readFileSync(file), stdio: ["pipe", "pipe", "pipe"] });
  }
  // Two real database sessions: a waiting stale writer must see the first
  // committed row after acquiring the advisory lock, then reject its old version.
  const connection = ["-h", dir, "-p", "55439", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"];
  const configure = `select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
    select set_config('test.permissions','staff.manage,timekeeping.view',false);`;
  const save = `select public.save_weekly_shift_assignment(date_trunc('week',now() at time zone 'Asia/Ho_Chi_Minh')::date+7,1,
    '22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',null,null,'concurrent test');`;
  const first = spawn(join(bin, "psql"), connection);
  let output = "";
  const done = new Promise((resolve, reject) => {
    first.on("error", reject);
    first.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`First writer failed: ${code}`)));
  });
  const locked = new Promise((resolve, reject) => {
    first.stdout.on("data", (chunk) => { output += chunk; if (output.includes("LOCKED")) resolve(); });
    first.on("error", reject);
    first.on("exit", () => { if (!output.includes("LOCKED")) reject(new Error("First writer never acquired lock")); });
  });
  first.stdin.end(`${configure} begin; ${save} select 'LOCKED'; select pg_sleep(0.5); commit;`);
  await locked;
  let conflict = false;
  try { await promisify(execFile)(join(bin, "psql"), [...connection, "-c", configure + save]); }
  catch (error) { if (!String(error.stderr).includes("WEEKLY_SCHEDULE_CONFLICT")) throw error; conflict = true; }
  await done;
  if (!conflict) throw new Error("Concurrent stale writer overwrote the committed schedule");
  console.log("PASS: weekly schedule migration, SQL integration suite and two-session stale-write race");
} catch (error) {
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  if (running) execFileSync(join(bin, "pg_ctl"), ["-D", join(dir, "data"), "stop", "-m", "fast"], { stdio: "pipe" });
  rmSync(dir, { recursive: true, force: true });
}
