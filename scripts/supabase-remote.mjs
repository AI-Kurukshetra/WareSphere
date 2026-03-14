#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const supabaseCliPath = resolve(rootDir, "node_modules", "supabase", "bin", "supabase");
const shellEnvKeys = new Set(Object.keys(process.env));

loadEnvFiles();

const [action = "check", ...args] = process.argv.slice(2);

switch (action) {
  case "check":
    runCheck();
    break;
  case "link":
    runLink(args);
    break;
  case "migrations":
    runMigrations(args);
    break;
  case "push":
    runPush(args);
    break;
  case "help":
  case "--help":
  case "-h":
    printHelp();
    break;
  default:
    console.error(`Unknown action: ${action}`);
    printHelp();
    process.exit(1);
}

function runCheck() {
  const runtimeRequired = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_JWT_SECRET"];
  const recommended = ["DATABASE_MIGRATION_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"];
  const missingRuntime = runtimeRequired.filter((key) => !readEnv(key));
  const usesDirectMigrationUrl = Boolean(readEnv("DATABASE_MIGRATION_URL"));
  const hasLinkedProjectInputs = Boolean(readEnv("SUPABASE_PROJECT_REF") && readEnv("SUPABASE_DB_PASSWORD"));

  console.log("Hosted Supabase environment check");
  console.log("");
  console.log(`Runtime mode: ${readEnv("WMS_STORAGE") ?? "db"}`);
  console.log(`Migration mode: ${usesDirectMigrationUrl ? "direct DATABASE_MIGRATION_URL" : "linked Supabase project"}`);
  console.log("");

  if (missingRuntime.length > 0) {
    console.log(`Missing runtime variables: ${missingRuntime.join(", ")}`);
  } else {
    console.log("Runtime variables: OK");
  }

  if (usesDirectMigrationUrl) {
    console.log("Migration variables: OK via DATABASE_MIGRATION_URL");
  } else if (hasLinkedProjectInputs) {
    console.log("Migration variables: OK via SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD");
  } else {
    console.log(
      "Migration variables: missing DATABASE_MIGRATION_URL or the linked-project pair SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD"
    );
  }

  const missingRecommended = recommended.filter((key) => !readEnv(key));

  if (missingRecommended.length > 0) {
    console.log(`Recommended extras: ${missingRecommended.join(", ")}`);
  }

  if (missingRuntime.length > 0 || (!usesDirectMigrationUrl && !hasLinkedProjectInputs)) {
    process.exit(1);
  }
}

function runLink(extraArgs) {
  const projectRef = requireEnv("SUPABASE_PROJECT_REF");
  const password = requireEnv("SUPABASE_DB_PASSWORD");

  runSupabase(["link", "--project-ref", projectRef, "-p", password, ...extraArgs]);
}

function runMigrations(extraArgs) {
  runSupabase(["migration", "list", ...buildRemoteTargetArgs(), ...extraArgs]);
}

function runPush(extraArgs) {
  runSupabase(["db", "push", ...buildRemoteTargetArgs(), ...extraArgs]);
}

function buildRemoteTargetArgs() {
  const migrationUrl = readEnv("DATABASE_MIGRATION_URL");

  if (migrationUrl) {
    return ["--db-url", migrationUrl];
  }

  const password = requireEnv("SUPABASE_DB_PASSWORD");

  return ["--linked", "-p", password];
}

function runSupabase(argumentsList) {
  const result = spawnSync(supabaseCliPath, argumentsList, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit"
  });

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  process.exit(1);
}

function requireEnv(name) {
  const value = readEnv(name);

  if (!value) {
    console.error(`${name} is required for this command.`);
    process.exit(1);
  }

  return value;
}

function readEnv(name) {
  const value = process.env[name]?.trim();

  if (!value || value.length === 0 || hasTemplatePlaceholder(value)) {
    return null;
  }

  return value;
}

function loadEnvFiles() {
  loadEnvFile(resolve(rootDir, ".env"));
  loadEnvFile(resolve(rootDir, ".env.local"));
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (shellEnvKeys.has(key)) {
      continue;
    }

    process.env[key] = value;
  }
}

function printHelp() {
  console.log(`Usage: node scripts/supabase-remote.mjs <action> [flags]

Actions:
  check        Validate hosted Supabase runtime and migration variables
  link         Link the repo to a hosted Supabase project
  migrations   List local versus remote Supabase migrations
  push         Apply migrations to the hosted database

Examples:
  pnpm env:check
  pnpm supabase:link
  pnpm supabase:migrations
  pnpm supabase:push
  pnpm supabase:push:seed
`);
}

function hasTemplatePlaceholder(value) {
  return (
    value.includes("replace-me") ||
    value.includes("[PROJECT-REF]") ||
    value.includes("[PASSWORD]") ||
    value.includes("[HOST]")
  );
}
