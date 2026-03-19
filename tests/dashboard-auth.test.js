/**
 * Dashboard mutation endpoint auth tests.
 * Verifies that BOX_DASHBOARD_TOKEN protects POST mutation routes.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import crypto from "node:crypto";

const VALID_TOKEN = "test-dashboard-token-abc123";

async function request({ path, method = "POST", token, noToken = false, port: p }) {
  return new Promise((resolve, reject) => {
    const headers = { "content-type": "application/json", "connection": "close" };
    if (!noToken && token !== undefined) {
      headers["authorization"] = `Bearer ${token}`;
    }
    const opts = { hostname: "127.0.0.1", port: p, path, method, headers };
    const req = http.request(opts, (res) => {
      let body = "";
      res.on("data", (d) => { body += d; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function makeAuthMiddleware(dashboardToken) {
  return function auth(req, res) {
    if (!dashboardToken) return true;
    const authHeader = String(req.headers["authorization"] || "");
    const tok = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    let ok = false;
    if (tok) {
      try {
        const a = Buffer.from(dashboardToken, "utf8");
        const b = Buffer.from(tok, "utf8");
        ok = a.length === b.length && crypto.timingSafeEqual(a, b);
      } catch { ok = false; }
    }
    if (!ok) {
      res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Unauthorized: valid Bearer token required for mutation endpoints" }));
      return false;
    }
    return true;
  };
}

function createStubServer(dashboardToken) {
  const auth = makeAuthMiddleware(dashboardToken);
  return http.createServer((req, res) => {
    // Drain the request body to prevent ECONNRESET when responding early.
    req.resume();
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const mutationPaths = ["/api/force-rebase", "/api/daemon-start", "/api/daemon-stop"];

    if (mutationPaths.includes(url.pathname)) {
      if (!auth(req, res)) return;
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, stub: true }));
      return;
    }

    if (url.pathname === "/api/state") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ state: "stub" }));
      return;
    }

    res.writeHead(404);
    res.end("{}");
  });
}

async function startServer(dashboardToken) {
  const srv = createStubServer(dashboardToken);
  await new Promise((resolve, reject) => {
    srv.listen(0, "127.0.0.1", () => resolve());
    srv.on("error", reject);
  });
  return { srv, port: srv.address().port };
}

describe("Dashboard mutation endpoint auth — token configured", () => {
  let srv, p;

  beforeAll(async () => {
    ({ srv, port: p } = await startServer(VALID_TOKEN));
  });

  afterAll(() => new Promise((resolve) => srv.close(resolve)));

  it("returns 200 for mutation endpoint with valid Bearer token", async () => {
    const res = await request({ path: "/api/daemon-stop", port: p, token: VALID_TOKEN });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 401 for mutation endpoint with missing token", async () => {
    const res = await request({ path: "/api/daemon-stop", port: p, noToken: true });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Unauthorized/);
  });

  it("returns 401 for mutation endpoint with wrong token", async () => {
    const res = await request({ path: "/api/daemon-stop", port: p, token: "wrong-token-xyz" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Unauthorized/);
  });

  it("returns 200 for read-only /api/state without any token (no auth required)", async () => {
    const res = await request({ path: "/api/state", method: "GET", port: p, noToken: true });
    expect(res.status).toBe(200);
  });

  it("guards all three mutation endpoints when token is wrong", async () => {
    const paths = ["/api/force-rebase", "/api/daemon-start", "/api/daemon-stop"];
    for (const path of paths) {
      const res = await request({ path, port: p, noToken: true });
      expect(res.status).toBe(401);
    }
  });
});

describe("Dashboard mutation endpoint auth — no token configured (backward compat)", () => {
  let srv, p;

  beforeAll(async () => {
    ({ srv, port: p } = await startServer(""));
  });

  afterAll(() => new Promise((resolve) => srv.close(resolve)));

  it("allows mutation without token when BOX_DASHBOARD_TOKEN is not set", async () => {
    const res = await request({ path: "/api/daemon-stop", port: p, noToken: true });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("allows mutation even with a token provided when no server token is configured", async () => {
    const res = await request({ path: "/api/daemon-stop", port: p, token: "any-token" });
    expect(res.status).toBe(200);
  });
});
