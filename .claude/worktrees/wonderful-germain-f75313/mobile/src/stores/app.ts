import { create } from 'zustand';

// Single global store for invalidating queries after writes. Components subscribe
// to `dataVersion` and re-fetch their data when it bumps.
interface AppState {
  dataVersion: number;
  bumpVersion: () => void;
  ready: boolean;
  setReady: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  dataVersion: 0,
  bumpVersion: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
  ready: false,
  setReady: (v) => set({ ready: v }),
}));
