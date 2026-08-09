import { create } from 'zustand';

// Single global store for invalidating queries after writes. Components subscribe
// to `dataVersion` and re-fetch their data when it bumps.
interface AppState {
  dataVersion: number;
  bumpVersion: () => void;
  ready: boolean;
  setReady: (v: boolean) => void;
  /**
   * The medication Today opens its card pager on, or null for the first card.
   *
   * The pager sorts A to Z, so the card you land on after logging a shot is the
   * medication whose name sorts first rather than the one you just injected.
   * `log-shot` names the medication it wrote here, Today scrolls to it, and the
   * first swipe clears it. Sorting by the last shot instead would move the cards
   * under a finger already on the way back from the log screen.
   */
  focusMedicationId: string | null;
  setFocusMedication: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  dataVersion: 0,
  bumpVersion: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
  ready: false,
  setReady: (v) => set({ ready: v }),
  focusMedicationId: null,
  setFocusMedication: (id) => set({ focusMedicationId: id }),
}));
