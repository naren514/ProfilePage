// Reads the server-sent events from /api/admin/writing/ai/rewrite.

export interface ContextSummary {
  model: string;
  tier: string;
  operation: string;
  promptVersion: string;
  style: { id: string; name: string; version: number } | null;
  examples: string[];
  passageWords: number;
  contextBeforeWords: number;
  contextAfterWords: number;
  maxOutputTokens: number;
  messages: Array<{ role: string; content: string }>;
}

export type RewriteEvent =
  | { event: "meta"; data: { suggestionId: string; context: ContextSummary } }
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: { suggestionId: string; proposalHtml: string; truncated: boolean; costUsd: number } }
  | { event: "error"; data: { code: string; message: string } };

export async function* readRewriteStream(response: Response): AsyncGenerator<RewriteEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        yield { event, data: JSON.parse(data) } as RewriteEvent;
      } catch {
        // ignore malformed events
      }
    }
  }
}
