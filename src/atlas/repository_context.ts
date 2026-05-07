import { loadConfig } from "../config.js";
import {
  readAtlasDesktopState,
  resolveAtlasDesktopStatePathFromStateDir,
  type AtlasDesktopRepoContext,
  type AtlasDesktopRepoMode,
  writeAtlasDesktopState,
} from "./desktop_state.js";

interface GitHubOwnerPayload {
  login?: string;
}

interface GitHubRepoPayload {
  name?: string;
  full_name?: string;
  description?: string | null;
  default_branch?: string | null;
  private?: boolean;
  visibility?: string;
  updated_at?: string | null;
  archived?: boolean;
  disabled?: boolean;
  size?: number;
  owner?: GitHubOwnerPayload;
}

export interface AtlasGitHubRepositoryListItem {
  name: string;
  fullName: string;
  description: string | null;
  updatedAt: string | null;
  defaultBranch: string | null;
  visibility: string;
  isPrivate: boolean;
  repoMode: AtlasDesktopRepoMode;
}

interface GitHubRequestError extends Error {
  statusCode?: number;
}

interface ListGitHubRepositoriesOptions {
  query?: string | null;
}

export interface AtlasNewProjectDetailsInput {
  projectName?: string | null;
  projectDescription?: string | null;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasExplicitNewProjectDetails(projectDetails?: AtlasNewProjectDetailsInput): boolean {
  return Boolean(
    normalizeOptionalString(projectDetails?.projectName)
    && normalizeOptionalString(projectDetails?.projectDescription),
  );
}

function resolveDesktopStatePath(stateDir: string): string {
  return resolveAtlasDesktopStatePathFromStateDir(stateDir);
}

async function persistRepoContext(stateDir: string, repoContext: AtlasDesktopRepoContext | null): Promise<void> {
  const statePath = resolveDesktopStatePath(stateDir);
  const currentState = await readAtlasDesktopState(statePath);
  await writeAtlasDesktopState(statePath, {
    ...currentState,
    repoContext,
  });
}

async function getGitHubToken(): Promise<string> {
  const config = await loadConfig();
  const token = String(
    config.env.githubToken
    || config.env.copilotGithubToken
    || process.env.GITHUB_TOKEN
    || process.env.COPILOT_GITHUB_TOKEN
    || "",
  ).trim();
  if (!token) {
    throw new Error("GITHUB_TOKEN is required before ATLAS can list or create GitHub repositories.");
  }
  return token;
}

function buildGitHubHeaders(token: string): Headers {
  const headers = new Headers();
  headers.set("accept", "application/vnd.github+json");
  headers.set("authorization", `Bearer ${token}`);
  headers.set("user-agent", "ATLAS-Desktop");
  headers.set("x-github-api-version", "2022-11-28");
  return headers;
}

async function githubRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getGitHubToken();
  const headers = buildGitHubHeaders(token);
  if (init?.headers) {
    const extraHeaders = new Headers(init.headers);
    extraHeaders.forEach((value, key) => headers.set(key, value));
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json() as { message?: string };
      if (payload?.message) {
        detail = payload.message;
      }
    } catch {
      const rawText = await response.text();
      if (rawText.trim()) {
        detail = rawText.trim();
      }
    }

    const error = new Error(`GitHub request failed: ${detail}`) as GitHubRequestError;
    error.statusCode = response.status;
    throw error;
  }

  return await response.json() as T;
}

function resolveRepoMode(repo: GitHubRepoPayload): AtlasDesktopRepoMode {
  return Number(repo.size || 0) > 0 && normalizeOptionalString(repo.default_branch)
    ? "existing"
    : "new";
}

function mapGitHubRepoToContext(repo: GitHubRepoPayload, overrides: Partial<AtlasDesktopRepoContext> = {}): AtlasDesktopRepoContext {
  const targetRepo = normalizeOptionalString(repo.full_name);
  if (!targetRepo) {
    throw new Error("GitHub repository payload is missing full_name.");
  }

  return {
    provider: "github",
    targetRepo,
    targetBaseBranch: normalizeOptionalString(repo.default_branch),
    repoMode: resolveRepoMode(repo),
    repoCreatedByAtlas: false,
    ...overrides,
  };
}

function mapGitHubRepoToListItem(repo: GitHubRepoPayload): AtlasGitHubRepositoryListItem | null {
  const fullName = normalizeOptionalString(repo.full_name);
  const name = normalizeOptionalString(repo.name);
  if (!fullName || !name) {
    return null;
  }

  return {
    name,
    fullName,
    description: normalizeOptionalString(repo.description),
    updatedAt: normalizeOptionalString(repo.updated_at),
    defaultBranch: normalizeOptionalString(repo.default_branch),
    visibility: normalizeOptionalString(repo.visibility) || (repo.private ? "private" : "public"),
    isPrivate: repo.private === true,
    repoMode: resolveRepoMode(repo),
  };
}

function sanitizeRepositoryName(projectName: string): string {
  const compact = String(projectName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return compact || "atlas-project";
}

function buildRepositoryNameCandidates(projectName: string): string[] {
  const base = sanitizeRepositoryName(projectName);
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
  return [
    base,
    `${base}-${stamp}`,
    `atlas-${base}-${stamp}`,
  ];
}

export function applyAtlasRepoContextToEnv(repoContext: AtlasDesktopRepoContext | null): void {
  if (!repoContext) {
    delete process.env.TARGET_REPO;
    delete process.env.TARGET_BASE_BRANCH;
    return;
  }

  process.env.TARGET_REPO = repoContext.targetRepo;
  if (repoContext.targetBaseBranch) {
    process.env.TARGET_BASE_BRANCH = repoContext.targetBaseBranch;
  } else {
    delete process.env.TARGET_BASE_BRANCH;
  }
}

export async function readAtlasDesktopRepoContext(stateDir: string): Promise<AtlasDesktopRepoContext | null> {
  const state = await readAtlasDesktopState(resolveDesktopStatePath(stateDir));
  return state.repoContext;
}

export async function clearAtlasDesktopRepoContext(stateDir: string): Promise<void> {
  await persistRepoContext(stateDir, null);
  applyAtlasRepoContextToEnv(null);
}

export async function consumeAtlasDesktopRepoContext(stateDir: string): Promise<void> {
  await clearAtlasDesktopRepoContext(stateDir);
}

export async function listAtlasGitHubRepositories(
  options: ListGitHubRepositoriesOptions = {},
): Promise<AtlasGitHubRepositoryListItem[]> {
  const params = new URLSearchParams({
    per_page: "100",
    sort: "updated",
    affiliation: "owner,collaborator,organization_member",
  });
  const repositories = await githubRequest<GitHubRepoPayload[]>(`https://api.github.com/user/repos?${params.toString()}`);
  const query = String(options.query || "").trim().toLowerCase();
  return repositories
    .filter((repo) => repo.archived !== true && repo.disabled !== true)
    .map(mapGitHubRepoToListItem)
    .filter((repo): repo is AtlasGitHubRepositoryListItem => repo !== null)
    .filter((repo) => {
      if (!query) {
        return true;
      }

      const haystack = [repo.name, repo.fullName, repo.description || ""]
        .join("\n")
        .toLowerCase();
      return haystack.includes(query);
    });
}

export async function selectAtlasExistingRepoContext(stateDir: string, repoFullName: string): Promise<AtlasDesktopRepoContext> {
  const normalizedRepo = String(repoFullName || "").trim();
  if (!normalizedRepo) {
    throw new Error("Select a repository before starting existing-project onboarding.");
  }

  const repository = await githubRequest<GitHubRepoPayload>(`https://api.github.com/repos/${normalizedRepo}`);
  const repoContext = mapGitHubRepoToContext(repository, {
    repoCreatedByAtlas: false,
  });
  await persistRepoContext(stateDir, repoContext);
  applyAtlasRepoContextToEnv(repoContext);
  return repoContext;
}

export async function createAtlasRepositoryFromProjectDetails(
  stateDir: string,
  projectDetails: AtlasNewProjectDetailsInput,
): Promise<AtlasDesktopRepoContext> {
  const projectName = normalizeOptionalString(projectDetails.projectName);
  const projectDescription = normalizeOptionalString(projectDetails.projectDescription);
  if (!projectName || !projectDescription) {
    throw new Error("Tell Atlas the project name and description before creating a new GitHub repository.");
  }

  let lastError: unknown = null;
  for (const candidateName of buildRepositoryNameCandidates(projectName)) {
    try {
      const repository = await githubRequest<GitHubRepoPayload>("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: candidateName,
          description: projectDescription.slice(0, 160),
          private: true,
          auto_init: true,
        }),
      });
      const repoContext = mapGitHubRepoToContext(repository, {
        repoMode: "new",
        repoCreatedByAtlas: true,
        targetBaseBranch: normalizeOptionalString(repository.default_branch) || "main",
      });
      await persistRepoContext(stateDir, repoContext);
      applyAtlasRepoContextToEnv(repoContext);
      return repoContext;
    } catch (error) {
      lastError = error;
      if ((error as GitHubRequestError).statusCode !== 422) {
        break;
      }
    }
  }

  throw new Error(String((lastError as Error)?.message || lastError || "ATLAS could not create a GitHub repository."));
}

export async function resolveAtlasRepoContextForNewSession(
  stateDir: string,
  _objective: string,
  projectDetails?: AtlasNewProjectDetailsInput,
): Promise<AtlasDesktopRepoContext> {
  if (hasExplicitNewProjectDetails(projectDetails)) {
    return createAtlasRepositoryFromProjectDetails(stateDir, projectDetails || {});
  }

  const existingContext = await readAtlasDesktopRepoContext(stateDir);
  if (existingContext) {
    applyAtlasRepoContextToEnv(existingContext);
    return existingContext;
  }
  return createAtlasRepositoryFromProjectDetails(stateDir, projectDetails || {});
}