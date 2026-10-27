import { create } from 'zustand';
export const usePreferences = create<{
  appearance: 'system' | 'light' | 'dark';
  setAppearance: (v: 'system' | 'light' | 'dark') => void;
}>((set) => ({ appearance: 'system', setAppearance: (appearance) => set({ appearance }) }));
