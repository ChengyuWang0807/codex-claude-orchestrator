#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVER_PATH = path.join(PROJECT_ROOT, "bin", "cco-mcp-server.mjs");
const FORMAL_OUTPUT_PATH = path.join(PROJECT_ROOT, "examples", "workspace", "generated", "control-plane-vs-execution-plane.md");

const child = spawn(process.execPath, [SERVER_PATH], {
  cwd: PROJECT_ROOT,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
  shell: false
});

let receiveBuffer = Buffer.alloc(0);
let nextId = 1;
const pending = new Map();

child.stdout.on("data", (chunk) => {
  receiveBuffer = Buffer.concat([receiveBuffer, chunk]);
  consumeMessages();
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

child.on("close", (code) => {
  if (code !== 0) {
    for (const { reject } of pending.values()) {
      reject(new Error(`MCP server exited early with code ${code}.`));
    }
    pending.clear();
  }
});

try {
  const initializeResult = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "cco-test",
      version: "0.1.0"
    }
  });
  if (initializeResult.protocolVersion !== "2025-06-18") {
    throw new Error(`Unexpected protocol version: ${initializeResult.protocolVersion}`);
  }

  notify("notifications/initialized", {});

  const tools = await request("tools/list", {});
  const toolNames = new Set((tools.tools ?? []).map((tool) => tool.name));
  for (const expected of [
    "cco_doctor",
    "cco_list_tasks",
    "cco_run_task",
    "cco_get_run_status",
    "cco_list_sessions",
    "cco_apply_preview_artifact"
  ]) {
    if (!toolNames.has(expected)) {
      throw new Error(`Missing tool: ${expected}`);
    }
  }

  await callTool("cco_doctor", {});
  await callTool("cco_list_tasks", {});

  const runResult = await callTool("cco_run_task", {
    config_path: "./examples/tasks/mock-doc-preview.json",
    write_mode: "preview"
  });
  if (runResult.resultLabel !== "success-preview") {
    throw new Error(`Unexpected preview result: ${runResult.resultLabel}`);
  }

  const statusResult = await callTool("cco_get_run_status", {
    config_path: "./examples/tasks/mock-doc-preview.json",
    run_id: runResult.runId
  });
  if (statusResult.runId !== runResult.runId) {
    throw new Error("Run status returned the wrong run id.");
  }

  const applyResult = await callTool("cco_apply_preview_artifact", {
    config_path: "./examples/tasks/mock-doc-preview.json",
    run_id: runResult.runId
  });
  if (applyResult.resultLabel !== "success-apply") {
    throw new Error(`Unexpected apply result: ${applyResult.resultLabel}`);
  }

  const appliedExists = await pathExists(FORMAL_OUTPUT_PATH);
  if (!appliedExists) {
    throw new Error(`Expected applied file at ${FORMAL_OUTPUT_PATH}`);
  }

  await callTool("cco_list_sessions", {});

  console.log("MCP server smoke test passed.");
} finally {
  try {
    await fs.rm(FORMAL_OUTPUT_PATH, { force: true });
  } catch {
  }
  child.kill();
}

function consumeMessages() {
  while (true) {
    const parsed = tryParseMessage(receiveBuffer);
    if (!parsed) {
      return;
    }
    receiveBuffer = parsed.remaining;
    const payload = parsed.message;
    const waiter = pending.get(payload.id);
    if (!waiter) {
      continue;
    }
    pending.delete(payload.id);
    if (payload.error) {
      waiter.reject(new Error(payload.error.message ?? "Unknown MCP error"));
      continue;
    }
    waiter.resolve(payload.result);
  }
}

function tryParseMessage(buffer) {
  const separator = "\r\n\r\n";
  const headerEnd = buffer.indexOf(separator);
  if (headerEnd === -1) {
    return null;
  }

  const headerText = buffer.subarray(0, headerEnd).toString("utf8");
  const headers = parseHeaders(headerText);
  const contentLength = Number(headers["content-length"]);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    throw new Error("Invalid Content-Length header.");
  }

  const bodyStart = headerEnd + Buffer.byteLength(separator);
  const bodyEnd = bodyStart + contentLength;
  if (buffer.length < bodyEnd) {
    return null;
  }

  return {
    message: JSON.parse(buffer.subarray(bodyStart, bodyEnd).toString("utf8")),
    remaining: buffer.subarray(bodyEnd)
  };
}

function parseHeaders(headerText) {
  const headers = {};
  for (const line of headerText.split("\r\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers[key] = value;
  }
  return headers;
}

function request(method, params) {
  const id = nextId;
  nextId += 1;
  const message = {
    jsonrpc: "2.0",
    id,
    method,
    params
  };

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    writeMessage(message);
  });
}

function notify(method, params) {
  writeMessage({
    jsonrpc: "2.0",
    method,
    params
  });
}

async function callTool(name, args) {
  const result = await request("tools/call", {
    name,
    arguments: args
  });

  if (result.isError) {
    const detail = result.structuredContent?.error ?? result.content?.[0]?.text ?? "Unknown tool error";
    throw new Error(detail);
  }
  return result.structuredContent;
}

function writeMessage(payload) {
  const body = JSON.stringify(payload);
  const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
  child.stdin.write(header);
  child.stdin.write(body);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
