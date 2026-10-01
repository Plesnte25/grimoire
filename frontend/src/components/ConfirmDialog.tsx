import { useEffect, useRef } from "react";

/** Native <dialog>: focus is trapped and Escape cancels without extra code. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="w-[min(92vw,420px)] rounded-2xl border border-white/15 bg-[#1c1730] p-6 text-white backdrop:bg-black/60"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-white/80">{body}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          autoFocus
          className="min-h-11 rounded-xl px-4 bg-white/10 hover:bg-white/15"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="min-h-11 rounded-xl px-4 bg-rose-500/80 font-semibold hover:bg-rose-500"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
