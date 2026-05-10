#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(PROJECT_ROOT, "bin", "cco.mjs");
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, "package.json");
const PROTOCOL_VERSION = "2025-06-18";
const TOOL_DEFINITIONS = [
  {
    name: "cco_doctor",
    description: "Check whether Node, Claude Code, Codex, and the built-in mock adapter are available.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        provider: {
          type: "string",
          description: "Optional provider filter: node, claude, codex, or mock."
        }
      }
    }
  },
  {
    name: "cco_list_tasks",
    description: "List bundled orchestration task configs and their target paths.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        task_dir: {
          type: "string",
          description: "Optional task directory. Defaults to ./examples/tasks."
        }
      }
    }
  },
  {
    name: "cco_run_task",
    description: "Run one task config through the orchestration runtime with preview-first defaults.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["config_path"],
      properties: {
        config_path: {
          type: "string",
          description: "Path to a task config JSON file."
        },
        provider_override: {
          type: "string",
          description: "Optional provider override such as claude, codex, or mock."
        },
        write_mode: {
          type: "string",
          enum: ["preview", "apply"],
          description: "Write mode override. Prefer preview unless a human explicitly wants apply."
        },
        dry_run: {
          type: "boolean",
          description: "Plan the run without invoking the provider."
        },
        reset_session: {
          type: "boolean",
          description: "Ignore any saved single-session mapping and start fresh."
        },
        session_id: {
          type: "string",
          description: "Optional explicit session id."
        },
        timeout_minutes: {
          type: "number",
          description: "Optional timeout override in minutes."
        }
      }
    }
  },
  {
    name: "cco_get_run_status",
    description: "Inspect the latest run or a specific run id for a task.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        config_path: {
          type: "string",
          description: "Preferred way to resolve the task and workspace."
        },
        task_name: {
          type: "string",
          description: "Fallback task name when config_path is unavailable."
        },
        workspace: {
          type: "string",
          description: "Workspace root used with task_name fallback."
        },
        ledger_dir: {
          type: "string",
          description: "Optional ledger directory override used with task_name fallback."
        },
        run_id: {
          type: "string",
          description: "Optional explicit run id. If omitted, the latest run is used."
        }
      }
    }
  },
  {
    name: "cco_list_sessions",
    description: "List persistent task-to-session mappings recorded by the runtime.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        workspace: {
          type: "string",
          description: "Optional workspace root. Defaults to ./examples/workspace."
        },
        ledger_dir: {
          type: "string",
          description: "Optional ledger directory override."
        }
      }
    }
  },
  {
    name: "cco_apply_preview_artifact",
    description: "Promote a preview artifact into the formal target path for a task.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        config_path: {
          type: "string",
          description: "Preferred task config path so the runtime can recover the formal target path."
        },
        task_name: {
          type: "string",
          description: "Fallback task name when config_path is unavailable."
        },
        workspace: {
          type: "string",
          description: "Workspace root used with task_name fallback."
        },
        ledger_dir: {
          type: "string",
          description: "Optional ledger directory override used with task_name fallback."
        },
        run_id: {
          type: "string",
          description: "Optional explicit run id. If omitted, the latest run is used."
        }
      }
    }
  }
];

const packageJson = await readJson(PACKAGE_JSON_PATH);
const serverInfo = {
  name: packageJson.name,
  version: packageJson.version
};

let receiveBuffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  receiveBuffer = Buffer.concat([receiveBuffer, chunk]);
  consumeMessages().catch((error) => {
    writeStderr(`[cco-mcp] ${error.stack ?? error.message}`);
  });
});

process.stdin.on("end", () => {
  process.exit(0);
});

async function consumeMessages() {
  while (true) {
    const parsed = tryParseMessage(receiveBuffer);
    if (!parsed) {
      return;
    }
    receiveBuffer = parsed.remaining;
    await handleMessage(parsed.message);
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

  const body = buffer.subarray(bodyStart, bodyEnd).toString("utf8");
  return {
    message: JSON.parse(body),
    remaining: buffer.subarray(bodyEnd)
  };
}

function parseHeaders(headerText) {
  const headers = {};
  for (const line of headerText.split("\r\n")) {
    const index = line.indexOf(":");
    if (index === -1) {
      continue;
    }
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    headers[key] = value;
  }
  return headers;
}

async function handleMessage(message) {
  if (message.method && typeof message.id !== "undefined") {
    await handleRequest(message);
    return;
  }

  if (message.method) {
    if (message.method === "notifications/initialized" || message.method === "$/cancelRequest") {
      return;
    }
    return;
  }
}

async function handleRequest(message) {
  try {
    let result;

    switch (message.method) {
      case "initialize":
        result = {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: false
            }
          },
          serverInfo,
          instructions: "Use preview-first orchestration tools to inspect tasks, run them, and only apply artifacts after review."
        };
        break;
      case "ping":
        result = {};
        break;
      case "tools/list":
        result = {
          tools: TOOL_DEFINITIONS
        };
        break;
      case "tools/call":
        result = await handleToolCall(message.params ?? {});
        break;
      default:
        throw createJsonRpcError(-32601, `Method not found: ${message.method}`);
    }

    writeMessage({
      jsonrpc: "2.0",
      id: message.id,
      result
    });
  } catch (error) {
    const jsonRpcError = isJsonRpcError(error)
      ? error
      : createJsonRpcError(-32000, error.message ?? "Unknown server error");
    writeMessage({
      jsonrpc: "2.0",
      id: message.id,
      error: jsonRpcError
    });
  }
}

async function handleToolCall(params) {
  const name = params.name;
  const args = params.arguments ?? {};

  try {
    let payload;
    switch (name) {
      case "cco_doctor":
        payload = await runCliJson("doctor", buildDoctorArgs(args));
        break;
      case "cco_list_tasks":
        payload = await runCliJson("tasks", buildTasksArgs(args));
        break;
      case "cco_run_task":
        payload = await runCliJson("run", buildRunArgs(args));
        break;
      case "cco_get_run_status":
        payload = await runCliJson("status", buildStatusOrApplyArgs(args));
        break;
      case "cco_list_sessions":
        payload = await runCliJson("sessions", buildSessionsArgs(args));
        break;
      case "cco_apply_preview_artifact":
        payload = await runCliJson("apply", buildStatusOrApplyArgs(args));
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload, null, 2)
        }
      ],
      structuredContent: payload,
      isError: false
    };
  } catch (error) {
    const message = error.message ?? String(error);
    return {
      content: [
        {
          type: "text",
          text: message
        }
      ],
      structuredContent: {
        error: message
      },
      isError: true
    };
  }
}

function buildDoctorArgs(args) {
  const cliArgs = [];
  if (args.provider) {
    cliArgs.push("--provider", String(args.provider));
  }
  return cliArgs;
}

function buildTasksArgs(args) {
  const cliArgs = [];
  if (args.task_dir) {
    cliArgs.push("--dir", String(args.task_dir));
  }
  return cliArgs;
}

function buildRunArgs(args) {
  if (!args.config_path) {
    throw new Error("config_path is required.");
  }

  const cliArgs = ["--config", String(args.config_path)];
  if (args.provider_override) {
    cliArgs.push("--provider", String(args.provider_override));
  }
  if (args.write_mode) {
    cliArgs.push("--write-mode", String(args.write_mode));
  }
  if (args.dry_run === true) {
    cliArgs.push("--dry-run");
  }
  if (args.reset_session === true) {
    cliArgs.push("--reset-session");
  }
  if (args.session_id) {
    cliArgs.push("--session-id", String(args.session_id));
  }
  if (typeof args.timeout_minutes !== "undefined") {
    cliArgs.push("--timeout-minutes", String(args.timeout_minutes));
  }
  return cliArgs;
}

function buildSessionsArgs(args) {
  const cliArgs = [];
  if (args.workspace) {
    cliArgs.push("--workspace", String(args.workspace));
  }
  if (args.ledger_dir) {
    cliArgs.push("--ledger-dir", String(args.ledger_dir));
  }
  return cliArgs;
}

function buildStatusOrApplyArgs(args) {
  const cliArgs = [];
  if (args.config_path) {
    cliArgs.push("--config", String(args.config_path));
  } else if (args.task_name) {
    cliArgs.push("--task-name", String(args.task_name));
    if (args.workspace) {
      cliArgs.push("--workspace", String(args.workspace));
    }
    if (args.ledger_dir) {
      cliArgs.push("--ledger-dir", String(args.ledger_dir));
    }
  } else {
    throw new Error("Provide config_path or task_name.");
  }

  if (args.run_id) {
    cliArgs.push("--run-id", String(args.run_id));
  }
  return cliArgs;
}

async function runCliJson(command, args) {
  const stdout = await runProcess(process.execPath, [CLI_PATH, command, ...args, "--json"]);
  return JSON.parse(stdout);
}

async function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`cco ${args[1] ?? ""} failed (${code}): ${stderr || stdout}`.trim()));
        return;
      }
      resolve(stdout);
    });
  });
}

function writeMessage(payload) {
  const body = JSON.stringify(payload);
  const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
  process.stdout.write(header);
  process.stdout.write(body);
}

function createJsonRpcError(code, message) {
  return {
    code,
    message
  };
}

function isJsonRpcError(value) {
  return Boolean(value && typeof value === "object" && "code" in value && "message" in value);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function writeStderr(text) {
  process.stderr.write(`${text}\n`);
}
