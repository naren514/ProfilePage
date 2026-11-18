import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutosaveController, type SaveFn, type SaveOutcome } from "@/lib/writing/autosave";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("AutosaveController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  function setup(save: SaveFn) {
    const states: string[] = [];
    const controller = new AutosaveController({
      save,
      baseRevision: 1,
      debounceMs: 1000,
      onChange: (s) => states.push(s.state),
    });
    return { controller, states };
  }

  it("debounces edits into one save with the latest values", async () => {
    const save = vi.fn<SaveFn>(async () => ({ ok: true, revision: 2 }));
    const { controller } = setup(save);
    controller.update({ title: "a" });
    await vi.advanceTimersByTimeAsync(500);
    controller.update({ title: "ab" });
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: "ab" }, 1, undefined);
    expect(controller.state).toMatchObject({ state: "saved", baseRevision: 2 });
    expect(controller.hasUnsavedChanges()).toBe(false);
  });

  it("evaluates function values at send time", async () => {
    let body = { type: "doc", v: 1 };
    const save = vi.fn<SaveFn>(async () => ({ ok: true, revision: 2 }));
    const { controller } = setup(save);
    controller.update({ bodyJson: () => body });
    body = { type: "doc", v: 2 };
    await vi.advanceTimersByTimeAsync(1000);
    expect(save.mock.calls[0][0]).toEqual({ bodyJson: { type: "doc", v: 2 } });
  });

  it("never runs two saves at once, and sends edits made during a save next, on the new revision", async () => {
    const first = deferred<SaveOutcome>();
    const save = vi
      .fn<SaveFn>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementation(async () => ({ ok: true, revision: 3 }));
    const { controller } = setup(save);

    controller.update({ title: "one" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);

    controller.update({ excerpt: "typed while saving" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1); // still waiting on the first

    first.resolve({ ok: true, revision: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]).toEqual([{ excerpt: "typed while saving" }, 2, undefined]);
    expect(controller.state).toMatchObject({ state: "saved", baseRevision: 3 });
  });

  it("keeps changes and retries with backoff after a network error", async () => {
    const save = vi
      .fn<SaveFn>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: false, kind: "error", message: "500", retryable: true })
      .mockResolvedValue({ ok: true, revision: 2 });
    const { controller } = setup(save);

    controller.update({ title: "keep me" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(controller.state.state).toBe("error");
    expect(controller.hasUnsavedChanges()).toBe(true);

    await vi.advanceTimersByTimeAsync(2000); // first retry
    expect(save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3999);
    expect(save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // second retry after 4s
    expect(save).toHaveBeenCalledTimes(3);
    expect(save.mock.calls[2][0]).toEqual({ title: "keep me" });
    expect(controller.state.state).toBe("saved");
  });

  it("merges a failed save with newer edits, newer values winning", async () => {
    const save = vi
      .fn<SaveFn>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ ok: true, revision: 2 });
    const { controller } = setup(save);
    controller.update({ title: "old", excerpt: "e" });
    await vi.advanceTimersByTimeAsync(1000);
    controller.update({ title: "new" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(save.mock.calls[1][0]).toEqual({ title: "new", excerpt: "e" });
  });

  it("stops on a conflict until the author chooses, then saves on the latest revision", async () => {
    const save = vi
      .fn<SaveFn>()
      .mockResolvedValueOnce({ ok: false, kind: "conflict", message: "changed elsewhere" })
      .mockResolvedValue({ ok: true, revision: 8 });
    const { controller } = setup(save);
    controller.update({ title: "mine" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(controller.state).toMatchObject({ state: "conflict", message: "changed elsewhere" });

    controller.update({ title: "mine, edited more" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);

    controller.resolveConflictWith(7);
    await vi.advanceTimersByTimeAsync(0);
    expect(save.mock.calls[1]).toEqual([{ title: "mine, edited more" }, 7, undefined]);
    expect(controller.state).toMatchObject({ state: "saved", baseRevision: 8 });
  });

  it("can discard local changes after a conflict", async () => {
    const save = vi.fn<SaveFn>().mockResolvedValue({ ok: false, kind: "conflict", message: "x" });
    const { controller } = setup(save);
    controller.update({ title: "mine" });
    await vi.advanceTimersByTimeAsync(1000);
    controller.discard(9);
    expect(controller.hasUnsavedChanges()).toBe(false);
    expect(controller.state).toMatchObject({ state: "saved", baseRevision: 9 });
  });

  it("does not retry non-retryable errors", async () => {
    const save = vi.fn<SaveFn>().mockResolvedValue({ ok: false, kind: "error", message: "bad slug", retryable: false });
    const { controller } = setup(save);
    controller.update({ slug: "Bad" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(controller.state).toMatchObject({ state: "error", message: "bad slug" });
    controller.update({ slug: "good" }); // a new edit tries again
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toEqual({ slug: "good" });
  });

  it("flush({snapshot}) saves immediately and names the version, even with nothing pending", async () => {
    const save = vi.fn<SaveFn>(async () => ({ ok: true, revision: 2 }));
    const { controller } = setup(save);
    controller.flush({ snapshot: "manual" });
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledWith({}, 1, "manual");
  });

  it("an AI-accept version isn't downgraded by a later manual save request", async () => {
    const first = deferred<SaveOutcome>();
    const save = vi
      .fn<SaveFn>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue({ ok: true, revision: 3 });
    const { controller } = setup(save);
    controller.update({ title: "x" });
    await vi.advanceTimersByTimeAsync(1000); // plain save in flight
    controller.update({ bodyJson: { type: "doc" } });
    controller.flush({ snapshot: "ai_accept" });
    controller.flush({ snapshot: "manual" });
    first.resolve({ ok: true, revision: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(save.mock.calls[1][2]).toBe("ai_accept");
  });

  it("keeps a requested version through a failed save", async () => {
    const save = vi
      .fn<SaveFn>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ ok: true, revision: 2 });
    const { controller } = setup(save);
    controller.update({ bodyJson: { type: "doc" } });
    controller.flush({ snapshot: "ai_accept" });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(save.mock.calls[1][2]).toBe("ai_accept");
  });
});
