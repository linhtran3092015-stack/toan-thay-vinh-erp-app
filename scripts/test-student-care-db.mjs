// Isolated PostgreSQL integration tests. Only temporary local data; no production connection.
import { execFileSync, execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { dashboardSchema, detailSchema, studentsSchema } from '../src/features/student-care/models.ts';
const bin = [process.env.PG_BINDIR, '/opt/homebrew/opt/postgresql@14/bin', '/usr/lib/postgresql/16/bin'].filter(Boolean).find(p=>existsSync(join(p,'initdb')));
if (!bin) throw new Error('Set PG_BINDIR to a local PostgreSQL installation.');
const dir=mkdtempSync(join(tmpdir(),'student-care-test-'));
const migration = name => readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
let running=false;
const connection=['-h',dir,'-p','55441','-d','postgres','-v','ON_ERROR_STOP=1','-At'];
const sql = input => execFileSync(join(bin,'psql'),connection,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']});
try {
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'server.log'),'-o',`-k ${dir} -h '' -p 55441`,'start'],{stdio:'pipe'}); running=true;
 sql(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create table public.profiles(id uuid primary key,display_name text,email text,employment_status text default 'active');
 create table public.roles(id uuid primary key default gen_random_uuid(),code text unique,is_active boolean default true);
 create table public.permissions(id uuid primary key default gen_random_uuid(),code text unique,module text,name text,description text,is_active boolean default true);
 create table public.role_permissions(role_id uuid,permission_id uuid,granted_by uuid,primary key(role_id,permission_id));
 create table public.user_role_assignments(user_id uuid,role_id uuid,revoked_at timestamptz);
 create function public.has_permission(p text) returns boolean language sql stable security definer as $$select exists(select 1 from public.user_role_assignments a join public.role_permissions rp on rp.role_id=a.role_id join public.permissions perm on perm.id=rp.permission_id where a.user_id=auth.uid() and a.revoked_at is null and perm.is_active and perm.code=p)$$;
 create table public.audit_logs(actor_user_id uuid,module text,action text,entity_type text,entity_id text,old_data jsonb,new_data jsonb,reason text,metadata jsonb);
 create table public.students(id uuid primary key default gen_random_uuid(),full_name text,public_code text,lifecycle_status text default 'active');
 create table public.classes(id uuid primary key default gen_random_uuid(),name text);
 create table public.class_sessions(id uuid primary key default gen_random_uuid(),class_id uuid,session_date date,start_time time default '18:00',status text default 'completed',session_kind text default 'regular');
 create table public.student_enrollments(id uuid primary key default gen_random_uuid(),student_id uuid,class_id uuid,effective_from date,effective_to date,status text default 'active');
 create table public.class_component_links(id uuid primary key default gen_random_uuid(),parent_class_id uuid,component_class_id uuid,effective_from date,effective_to date);
 create table public.session_attendance(id uuid primary key default gen_random_uuid(),student_id uuid,class_session_id uuid,attendance_status text,unique(student_id,class_session_id));
 create table public.session_results(id uuid primary key default gen_random_uuid(),student_id uuid,class_session_id uuid,test_score numeric,unique(student_id,class_session_id));
 insert into public.roles(code) values('owner'),('assistant_manager'),('teaching_assistant');
 insert into public.permissions(code) values('app.access');
 insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where p.code='app.access';
 `);
 sql(migration('20260729123000_coaching_foundation.sql'));
 sql(migration('20260802193000_coaching_management_workflows.sql'));
 const notifications=migration('20260731025000_notifications_foundation.sql');
 const salaryStart=notifications.indexOf('create or replace function public.',notifications.indexOf('grant execute on function public.mark_all_notifications_read'));
 if(salaryStart<0) throw new Error('Notification foundation extraction marker missing');
 sql(notifications.slice(0,salaryStart)+'\ncommit;');
 for(const file of ['20260917100000_student_care_foundation.sql','20260917101000_student_care_workflows.sql','20260917102000_student_care_automation.sql']) sql(migration(file));
 sql(readFileSync(new URL('../tests/database/student-care.sql',import.meta.url),'utf8'));
 const authenticatedJson=query=>JSON.parse(sql("set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';"+query).trim().split('\n').at(-1));
 dashboardSchema.parse(authenticatedJson('select public.get_student_care_dashboard();'));
 detailSchema.parse(authenticatedJson('select public.get_student_care_detail(id) from public.student_care_tasks order by detected_at limit 1;'));
 studentsSchema.parse(authenticatedJson('select public.get_student_care_students();'));
 // Real concurrent connections compete for an unclaimed task; exactly one wins.
 const task=sql(`insert into public.student_care_tasks(student_id,kind) values('22222222-2222-4222-8222-222222222222','followup') returning id;`).split('\n')[0];
 const claim=actor=>`set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false); select public.mutate_student_care(jsonb_build_object('op','claim','request_id',gen_random_uuid(),'task_id','${task}','version',1));`;
 const race=await Promise.allSettled(['11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112'].map(actor=>promisify(execFile)(join(bin,'psql'),[...connection,'-c',claim(actor)])));
 if(race.filter(r=>r.status==='fulfilled').length!==1) throw new Error('Concurrent claim must have exactly one winner');
 const rejected=race.find(r=>r.status==='rejected');
 if(!String(rejected.reason.stderr).includes('STUDENT_CARE_STALE_VERSION')) throw rejected.reason;
 console.log('PASS: student care migrations, rule/workflow/security assertions and concurrent claim race');
} catch(error) {
 if(error.stderr) process.stderr.write(error.stderr);
 throw error;
} finally {
 if(running) execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'stop','-m','fast'],{stdio:'pipe'});
 rmSync(dir,{recursive:true,force:true});
}
