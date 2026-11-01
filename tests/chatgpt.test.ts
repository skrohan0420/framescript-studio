// @vitest-environment node
import { it, expect, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { generateKeyPair, SignJWT, jwtVerify } from "jose";
import { ChatGPTConnection } from "../server/chatgpt";
import {
  readChatGPTStream,
  models,
  generate,
  chatGPTError,
} from "../server/ai";
import { newProject } from "../shared/project";
async function fixture(
  options: {
    nonceBad?: boolean;
    signatureBad?: boolean;
    scope?: string;
    expired?: boolean;
  } = {},
) {
  const dir = path.resolve("test-results/auth-" + randomUUID());
  const keys = await generateKeyPair("RS256");
  let authorization: URL;
  let refreshes = 0;
  let verifier = "";
  const request = vi.fn(async (url: any, init?: RequestInit) => {
    if (String(url).endsWith("openid-configuration"))
      return Response.json({
        issuer: "https://auth.openai.com",
        jwks_uri: "https://auth.openai.com/jwks",
        revocation_endpoint: "https://auth.openai.com/revoke",
      });
    if (String(url).endsWith("/revoke"))
      return new Response("", { status: 200 });
    const form = init!.body as URLSearchParams;
    verifier = form.get("code_verifier") ?? verifier;
    if (form.get("grant_type") === "refresh_token") {
      refreshes++;
      await new Promise((r) => setTimeout(r, 10));
      return Response.json({
        access_token: "renewed-access",
        refresh_token: "renewed-refresh",
        expires_in: 3600,
      });
    }
    expect(form.get("client_id")).toBe("oaiapp_test");
    expect(form.get("redirect_uri")).toBe(
      authorization.searchParams.get("redirect_uri"),
    );
    const token = await new SignJWT({
      nonce: options.nonceBad
        ? "wrong"
        : authorization.searchParams.get("nonce"),
      email: "test@example.com",
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://auth.openai.com")
      .setAudience("oaiapp_test")
      .setSubject("test-user")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(keys.privateKey);
    return Response.json({
      id_token: options.signatureBad
        ? token.slice(0, -10) + "invalidsig"
        : token,
      access_token: "private-access",
      refresh_token: "private-refresh",
      token_type: "Bearer",
      expires_in: options.expired ? 0 : 3600,
      scope: options.scope ?? "openid chatgpt.tokens.use.direct",
    });
  });
  const connection = new ChatGPTConnection(dir, {
    fetch: request as typeof fetch,
    verify: async (token, clientId) =>
      (
        await jwtVerify(token, keys.publicKey, {
          issuer: "https://auth.openai.com",
          audience: clientId,
        })
      ).payload,
  });
  const start = await connection.begin();
  authorization = new URL(start.url);
  const callback = (state = authorization.searchParams.get("state")!) => {
    const url = new URL(authorization.searchParams.get("redirect_uri")!);
    url.search = new URLSearchParams({
      state,
      client_id: "oaiapp_test",
      code: "test-code",
    }).toString();
    return fetch(url);
  };
  return {
    connection,
    authorization,
    callback,
    dir,
    request,
    get refreshes() {
      return refreshes;
    },
    get verifier() {
      return verifier;
    },
  };
}
it("uses official PKCE flow, rejects wrong state, validates identity and keeps credentials off disk/status", async () => {
  const f = await fixture();
  try {
    expect(f.authorization.origin).toBe("https://auth.openai.com");
    expect(f.authorization.searchParams.get("client_id")).toBe(
      "dynamic_agent_client",
    );
    expect((await f.callback("wrong")).status).toBe(400);
    expect(f.connection.status().pending).toBe(true);
    expect((await f.callback()).status).toBe(200);
    expect(f.authorization.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(f.verifier).digest("base64url"),
    );
    expect(f.connection.status()).toMatchObject({
      connected: true,
      email: "test@example.com",
      planEnabled: true,
    });
    expect(JSON.stringify(f.connection.status())).not.toContain("private-");
    for (const name of await fs.readdir(f.dir))
      expect(await fs.readFile(path.join(f.dir, name), "utf8")).not.toContain(
        "private-",
      );
    await f.connection.disconnect();
    expect(f.connection.status().connected).toBe(false);
    const again = new URL((await f.connection.begin()).url);
    expect(again.searchParams.get("client_id")).toBe("oaiapp_test");
    expect(again.searchParams.has("agent_name_hint")).toBe(false);
    expect(again.searchParams.get("ext_agent_host_id")).toBe(
      f.authorization.searchParams.get("ext_agent_host_id"),
    );
  } finally {
    f.connection.close();
  }
});
for (const option of [
  { nonceBad: true },
  { signatureBad: true },
  { scope: "openid email" },
])
  it(
    "rejects invalid identity or missing plan permission " +
      JSON.stringify(option),
    async () => {
      const f = await fixture(option);
      try {
        expect((await f.callback()).status).toBe(400);
        expect(f.connection.status().connected).toBe(false);
        await expect(f.connection.accessToken()).rejects.toThrow();
      } finally {
        f.connection.close();
      }
    },
  );
it("serializes token refresh and revokes the renewable session on sign out", async () => {
  const f = await fixture({ expired: true });
  try {
    await f.callback();
    expect(
      await Promise.all([
        f.connection.accessToken(),
        f.connection.accessToken(),
      ]),
    ).toEqual(["renewed-access", "renewed-access"]);
    expect(f.refreshes).toBe(1);
    await f.connection.disconnect();
    expect(
      f.request.mock.calls.some(([url]) => String(url).endsWith("/revoke")),
    ).toBe(true);
  } finally {
    f.connection.close();
  }
});
it("cancels pending sign-in without granting access", async () => {
  const f = await fixture();
  await f.connection.disconnect();
  expect(f.connection.status()).toMatchObject({
    connected: false,
    pending: false,
  });
  await expect(f.connection.accessToken()).rejects.toThrow();
});
const sse = (events: any[]) =>
  new Response(
    events.map((e) => "data: " + JSON.stringify(e) + "\n\n").join(""),
  );
it("returns completed output without waiting for the provider connection to close", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          'data: {"type":"response.output_text.delta","delta":"finished"}\n\ndata: {"type":"response.completed"}\n\n',
        ),
      );
    },
    cancel() {
      cancelled = true;
    },
  });
  expect(await readChatGPTStream(new Response(stream))).toBe("finished");
  expect(cancelled).toBe(true);
});
it("requires a completed event and rejects usage failures after text deltas", async () => {
  expect(
    await readChatGPTStream(
      sse([
        { type: "response.output_text.delta", delta: "ok" },
        { type: "response.completed" },
      ]),
    ),
  ).toBe("ok");
  await expect(
    readChatGPTStream(
      sse([{ type: "response.output_text.delta", delta: "partial" }]),
    ),
  ).rejects.toThrow("before completion");
  await expect(
    readChatGPTStream(
      sse([
        { type: "response.output_text.delta", delta: "partial" },
        {
          type: "response.failed",
          response: {
            error: { code: "subscription_sharing_usage_limit_exceeded" },
          },
        },
      ]),
    ),
  ).rejects.toThrow("subscription_sharing_usage_limit_exceeded");
});
it("uses account catalog and streaming Responses with store disabled for code generation", async () => {
  const original = globalThis.fetch;
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        models: [
          {
            slug: "available-model",
            display_name: "Available model",
            visibility: "list",
          },
          { slug: "hidden", visibility: "hide" },
        ],
      }),
    )
    .mockResolvedValueOnce(
      sse([
        {
          type: "response.output_text.delta",
          delta: JSON.stringify({
            action: "update",
            css: "body{color:red}",
            explanation: "Updated",
          }),
        },
        { type: "response.completed" },
      ]),
    );
  globalThis.fetch = request;
  try {
    expect(
      await models({ provider: "chatgpt", model: "", key: "oauth-secret" }),
    ).toEqual([
      { name: "available-model", label: "Available model", vision: false },
    ]);
    const result = await generate(
      { provider: "chatgpt", model: "available-model", key: "oauth-secret" },
      { project: newProject(), prompt: "Make it red", history: [], images: [] },
      new AbortController().signal,
    );
    expect(result.css).toContain("red");
    expect(request.mock.calls[1][0]).toBe(
      "https://api.openai.com/v1/responses",
    );
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({
      store: false,
      stream: true,
      model: "available-model",
    });
    expect(JSON.parse(request.mock.calls[1][1].body)).not.toHaveProperty(
      "text",
    );
    expect(request.mock.calls[1][1].body).not.toContain("oauth-secret");
  } finally {
    globalThis.fetch = original;
  }
});
it("preserves safe provider diagnostics and distinguishes bad parameters from quota errors", async () => {
  const e = await chatGPTError(
    Response.json(
      {
        error: {
          code: "unsupported_parameter",
          param: "text.format",
          message: "This model does not support json_object; secret-token",
        },
      },
      { status: 400, headers: { "x-request-id": "req-test" } },
    ),
    "secret-token",
  );
  expect(e.message).toContain("unsupported_parameter");
  expect(e.message).toContain("text.format");
  expect(e.message).toContain("req-test");
  expect(e.message).not.toContain("secret-token");
  expect(e.message).toContain("[redacted]");
  const admission = await chatGPTError(
    Response.json({ detail: "Routing unavailable" }, { status: 503 }),
  );
  expect(admission.message).toContain("Routing unavailable");
  expect(admission.message).toContain("Keep the connection");
});
