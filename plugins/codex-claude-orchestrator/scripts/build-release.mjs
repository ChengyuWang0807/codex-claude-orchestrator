#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const cliPath = path.join(projectRoot, "bin", "cco.mjs");

const result = spawnSync(process.execPath, [cliPath, "pack"], {
  cwd: projectRoot,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
