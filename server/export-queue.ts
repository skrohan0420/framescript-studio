/** Bound total concurrent exports across browser sessions; queued cancellation frees no slot. */
export class ExportQueue {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private limit = 2) {}
  acquire(signal: AbortSignal): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.waiting = this.waiting.filter((item) => item !== start);
        reject(Error("Export cancelled"));
      };
      const start = () => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) {
          abort();
          return;
        }
        this.active++;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.active--;
          this.waiting.shift()?.();
        });
      };
      if (signal.aborted) {
        reject(Error("Export cancelled"));
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
      if (this.active < this.limit) start();
      else this.waiting.push(start);
    });
  }
}
