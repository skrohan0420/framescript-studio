import { generate } from "selfsigned";
let credentials: Promise<{ key: string; cert: string }> | undefined;
// Ephemeral certificate only for private loopback HTTP/2. Never installed in
// the trust store, persisted, or used by the application HTTP server.
export function loopbackTls() {
  return (credentials ??= generate(
    [{ name: "commonName", value: "127.0.0.1" }],
    {
      keySize: 2048,
      algorithm: "sha256",
      notAfterDate: new Date(Date.now() + 24 * 3600_000),
      extensions: [
        { name: "subjectAltName", altNames: [{ type: 7, ip: "127.0.0.1" }] },
      ],
    },
  ).then((pem) => ({ key: pem.private, cert: pem.cert })));
}
