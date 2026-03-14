/**
 * Provision Supabase Auth users that match the seed public.users rows.
 *
 * Usage:
 *   pnpm auth:provision
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Idempotent — skips users that already exist (409 conflict).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually (Node 22+ --env-file flag may not be available)
function loadEnv() {
  for (const name of [".env", ".env.local"]) {
    try {
      const content = readFileSync(resolve(__dirname, "..", name), "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // file not found — skip
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const PASSWORD = "Warehouse@123";

const users = [
  { id: "90000000-0000-0000-0000-000000000001", email: "admin@local.test", role: "admin", displayName: "Local Admin" },
  { id: "90000000-0000-0000-0000-000000000002", email: "manager@local.test", role: "manager", displayName: "Local Manager" },
  { id: "90000000-0000-0000-0000-000000000003", email: "receiver@local.test", role: "receiver", displayName: "Local Receiver" },
  { id: "90000000-0000-0000-0000-000000000004", email: "picker@local.test", role: "picker", displayName: "Local Picker" },
  { id: "90000000-0000-0000-0000-000000000005", email: "packer@local.test", role: "packer", displayName: "Local Packer" },
];

let created = 0;
let skipped = 0;
let failed = 0;

for (const user of users) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        password: PASSWORD,
        email_confirm: true,
        app_metadata: { provider: "email", providers: ["email"], role: user.role },
        user_metadata: { display_name: user.displayName },
      }),
    });

    if (response.ok) {
      console.log(`  + created  ${user.role.padEnd(10)} ${user.email}`);
      created++;
    } else if (response.status === 422) {
      // Supabase returns 422 for duplicate email
      console.log(`  ~ exists   ${user.role.padEnd(10)} ${user.email}`);
      skipped++;
    } else {
      const body = await response.text();
      console.error(`  ! failed   ${user.role.padEnd(10)} ${user.email}  (${response.status}: ${body})`);
      failed++;
    }
  } catch (err) {
    console.error(`  ! error    ${user.role.padEnd(10)} ${user.email}  ${err.message}`);
    failed++;
  }
}

console.log(`\nDone: ${created} created, ${skipped} already existed, ${failed} failed.`);
if (failed > 0) process.exit(1);
