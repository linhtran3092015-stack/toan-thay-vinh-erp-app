// Run real finance/tuition migration routines in an isolated local PostgreSQL.
// Auth and academic/CRM tables are fixtures; no remote database or TCP listener.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const bin=[process.env.PG_BINDIR,'/opt/homebrew/opt/postgresql@14/bin','/usr/lib/postgresql/16/bin'].filter(Boolean).find(p=>existsSync(join(p,'initdb')));
if(!bin) throw new Error('Set PG_BINDIR to a PostgreSQL installation.');
const dir=mkdtempSync(join(tmpdir(),'tuition-readiness-'));
const migration=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const routine=(text,marker)=>{const start=text.indexOf(marker);if(start<0)throw new Error(marker);return text.slice(start,text.indexOf('$$;',start)+3);};
let running=false;
const sql=input=>execFileSync(join(bin,'psql'),['-h',dir,'-p','55443','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']});
try {
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'server.log'),'-o',`-k ${dir} -h '' -p 55443`,'start'],{stdio:'pipe'});running=true;
 sql(`create role anon; create role authenticated; create role service_role; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create function public.has_permission(p text) returns boolean language sql stable as $$select p=any(string_to_array(current_setting('test.permissions',true),','))$$;
 create table public.profiles(id uuid primary key,display_name text);
 create table public.roles(id uuid primary key default gen_random_uuid(),code text unique);
 create table public.permissions(id uuid primary key default gen_random_uuid(),code text unique,module text,name text,description text);
 create table public.role_permissions(role_id uuid,permission_id uuid,primary key(role_id,permission_id));
 create table public.audit_logs(id uuid default gen_random_uuid(),actor_user_id uuid,module text,action text,entity_type text,entity_id text,old_data jsonb,new_data jsonb,reason text,metadata jsonb);
 create table public.students(id uuid primary key default gen_random_uuid(),full_name text,public_code text,birth_year smallint,current_grade integer,lifecycle_status text default 'active');
 create table public.guardians(id uuid primary key default gen_random_uuid(),full_name text,phone text);
 create table public.student_guardians(student_id uuid,guardian_id uuid,is_primary boolean,ended_at timestamptz);
 create table public.crm_lead_sources(id uuid primary key default gen_random_uuid(),code text,name text,group_code text,is_active boolean default true);
 create table public.crm_cases(id uuid primary key default gen_random_uuid(),student_id uuid,lead_source_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
 create table public.classes(id uuid primary key default gen_random_uuid(),code text,name text,grade integer);
 create table public.student_enrollments(id uuid primary key default gen_random_uuid(),student_id uuid,class_id uuid,status text,effective_from date,effective_to date,registered_mode text,created_at timestamptz default now());
 create table public.class_sessions(id uuid primary key default gen_random_uuid(),class_id uuid,session_date date,session_kind text,status text,makeup_for_session_id uuid);
 create table public.class_component_links(parent_class_id uuid,component_class_id uuid,effective_from date,effective_to date,component_order integer,id uuid);
 create table public.student_session_ledger_entries(id uuid default gen_random_uuid(),student_id uuid,entry_type text,delta_sessions integer,effective_on date,event_key text unique,reference_code text,unit_price_vnd bigint,note text,metadata jsonb,created_by uuid);
 create view public.student_session_balances as select student_id,sum(delta_sessions)::bigint balance_sessions from public.student_session_ledger_entries group by student_id;
 `+routine(migration('20260722130437_student_guardian_foundation.sql'),'create or replace function public.normalize_vietnam_phone('));
 for(const name of ['20260726160000_finance_sepay_foundation.sql','20260814100000_tuition_collection_wave_a.sql','20260817094500_class_component_roster_tuition_history.sql'])sql(migration(name));
 sql(`alter table public.sepay_transactions add account_purpose text not null default 'unknown';`);
 sql(migration('20260905010000_sepay_api_v2_record_only_ingestion.sql'));
 sql(migration('20260923010000_tuition_readiness_and_transfer_identity.sql'));
 sql(readFileSync(new URL('../tests/database/tuition-readiness.sql',import.meta.url),'utf8'));
 console.log('PASS: tuition readiness, atomic rate preparation, locked request creation, transfer identity, ambiguity and webhook idempotency (isolated PostgreSQL)');
} catch(error) {if(error.stderr)process.stderr.write(error.stderr);throw error;}
finally {if(running)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'stop','-m','fast'],{stdio:'pipe'});rmSync(dir,{recursive:true,force:true});}
