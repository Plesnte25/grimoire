import type { LogInput } from "../app/api";

const STORAGE_KEY = "grimoire.offline-logs.v1";

export type PendingLog = {
  mediaId: string;
  clientMutationId: string;
  input: LogInput;
  queuedAt: string;
};

export function readOfflineLogs(): PendingLog[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  const value: unknown = JSON.parse(stored);
  if (!Array.isArray(value) || value.some((entry) =>
    !entry ||
    typeof entry.mediaId !== "string" ||
    typeof entry.clientMutationId !== "string" ||
    typeof entry.queuedAt !== "string" ||
    typeof entry.input !== "object" ||
    entry.input === null
  )) {
    throw new Error("The offline log queue is invalid. Export your browser storage before clearing it.");
  }
  return value as PendingLog[];
}

export function queueOfflineLog(entry: PendingLog) {
  const logs = readOfflineLogs();
  if (logs.some((log) => log.clientMutationId === entry.clientMutationId)) return;
  logs.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

export function removeOfflineLog(clientMutationId: string) {
  const logs = readOfflineLogs().filter((log) => log.clientMutationId !== clientMutationId);
  if (logs.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  else localStorage.removeItem(STORAGE_KEY);
}
