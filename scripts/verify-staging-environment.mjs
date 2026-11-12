#!/usr/bin/env node
// ==============================================================================
// ABLEBIZ SUITE — STAGING ENVIRONMENT PRE-FLIGHT SAFETY GUARD
// File: scripts/verify-staging-environment.mjs
// ==============================================================================
// PURPOSE:
// Verifies that a dedicated staging environment configuration exists, is fully
// isolated from production, and is safe for empirical validation.
//
// FAIL-CLOSED SAFETY RULE:
// If staging credentials are not configured, or if the project reference matches
// production, this script immediately aborts with a non-zero exit code.
// Under NO circumstances does it fall back to production credentials.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Authoritative production project reference that MUST NEVER be targeted in staging
const PRODUCTION_PROJECT_REF = 'ksjphkqxudtkduuhnyvn';

function maskSecret(val) {
  if (!val) return '[NOT CONFIGURED]';
  if (val.length <= 6) return '***';
  return `${val.slice(0, 3)}...${val.slice(-3)} (${val.length} chars)`;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

console.log('==============================================================================');
console.log('ABLEBIZ SUITE — STAGING PRE-FLIGHT ENVIRONMENT VERIFICATION');
console.log('==============================================================================');

// Locate staging environment files (prefers .env.staging.local, then .env.staging)
const stagingLocalPath = path.join(rootDir, '.env.staging.local');
const stagingPath = path.join(rootDir, '.env.staging');

let configSource = null;
let envConfig = parseEnvFile(stagingLocalPath);

if (envConfig) {
  configSource = '.env.staging.local';
} else {
  envConfig = parseEnvFile(stagingPath);
  if (envConfig) configSource = '.env.staging';
}

if (!envConfig) {
  console.error('\n[SAFETY GATE: BLOCKED]');
  console.error('ERROR: No staging configuration file found.');
  console.error('Checked: .env.staging.local, .env.staging');
  console.error('\nREASON FOR BLOCK:');
  console.error('To protect the live ABLEBIZ platform, empirical database tests CANNOT run');
  console.error('without an explicit, isolated staging environment.');
  console.error('\nHOW TO RESOLVE:');
  console.error('1. Create an isolated staging project in the Supabase Dashboard.');
  console.error('2. Copy .env.staging.example to .env.staging.local:');
  console.error('     cp .env.staging.example .env.staging.local');
  console.error('3. Populate .env.staging.local with your isolated staging credentials.');
  console.error('4. Re-run: node scripts/verify-staging-environment.mjs');
  console.error('\nUNDER NO CIRCUMSTANCES WILL THE SYSTEM FALL BACK TO PRODUCTION.\n');
  process.exit(1);
}

console.log(`Loaded staging configuration from: ${configSource}`);

const projectRef = envConfig.STAGING_SUPABASE_PROJECT_REF || '';
const supabaseUrl = envConfig.STAGING_SUPABASE_URL || '';
const dbHost = envConfig.STAGING_DB_HOST || '';
const anonKey = envConfig.STAGING_SUPABASE_ANON_KEY || '';
const serviceRoleKey = envConfig.STAGING_SUPABASE_SERVICE_ROLE_KEY || '';
const isConfirmed = envConfig.STAGING_ENVIRONMENT_CONFIRMED === 'true';

// ----------------------------------------------------------------------------
// STRICT SAFETY CHECK 1: PRODUCTION COLLISION GUARD
// ----------------------------------------------------------------------------
const detectedReferences = [projectRef, supabaseUrl, dbHost].join(' ').toLowerCase();

if (detectedReferences.includes(PRODUCTION_PROJECT_REF)) {
  console.error('\n[CRITICAL SAFETY VIOLATION: ABORTED]');
  console.error(`FATAL: The configured staging environment references the PRODUCTION project:`);
  console.error(`       Production Project Ref: "${PRODUCTION_PROJECT_REF}"`);
  console.error('\nEXECUTION BLOCKED IMMEDIATELY.');
  console.error('The migration or rollback scripts will NEVER be executed against production.');
  console.error('Please configure a genuinely distinct, isolated staging Supabase project.\n');
  process.exit(2);
}

// ----------------------------------------------------------------------------
// STRICT SAFETY CHECK 2: PLACEHOLDER CHECK
// ----------------------------------------------------------------------------
if (!projectRef || projectRef === 'your-isolated-staging-project-ref' || projectRef.includes('placeholder')) {
  console.error('\n[SAFETY GATE: BLOCKED]');
  console.error('ERROR: STAGING_SUPABASE_PROJECT_REF is unconfigured or contains placeholder values.');
  console.error('Current value:', projectRef || '[EMPTY]');
  console.error('Please provide the real project reference of your isolated staging Supabase instance.');
  process.exit(1);
}

if (!supabaseUrl || supabaseUrl.includes('your-isolated-staging-project-ref')) {
  console.error('\n[SAFETY GATE: BLOCKED]');
  console.error('ERROR: STAGING_SUPABASE_URL is unconfigured or contains placeholder values.');
  process.exit(1);
}

if (!isConfirmed) {
  console.error('\n[SAFETY GATE: BLOCKED]');
  console.error('ERROR: STAGING_ENVIRONMENT_CONFIRMED must be set to "true" in your staging config.');
  process.exit(1);
}

// ----------------------------------------------------------------------------
// SUMMARY OF VERIFIED STAGING CONFIGURATION
// ----------------------------------------------------------------------------
console.log('\n[PRE-FLIGHT VERIFICATION: PASSED]');
console.log(`- Project Reference       : ${projectRef}`);
console.log(`- Staging URL             : ${supabaseUrl}`);
console.log(`- Staging Database Host   : ${dbHost ? maskSecret(dbHost) : '[NOT SET]'}`);
console.log(`- Staging Anon Key        : ${maskSecret(anonKey)}`);
console.log(`- Staging Service-Role Key: ${maskSecret(serviceRoleKey)}`);
console.log(`- Production Protection   : VERIFIED (Target is distinct from ${PRODUCTION_PROJECT_REF})`);
console.log(`- Fail-Closed Policy      : ACTIVE (No production fallbacks permitted)`);
console.log('\nStaging environment is verified and ready for migration & concurrency tests.');
process.exit(0);
