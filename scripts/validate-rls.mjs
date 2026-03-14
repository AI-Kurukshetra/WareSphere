/**
 * Validate RLS policies by signing in as each role and testing table access.
 *
 * Usage:
 *   pnpm rls:validate
 *
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY in .env.local.
 * Auth users must be provisioned first (pnpm auth:provision).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // skip
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PASSWORD = "Warehouse@123";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  process.exit(1);
}

const users = [
  { email: "admin@local.test", role: "admin" },
  { email: "manager@local.test", role: "manager" },
  { email: "receiver@local.test", role: "receiver" },
  { email: "picker@local.test", role: "picker" },
  { email: "packer@local.test", role: "packer" },
];

// Expected access per role:
//   true  = should return rows (table has seed data AND role has access)
//   false = should return empty or error (role is denied)
//   "empty" = role has access but table has no seed data — expect no error
const accessMatrix = {
  admin:    { warehouses: true, products: true, inventory: true, orders: "empty", tasks: true, integrations: "empty" },
  manager:  { warehouses: true, products: true, inventory: true, orders: "empty", tasks: true, integrations: "empty" },
  receiver: { warehouses: true, products: true, inventory: true, orders: "empty", tasks: true, integrations: false },
  picker:   { warehouses: true, products: true, inventory: false, orders: "empty", tasks: "empty", integrations: false },
  packer:   { warehouses: true, products: true, inventory: false, orders: "empty", tasks: "empty", integrations: false },
};

let passed = 0;
let failed = 0;

async function signIn(email) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });

  if (error || !data.session) {
    throw new Error(`Sign-in failed for ${email}: ${error?.message ?? "no session"}`);
  }

  // Create a client authenticated as this user
  const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
  });

  return authedClient;
}

async function testAccess(client, table, expectation) {
  const { data, error } = await client.from(table).select("id").limit(5);

  if (error) {
    if (expectation === true) {
      return { ok: false, reason: `expected rows but got error: ${error.message}` };
    }
    if (expectation === "empty") {
      return { ok: false, reason: `expected accessible (empty) but got error: ${error.message}` };
    }
    return { ok: true };
  }

  const hasRows = data && data.length > 0;

  if (expectation === true && !hasRows) {
    return { ok: false, reason: "expected rows but got empty result" };
  }

  if (expectation === false && hasRows) {
    return { ok: false, reason: `expected denied but got ${data.length} rows` };
  }

  // "empty" — we just need no error (rows or empty is fine)
  return { ok: true };
}

console.log("RLS Policy Validation\n");

for (const user of users) {
  console.log(`  ${user.role} (${user.email})`);

  let client;
  try {
    client = await signIn(user.email);
  } catch (err) {
    console.log(`    ! Sign-in failed: ${err.message}`);
    failed++;
    continue;
  }

  const expected = accessMatrix[user.role];

  for (const [table, expectation] of Object.entries(expected)) {
    const result = await testAccess(client, table, expectation);
    const label = expectation === true ? "read OK" : expectation === "empty" ? "accessible (no data)" : "denied OK";

    if (result.ok) {
      console.log(`    + ${table.padEnd(22)} ${label}`);
      passed++;
    } else {
      console.log(`    - ${table.padEnd(22)} FAIL: ${result.reason}`);
      failed++;
    }
  }

  console.log();
}

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
