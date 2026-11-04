declare module "monaco-editor/esm/vs/editor/common/diff/defaultLinesDiffComputer/defaultLinesDiffComputer.js" {
  type LineRange = { startLineNumber: number; endLineNumberExclusive: number };
  export class DefaultLinesDiffComputer {
    computeDiff(
      original: string[],
      modified: string[],
      options: {
        ignoreTrimWhitespace: boolean;
        maxComputationTimeMs: number;
        computeMoves: boolean;
      },
    ): { changes: { original: LineRange; modified: LineRange }[] };
  }
}
