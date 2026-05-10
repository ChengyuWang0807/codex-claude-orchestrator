#!/usr/bin/env node
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, "package.json");
const PLUGIN_MANIFEST_PATH = path.join(PROJECT_ROOT, ".codex-plugin", "plugin.json");
const DEFAULT_TASK_DIR = "./examples/tasks";
const DEFAULT_WORKSPACE_DIR = "./examples/workspace";
const DEFAULT_FORMULA_PATTERNS = [
  String.raw`\b[A-Za-z\u4E00-\u9FFF][A-Za-z0-9_\u4E00-\u9FFF ]{0,24}\s*=\s*[^=\n]+`,
  String.raw`\b(?:O|Theta|Ω)\s*\(`,
  String.raw`(?:<=|>=|≈|∝|λ|μ)`
];

async function main(argv = process.argv.slice(2)) {
  const command = argv[0] ?? "help";
  const args = argv.slice(1);

  switch (command) {
    case "doctor":
      await commandDoctor(args);
      break;
    case "tasks":
      await commandTasks(args);
      break;
    case "sessions":
      await commandSessions(args);
      break;
    case "status":
      await commandStatus(args);
      break;
    case "apply":
      await commandApply(args);
      break;
    case "run":
      await commandRun(args);
      break;
    case "watch":
      await commandWatch(args);
      break;
    case "pack":
      await commandPack(args);
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function printHelp() {
  console.log(`Codex Claude Orchestrator

Usage:
  node ./bin/cco.mjs doctor
  node ./bin/cco.mjs tasks --dir ./examples/tasks
  node ./bin/cco.mjs sessions --workspace ./examples/workspace
  node ./bin/cco.mjs status --config ./examples/tasks/mock-doc-preview.json
  node ./bin/cco.mjs apply --config ./examples/tasks/mock-doc-preview.json
  node ./bin/cco.mjs run --config ./examples/tasks/mock-doc-preview.json
  node ./bin/cco.mjs watch --config ./examples/tasks/mock-doc-preview.json --interval-minutes 120
  node ./bin/cco.mjs pack
`);
}

function parseCommandOptions(args, schema) {
  const { values } = parseArgs({
    args,
    options: schema,
    allowPositionals: false,
    strict: true
  });
  return values;
}

async function commandDoctor(args) {
  const options = parseCommandOptions(args, {
    provider: { type: "string" },
    json: { type: "boolean", default: false }
  });

  const checks = [
    await buildHealthForProcess("node", process.execPath, ["--version"]),
    await buildHealthForProvider("claude"),
    await buildHealthForProvider("codex"),
    {
      name: "mock",
      available: true,
      version: "builtin"
    }
  ];

  const provider = options.provider ? String(options.provider).toLowerCase() : "all";
  const filtered = provider === "all"
    ? checks
    : checks.filter((item) => item.name === provider || item.name === "node");
  const payload = {
    projectRoot: normalizeSlashes(PROJECT_ROOT),
    provider,
    checks: filtered
  };

  if (options.json) {
    printJson(payload);
    return;
  }

  for (const item of filtered) {
    const status = item.available ? "ok" : "missing";
    const tail = item.version ?? item.message ?? "";
    console.log(`${item.name.padEnd(7)} ${status.padEnd(8)} ${tail}`.trimEnd());
  }
}

async function commandTasks(args) {
  const options = parseCommandOptions(args, {
    dir: { type: "string", default: DEFAULT_TASK_DIR },
    json: { type: "boolean", default: false }
  });

  const taskDir = resolveCliPath(PROJECT_ROOT, options.dir);
  const entries = await fs.readdir(taskDir, { withFileTypes: true });
  const tasks = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const fullPath = path.join(taskDir, entry.name);
    const task = await readJson(fullPath);
    tasks.push({
      file: normalizeSlashes(path.relative(PROJECT_ROOT, fullPath)),
      taskName: task.taskName ?? path.basename(entry.name, ".json"),
      provider: task.provider?.kind ?? "unknown",
      writeMode: task.output?.writeMode ?? "preview",
      targetPath: task.output?.targetPath ?? "",
      purpose: task.purpose ?? ""
    });
  }

  tasks.sort((left, right) => left.taskName.localeCompare(right.taskName));
  const payload = {
    taskDir: normalizeSlashes(taskDir),
    tasks
  };

  if (options.json) {
    printJson(payload);
    return;
  }

  for (const task of tasks) {
    console.log(`${task.taskName} | provider=${task.provider} | writeMode=${task.writeMode} | target=${task.targetPath}`);
  }
}

async function commandSessions(args) {
  const options = parseCommandOptions(args, {
    workspace: { type: "string", default: DEFAULT_WORKSPACE_DIR },
    "ledger-dir": { type: "string" },
    json: { type: "boolean", default: false }
  });

  const workspaceRoot = resolveCliPath(PROJECT_ROOT, options.workspace);
  const ledgerRoot = options["ledger-dir"]
    ? resolveCliPath(PROJECT_ROOT, options["ledger-dir"])
    : path.join(workspaceRoot, ".cco");
  const sessionRoot = path.join(ledgerRoot, "session-state");
  const rows = [];

  if (await pathExists(sessionRoot)) {
    const entries = await fs.readdir(sessionRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const sessionFile = path.join(sessionRoot, entry.name, "session.json");
      if (!(await pathExists(sessionFile))) {
        continue;
      }
      const session = await readJson(sessionFile);
      rows.push({
        taskKey: entry.name,
        provider: session.providerKind ?? "",
        sessionId: session.sessionId ?? "",
        sessionMode: session.sessionMode ?? "",
        updatedAt: session.updatedAt ?? ""
      });
    }
  }

  rows.sort((left, right) => left.taskKey.localeCompare(right.taskKey));
  const payload = {
    workspaceRoot: normalizeSlashes(workspaceRoot),
    ledgerRoot: normalizeSlashes(ledgerRoot),
    sessions: rows
  };

  if (options.json) {
    printJson(payload);
    return;
  }

  if (rows.length === 0) {
    console.log("No recorded sessions.");
    return;
  }

  for (const row of rows) {
    console.log(`${row.taskKey} | provider=${row.provider} | session=${row.sessionId} | mode=${row.sessionMode} | updated=${row.updatedAt}`);
  }
}

async function commandStatus(args) {
  const options = parseCommandOptions(args, {
    config: { type: "string" },
    "task-name": { type: "string" },
    workspace: { type: "string", default: DEFAULT_WORKSPACE_DIR },
    "ledger-dir": { type: "string" },
    "run-id": { type: "string" },
    json: { type: "boolean", default: false }
  });

  const taskContext = await resolveTaskContext(options);
  const status = await getRunStatus({
    taskName: taskContext.taskName,
    taskKey: taskContext.taskKey,
    ledgerRoot: taskContext.ledgerRoot,
    runId: options["run-id"] ?? null
  });

  if (options.json) {
    printJson(status);
    return;
  }

  console.log(`task=${status.taskName}`);
  console.log(`run=${status.runId}`);
  console.log(`result=${status.resultLabel}`);
  console.log(`artifact=${status.artifactPath}`);
  if (status.formalPath) {
    console.log(`formal=${status.formalPath}`);
  }
  if (status.appliedAt) {
    console.log(`appliedAt=${status.appliedAt}`);
  }
}

async function commandApply(args) {
  const options = parseCommandOptions(args, {
    config: { type: "string" },
    "task-name": { type: "string" },
    workspace: { type: "string", default: DEFAULT_WORKSPACE_DIR },
    "ledger-dir": { type: "string" },
    "run-id": { type: "string" },
    json: { type: "boolean", default: false }
  });

  const taskContext = await resolveTaskContext(options);
  const result = await applyPreviewArtifact({
    taskName: taskContext.taskName,
    taskKey: taskContext.taskKey,
    ledgerRoot: taskContext.ledgerRoot,
    defaultWorkspaceRoot: taskContext.workspaceRoot,
    defaultTargetPath: taskContext.targetPath,
    runId: options["run-id"] ?? null
  });

  if (options.json) {
    printJson(result);
    return;
  }

  console.log(`task=${result.taskName}`);
  console.log(`run=${result.runId}`);
  console.log(`result=${result.resultLabel}`);
  console.log(`artifact=${result.artifactPath}`);
  if (result.formalPath) {
    console.log(`formal=${result.formalPath}`);
  }
}

async function commandRun(args) {
  const options = parseCommandOptions(args, {
    config: { type: "string" },
    provider: { type: "string" },
    "write-mode": { type: "string" },
    "task-name": { type: "string" },
    purpose: { type: "string" },
    "timeout-minutes": { type: "string" },
    "session-id": { type: "string" },
    "reset-session": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    json: { type: "boolean", default: false }
  });

  if (!options.config) {
    throw new Error("run requires --config");
  }

  const configPath = resolveCliPath(PROJECT_ROOT, options.config);
  const result = await runConfiguredTask(configPath, {
    providerKind: options.provider,
    writeMode: options["write-mode"],
    taskName: options["task-name"],
    purpose: options.purpose,
    timeoutMinutes: options["timeout-minutes"] ? Number(options["timeout-minutes"]) : undefined,
    sessionId: options["session-id"],
    resetSession: options["reset-session"] === true,
    dryRun: options["dry-run"] === true
  });

  if (options.json) {
    printJson(result);
    return;
  }

  console.log(`task=${result.taskName}`);
  console.log(`provider=${result.provider.kind}`);
  console.log(`run=${result.runId}`);
  console.log(`result=${result.resultLabel}`);
  console.log(`artifact=${result.artifactPath}`);
  if (result.formalPath) {
    console.log(`formal=${result.formalPath}`);
  }
  if (result.sessionId) {
    console.log(`session=${result.sessionId}`);
  }
}

async function commandWatch(args) {
  const options = parseCommandOptions(args, {
    config: { type: "string" },
    "interval-minutes": { type: "string", default: "120" },
    "max-runs": { type: "string", default: "4" },
    "doctor-every": { type: "string", default: "1" }
  });

  if (!options.config) {
    throw new Error("watch requires --config");
  }

  const configPath = resolveCliPath(PROJECT_ROOT, options.config);
  const intervalMinutes = Number(options["interval-minutes"]);
  const maxRuns = Number(options["max-runs"]);
  const doctorEvery = Number(options["doctor-every"]);

  for (let index = 1; index <= maxRuns; index += 1) {
    console.log(`[watch] run ${index}/${maxRuns}`);
    try {
      await runConfiguredTask(configPath, {});
    } catch (error) {
      console.error(`[watch] run ${index} failed: ${error.message}`);
    }

    if (doctorEvery > 0 && index % doctorEvery === 0) {
      await commandDoctor([]);
    }

    if (index < maxRuns) {
      await sleep(intervalMinutes * 60 * 1000);
    }
  }
}

async function commandPack(args) {
  const options = parseCommandOptions(args, {
    json: { type: "boolean", default: false }
  });

  const pkg = await readJson(PACKAGE_JSON_PATH);
  const pluginManifest = await readJson(PLUGIN_MANIFEST_PATH);
  const releaseName = `${pkg.name}-v${pkg.version}`;
  const distDir = path.join(PROJECT_ROOT, "dist");
  const releaseRoot = path.join(distDir, releaseName);
  const pluginStageRoot = path.join(releaseRoot, "plugins", pkg.name);
  const zipPath = path.join(distDir, `${releaseName}.zip`);
  const marketplace = buildMarketplaceManifest({
    pluginName: pkg.name,
    category: pluginManifest.interface?.category ?? "Productivity"
  });

  await fs.rm(releaseRoot, { recursive: true, force: true });
  await fs.rm(zipPath, { force: true });
  await fs.mkdir(distDir, { recursive: true });

  await copyReleaseTree(PROJECT_ROOT, pluginStageRoot);
  await writeJson(path.join(releaseRoot, ".agents", "plugins", "marketplace.json"), marketplace);
  await writeJson(path.join(releaseRoot, "release-manifest.json"), {
    name: releaseName,
    version: pkg.version,
    builtAt: new Date().toISOString(),
    marketplaceName: marketplace.name,
    pluginPath: normalizeSlashes(path.relative(releaseRoot, pluginStageRoot)),
    install: {
      addMarketplace: "codex plugin marketplace add <release-root>",
      addMcp: "codex mcp add cco -- node <plugin-root>/bin/cco-mcp-server.mjs"
    }
  });

  const powershell = await resolvePowerShellCommand();
  const script = `Compress-Archive -Path '${escapePowerShell(releaseRoot)}\\*' -DestinationPath '${escapePowerShell(zipPath)}' -Force`;
  await runProcess(powershell, ["-NoProfile", "-Command", script], {
    cwd: PROJECT_ROOT,
    timeoutMs: 120000
  });

  const payload = {
    releaseName,
    releaseRoot: normalizeSlashes(releaseRoot),
    pluginStageRoot: normalizeSlashes(pluginStageRoot),
    zipPath: normalizeSlashes(zipPath)
  };

  if (options.json) {
    printJson(payload);
    return;
  }

  console.log(`staged=${payload.releaseRoot}`);
  console.log(`plugin=${payload.pluginStageRoot}`);
  console.log(`zip=${payload.zipPath}`);
}

async function resolveTaskContext(options) {
  if (options.config) {
    return loadTaskContextFromConfig(resolveCliPath(PROJECT_ROOT, options.config));
  }
  if (!options["task-name"]) {
    throw new Error("Provide either --config or --task-name.");
  }

  const workspaceRoot = resolveCliPath(PROJECT_ROOT, options.workspace ?? DEFAULT_WORKSPACE_DIR);
  const ledgerRoot = options["ledger-dir"]
    ? resolveCliPath(PROJECT_ROOT, options["ledger-dir"])
    : path.join(workspaceRoot, ".cco");

  return {
    configPath: null,
    taskName: options["task-name"],
    taskKey: normalizeTaskKey(options["task-name"]),
    workspaceRoot,
    ledgerRoot,
    targetPath: null
  };
}

async function loadTaskContextFromConfig(configPath) {
  const config = await readJson(configPath);
  ensureTaskConfig(config, configPath);
  const configDir = path.dirname(configPath);
  const workspaceRoot = resolveConfigPath(configDir, config.workspace?.root ?? ".");
  const ledgerRoot = resolveConfigPath(configDir, config.workspace?.ledgerDir ?? path.join(workspaceRoot, ".cco"));

  return {
    configPath,
    taskName: config.taskName,
    taskKey: normalizeTaskKey(config.taskName),
    workspaceRoot,
    ledgerRoot,
    targetPath: config.output?.targetPath ?? null
  };
}

async function getRunStatus({ taskName, taskKey, ledgerRoot, runId }) {
  const { manifest } = await readRunManifest({ ledgerRoot, taskKey, runId });
  return buildRunStatus(manifest, {
    taskName,
    taskKey,
    ledgerRoot
  });
}

async function applyPreviewArtifact({ taskName, taskKey, ledgerRoot, defaultWorkspaceRoot, defaultTargetPath, runId }) {
  const { manifest, manifestPath, latestRunPath } = await readRunManifest({ ledgerRoot, taskKey, runId });
  const workspaceRoot = manifest.workspaceRoot ?? defaultWorkspaceRoot;
  const targetPath = manifest.targetPath ?? defaultTargetPath;
  const artifactPath = manifest.artifactPath;

  if (!artifactPath || !(await pathExists(artifactPath))) {
    throw new Error("Preview artifact not found for the requested run.");
  }
  if (!workspaceRoot) {
    throw new Error("workspaceRoot is missing. Re-run with a config-backed task or provide a run generated by the current runtime.");
  }
  if (!targetPath) {
    throw new Error("targetPath is missing. Re-run with a config-backed task or provide a run generated by the current runtime.");
  }

  const formalPath = path.join(workspaceRoot, targetPath);
  await writeText(formalPath, await readText(artifactPath));

  const updatedManifest = {
    ...manifest,
    workspaceRoot,
    targetPath,
    formalPath,
    resultLabel: "success-apply",
    appliedAt: new Date().toISOString()
  };

  await writeJson(manifestPath, updatedManifest);
  await writeJson(latestRunPath, {
    taskName: updatedManifest.taskName,
    taskKey: updatedManifest.taskKey,
    runId: updatedManifest.runId,
    resultLabel: updatedManifest.resultLabel,
    updatedAt: updatedManifest.appliedAt
  });
  await appendJsonl(path.join(ledgerRoot, "run-ledger.jsonl"), {
    event: "apply-finish",
    taskName: updatedManifest.taskName,
    taskKey: updatedManifest.taskKey,
    provider: updatedManifest.provider?.kind ?? "",
    sessionId: updatedManifest.sessionId ?? null,
    runId: updatedManifest.runId,
    resultLabel: updatedManifest.resultLabel,
    artifactPath: updatedManifest.artifactPath,
    formalPath
  });

  return buildRunStatus(updatedManifest, {
    taskName,
    taskKey,
    ledgerRoot
  });
}

async function runConfiguredTask(configPath, overrides) {
  const configDir = path.dirname(configPath);
  const config = mergeConfig(await readJson(configPath), overrides);
  ensureConfig(config, configPath);

  const provider = buildProviderConfig(config.provider);
  const output = buildOutputConfig(config.output);
  const validation = buildValidationConfig(config.validation);
  const workspaceRoot = resolveConfigPath(configDir, config.workspace?.root ?? ".");
  const ledgerRoot = resolveConfigPath(configDir, config.workspace?.ledgerDir ?? path.join(workspaceRoot, ".cco"));
  const taskKey = normalizeTaskKey(config.taskName);
  const prompt = await buildPrompt(config, configDir);
  const runContext = await createRunContext(ledgerRoot, taskKey, output.targetPath);
  const sessionState = await resolveSessionState({
    ledgerRoot,
    taskKey,
    taskName: config.taskName,
    provider,
    providedSessionId: overrides.sessionId,
    resetSession: overrides.resetSession === true
  });

  await fs.mkdir(workspaceRoot, { recursive: true });
  await appendJsonl(path.join(ledgerRoot, "session-ledger.jsonl"), {
    event: "session-bind",
    taskName: config.taskName,
    taskKey,
    provider: provider.kind,
    sessionId: sessionState.sessionId,
    sessionMode: provider.sessionMode,
    action: sessionState.action
  });
  await appendJsonl(path.join(ledgerRoot, "run-ledger.jsonl"), {
    event: "run-start",
    taskName: config.taskName,
    taskKey,
    provider: provider.kind,
    sessionId: sessionState.sessionId,
    writeMode: output.writeMode,
    runId: runContext.runId,
    dryRun: overrides.dryRun === true
  });

  if (overrides.dryRun === true) {
    const dryResult = {
      taskName: config.taskName,
      taskKey,
      purpose: config.purpose,
      provider,
      sessionId: sessionState.sessionId,
      runId: runContext.runId,
      artifactPath: normalizeSlashes(runContext.artifactPath),
      formalPath: output.writeMode === "apply" ? normalizeSlashes(path.join(workspaceRoot, output.targetPath)) : null,
      resultLabel: "planned",
      workspaceRoot: normalizeSlashes(workspaceRoot),
      ledgerRoot: normalizeSlashes(ledgerRoot),
      targetPath: output.targetPath,
      writeMode: output.writeMode,
      configPath: normalizeSlashes(configPath),
      createdAt: new Date().toISOString(),
      appliedAt: null,
      validation
    };
    await writeJson(path.join(runContext.metaDir, "run-manifest.json"), dryResult);
    return dryResult;
  }

  let providerResult = await invokeProvider(provider, {
    prompt,
    cwd: workspaceRoot,
    timeoutMinutes: config.timeoutMinutes ?? 20,
    sessionState
  });

  let outputText = unwrapCodeFence(providerResult.text);
  let quality = validateOutput(outputText, validation);
  let repairAttempt = 0;

  while (!quality.valid && repairAttempt < validation.repairAttempts && provider.kind !== "mock") {
    repairAttempt += 1;
    providerResult = await invokeProvider(provider, {
      prompt: buildRepairPrompt({
        originalPrompt: prompt,
        invalidOutput: outputText,
        reasons: quality.reasons
      }),
      cwd: workspaceRoot,
      timeoutMinutes: config.timeoutMinutes ?? 20,
      sessionState: {
        ...sessionState,
        sessionId: providerResult.sessionId ?? sessionState.sessionId,
        useResume: true
      }
    });
    outputText = unwrapCodeFence(providerResult.text);
    quality = validateOutput(outputText, validation);
  }

  if (!quality.valid) {
    throw new Error(`Validation failed: ${quality.reasons.join("; ")}`);
  }

  const finalSessionId = providerResult.sessionId ?? sessionState.sessionId ?? null;
  await writeText(runContext.artifactPath, outputText);

  let formalPath = null;
  let resultLabel = "success-preview";
  let appliedAt = null;

  if (output.writeMode === "apply") {
    formalPath = path.join(workspaceRoot, output.targetPath);
    await writeText(formalPath, outputText);
    resultLabel = "success-apply";
    appliedAt = new Date().toISOString();
  }

  await persistSessionState({
    ledgerRoot,
    taskKey,
    taskName: config.taskName,
    provider,
    sessionId: finalSessionId
  });

  const manifest = {
    taskName: config.taskName,
    taskKey,
    purpose: config.purpose,
    provider,
    sessionId: finalSessionId,
    runId: runContext.runId,
    runDir: normalizeSlashes(runContext.runDir),
    artifactPath: normalizeSlashes(runContext.artifactPath),
    formalPath: formalPath ? normalizeSlashes(formalPath) : null,
    resultLabel,
    validation,
    configPath: normalizeSlashes(configPath),
    workspaceRoot: normalizeSlashes(workspaceRoot),
    ledgerRoot: normalizeSlashes(ledgerRoot),
    targetPath: output.targetPath,
    writeMode: output.writeMode,
    createdAt: new Date().toISOString(),
    appliedAt
  };

  await writeJson(path.join(runContext.metaDir, "run-manifest.json"), manifest);
  await writeJson(path.join(path.dirname(runContext.runDir), "latest-run.json"), {
    taskName: config.taskName,
    taskKey,
    runId: runContext.runId,
    resultLabel,
    updatedAt: appliedAt ?? manifest.createdAt
  });
  await appendJsonl(path.join(ledgerRoot, "run-ledger.jsonl"), {
    event: "run-finish",
    taskName: config.taskName,
    taskKey,
    provider: provider.kind,
    sessionId: finalSessionId,
    runId: runContext.runId,
    resultLabel,
    artifactPath: manifest.artifactPath,
    formalPath: manifest.formalPath
  });

  return buildRunStatus(manifest, {
    taskName: config.taskName,
    taskKey,
    ledgerRoot
  });
}

function mergeConfig(config, overrides) {
  const provider = { ...(config.provider ?? {}) };
  const output = { ...(config.output ?? {}) };
  const merged = {
    ...config,
    provider,
    output
  };

  if (overrides.providerKind) {
    provider.kind = overrides.providerKind;
  }
  if (overrides.writeMode) {
    output.writeMode = overrides.writeMode;
  }
  if (overrides.taskName) {
    merged.taskName = overrides.taskName;
  }
  if (overrides.purpose) {
    merged.purpose = overrides.purpose;
  }
  if (typeof overrides.timeoutMinutes === "number" && Number.isFinite(overrides.timeoutMinutes)) {
    merged.timeoutMinutes = overrides.timeoutMinutes;
  }

  return merged;
}

function ensureTaskConfig(config, configPath) {
  if (!config.taskName) {
    throw new Error(`taskName is required in ${configPath}`);
  }
}

function ensureConfig(config, configPath) {
  ensureTaskConfig(config, configPath);
  if (!config.provider?.kind) {
    throw new Error(`provider.kind is required in ${configPath}`);
  }
  if (!config.output?.targetPath) {
    throw new Error(`output.targetPath is required in ${configPath}`);
  }
}

function buildProviderConfig(provider) {
  return {
    kind: String(provider.kind).toLowerCase(),
    model: provider.model ?? null,
    effort: provider.effort ?? "medium",
    sessionMode: provider.sessionMode ?? "single",
    permissionMode: provider.permissionMode ?? "bypassPermissions",
    sandbox: provider.sandbox ?? "read-only",
    name: provider.name ?? null
  };
}

function buildOutputConfig(output) {
  return {
    targetPath: output.targetPath,
    writeMode: output.writeMode ?? "preview"
  };
}

function buildValidationConfig(validation) {
  return {
    requireTopLevelTitle: validation?.requireTopLevelTitle !== false,
    requiredHeadings: validation?.requiredHeadings ?? [],
    requireFormulaLike: validation?.requireFormulaLike === true,
    formulaPatterns: validation?.formulaPatterns ?? [],
    minLines: Number(validation?.minLines ?? 0),
    allowCodeFences: validation?.allowCodeFences !== false,
    repairAttempts: Number(validation?.repairAttempts ?? 0)
  };
}

async function buildPrompt(config, configDir) {
  const prompt = config.prompt ?? {};
  let text = "";

  if (prompt.templateFile) {
    text += await readText(resolveConfigPath(configDir, prompt.templateFile));
  }
  if (prompt.inline) {
    text += `${text ? "\n\n" : ""}${prompt.inline}`;
  }

  const variables = {
    ...(prompt.variables ?? {}),
    taskName: config.taskName,
    purpose: config.purpose ?? ""
  };
  text = applyVariables(text, variables);

  const contextFiles = prompt.contextFiles ?? [];
  if (contextFiles.length > 0) {
    const blocks = [];
    for (const relativeFile of contextFiles) {
      const fullPath = resolveConfigPath(configDir, relativeFile);
      const content = await readText(fullPath);
      const name = path.basename(fullPath);
      blocks.push(`\n\n--- BEGIN CONTEXT: ${name} ---\n${content}\n--- END CONTEXT: ${name} ---`);
    }
    text += blocks.join("");
  }

  return text.trim();
}

function applyVariables(text, variables) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key]);
    }
    return "";
  });
}

function validateOutput(text, validation) {
  const reasons = [];
  const trimmed = text.trim();
  const lineCount = trimmed ? trimmed.split(/\r?\n/).length : 0;

  if (!trimmed) {
    reasons.push("output is empty");
  }
  if (validation.requireTopLevelTitle && !/^#\s+\S+/m.test(trimmed)) {
    reasons.push("missing top-level title");
  }
  if (!validation.allowCodeFences && /```/.test(trimmed)) {
    reasons.push("contains code fences");
  }
  for (const heading of validation.requiredHeadings) {
    if (!trimmed.includes(heading)) {
      reasons.push(`missing heading: ${heading}`);
    }
  }
  if (validation.requireFormulaLike) {
    const patterns = validation.formulaPatterns.length > 0
      ? validation.formulaPatterns
      : DEFAULT_FORMULA_PATTERNS;
    const hasFormulaLike = patterns.some((pattern) => new RegExp(pattern, "u").test(trimmed));
    if (!hasFormulaLike) {
      reasons.push("missing formula-like expression");
    }
  }
  if (validation.minLines > 0 && lineCount < validation.minLines) {
    reasons.push(`too short: ${lineCount} lines < ${validation.minLines}`);
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}

function buildRepairPrompt({ originalPrompt, invalidOutput, reasons }) {
  return [
    "Your previous output failed validation. Rewrite it immediately.",
    "",
    "Validation failures:",
    ...reasons.map((reason) => `- ${reason}`),
    "",
    "Output only the final Markdown body.",
    "Do not wrap the answer in code fences and do not add commentary.",
    "",
    "Original task:",
    originalPrompt,
    "",
    "Invalid output:",
    invalidOutput
  ].join("\n");
}

function unwrapCodeFence(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  const lines = trimmed.split(/\r?\n/);
  if (lines.length >= 3 && lines[0].startsWith("```") && lines.at(-1).startsWith("```")) {
    return lines.slice(1, -1).join("\n").trim();
  }
  return trimmed;
}

async function invokeProvider(provider, runtime) {
  switch (provider.kind) {
    case "claude":
      return invokeClaude(provider, runtime);
    case "codex":
      return invokeCodex(provider, runtime);
    case "mock":
      return invokeMock();
    default:
      throw new Error(`Unsupported provider: ${provider.kind}`);
  }
}

async function invokeClaude(provider, runtime) {
  const command = await resolveClaudeCommand();
  const sessionId = runtime.sessionState.sessionId ?? crypto.randomUUID();
  const useResume = runtime.sessionState.useResume === true;
  const args = [
    "--print",
    "--bare",
    "--permission-mode",
    provider.permissionMode,
    "--output-format",
    "text"
  ];

  if (provider.model) {
    args.push("--model", provider.model);
  }
  if (provider.effort) {
    args.push("--effort", provider.effort);
  }
  if (provider.sessionMode === "single") {
    if (useResume) {
      args.push("--resume", sessionId);
    } else {
      args.push("--session-id", sessionId);
      if (provider.name) {
        args.push("--name", provider.name);
      }
    }
  } else {
    args.push("--no-session-persistence");
  }
  args.push("--", runtime.prompt);

  try {
    const result = await runProcess(command, args, {
      cwd: runtime.cwd,
      timeoutMs: minutesToMs(runtime.timeoutMinutes)
    });
    return {
      text: result.stdout.trim(),
      sessionId
    };
  } catch (error) {
    if (useResume && /No conversation found with session ID/i.test(error.message)) {
      return invokeClaude(provider, {
        ...runtime,
        sessionState: {
          ...runtime.sessionState,
          sessionId,
          useResume: false
        }
      });
    }
    throw error;
  }
}

async function invokeCodex(provider, runtime) {
  const runner = await resolveCodexRunner();
  const outputFile = path.join(os.tmpdir(), `cco-codex-output-${crypto.randomUUID()}.txt`);
  const baseArgs = [
    "--skip-git-repo-check",
    "--json",
    "--color",
    "never",
    "-o",
    outputFile
  ];

  if (provider.model) {
    baseArgs.push("--model", provider.model);
  }

  let args;
  if (provider.sessionMode === "single" && runtime.sessionState.sessionId) {
    args = ["exec", "resume", runtime.sessionState.sessionId, ...baseArgs];
  } else {
    args = ["exec", ...baseArgs, "--sandbox", provider.sandbox];
    if (provider.sessionMode !== "single") {
      args.push("--ephemeral");
    }
  }
  args.push(runtime.prompt);

  try {
    const result = await runProcess(runner.command, [...runner.prefixArgs, ...args], {
      cwd: runtime.cwd,
      timeoutMs: minutesToMs(runtime.timeoutMinutes)
    });
    const text = await readText(outputFile);
    return {
      text,
      sessionId: parseCodexThreadId(result.stdout) ?? runtime.sessionState.sessionId ?? null
    };
  } finally {
    await fs.rm(outputFile, { force: true });
  }
}

async function invokeMock() {
  return {
    text: [
      "# Control Plane vs Execution Plane",
      "## Navigation",
      "- Read this note when you need to decide whether an agent workflow should be orchestrated or stay single-loop.",
      "- Treat preview, validation, and apply as separate safety gates rather than one write step.",
      "## Outline",
      "1. Problem Framing",
      "2. Concept Boundary",
      "3. Mechanism Breakdown",
      "4. Formula and Metrics",
      "5. Trade-offs",
      "6. Failure Modes",
      "7. Summary",
      "## Key Takeaways",
      "- The control plane chooses tasks, sessions, validation, and landing policy.",
      "- The execution plane focuses on generation quality, exploration, and local tool use.",
      "- Preview-first pipelines reduce formal write risk before content is applied.",
      "## Problem Framing",
      "Long-running document or research jobs need replayability, not just a fast first answer.",
      "## Concept Boundary",
      "A control plane decides who should act, under which policy, and how results are persisted.",
      "An execution plane is the worker loop that turns prompts into concrete artifacts.",
      "## Mechanism Breakdown",
      "This runtime stores task configs, session ledgers, preview artifacts, and apply decisions outside the writing agent.",
      "That split lets Claude Code, Codex, or a mock adapter share one operational contract.",
      "## Formula and Metrics",
      "orchestration_value = governance + repeatability + recoverability",
      "If coordination_cost > orchestration_value, a direct single-agent workflow is usually the better choice.",
      "## Trade-offs",
      "Orchestration adds structure, but it also adds more state, more policy, and more testing surface.",
      "## Failure Modes",
      "Teams often confuse preview artifacts with final outputs and skip the apply review checkpoint.",
      "## Summary",
      "Use orchestration when the workflow is risky, repeated, or long-lived; skip it for tiny disposable edits."
    ].join("\n"),
    sessionId: null
  };
}

function parseCodexThreadId(stdout) {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }
    try {
      const payload = JSON.parse(trimmed);
      if (payload.type === "thread.started" && payload.thread_id) {
        return payload.thread_id;
      }
    } catch {
    }
  }
  return null;
}

async function buildHealthForProvider(providerKind) {
  try {
    const runner = providerKind === "claude"
      ? { command: await resolveClaudeCommand(), prefixArgs: [] }
      : await resolveCodexRunner();
    const result = await runProcess(runner.command, [...runner.prefixArgs, "--version"], {
      cwd: PROJECT_ROOT,
      timeoutMs: 30000
    });
    return {
      name: providerKind,
      available: true,
      version: result.stdout.trim() || result.stderr.trim()
    };
  } catch (error) {
    return {
      name: providerKind,
      available: false,
      message: error.message
    };
  }
}

async function buildHealthForProcess(name, command, args) {
  try {
    const result = await runProcess(command, args, {
      cwd: PROJECT_ROOT,
      timeoutMs: 30000
    });
    return {
      name,
      available: true,
      version: result.stdout.trim() || result.stderr.trim()
    };
  } catch (error) {
    return {
      name,
      available: false,
      message: error.message
    };
  }
}

async function resolveSessionState({ ledgerRoot, taskKey, provider, providedSessionId, resetSession }) {
  const stateDir = path.join(ledgerRoot, "session-state", taskKey);
  const stateFile = path.join(stateDir, "session.json");
  await fs.mkdir(stateDir, { recursive: true });

  const existing = await readJsonIfExists(stateFile);

  if (provider.sessionMode !== "single") {
    return {
      action: "ephemeral",
      sessionId: null,
      useResume: false
    };
  }

  if (providedSessionId) {
    return {
      action: "provided",
      sessionId: providedSessionId,
      useResume: false
    };
  }

  if (!resetSession && existing?.sessionId) {
    return {
      action: "resume-existing",
      sessionId: existing.sessionId,
      useResume: true
    };
  }

  if (provider.kind === "claude") {
    return {
      action: "created-new",
      sessionId: crypto.randomUUID(),
      useResume: false
    };
  }

  return {
    action: "created-new",
    sessionId: null,
    useResume: false
  };
}

async function persistSessionState({ ledgerRoot, taskKey, taskName, provider, sessionId }) {
  if (provider.sessionMode !== "single" || !sessionId) {
    return;
  }
  const stateFile = path.join(ledgerRoot, "session-state", taskKey, "session.json");
  await writeJson(stateFile, {
    taskName,
    taskKey,
    providerKind: provider.kind,
    sessionMode: provider.sessionMode,
    sessionId,
    updatedAt: new Date().toISOString()
  });
}

async function createRunContext(ledgerRoot, taskKey, targetPath) {
  const runId = `${timestampSlug()}-${taskKey}`;
  const runDir = path.join(ledgerRoot, "sandbox", taskKey, "runs", runId);
  const generatedDir = path.join(runDir, "preview");
  const metaDir = path.join(runDir, "meta");
  const artifactPath = path.join(generatedDir, targetPath);

  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.mkdir(metaDir, { recursive: true });

  return {
    runId,
    runDir,
    artifactPath,
    metaDir
  };
}

async function readRunManifest({ ledgerRoot, taskKey, runId }) {
  const runsRoot = path.join(ledgerRoot, "sandbox", taskKey, "runs");
  const latestRunPath = path.join(runsRoot, "latest-run.json");
  let resolvedRunId = runId;

  if (!resolvedRunId) {
    const latest = await readJsonIfExists(latestRunPath);
    resolvedRunId = latest?.runId ?? null;
  }

  if (!resolvedRunId) {
    throw new Error(`No run found for task "${taskKey}".`);
  }

  const manifestPath = path.join(runsRoot, resolvedRunId, "meta", "run-manifest.json");
  if (!(await pathExists(manifestPath))) {
    throw new Error(`Run manifest not found for run "${resolvedRunId}".`);
  }

  return {
    manifest: await readJson(manifestPath),
    manifestPath,
    latestRunPath
  };
}

function buildRunStatus(manifest, context) {
  return {
    taskName: manifest.taskName ?? context.taskName,
    taskKey: manifest.taskKey ?? context.taskKey,
    provider: manifest.provider?.kind ?? null,
    runId: manifest.runId ?? null,
    resultLabel: manifest.resultLabel ?? null,
    artifactPath: manifest.artifactPath ?? null,
    formalPath: manifest.formalPath ?? null,
    targetPath: manifest.targetPath ?? null,
    workspaceRoot: manifest.workspaceRoot ?? null,
    ledgerRoot: manifest.ledgerRoot ?? normalizeSlashes(context.ledgerRoot),
    sessionId: manifest.sessionId ?? null,
    writeMode: manifest.writeMode ?? null,
    createdAt: manifest.createdAt ?? null,
    appliedAt: manifest.appliedAt ?? null,
    validation: manifest.validation ?? null,
    providerConfig: manifest.provider ?? null
  };
}

async function resolveClaudeCommand() {
  const matches = await lookupCommands("claude");
  for (const match of matches) {
    const exePath = path.join(path.dirname(match), "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (await pathExists(exePath)) {
      return exePath;
    }
  }

  const executable = matches.find((item) => item.toLowerCase().endsWith(".exe"));
  if (executable) {
    return executable;
  }

  const cmdWrapper = matches.find((item) => item.toLowerCase().endsWith(".cmd"));
  if (cmdWrapper) {
    return cmdWrapper;
  }

  const fallback = "D:\\nvm4w\\nodejs\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe";
  if (await pathExists(fallback)) {
    return fallback;
  }
  throw new Error("Claude Code executable not found.");
}

async function resolveCodexRunner() {
  const bundledNode = "D:\\nvm4w\\nodejs\\node.exe";
  const bundledScript = "D:\\nvm4w\\nodejs\\node_modules\\@openai\\codex\\bin\\codex.js";
  if (await pathExists(bundledNode) && await pathExists(bundledScript)) {
    return {
      command: bundledNode,
      prefixArgs: [bundledScript]
    };
  }

  const matches = await lookupCommands("codex");
  const executable = matches.find((item) => item.toLowerCase().endsWith(".exe"));
  if (executable) {
    return {
      command: executable,
      prefixArgs: []
    };
  }

  const cmdWrapper = matches.find((item) => item.toLowerCase().endsWith(".cmd"));
  if (cmdWrapper) {
    return {
      command: cmdWrapper,
      prefixArgs: []
    };
  }

  throw new Error("Codex executable not found.");
}

async function resolvePowerShellCommand() {
  const matches = await lookupCommands("powershell");
  const preferred = matches.find((item) => item.toLowerCase().endsWith(".exe"));
  if (preferred) {
    return preferred;
  }
  throw new Error("PowerShell executable not found.");
}

async function lookupCommands(name) {
  const whereCommand = process.platform === "win32" ? "where.exe" : "which";
  try {
    const result = await runProcess(whereCommand, [name], {
      cwd: PROJECT_ROOT,
      timeoutMs: 30000
    });
    return result.stdout
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function runProcess(command, args, options) {
  const isCmdScript = /\.(cmd|bat)$/i.test(command);
  const isPowerShellScript = /\.ps1$/i.test(command);
  let file = command;
  let finalArgs = args;

  if (isCmdScript) {
    file = process.env.ComSpec ?? "cmd.exe";
    finalArgs = ["/d", "/s", "/c", buildWindowsCmdInvocation(command, args)];
  } else if (isPowerShellScript) {
    file = await resolvePowerShellCommand();
    finalArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", command, ...args];
  }

  return new Promise((resolve, reject) => {
    const child = spawn(file, finalArgs, {
      cwd: options.cwd,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) {
        return;
      }
      finished = true;
      child.kill();
      reject(new Error(`Command timed out: ${command} ${args.join(" ")}`));
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      if (finished) {
        return;
      }
      finished = true;
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (finished) {
        return;
      }
      finished = true;
      if (code !== 0) {
        reject(new Error(`Command failed (${code}): ${command} ${args.join(" ")}\n${stdout}\n${stderr}`.trim()));
        return;
      }
      resolve({ stdout, stderr, code });
    });
  });
}

function buildWindowsCmdInvocation(command, args) {
  const parts = [quoteWindowsArg(command), ...args.map((item) => quoteWindowsArg(item))];
  return `"${parts.join(" ")}"`;
}

function quoteWindowsArg(value) {
  const text = String(value ?? "");
  if (text.length === 0) {
    return "\"\"";
  }
  if (!/[\s"]/u.test(text)) {
    return text;
  }

  let result = "\"";
  let backslashes = 0;
  for (const character of text) {
    if (character === "\\") {
      backslashes += 1;
      continue;
    }
    if (character === "\"") {
      result += "\\".repeat(backslashes * 2 + 1);
      result += "\"";
      backslashes = 0;
      continue;
    }
    if (backslashes > 0) {
      result += "\\".repeat(backslashes);
      backslashes = 0;
    }
    result += character;
  }
  if (backslashes > 0) {
    result += "\\".repeat(backslashes * 2);
  }
  result += "\"";
  return result;
}

async function copyReleaseTree(sourceDir, targetDir) {
  const ignore = new Set(["dist", "node_modules", ".cco"]);
  await fs.mkdir(targetDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignore.has(entry.name)) {
      continue;
    }
    const from = path.join(sourceDir, entry.name);
    const to = path.join(targetDir, entry.name);
    const relativeFromProject = normalizeSlashes(path.relative(PROJECT_ROOT, from));
    if (relativeFromProject.startsWith("examples/workspace/generated/") && entry.name !== ".gitkeep") {
      continue;
    }
    if (entry.isDirectory()) {
      await copyReleaseTree(from, to);
      continue;
    }
    if (entry.isFile()) {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
    }
  }
}

function buildMarketplaceManifest({ pluginName, category }) {
  return {
    name: "codex-claude-orchestrator-marketplace",
    interface: {
      displayName: "Codex Claude Orchestrator"
    },
    plugins: [
      {
        name: pluginName,
        source: {
          source: "local",
          path: `./plugins/${pluginName}`
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL"
        },
        category
      }
    ]
  };
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

async function readJsonIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJson(filePath);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function appendJsonl(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify({ timestamp: new Date().toISOString(), ...value })}\n`, "utf8");
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function writeText(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${text.trimEnd()}\n`, "utf8");
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveConfigPath(configDir, relativePath) {
  return path.resolve(configDir, relativePath);
}

function resolveCliPath(baseDir, maybeRelativePath) {
  return path.resolve(baseDir, maybeRelativePath);
}

function normalizeTaskKey(taskName) {
  return String(taskName)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSlashes(value) {
  return String(value).replaceAll("\\", "/");
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function timestampSlug() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function minutesToMs(minutes) {
  return Math.max(1, Number(minutes)) * 60 * 1000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapePowerShell(value) {
  return value.replaceAll("'", "''");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
