import type { Project } from "./project";

// Leave headroom for RPC arguments, editor metadata and Unicode escaping.
export const MAX_PROJECT_BYTES = 90_000_000;

export function projectBytes(project: Project): number {
  let mediaBytes = 0;
  const sizes = new Map<string, number>();
  const metadata = JSON.stringify(project, (key, value) => {
    if (
      key === "data" &&
      typeof value === "string" &&
      value.startsWith("data:")
    ) {
      // Base64 is ASCII; non-base64 image URIs can contain Unicode/JSON escapes.
      let bytes = sizes.get(value);
      if (bytes === undefined) {
        bytes = /^[\x20-\x21\x23-\x5b\x5d-\x7e]*$/.test(value)
          ? value.length
          : new TextEncoder().encode(JSON.stringify(value)).length - 2;
        sizes.set(value, bytes);
      }
      mediaBytes += bytes;
      return "";
    }
    return value;
  });
  return new TextEncoder().encode(metadata).length + mediaBytes;
}

export function assertProjectSize(project: Project) {
  if (projectBytes(project) > MAX_PROJECT_BYTES)
    throw Error(
      "This change would exceed the 90 MB project limit. Remove unused media or use smaller recordings/images, then try again. Your previous project is preserved.",
    );
}
