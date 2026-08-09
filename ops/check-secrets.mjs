#!/usr/bin/env node
// Refuse to deploy when the target environment is missing a secret it needs.
//
// The Worker's Zod schema marks most secrets `.optional()`, so a missing one
// does not stop it booting — it quietly disables a feature instead. A deploy
// that turns off transactional email or the Stripe webhook should fail loudly,
// not succeed and wait to be noticed.
//
// Usage: node ops/check-secrets.mjs <environment>

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WORKER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "worker");

function fail(message) {
  console.error(`\n✘ ${message}\n`);
  process.exit(1);
}

const env = process.argv[2];
if (!env) fail("usage: node ops/check-secrets.mjs <environment>");

const manifest = JSON.parse(readFileSync(join(WORKER_DIR, "secrets.manifest.json"), "utf8"));
const envConfig = manifest.environments[env];
if (!envConfig) {
  fail(`no entry for environment "${env}" in secrets.manifest.json`);
}

const wanted = [...manifest.required, ...envConfig.expected];

let present;
try {
  const raw = execFileSync(
    "npx",
    ["wrangler", "secret", "list", "--env", env],
    { cwd: WORKER_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  // wrangler prints a banner before the JSON payload
  const start = raw.indexOf("[");
  if (start === -1) throw new Error(`unexpected output:\n${raw}`);
  present = new Set(JSON.parse(raw.slice(start)).map((s) => s.name));
} catch (error) {
  fail(`could not read the secret list for "${env}": ${error.message}`);
}

const missing = wanted.filter((name) => !present.has(name));

console.log(`Secrets on ${env}: ${present.size} set, ${wanted.length} expected`);

if (missing.length > 0) {
  for (const name of missing) {
    const note = envConfig.notes?.[name];
    console.error(`  missing: ${name}${note ? ` — ${note}` : ""}`);
  }
  fail(
    `${missing.length} secret(s) missing on ${env}. Set them with:\n` +
      missing.map((n) => `    pnpm --filter @badge/worker exec wrangler secret put ${n} --env ${env}`).join("\n"),
  );
}

// Not a failure: an unexpected secret is usually a leftover, occasionally a new
// one someone forgot to declare. Either way it is worth a line in the log.
const undeclared = [...present].filter((name) => !wanted.includes(name));
if (undeclared.length > 0) {
  console.log(`  set but not declared: ${undeclared.join(", ")}`);
}

console.log(`✓ every secret ${env} needs is present`);
