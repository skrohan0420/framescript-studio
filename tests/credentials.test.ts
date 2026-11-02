// @vitest-environment node
import { it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WindowsCredentialStore } from "../server/credentials";
import { ChatGPTConnection } from "../server/chatgpt";
it.skipIf(process.platform !== "win32")(
  "encrypts credentials, restores after reopening, and forgets them without plaintext on disk",
  async () => {
    const file = path.resolve(
      "test-results/credentials-" + randomUUID() + ".dpapi",
    );
    let store = new WindowsCredentialStore(file);
    await store.load();
    await store.set("eleven", "test-private-eleven-secret");
    await store.set("chatgpt", {
      access: "private-access",
      refresh: "private-refresh",
      clientId: "oaiapp_test",
      subject: "test-user",
      expires: Date.now() + 3600000,
      scopes: ["chatgpt.tokens.use.direct"],
    });
    const bytes = await fs.readFile(file, "utf8");
    expect(bytes).not.toContain("private");
    expect(bytes).not.toContain("test-user");
    store = new WindowsCredentialStore(file);
    await store.load();
    expect(store.get("eleven")).toBe("test-private-eleven-secret");
    const connection = new ChatGPTConnection(path.dirname(file), {
      credentials: store,
    });
    expect(connection.status().connected).toBe(true);
    expect(await connection.accessToken()).toBe("private-access");
    expect(JSON.stringify(connection.status())).not.toContain("private-access");
    await store.set("chatgpt", undefined);
    await store.set("eleven", undefined);
    await expect(fs.stat(file)).rejects.toThrow();
    connection.close();
  },
  30000,
);
