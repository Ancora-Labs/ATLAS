import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export type AtlasSessionAttachmentKind = "image" | "text" | "document" | "archive" | "other";

export interface AtlasSessionAttachmentInput {
  originalName: string;
  mediaType?: string;
  byteSize?: number;
  buffer: Buffer;
}

export interface AtlasSessionAttachment {
  id: string;
  originalName: string;
  storedName: string;
  storedRelativePath: string;
  mediaType: string;
  byteSize: number;
  kind: AtlasSessionAttachmentKind;
  sha256: string;
  roleHint: string;
  textPreview: string | null;
  createdAt: string;
}

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".json", ".csv", ".html", ".htm", ".xml", ".yaml", ".yml", ".css", ".js", ".ts", ".tsx", ".jsx", ".sql"]);
const DOCUMENT_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".odt", ".rtf"]);
const ARCHIVE_EXTENSIONS = new Set([".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"]);
const MAX_TEXT_PREVIEW_CHARS = 1600;

function sanitizeSessionId(value: string): string {
  return value.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "atlas-session";
}

function normalizeFileName(value: string): string {
  const fileName = path.basename(String(value || "attachment").trim()) || "attachment";
  return fileName.length > 120 ? `${fileName.slice(0, 117)}...` : fileName;
}

function normalizeMediaType(value: string | undefined, fileName: string): string {
  const mediaType = String(value || "").trim().toLowerCase();
  if (mediaType) {
    return mediaType;
  }

  const extension = path.extname(fileName).toLowerCase();
  if (TEXT_EXTENSIONS.has(extension)) return "text/plain";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "application/octet-stream";
}

function inferAttachmentKind(fileName: string, mediaType: string): AtlasSessionAttachmentKind {
  const extension = path.extname(fileName).toLowerCase();
  if (mediaType.startsWith("image/")) return "image";
  if (mediaType.startsWith("text/") || TEXT_EXTENSIONS.has(extension)) return "text";
  if (DOCUMENT_EXTENSIONS.has(extension)) return "document";
  if (ARCHIVE_EXTENSIONS.has(extension)) return "archive";
  return "other";
}

function createStoredName(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, extension)
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "attachment";
  const uniqueSuffix = randomUUID().replaceAll("-", "").slice(0, 10);
  return `${baseName}-${uniqueSuffix}${extension.slice(0, 16)}`;
}

function resolveRoleHint(kind: AtlasSessionAttachmentKind): string {
  if (kind === "image") {
    return "User-supplied visual asset. Use this exact file when the final build needs a real photo, screenshot, or branded image. Preserve this source as the visual input for the matching product surface.";
  }
  if (kind === "text") {
    return "Source content file. Pull copy, labels, or structured details from this attachment during planning and implementation.";
  }
  if (kind === "document") {
    return "Reference document. Review this file for requirements, copy, or factual details before implementation.";
  }
  if (kind === "archive") {
    return "Bundled asset package. Inspect and reuse the operator-supplied contents before generating replacements.";
  }
  return "User-supplied session asset. Preserve and inspect it before implementation decisions are finalized.";
}

function extractTextPreview(buffer: Buffer, kind: AtlasSessionAttachmentKind): string | null {
  if (kind !== "text" && kind !== "document") {
    return null;
  }

  const preview = buffer.toString("utf8").replace(/\u0000/g, "").trim();
  if (!preview) {
    return null;
  }
  return preview.length <= MAX_TEXT_PREVIEW_CHARS
    ? preview
    : `${preview.slice(0, MAX_TEXT_PREVIEW_CHARS - 3)}...`;
}

function getAttachmentDirectory(stateDir: string, sessionId: string): string {
  return path.join(stateDir, "atlas", "desktop_sessions", sanitizeSessionId(sessionId), "attachments");
}

function createStoredRelativePath(sessionId: string, storedName: string): string {
  return path.posix.join("atlas", "desktop_sessions", sanitizeSessionId(sessionId), "attachments", storedName);
}

export async function persistAtlasSessionAttachments(
  stateDir: string,
  sessionId: string,
  inputs: AtlasSessionAttachmentInput[],
): Promise<AtlasSessionAttachment[]> {
  if (!inputs.length) {
    return [];
  }

  const attachmentDirectory = getAttachmentDirectory(stateDir, sessionId);
  await fs.mkdir(attachmentDirectory, { recursive: true });

  const createdAt = new Date().toISOString();
  const attachments: AtlasSessionAttachment[] = [];

  for (const input of inputs) {
    const originalName = normalizeFileName(input.originalName);
    const mediaType = normalizeMediaType(input.mediaType, originalName);
    const kind = inferAttachmentKind(originalName, mediaType);
    const storedName = createStoredName(originalName);
    await fs.writeFile(path.join(attachmentDirectory, storedName), input.buffer);

    attachments.push({
      id: randomUUID(),
      originalName,
      storedName,
      storedRelativePath: createStoredRelativePath(sessionId, storedName),
      mediaType,
      byteSize: Number(input.byteSize || input.buffer.byteLength || 0),
      kind,
      sha256: createHash("sha256").update(input.buffer).digest("hex"),
      roleHint: resolveRoleHint(kind),
      textPreview: extractTextPreview(input.buffer, kind),
      createdAt,
    });
  }

  return attachments;
}