import { parse } from "@babel/parser";
import { format } from "prettier/standalone";
import html from "prettier/plugins/html";
import css from "prettier/plugins/postcss";
import type { CodeSnapshot } from "../shared/rpc";

export type Location = { line: number; column: number };
export type ProblemLanguage = keyof CodeSnapshot | "all";
export type SyntaxProblem = {
  language: ProblemLanguage;
  message: string;
  location?: Location;
};
export type SyntaxRequest = {
  id: number;
  code: CodeSnapshot;
  combinedHtml?: string;
};
export type SyntaxResult = { id: number; problems: SyntaxProblem[] };

const languages = ["html", "css", "js"] as const;
const cache = new Map<
  ProblemLanguage,
  { source: string; problems: SyntaxProblem[] }
>();

function javascriptProblem(error: unknown): SyntaxProblem {
  const { message, loc, reasonCode } = error as Error & {
    loc?: Location;
    reasonCode?: string;
  };
  return {
    language: "js",
    message:
      reasonCode === "ImportOutsideModule"
        ? "Import and export statements require a module. FrameScript runs this code as a classic script."
        : message.replace(/\s*\(\d+:\d+\)$/, ""),
    location: loc && { line: loc.line, column: loc.column + 1 },
  };
}

async function check(
  language: ProblemLanguage,
  source: string,
): Promise<SyntaxProblem[]> {
  if (language === "js") {
    try {
      const result = parse(source, {
        sourceType: "script",
        errorRecovery: true,
      });
      return (result.errors ?? []).map(javascriptProblem);
    } catch (error) {
      return [javascriptProblem(error)];
    }
  }
  try {
    await format(source, {
      parser: language === "all" ? "html" : language,
      plugins: [html, css],
      embeddedLanguageFormatting: "off",
    });
    return [];
  } catch (error) {
    const { message, loc } = error as Error & { loc?: { start: Location } };
    return [
      { language, message: message.split("\n")[0], location: loc?.start },
    ];
  }
}

self.addEventListener(
  "message",
  async ({ data }: MessageEvent<SyntaxRequest>) => {
    const results = await Promise.all(
      languages.map(async (part) => {
        const language =
          part === "html" && data.combinedHtml !== undefined ? "all" : part;
        const source =
          language === "all" ? data.combinedHtml! : data.code[part];
        const cached = cache.get(language);
        if (cached?.source === source) return cached.problems;
        const problems = await check(language, source);
        cache.set(language, { source, problems });
        return problems;
      }),
    );
    self.postMessage({
      id: data.id,
      problems: results.flat(),
    } satisfies SyntaxResult);
  },
);
