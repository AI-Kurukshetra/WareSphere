import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const envFiles = [".env.local", ".env"];
const target = (process.argv[2] ?? "all").trim();

const fileEnv = Object.assign({}, ...envFiles.map(loadEnvFile));

function loadEnvFile(filename) {
  const absolutePath = path.join(rootDir, filename);

  if (!existsSync(absolutePath)) {
    return {};
  }

  const content = readFileSync(absolutePath, "utf8");
  const values = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator < 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function readEnv(key) {
  return process.env[key] ?? fileEnv[key] ?? "";
}

function isPlaceholder(value) {
  if (!value) {
    return true;
  }

  const normalized = value.trim().toLowerCase();

  return (
    normalized.includes("replace-me") ||
    normalized.includes("[project-ref]") ||
    normalized.includes("[db-password]") ||
    normalized.includes("[password]") ||
    normalized.includes("[anon-key]") ||
    normalized.includes("[service-role-key]") ||
    normalized.includes("[jwt-secret]") ||
    normalized.includes("[personal-access-token]") ||
    normalized.includes("[webhook-secret]") ||
    normalized.includes("[pooler-host]") ||
    normalized.includes("example-shopify-app.test")
  );
}

function expectValue(key, errors, options = {}) {
  const value = readEnv(key);
  if (isPlaceholder(value)) {
    errors.push(`${key} is missing or still uses a placeholder value.`);
    return "";
  }

  if (options.mustUseHttps && !value.startsWith("https://")) {
    errors.push(`${key} must use https in production.`);
  }

  if (options.rejectLocalhost && /localhost|127\.0\.0\.1/u.test(value)) {
    errors.push(`${key} must point at a deployed service, not localhost.`);
  }

  if (options.mustEqual && value !== options.mustEqual) {
    errors.push(`${key} must be set to ${options.mustEqual}.`);
  }

  return value;
}

function validateWeb() {
  const errors = [];
  const apiBaseUrl = readEnv("API_BASE_URL") || readEnv("NEXT_PUBLIC_API_BASE_URL");

  if (isPlaceholder(apiBaseUrl)) {
    errors.push("API_BASE_URL is required for the web deployment.");
  } else {
    if (!apiBaseUrl.startsWith("https://")) {
      errors.push("API_BASE_URL must use https in production.");
    }

    if (/localhost|127\.0\.0\.1/u.test(apiBaseUrl)) {
      errors.push("API_BASE_URL must not point to localhost in production.");
    }
  }

  const supabaseUrl =
    readEnv("SUPABASE_URL") || readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey =
    readEnv("SUPABASE_ANON_KEY") || readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (isPlaceholder(supabaseUrl)) {
    errors.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  } else if (!supabaseUrl.startsWith("https://")) {
    errors.push("SUPABASE_URL must use https.");
  }

  if (isPlaceholder(supabaseAnonKey)) {
    errors.push("SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
  }

  if (readEnv("ALLOW_DEV_AUTH_HEADERS") === "true") {
    errors.push("ALLOW_DEV_AUTH_HEADERS must be false for web production deployments.");
  }

  return errors;
}

function validateApi() {
  const errors = [];

  expectValue("DATABASE_URL", errors);
  expectValue("SUPABASE_URL", errors, { mustUseHttps: true });

  if (readEnv("WMS_STORAGE") === "memory") {
    errors.push("WMS_STORAGE must not be set to memory for production API deployments.");
  }

  if (readEnv("ALLOW_DEV_AUTH_HEADERS") === "true") {
    errors.push("ALLOW_DEV_AUTH_HEADERS must be false for API production deployments.");
  }

  if (isPlaceholder(readEnv("SUPABASE_JWT_SECRET"))) {
    console.warn(
      "warning: SUPABASE_JWT_SECRET is not set. This is acceptable only if your Supabase project uses ES256/JWKS."
    );
  }

  return errors;
}

const validations = {
  all: () => [...validateWeb(), ...validateApi()],
  api: validateApi,
  web: validateWeb
};

if (!(target in validations)) {
  console.error(`Unknown deployment target "${target}". Use one of: all, api, web.`);
  process.exit(1);
}

const errors = validations[target]();

if (errors.length > 0) {
  console.error("Deployment environment validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Deployment environment validation passed for target: ${target}`);
