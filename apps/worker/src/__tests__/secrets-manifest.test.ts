import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { envSchema } from "../config.js";

// ops/check-secrets.mjs blocks a deploy when the target environment is missing
// a secret. It reads secrets.manifest.json, which is a second copy of knowledge
// the Zod schema already holds — so this test keeps the two from drifting.

const manifest = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "..", "secrets.manifest.json"), "utf8"),
);

/** Keys the schema refuses to fill in for you: no default, not optional. */
function schemaRequiredKeys(): string[] {
  const shape = envSchema.shape as Record<string, z.ZodTypeAny>;
  return Object.entries(shape)
    .filter(([, field]) => !field.isOptional() && field.safeParse(undefined).success === false)
    .map(([key]) => key);
}

describe("secrets manifest", () => {
  it("lists exactly the secrets the schema will not default", () => {
    expect([...manifest.required].sort()).toEqual(schemaRequiredKeys().sort());
  });

  it("only names secrets the schema knows about", () => {
    const known = new Set(Object.keys(envSchema.shape));
    const declared = [
      ...manifest.required,
      ...Object.values(manifest.environments).flatMap((e: any) => e.expected),
    ];
    expect(declared.filter((name) => !known.has(name))).toEqual([]);
  });

  it("does not repeat a globally required secret in an environment list", () => {
    for (const [name, env] of Object.entries(manifest.environments) as [string, any][]) {
      const repeated = env.expected.filter((s: string) => manifest.required.includes(s));
      expect(repeated, `${name} repeats globally required secrets`).toEqual([]);
    }
  });

  it("covers every environment the Worker deploys to", () => {
    expect(Object.keys(manifest.environments).sort()).toEqual(["production", "staging"]);
  });
});
