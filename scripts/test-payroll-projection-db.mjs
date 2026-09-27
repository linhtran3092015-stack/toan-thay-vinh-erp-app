// Exercise the actual shared projection in isolated PostgreSQL, never a remote database.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const bin = [process.env.PG_BINDIR, '/opt/homebrew/opt/postgresql@14/bin', '/usr/lib/postgresql/16/bin'].filter(Boolean).find(p => existsSync(join(p, 'initdb')));
if (!bin) throw new Error('Set PG_BINDIR to PostgreSQL binaries.');
const dir = mkdtempSync(join(tmpdir(), 'payroll-projection-'));
const sql = input => execFileSync(join(bin, 'psql'), ['-h', dir, '-p', '55444', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
let running = false;
try {
  execFileSync(join(bin, 'initdb'), ['-D', join(dir, 'data'), '-A', 'trust', '--no-locale', '-E', 'UTF8'], { stdio: 'pipe' });
  execFileSync(join(bin, 'pg_ctl'), ['-D', join(dir, 'data'), '-l', join(dir, 'server.log'), '-o', `-k ${dir} -h '' -p 55444`, 'start'], { stdio: 'pipe' });
  running = true;
  sql(readFileSync(new URL('../tests/database/payroll-projection-fixture.sql', import.meta.url), 'utf8'));
  const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
  const names = process.env.PAYROLL_MIGRATION ? [process.env.PAYROLL_MIGRATION]
    : readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort();
  // Test the latest definitions, so later migrations cannot silently remove bonuses again.
  for (const routine of ['compute_payroll_projection', 'generate_payroll_calculation_run']) {
    let definition;
    for (const name of names) {
      const migration = readFileSync(new URL(name, migrationsDir), 'utf8');
      const start = migration.lastIndexOf('create or replace function public.' + routine + '(');
      if (start >= 0) definition = migration.slice(start, migration.indexOf('$$;', start) + 3);
    }
    if (!definition) throw new Error('Missing payroll routine: ' + routine);
    sql(definition);
  }
  execFileSync(join(bin, 'psql'), ['-h', dir, '-p', '55444', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', new URL('../tests/database/payroll-optional-bonuses.sql', import.meta.url).pathname], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  console.log('PASS: projection regression checks and persisted draft run checks');
} catch (error) { if (error.stderr) process.stderr.write(error.stderr); process.exitCode = 1; }
finally {
  if (running) execFileSync(join(bin, 'pg_ctl'), ['-D', join(dir, 'data'), 'stop', '-m', 'fast'], { stdio: 'pipe' });
  rmSync(dir, { recursive: true, force: true });
}
