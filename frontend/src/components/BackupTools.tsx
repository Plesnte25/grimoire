import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchBackup, importBackup } from "../app/api";
import { ConfirmDialog } from "./ConfirmDialog";

export function BackupTools() {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<unknown>(null);

  async function download() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const file = await fetchBackup();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `grimoire-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage("Backup downloaded.");
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Could not export your backup.");
    } finally {
      setBusy(false);
    }
  }

  async function selectFile(file?: File) {
    if (!file) return;
    setError(null);
    setMessage(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Backup files must be smaller than 20 MB.");
      setPendingBackup(JSON.parse(await file.text()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this backup file.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <section className="surface-card mt-4 rounded-[var(--radius-panel)] p-4 md:p-5" aria-labelledby="backup-heading">
      <h2 id="backup-heading" className="font-semibold">Backup & restore</h2>
      <p className="mt-1 text-sm text-[var(--tx3)]">Export your library, history, lists, tags, goals and reminders. PINs and trusted devices are never included. Import merges the backup without deleting anything.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={download} className="min-h-11 rounded-xl bg-[var(--accbg)] px-4 text-sm font-semibold text-[var(--acc-ink)] disabled:opacity-50">
          {busy ? "Working…" : "Export backup"}
        </button>
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="min-h-11 rounded-xl border border-[var(--line2)] px-4 text-sm font-semibold text-[var(--tx)] hover:bg-[var(--s2)] disabled:opacity-50">
          Import backup
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose a Grimoire backup file" onChange={(event) => void selectFile(event.target.files?.[0])} />
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-[var(--err)]">{error}</p> : null}
      {message ? <p role="status" className="mt-3 text-sm text-[var(--ok)]">{message}</p> : null}
      <ConfirmDialog
        open={pendingBackup !== null}
        title="Merge this backup?"
        body="Matching titles and lists will be updated. New records will be added; nothing in your current library will be deleted."
        confirmLabel={busy ? "Importing…" : "Merge backup"}
        onCancel={() => setPendingBackup(null)}
        onConfirm={async () => {
          if (pendingBackup === null) return;
          const payload = pendingBackup;
          setPendingBackup(null);
          setBusy(true);
          setError(null);
          try {
            const result = await importBackup(payload);
            setMessage(`Imported ${result.importedItems} title${result.importedItems === 1 ? "" : "s"}.`);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["library"] }),
              queryClient.invalidateQueries({ queryKey: ["lists"] }),
              queryClient.invalidateQueries({ queryKey: ["tier-lists"] }),
              queryClient.invalidateQueries({ queryKey: ["home"] }),
              queryClient.invalidateQueries({ queryKey: ["diary"] }),
            ]);
          } catch (e: any) {
            setError(e?.response?.data?.error ?? "Could not import this backup.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
