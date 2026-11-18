"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SetupCard } from "./setup-card";
import { formatWhen, StudioApiError, studioFetch, type StudioListItem } from "./client";

interface StyleRules {
  voice?: string;
  sentences?: string;
  structure?: string;
  avoid?: string[];
  other?: string;
}

interface Style {
  id: string;
  name: string;
  description: string;
  rules: StyleRules;
  exampleDocumentIds: string[];
  isDefault: boolean;
  version: number;
  updatedAt: string;
}

interface StyleVersion {
  id: string;
  version: number;
  name: string;
  createdAt: string;
  createdBy: string | null;
  note: string | null;
  sourceRunId: string | null;
}

interface Draft {
  name: string;
  description: string;
  voice: string;
  sentences: string;
  structure: string;
  avoid: string[];
  other: string;
  exampleDocumentIds: string[];
}

const emptyDraft: Draft = { name: "", description: "", voice: "", sentences: "", structure: "", avoid: [], other: "", exampleDocumentIds: [] };

function toDraft(style: Style): Draft {
  return {
    name: style.name,
    description: style.description,
    voice: style.rules.voice ?? "",
    sentences: style.rules.sentences ?? "",
    structure: style.rules.structure ?? "",
    avoid: style.rules.avoid ?? [],
    other: style.rules.other ?? "",
    exampleDocumentIds: style.exampleDocumentIds,
  };
}

function toPayload(d: Draft) {
  return {
    name: d.name,
    description: d.description,
    rules: { voice: d.voice, sentences: d.sentences, structure: d.structure, avoid: d.avoid, other: d.other },
    exampleDocumentIds: d.exampleDocumentIds,
  };
}

// ---------------------------------------------------------------------------

export function StylesManager() {
  const [setupRequired, setSetupRequired] = useState(false);
  const [tab, setTab] = useState("styles");
  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/admin/stories">
            <ArrowLeft className="mr-1 h-4 w-4" /> Thoughts
          </Link>
        </Button>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Styles &amp; AI</h1>
        <p className="text-muted-foreground">
          Writing styles tell the AI how you write. Each post can use a different one.
        </p>
      </div>
      {setupRequired ? (
        <SetupCard onReady={() => setSetupRequired(false)} />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="styles">Writing styles</TabsTrigger>
            <TabsTrigger value="ai">AI settings &amp; usage</TabsTrigger>
          </TabsList>
          <TabsContent value="styles" className="mt-6">
            <StylesTab onSetupRequired={() => setSetupRequired(true)} />
          </TabsContent>
          <TabsContent value="ai" className="mt-6">
            <AiSettingsTab onSetupRequired={() => setSetupRequired(true)} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function StylesTab({ onSetupRequired }: { onSetupRequired: () => void }) {
  const [styles, setStyles] = useState<Style[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [avoidInput, setAvoidInput] = useState("");
  const [documents, setDocuments] = useState<StudioListItem[]>([]);
  const [versions, setVersions] = useState<StyleVersion[] | null>(null);

  const load = useCallback(async (selectId?: string) => {
    try {
      const data = await studioFetch<{ styles: Style[] }>("/styles");
      setStyles(data.styles);
      const pick = selectId ? data.styles.find((s) => s.id === selectId) : data.styles[0];
      if (pick) {
        setSelectedId(pick.id);
        setDraft(toDraft(pick));
      }
    } catch (e) {
      if (e instanceof StudioApiError && e.code === "SETUP_REQUIRED") onSetupRequired();
      else toast.error(e instanceof Error ? e.message : "Couldn't load styles");
    }
  }, [onSetupRequired]);

  useEffect(() => {
    load();
    studioFetch<{ documents: StudioListItem[] }>("/documents?filter=all")
      .then((d) => setDocuments(d.documents.filter((doc) => doc.wordCount > 0)))
      .catch(() => {});
  }, [load]);

  const selected = useMemo(() => styles?.find((s) => s.id === selectedId) ?? null, [styles, selectedId]);
  const dirty = selectedId === "new" || (selected ? JSON.stringify(toDraft(selected)) !== JSON.stringify(draft) : false);

  const select = (style: Style) => {
    if (dirty && !confirm("Discard unsaved changes to this style?")) return;
    setSelectedId(style.id);
    setDraft(toDraft(style));
    setVersions(null);
  };

  const startNew = () => {
    if (dirty && !confirm("Discard unsaved changes to this style?")) return;
    setSelectedId("new");
    setDraft(emptyDraft);
    setVersions(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = toPayload(draft);
      const style =
        selectedId === "new"
          ? await studioFetch<Style>("/styles", { method: "POST", json: payload })
          : await studioFetch<Style>(`/styles/${selectedId}`, { method: "PUT", json: payload });
      toast.success(selectedId === "new" ? "Style created" : `Saved as version ${style.version}`);
      setVersions(null);
      await load(style.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async () => {
    if (!selected) return;
    try {
      await studioFetch(`/styles/${selected.id}/default`, { method: "POST" });
      toast.success(`${selected.name} is now the default style`);
      await load(selected.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change the default");
    }
  };

  const archive = async () => {
    if (!selected) return;
    if (!confirm(`Remove "${selected.name}"? Posts using it will switch to the default style. Its history is kept.`)) return;
    try {
      await studioFetch(`/styles/${selected.id}`, { method: "DELETE" });
      toast.success("Style removed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove");
    }
  };

  const showVersions = async () => {
    if (!selected) return;
    try {
      setVersions((await studioFetch<{ versions: StyleVersion[] }>(`/styles/${selected.id}/versions`)).versions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load history");
    }
  };

  const restore = async (version: StyleVersion) => {
    if (!selected || !confirm(`Restore version ${version.version}? It's saved as a new version; nothing is lost.`)) return;
    try {
      await studioFetch(`/styles/${selected.id}/restore`, { method: "POST", json: { versionId: version.id } });
      toast.success(`Restored version ${version.version}`);
      setVersions(null);
      await load(selected.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't restore");
    }
  };

  const addAvoid = () => {
    const items = avoidInput.split(",").map((s) => s.trim()).filter(Boolean);
    if (items.length) setDraft((d) => ({ ...d, avoid: Array.from(new Set([...d.avoid, ...items])).slice(0, 40) }));
    setAvoidInput("");
  };

  if (!styles) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading styles" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Styles" className="space-y-2">
        <ul className="divide-y rounded-lg border">
          {styles.map((style) => (
            <li key={style.id}>
              <button
                type="button"
                onClick={() => select(style)}
                aria-current={selectedId === style.id}
                className={`flex w-full items-center justify-between gap-2 p-3 text-left text-sm hover:bg-muted/40 ${selectedId === style.id ? "bg-muted/60 font-medium" : ""}`}
              >
                <span className="min-w-0 truncate">{style.name}</span>
                {style.isDefault && <Badge variant="secondary">Default</Badge>}
              </button>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="w-full" onClick={startNew}>
          <Plus className="mr-1.5 h-4 w-4" /> New style
        </Button>
      </nav>

      {selectedId && (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {selected ? `Version ${selected.version} · saved ${formatWhen(selected.updatedAt)}` : "New style"}
            </div>
            {selected && (
              <div className="flex flex-wrap gap-2">
                {!selected.isDefault && (
                  <Button type="button" variant="outline" size="sm" onClick={makeDefault}>
                    <Star className="mr-1.5 h-4 w-4" /> Make default
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={showVersions}>
                  <History className="mr-1.5 h-4 w-4" /> History
                </Button>
                {!selected.isDefault && (
                  <Button type="button" variant="ghost" size="sm" onClick={archive}>
                    <Trash2 className="mr-1.5 h-4 w-4 text-destructive" /> Remove
                  </Button>
                )}
              </div>
            )}
          </div>

          {versions && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">History</CardTitle>
              </CardHeader>
              <CardContent>
                {versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No earlier versions yet. Each save creates one.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {versions.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                        <span>
                          Version {v.version} · {v.name}{" "}
                          <span className="text-muted-foreground">
                            · {v.createdBy === "starter" ? "original starter version" : new Date(v.createdAt).toLocaleString()}
                          </span>
                          {v.note && (
                            <span className="block text-xs text-muted-foreground">
                              {v.note}
                              {v.sourceRunId && (
                                <>
                                  {" "}
                                  · <Link href={`/admin/stories/runs/${v.sourceRunId}`} className="underline underline-offset-2">see why</Link>
                                </>
                              )}
                            </span>
                          )}
                        </span>
                        {selected && v.version !== selected.version && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => restore(v)}>
                            Restore
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="style-name">Name</Label>
              <Input id="style-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="style-description">When to use it</Label>
              <Input
                id="style-description"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="e.g. Personal reflections and lessons learned"
                maxLength={300}
              />
            </div>
          </div>

          <Field id="style-voice" label="Voice and tone" hint="How should it sound? e.g. warm and honest, first person, admits uncertainty">
            <Textarea id="style-voice" rows={3} value={draft.voice} onChange={(e) => setDraft({ ...draft, voice: e.target.value })} maxLength={1000} />
          </Field>
          <Field id="style-sentences" label="Sentences and paragraphs" hint="Length and rhythm, e.g. short sentences, paragraphs of two to four sentences">
            <Textarea id="style-sentences" rows={2} value={draft.sentences} onChange={(e) => setDraft({ ...draft, sentences: e.target.value })} maxLength={1000} />
          </Field>
          <Field id="style-structure" label="Structure" hint="How a piece is shaped, e.g. open with a concrete moment, end with a takeaway">
            <Textarea id="style-structure" rows={2} value={draft.structure} onChange={(e) => setDraft({ ...draft, structure: e.target.value })} maxLength={1000} />
          </Field>

          <Field id="style-avoid" label="Words and phrases to avoid" hint="Press Enter or use commas to add several">
            <Input
              id="style-avoid"
              value={avoidInput}
              onChange={(e) => setAvoidInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAvoid();
                }
              }}
              onBlur={addAvoid}
              placeholder="e.g. leverage, synergy"
            />
            {draft.avoid.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Avoided words">
                {draft.avoid.map((word) => (
                  <li key={word}>
                    <Badge variant="secondary" className="gap-1 pr-1">
                      {word}
                      <button
                        type="button"
                        aria-label={`Remove ${word}`}
                        className="rounded-sm p-0.5 hover:bg-background/60"
                        onClick={() => setDraft({ ...draft, avoid: draft.avoid.filter((w) => w !== word) })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <Field id="style-other" label="Anything else" hint="Other preferences, e.g. use British spelling, prefer specific details over general claims">
            <Textarea id="style-other" rows={3} value={draft.other} onChange={(e) => setDraft({ ...draft, other: e.target.value })} maxLength={2000} />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Example posts (up to 2)</legend>
            <p className="text-xs text-muted-foreground">
              The AI reads these to match your voice. Each example adds to the cost of every request, so pick short, typical ones.
            </p>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No posts with text yet.</p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                {documents.map((doc) => {
                  const checked = draft.exampleDocumentIds.includes(doc.id);
                  const full = !checked && draft.exampleDocumentIds.length >= 2;
                  return (
                    <label key={doc.id} className={`flex items-center gap-2 rounded px-1 py-1 text-sm ${full ? "opacity-50" : "hover:bg-muted/40"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={full}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            exampleDocumentIds: e.target.checked
                              ? [...draft.exampleDocumentIds, doc.id]
                              : draft.exampleDocumentIds.filter((id) => id !== doc.id),
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{doc.title || "Untitled"}</span>
                      <span className="text-xs text-muted-foreground">{doc.wordCount.toLocaleString()} words</span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !draft.name.trim() || !dirty}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedId === "new" ? "Create style" : "Save new version"}
            </Button>
            {dirty && selected && (
              <Button type="button" variant="ghost" onClick={() => setDraft(toDraft(selected))}>
                Discard changes
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI settings
// ---------------------------------------------------------------------------

interface AiSettings {
  enabled: boolean;
  models: { fast: string; quality: string };
  monthlyBudgetUsd: number;
  prices: Record<string, { input: number; output: number }>;
  searchPriceUsd: number;
  runBudgetUsd: number;
}

function AiSettingsTab({ onSetupRequired }: { onSetupRequired: () => void }) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [usage, setUsage] = useState<{ spentUsd: number; requests: number } | null>(null);
  const [configured, setConfigured] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    studioFetch<{ settings: AiSettings; usage: { spentUsd: number; requests: number }; providerConfigured: boolean }>("/ai/settings")
      .then((d) => {
        setSettings(d.settings);
        setUsage(d.usage);
        setConfigured(d.providerConfigured);
      })
      .catch((e) => {
        if (e instanceof StudioApiError && e.code === "SETUP_REQUIRED") onSetupRequired();
        else toast.error(e instanceof Error ? e.message : "Couldn't load AI settings");
      });
  }, [onSetupRequired]);

  if (!settings) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading AI settings" />
      </div>
    );
  }

  const models = Array.from(new Set([settings.models.fast, settings.models.quality, ...Object.keys(settings.prices)]));
  const spentShare = settings.monthlyBudgetUsd > 0 && usage ? Math.min(100, (usage.spentUsd / settings.monthlyBudgetUsd) * 100) : 0;

  const setPrice = (model: string, key: "input" | "output", value: string) => {
    const n = Number(value);
    setSettings({
      ...settings,
      prices: { ...settings.prices, [model]: { ...(settings.prices[model] ?? { input: 0, output: 0 }), [key]: Number.isFinite(n) ? n : 0 } },
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      // Only keep prices for models that are typed in, plus any already priced
      await studioFetch("/ai/settings", { method: "PUT", json: settings });
      toast.success("AI settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {!configured && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          AI is not set up on the server. Add <code>OPENAI_API_KEY</code> to the site&apos;s environment variables (in Vercel)
          and redeploy. The editor works fully without it.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What leaves your site</CardTitle>
          <CardDescription>Only when you use an AI feature. Turning AI off stops all of it; writing, saving and publishing never need it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <b>To OpenAI</b> (or the AI server set by <code>OPENAI_BASE_URL</code>): the text you select plus a few hundred words around it, the
            post&apos;s writing style and up to three voice examples, and for workflows and chat, the post&apos;s text (trimmed to about
            16,000–24,000 characters). Ideas you explore are sent too. Each request is listed under &ldquo;What the AI saw&rdquo;.
          </p>
          <p>
            <b>To Tavily</b>: only the search queries the research workflow writes from your question. The pages it returns are stored here as
            sources.
          </p>
          <p className="text-muted-foreground">
            Kept in your database: suggestions and what you did with them, chats, workflow runs and their logs, sources, samples and usage. You
            can delete feedback on the Memory page and export everything from Thoughts → Export. How long providers keep API data is set by
            their own policies; check OpenAI&apos;s and Tavily&apos;s data-retention terms for your account.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">This month</CardTitle>
          <CardDescription>Spending is estimated from the prices below and resets on the 1st (UTC).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-2xl font-semibold">
            ${usage?.spentUsd.toFixed(2) ?? "0.00"}{" "}
            <span className="text-base font-normal text-muted-foreground">of ${settings.monthlyBudgetUsd.toFixed(2)}</span>
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(spentShare)} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used">
            <div className="h-full bg-foreground" style={{ width: `${spentShare}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{usage?.requests ?? 0} AI requests this month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="ai-enabled">AI suggestions</Label>
              <p className="text-xs text-muted-foreground">Turn off to stop all AI requests.</p>
            </div>
            <Switch id="ai-enabled" checked={settings.enabled} onCheckedChange={(enabled) => setSettings({ ...settings, enabled })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-budget">Monthly budget (US$)</Label>
            <Input
              id="ai-budget"
              type="number"
              min={0}
              step={1}
              value={settings.monthlyBudgetUsd}
              onChange={(e) => setSettings({ ...settings, monthlyBudgetUsd: Math.max(0, Number(e.target.value) || 0) })}
              className="max-w-[10rem]"
            />
            <p className="text-xs text-muted-foreground">AI requests stop once this is reached. Set to 0 to block all spending.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-run-budget">Limit per workflow run (US$)</Label>
              <Input
                id="ai-run-budget"
                type="number"
                min={0}
                step={0.1}
                value={settings.runBudgetUsd}
                onChange={(e) => setSettings({ ...settings, runBudgetUsd: Math.max(0, Number(e.target.value) || 0) })}
                className="max-w-[10rem]"
              />
              <p className="text-xs text-muted-foreground">A single draft, review or research run stops if it would cost more.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-search-price">Price per web search (US$)</Label>
              <Input
                id="ai-search-price"
                type="number"
                min={0}
                step={0.001}
                value={settings.searchPriceUsd}
                onChange={(e) => setSettings({ ...settings, searchPriceUsd: Math.max(0, Number(e.target.value) || 0) })}
                className="max-w-[10rem]"
              />
              <p className="text-xs text-muted-foreground">Tavily. Check your plan&apos;s price per credit; a basic search may use more than one credit.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-fast">Fast model</Label>
              <Input id="ai-fast" value={settings.models.fast} onChange={(e) => setSettings({ ...settings, models: { ...settings.models, fast: e.target.value } })} />
              <p className="text-xs text-muted-foreground">Used for Shorten, Simplify and Fix grammar.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-quality">Quality model</Label>
              <Input
                id="ai-quality"
                value={settings.models.quality}
                onChange={(e) => setSettings({ ...settings, models: { ...settings.models, quality: e.target.value } })}
              />
              <p className="text-xs text-muted-foreground">Used for Improve, Expand, flow, styles and custom edits.</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Prices (US$ per 1M tokens)</p>
            <p className="text-xs text-muted-foreground">
              Check these against OpenAI&apos;s pricing page. A model without a price is counted at $10 in / $50 out, so the budget
              stays on the safe side.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-normal">Model</th>
                  <th className="py-1 font-normal">Input</th>
                  <th className="py-1 font-normal">Output</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model}>
                    <td className="py-1 pr-2 font-mono text-xs">
                      {model}
                      {!settings.prices[model] && <span className="ml-1 text-destructive">(no price)</span>}
                    </td>
                    {(["input", "output"] as const).map((key) => (
                      <td key={key} className="py-1 pr-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          aria-label={`${model} ${key} price`}
                          value={settings.prices[model]?.[key] ?? ""}
                          placeholder={key === "input" ? "10" : "50"}
                          onChange={(e) => setPrice(model, key, e.target.value)}
                          className="h-8 max-w-[7rem]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button onClick={save} disabled={saving || !settings.models.fast.trim() || !settings.models.quality.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
