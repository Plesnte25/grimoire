import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../app/api";
import { readOfflineLogs, removeOfflineLog } from "../lib/offlineLogQueue";
import { showToast } from "../lib/toast";

export function OfflineLogSync() {
  const queryClient = useQueryClient();
  const syncing = useRef(false);

  useEffect(() => {
    const sync = async () => {
      if (!navigator.onLine || syncing.current) return;
      syncing.current = true;
      let synced = 0;
      try {
        const pending = readOfflineLogs();
        for (const entry of pending) {
          await api.post(`/api/library/${encodeURIComponent(entry.mediaId)}/logs`, {
            ...entry.input,
            clientMutationId: entry.clientMutationId,
          });
          removeOfflineLog(entry.clientMutationId);
          synced++;
        }
        if (synced) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["library"] }),
            queryClient.invalidateQueries({ queryKey: ["home"] }),
            queryClient.invalidateQueries({ queryKey: ["diary"] }),
            queryClient.invalidateQueries({ queryKey: ["logs"] }),
          ]);
          showToast({ message: `${synced} offline log${synced === 1 ? "" : "s"} synced`, timeoutMs: 5000 });
        }
      } catch (error: any) {
        console.error("Offline log sync failed:", error);
        const message = error?.response?.status === 401
          ? "Offline logs are still saved on this device. Sign in to sync them."
          : "Some offline logs couldn’t sync. They remain saved here for another attempt.";
        showToast({ message, timeoutMs: 8000 });
      } finally {
        syncing.current = false;
      }
    };

    window.addEventListener("online", sync);
    void sync();
    return () => window.removeEventListener("online", sync);
  }, [queryClient]);

  return null;
}
