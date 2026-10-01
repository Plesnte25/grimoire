import { useEffect } from "react";
import { useToasts, type Toast } from "../lib/toast";

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);

  useEffect(() => {
    const t = window.setTimeout(() => dismiss(toast.id), toast.timeoutMs);
    return () => window.clearTimeout(t);
  }, [toast.id, toast.timeoutMs, dismiss]);

  return (
    <div className="pointer-events-auto flex items-center gap-4 rounded-xl border border-white/15 bg-[#1c1730] px-4 py-3 text-sm text-white shadow-2xl">
      <span>{toast.message}</span>
      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          className="font-semibold text-[#f0a8dd] underline-offset-2 hover:underline"
          onClick={() => {
            toast.onAction?.();
            dismiss(toast.id);
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>
  );
}
