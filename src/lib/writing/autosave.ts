// Framework-free autosave engine for the Writing Studio editor.
//
// Guarantees:
// - At most one save request in flight; edits made meanwhile are sent next.
// - A change is only dropped from the queue once the server acknowledged it.
// - Network/server errors keep the changes and retry with backoff.
// - A revision conflict stops autosave until the author decides what to do.

export type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

/** Field values; a function is called at send time (used for the editor body). */
export type Changes = Record<string, unknown>;

export type SaveOutcome =
  | { ok: true; revision: number }
  | { ok: false; kind: "conflict"; message: string }
  | { ok: false; kind: "error"; message: string; retryable: boolean };

/** A named version to record with the save ("manual", "ai_accept"), or undefined for a plain autosave. */
export type SnapshotKind = "manual" | "ai_accept";

export type SaveFn = (changes: Record<string, unknown>, baseRevision: number, snapshot: SnapshotKind | undefined) => Promise<SaveOutcome>;

export interface AutosaveSnapshot {
  state: SaveState;
  baseRevision: number;
  message: string | null;
  lastSavedAt: number | null;
}

interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
}

export interface AutosaveOptions {
  save: SaveFn;
  baseRevision: number;
  debounceMs?: number;
  maxRetryDelayMs?: number;
  onChange?: (snapshot: AutosaveSnapshot) => void;
  timers?: Timers;
}

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

function resolve(changes: Changes): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) out[key] = typeof value === "function" ? value() : value;
  return out;
}

export class AutosaveController {
  private pending: Changes = {};
  private inflight: Changes | null = null;
  private timer: unknown = null;
  private retryDelay = 0;
  private snapshotRequested: SnapshotKind | undefined;
  private disposed = false;
  private snapshot: AutosaveSnapshot;
  private readonly save: SaveFn;
  private readonly debounceMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly onChange?: (snapshot: AutosaveSnapshot) => void;
  private readonly timers: Timers;

  constructor(options: AutosaveOptions) {
    this.save = options.save;
    this.debounceMs = options.debounceMs ?? 1500;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 30_000;
    this.onChange = options.onChange;
    this.timers = options.timers ?? defaultTimers;
    this.snapshot = { state: "saved", baseRevision: options.baseRevision, message: null, lastSavedAt: null };
  }

  get state(): AutosaveSnapshot {
    return this.snapshot;
  }

  /** True while any change hasn't been acknowledged by the server. */
  hasUnsavedChanges(): boolean {
    return Object.keys(this.pending).length > 0 || this.inflight !== null;
  }

  /** Record edited fields and schedule a save. */
  update(changes: Changes): void {
    if (this.disposed) return;
    this.pending = { ...this.pending, ...changes };
    if (this.snapshot.state === "conflict") return; // wait for the author
    if (this.snapshot.state !== "saving") this.set({ state: "dirty", message: null });
    // A new edit also re-arms a save after an error (sooner than a backoff retry)
    this.schedule(this.debounceMs);
  }

  /** Save now. With a snapshot kind, the save also records a named version. */
  flush(options: { snapshot?: SnapshotKind } = {}): void {
    if (this.disposed) return;
    // An AI-accept version outranks a plain manual one if both are requested
    if (options.snapshot && this.snapshotRequested !== "ai_accept") this.snapshotRequested = options.snapshot;
    if (this.snapshot.state === "conflict") return;
    if (!this.hasUnsavedChanges() && !this.snapshotRequested) return;
    this.schedule(0);
  }

  /** After a conflict: save these changes on top of the latest revision ("keep mine"). */
  resolveConflictWith(latestRevision: number): void {
    this.set({ state: "dirty", baseRevision: latestRevision, message: null });
    this.schedule(0);
  }

  /** After a conflict: throw away unsaved changes ("use the other version"). */
  discard(latestRevision: number): void {
    this.cancelTimer();
    this.pending = {};
    this.snapshotRequested = undefined;
    this.set({ state: "saved", baseRevision: latestRevision, message: null });
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer();
  }

  private schedule(ms: number) {
    this.cancelTimer();
    this.timer = this.timers.setTimeout(() => {
      this.timer = null;
      void this.run();
    }, ms);
  }

  private cancelTimer() {
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
  }

  private async run() {
    if (this.disposed || this.inflight !== null || this.snapshot.state === "conflict") return;
    const snapshot = this.snapshotRequested;
    if (Object.keys(this.pending).length === 0 && !snapshot) return;

    this.inflight = this.pending;
    this.pending = {};
    this.snapshotRequested = undefined;
    this.set({ state: "saving" });

    let outcome: SaveOutcome;
    let payload: Record<string, unknown>;
    try {
      payload = resolve(this.inflight);
      outcome = await this.save(payload, this.snapshot.baseRevision, snapshot);
    } catch (error) {
      outcome = { ok: false, kind: "error", message: error instanceof Error ? error.message : "Network error", retryable: true };
    }
    if (this.disposed) return;

    if (outcome.ok) {
      this.inflight = null;
      this.retryDelay = 0;
      const more = Object.keys(this.pending).length > 0 || Boolean(this.snapshotRequested);
      this.set({
        state: more ? "dirty" : "saved",
        baseRevision: outcome.revision,
        message: null,
        lastSavedAt: this.timers.now(),
      });
      if (more) this.schedule(0);
      return;
    }

    // Put the unacknowledged changes back; anything edited since takes precedence.
    this.pending = { ...this.inflight, ...this.pending };
    this.inflight = null;
    if (snapshot && this.snapshotRequested !== "ai_accept") this.snapshotRequested = snapshot;

    if (outcome.kind === "conflict") {
      this.set({ state: "conflict", message: outcome.message });
      return;
    }
    this.set({ state: "error", message: outcome.message });
    if (outcome.retryable) {
      this.retryDelay = Math.min(this.retryDelay ? this.retryDelay * 2 : 2000, this.maxRetryDelayMs);
      this.schedule(this.retryDelay);
    }
  }

  private set(patch: Partial<AutosaveSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.onChange?.(this.snapshot);
  }
}
