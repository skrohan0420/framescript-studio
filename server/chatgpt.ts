import http from "node:http";
import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { atomicWrite } from "./storage";
import type { CredentialStore } from "./credentials";
const issuer = "https://auth.openai.com",
  resource = "https://api.openai.com/v1";
type Registration = { clientId: string; subject?: string; email?: string };
type Tokens = Registration & {
  access: string;
  refresh?: string;
  expires: number;
  scopes: string[];
  idToken?: string;
};
type Pending = {
  state: string;
  nonce: string;
  verifier: string;
  redirect: string;
  registration?: Registration;
  server: http.Server;
  timer: ReturnType<typeof setTimeout>;
  finishing: boolean;
};
type Deps = {
  fetch?: typeof fetch;
  verify?: (token: string, clientId: string) => Promise<JWTPayload>;
  credentials?: CredentialStore;
};
export class ChatGPTConnection {
  private starting = false;
  private tokens?: Tokens;
  private pending?: Pending;
  private error = "";
  private renewing?: Promise<string>;
  private discovery?: any;
  private credentials?: CredentialStore;
  private remember = false;
  private request: typeof fetch;
  private verifier: NonNullable<Deps["verify"]>;
  constructor(
    private directory: string,
    deps: Deps = {},
  ) {
    this.credentials = deps.credentials;
    const saved = deps.credentials?.get("chatgpt");
    if (
      saved &&
      typeof saved.access === "string" &&
      typeof saved.clientId === "string" &&
      typeof saved.subject === "string" &&
      typeof saved.expires === "number" &&
      Array.isArray(saved.scopes) &&
      saved.scopes.includes("chatgpt.tokens.use.direct")
    ) {
      this.tokens = saved;
      this.remember = true;
    }
    this.request = deps.fetch ?? fetch;
    this.verifier =
      deps.verify ??
      (async (token, clientId) => {
        const meta = await this.metadata();
        return (
          await jwtVerify(token, createRemoteJWKSet(new URL(meta.jwks_uri)), {
            issuer,
            audience: clientId,
            algorithms: ["RS256"],
            requiredClaims: ["sub", "exp", "iat"],
          })
        ).payload;
      });
  }
  private async metadata() {
    if (!this.discovery) {
      const r = await this.request(
        issuer + "/.well-known/openid-configuration",
        { signal: AbortSignal.timeout(15000) },
      );
      if (!r.ok)
        throw Error("Unable to discover ChatGPT authentication service");
      const m = await r.json();
      if (m.issuer !== issuer) throw Error("Unexpected authentication issuer");
      for (const name of ["jwks_uri", "revocation_endpoint"])
        if (!m[name] || new URL(m[name]).origin !== issuer)
          throw Error("Invalid authentication metadata");
      this.discovery = m;
    }
    return this.discovery;
  }
  private async registration() {
    try {
      return JSON.parse(
        await fs.readFile(
          path.join(this.directory, "chatgpt-registration.json"),
          "utf8",
        ),
      ) as Registration;
    } catch {
      try {
        return JSON.parse(
          await fs.readFile(
            path.join(this.directory, "chatgpt-pending-registration.json"),
            "utf8",
          ),
        ) as Registration;
      } catch {
        return undefined;
      }
    }
  }
  private stopPending() {
    const p = this.pending;
    if (p) {
      clearTimeout(p.timer);
      p.server.close();
      this.pending = undefined;
    }
  }
  status() {
    return {
      connected: !!this.tokens,
      remembered: this.remember,
      pending: !!this.pending,
      email: this.tokens?.email,
      subject: this.tokens?.subject,
      planEnabled:
        this.tokens?.scopes.includes("chatgpt.tokens.use.direct") ?? false,
      error: this.error,
    };
  }
  async begin(newAccount = false, remember = false) {
    if (this.pending || this.starting)
      throw Error(
        "A ChatGPT sign-in is already pending. Cancel it before retrying.",
      );
    this.starting = true;
    this.remember = remember;
    try {
      this.error = "";
      await fs.mkdir(this.directory, { recursive: true });
      const hostFile = path.join(this.directory, "chatgpt-host.json");
      let host: string;
      try {
        host = JSON.parse(await fs.readFile(hostFile, "utf8")).id;
        if (!/^urn:uuid:[a-f0-9-]{36}$/.test(host))
          throw Error("Invalid host ID");
      } catch {
        host = "urn:uuid:" + randomUUID();
        await atomicWrite(hostFile, JSON.stringify({ id: host }));
      }
      const registration = newAccount ? undefined : await this.registration();
      const state = randomBytes(32).toString("base64url"),
        nonce = randomBytes(32).toString("base64url"),
        verifier = randomBytes(48).toString("base64url");
      const server = http.createServer((req, res) => {
        void this.callback(req, res).catch(() => {
          if (!res.headersSent) {
            res.writeHead(400, {
              "Content-Type": "text/plain",
              "Cache-Control": "no-store",
            });
            res.end(
              "Sign-in could not be completed. Return to FrameScript Studio for details.",
            );
          }
        });
      });
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const port = (server.address() as { port: number }).port,
        redirect = `http://127.0.0.1:${port}/auth/callback`;
      const timer = setTimeout(() => {
        this.error = "ChatGPT sign-in timed out. Please try again.";
        this.stopPending();
      }, 300000);
      timer.unref();
      this.pending = {
        state,
        nonce,
        verifier,
        redirect,
        registration,
        server,
        timer,
        finishing: false,
      };
      const url = new URL(issuer + "/api/accounts/authorize");
      url.search = new URLSearchParams({
        client_id: registration?.clientId ?? "dynamic_agent_client",
        ...(registration ? {} : { agent_name_hint: "FrameScript Studio" }),
        ext_agent_host_id: host,
        response_type: "code",
        redirect_uri: redirect,
        scope:
          "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
        resource,
        state,
        nonce,
        code_challenge_method: "S256",
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
      }).toString();
      return { url: url.href };
    } finally {
      this.starting = false;
    }
  }
  private async callback(req: http.IncomingMessage, res: http.ServerResponse) {
    const p = this.pending;
    if (!p) {
      res.writeHead(410);
      res.end("Sign-in expired.");
      return;
    }
    const url = new URL(req.url ?? "/", p.redirect);
    if (
      url.pathname !== "/auth/callback" ||
      req.method !== "GET" ||
      req.headers.host !== new URL(p.redirect).host
    ) {
      res.writeHead(404);
      res.end();
      return;
    }
    const state = url.searchParams.get("state") ?? "";
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(p.state))
    ) {
      res.writeHead(400);
      res.end("Invalid sign-in state.");
      return;
    }
    if (p.finishing) {
      res.writeHead(409);
      res.end("Sign-in is already being processed.");
      return;
    }
    p.finishing = true;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    try {
      if (url.searchParams.has("error"))
        throw Error("ChatGPT authorization was declined. You can try again.");
      const clientId =
        url.searchParams.get("client_id") ?? p.registration?.clientId;
      if (
        !clientId ||
        clientId === "dynamic_agent_client" ||
        (p.registration && clientId !== p.registration.clientId)
      )
        throw Error("ChatGPT did not return the expected client registration.");
      const code = url.searchParams.get("code");
      if (!code) throw Error("Authorization code is missing.");
      if (!p.registration)
        await atomicWrite(
          path.join(this.directory, "chatgpt-pending-registration.json"),
          JSON.stringify({ clientId }),
        );
      const data = await this.token(
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          code,
          code_verifier: p.verifier,
          redirect_uri: p.redirect,
          resource,
        }),
      );
      const identity = await this.verifier(data.id_token, clientId);
      if (
        identity.nonce !== p.nonce ||
        !identity.sub ||
        (p.registration?.subject && identity.sub !== p.registration.subject)
      )
        throw Error("ChatGPT identity validation failed.");
      const scopes = String(data.scope ?? "")
        .split(" ")
        .filter(Boolean);
      if (!scopes.includes("chatgpt.tokens.use.direct"))
        throw Error(
          "ChatGPT plan usage was not authorized. Sign in again and approve plan access.",
        );
      if (
        typeof data.access_token !== "string" ||
        data.token_type?.toLowerCase() !== "bearer"
      )
        throw Error("Invalid token response.");
      if (this.pending !== p) throw Error("Sign-in was cancelled.");
      const registration = {
        clientId,
        subject: identity.sub,
        email: typeof identity.email === "string" ? identity.email : undefined,
      };
      await atomicWrite(
        path.join(this.directory, "chatgpt-registration.json"),
        JSON.stringify(registration),
      );
      const nextTokens = {
        ...registration,
        access: data.access_token,
        refresh: data.refresh_token,
        expires: Date.now() + Number(data.expires_in ?? 3600) * 1000,
        scopes,
        idToken: data.id_token,
      };
      if (this.credentials)
        await this.credentials.set(
          "chatgpt",
          this.remember ? nextTokens : undefined,
        );
      this.tokens = nextTokens;
      this.error = "";
      res.end(
        "Connected to FrameScript Studio. You may close this tab and return to the animation editor.",
      );
    } catch (error) {
      if (this.pending === p)
        this.error =
          error instanceof Error ? error.message : "ChatGPT sign-in failed";
      res.statusCode = 400;
      res.end(
        "Sign-in was not completed. Return to FrameScript Studio for details.",
      );
    } finally {
      if (this.pending === p) this.stopPending();
    }
  }
  private async token(form: URLSearchParams) {
    const r = await this.request(issuer + "/api/accounts/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok)
      throw Error(
        `ChatGPT authorization failed (${r.status}). Please sign in again.`,
      );
    return r.json();
  }
  async accessToken() {
    const t = this.tokens;
    if (!t) throw Error("Connect your ChatGPT account first.");
    if (!t.scopes.includes("chatgpt.tokens.use.direct"))
      throw Error(
        "ChatGPT plan access is unavailable. Reconnect your account.",
      );
    if (t.expires > Date.now() + 60000) return t.access;
    if (this.renewing) return this.renewing;
    this.renewing = (async () => {
      if (!t.refresh)
        throw Error("ChatGPT session expired. Please sign in again.");
      const data = await this.token(
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: t.clientId,
          refresh_token: t.refresh,
          resource,
        }),
      );
      if (this.tokens !== t)
        throw Error("ChatGPT account changed during renewal.");
      if (typeof data.access_token !== "string")
        throw Error("ChatGPT session renewal failed");
      this.tokens = {
        ...t,
        access: data.access_token,
        refresh: data.refresh_token ?? t.refresh,
        expires: Date.now() + Number(data.expires_in ?? 3600) * 1000,
        scopes: data.scope ? data.scope.split(" ") : t.scopes,
      };
      if (!this.tokens.scopes.includes("chatgpt.tokens.use.direct"))
        throw Error(
          "ChatGPT plan access is unavailable. Reconnect your account.",
        );
      if (this.credentials && this.remember)
        await this.credentials.set("chatgpt", this.tokens);
      return this.tokens.access;
    })().finally(() => {
      this.renewing = undefined;
    });
    return this.renewing;
  }
  async disconnect() {
    if (this.credentials) await this.credentials.set("chatgpt", undefined);
    this.remember = false;
    this.stopPending();
    const t = this.tokens;
    this.tokens = undefined;
    this.error = "";
    let warning = "";
    if (t?.refresh) {
      try {
        const meta = await this.metadata();
        const r = await this.request(meta.revocation_endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: t.refresh,
            token_type_hint: "refresh_token",
            client_id: t.clientId,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw Error();
      } catch {
        warning =
          "Signed out locally. Remote revocation was not confirmed; disconnect this app in ChatGPT Settings.";
      }
    }
    return { warning };
  }
  close() {
    this.stopPending();
    this.tokens = undefined;
  }
}
