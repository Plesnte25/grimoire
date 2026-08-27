import { create } from "zustand";
import type { MediaType } from "../types";

type UIState = {
    searchOpen: boolean;
    setSearchOpen: (v: boolean) => void;

    activeType?: MediaType;
    setActiveType: (t?: MediaType) => void;
};

export const useUI = create<UIState>((set) => ({
    searchOpen: false,
    setSearchOpen: (v) => set({ searchOpen: v }),
    activeType: undefined,
    setActiveType: (t) => set({ activeType: t })
}));
