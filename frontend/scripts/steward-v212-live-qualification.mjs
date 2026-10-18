#!/usr/bin/env node
// Compatibility entrypoint for the durable Studionet qualification runner.
// It intentionally has no simulator faucet, ephemeral signer, or standalone write path.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const runner = path.join(repositoryRoot, "scripts", "qualification", "studionet_evidence_qualification.mjs");
const sdk = path.join(frontendRoot, "node_modules", "genlayer-stable", "dist", "index.js");
const args = process.argv.slice(2);

if (args[0] === "--help" || args[0] === "-h") {
  console.log("Usage: GENLAYER_KEYTAR_MODULE=<local-keytar-module> node frontend/scripts/steward-v212-live-qualification.mjs [--resume] [--reuse-contract-address=<address>] [--execute --approved-source-sha=<sha256> --approved-max-gen=1000000000000000]");
  console.log("Without --execute, the underlying runner performs read-only preflight. Writes require its exact-scope local authorization record.");
  process.exit(0);
}

const keytar = process.env.GENLAYER_KEYTAR_MODULE ?? args.shift();
if (!keytar) {
  console.error("A local GenLayer CLI keytar module is required. Set GENLAYER_KEYTAR_MODULE or pass its path as the first argument; never provide wallet keys in chat.");
  process.exit(2);
}
if (!existsSync(runner) || !existsSync(sdk) || !existsSync(keytar)) {
  console.error(JSON.stringify({
    error: "qualification runner dependency is missing",
    runnerExists: existsSync(runner),
    stableSdkExists: existsSync(sdk),
    keytarModuleExists: existsSync(keytar),
  }));
  process.exit(2);
}

const result = spawnSync(process.execPath, [runner, sdk, keytar, ...args], {
  cwd: repositoryRoot,
  stdio: "inherit",
  env: process.env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
