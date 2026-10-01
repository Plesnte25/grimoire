import { create } from "zustand";

export type Toast = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  timeoutMs: number;
};

type ToastState = {
  toasts: Toast[];
  show: (t: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const showToast = (t: Omit<Toast, "id">) => useToasts.getState().show(t);
