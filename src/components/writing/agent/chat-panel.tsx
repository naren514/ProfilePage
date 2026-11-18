"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, MessageSquarePlus, Send, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatWhen, studioFetch } from "../client";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

async function* readEvents(response: Response): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
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
      try {
        if (data) yield { event, data: JSON.parse(data) };
      } catch {
        // ignore malformed events
      }
    }
  }
}

/** The per-post writing partner. Conversations are saved; "New" starts fresh. */
export function ChatPanel({ documentId, disabledReason }: { documentId: string; disabledReason?: string }) {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // A conversation created by send() already shows its messages locally
  const createdLocally = useRef<string | null>(null);

  const loadConversations = useCallback(async () => {
    const data = await studioFetch<{ conversations: Conversation[] }>(`/documents/${documentId}/conversations`);
    setConversations(data.conversations);
    return data.conversations;
  }, [documentId]);

  useEffect(() => {
    loadConversations()
      .then((list) => {
        if (list[0]) setActiveId(list[0].id);
      })
      .catch(() => setConversations([]));
    return () => abortRef.current?.abort();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    if (createdLocally.current === activeId) return;
    studioFetch<{ messages: Message[] }>(`/conversations/${activeId}`)
      .then((d) => setMessages(d.messages))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't load the conversation"));
  }, [activeId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const newConversation = async () => {
    const c = await studioFetch<Conversation>(`/documents/${documentId}/conversations`, { method: "POST" });
    await loadConversations();
    setActiveId(c.id);
  };

  const removeConversation = async () => {
    if (!activeId || !confirm("Remove this conversation from the list?")) return;
    await studioFetch(`/conversations/${activeId}`, { method: "DELETE" });
    const list = await loadConversations();
    setActiveId(list[0]?.id ?? null);
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || streaming) return;
    let conversationId = activeId;
    if (!conversationId) {
      const c = await studioFetch<Conversation>(`/documents/${documentId}/conversations`, { method: "POST" });
      conversationId = c.id;
      createdLocally.current = c.id;
      setActiveId(c.id);
    }
    setDraft("");
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content }, { id: "streaming", role: "assistant", content: "" }]);
    setStreaming(true);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const response = await fetch(`/api/admin/writing/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `The reply failed (${response.status}).`);
      }
      for await (const ev of readEvents(response)) {
        if (ev.event === "delta") {
          setMessages((m) => m.map((msg) => (msg.id === "streaming" ? { ...msg, content: msg.content + String(ev.data.text) } : msg)));
        } else if (ev.event === "done") {
          setMessages((m) => m.map((msg) => (msg.id === "streaming" ? { ...msg, id: String(ev.data.messageId) } : msg)));
        } else if (ev.event === "error") {
          throw new Error(String(ev.data.message));
        }
      }
    } catch (e) {
      if (!abort.signal.aborted) toast.error(e instanceof Error ? e.message : "The reply failed");
      setMessages((m) => m.filter((msg) => !(msg.id === "streaming" && !msg.content)).map((msg) => (msg.id === "streaming" ? { ...msg, id: `partial-${Date.now()}` } : msg)));
    } finally {
      setStreaming(false);
      loadConversations().catch(() => {});
    }
  };

  if (disabledReason) return <p className="text-xs text-muted-foreground">{disabledReason}</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <label htmlFor={`chat-select-${documentId}`} className="sr-only">
          Conversation
        </label>
        <select
          id={`chat-select-${documentId}`}
          value={activeId ?? ""}
          onChange={(e) => setActiveId(e.target.value || null)}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
        >
          {!activeId && <option value="">New conversation</option>}
          {(conversations ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {(c.title || "Untitled").slice(0, 50)} · {formatWhen(c.updatedAt)}
            </option>
          ))}
        </select>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="New conversation" onClick={newConversation} disabled={streaming}>
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
        {activeId && (
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Remove conversation" onClick={removeConversation} disabled={streaming}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div ref={listRef} className="max-h-[45vh] min-h-[8rem] space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-2" aria-live="polite">
        {messages.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">
            Ask about this post: &ldquo;What&apos;s my strongest point?&rdquo;, &ldquo;What would a sceptic say?&rdquo;, &ldquo;Suggest a better opening.&rdquo; The
            partner reads the post but never changes it.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("rounded-md px-2.5 py-1.5 text-sm", m.role === "user" ? "ml-6 bg-foreground text-background" : "mr-2 bg-background shadow-sm")}>
              {m.role === "assistant" ? (
                m.content ? (
                  <div className="prose prose-sm prose-neutral max-w-none [&_p]:my-1 [&_ul]:my-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" aria-label="Writing a reply" />
                )
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          ))
        )}
      </div>

      <form
        className="flex items-end gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor={`chat-input-${documentId}`} className="sr-only">
          Message
        </label>
        <textarea
          id={`chat-input-${documentId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder="Ask your writing partner…"
          className="min-h-[2.5rem] flex-1 resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {streaming ? (
          <Button type="button" size="icon" variant="outline" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
