import { useState } from "react";
import type { Tag } from "../types";

const MOOD_SUGGESTIONS = ["Cozy", "Feel-good", "Funny", "Intense", "Dark", "Mind-bending", "Romantic", "Scary", "Sad", "Epic"];

function TagRow({
  label,
  kind,
  current,
  known,
  suggestions,
  onChange,
}: {
  label: string;
  kind: Tag["kind"];
  current: string[];
  known: string[];
  suggestions?: string[];
  onChange: (names: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const listId = `tags-${kind}`;
  const options = [...new Set([...(suggestions ?? []), ...known])].filter(
    (n) => !current.some((c) => c.toLowerCase() === n.toLowerCase())
  );

  const add = (name: string) => {
    const n = name.trim();
    if (!n || current.some((c) => c.toLowerCase() === n.toLowerCase())) return setDraft("");
    onChange([...current, n]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-white/75">{label}</div>
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {current.map((name) => (
          <li key={name} className="flex items-center gap-1 rounded-full bg-white/10 pl-3 text-sm">
            {name}
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
              aria-label={`Remove ${name}`}
              onClick={() => onChange(current.filter((c) => c !== name))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
        }}
      >
        <input
          className="min-h-11 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-sm"
          placeholder={kind === "MOOD" ? "Add a mood" : "Add a tag (comfort watch, with family…)"}
          aria-label={kind === "MOOD" ? "Add a mood" : "Add a tag"}
          list={listId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <datalist id={listId}>
          {options.map((o) => <option key={o} value={o} />)}
        </datalist>
        <button type="submit" className="min-h-11 rounded-xl bg-white/10 px-4 text-sm hover:bg-white/15">
          Add
        </button>
      </form>
    </div>
  );
}

export function TagEditor({
  tags,
  allTags,
  onChange,
}: {
  tags: Tag[];
  allTags: Tag[];
  onChange: (names: string[], kind: Tag["kind"]) => void;
}) {
  const of = (kind: Tag["kind"]) => tags.filter((t) => t.kind === kind).map((t) => t.name);
  const known = (kind: Tag["kind"]) => allTags.filter((t) => t.kind === kind).map((t) => t.name);
  return (
    <div className="space-y-4">
      <TagRow label="Tags" kind="TAG" current={of("TAG")} known={known("TAG")} onChange={(n) => onChange(n, "TAG")} />
      <TagRow
        label="Mood"
        kind="MOOD"
        current={of("MOOD")}
        known={known("MOOD")}
        suggestions={MOOD_SUGGESTIONS}
        onChange={(n) => onChange(n, "MOOD")}
      />
    </div>
  );
}
