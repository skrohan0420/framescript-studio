import { useEffect } from "react";

export function TabIdentity({ name, home }: { name: string; home?: boolean }) {
  useEffect(() => {
    document.title = `${home ? "Projects" : name.trim() || "Untitled animation"} · FrameScript Studio`;
  }, [name, home]);
  return null;
}
