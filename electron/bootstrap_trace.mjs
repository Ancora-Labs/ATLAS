import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const bootstrapTraceDir = path.join(process.env.APPDATA || os.tmpdir(), "box-orchestrator");
const bootstrapTracePath = path.join(bootstrapTraceDir, "atlas-bootstrap.log");

export function appendBootstrapTrace(message, error = null) {
  try {
    fs.mkdirSync(bootstrapTraceDir, { recursive: true });
    const suffix = error
      ? ` ${error instanceof Error ? error.stack || error.message : String(error)}`
      : "";
    fs.appendFileSync(bootstrapTracePath, `[${new Date().toISOString()}] ${message}${suffix}\n`, "utf8");
  } catch {
    // Best-effort tracing only.
  }
}

export function getBootstrapTracePath() {
  return bootstrapTracePath;
}