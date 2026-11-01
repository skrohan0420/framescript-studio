process.env.NODE_ENV = "development";
await import("./build.mjs");
await import("../dist-server/index.cjs");
