import { create } from 'zustand';

interface AppState {
  sidebarCollapsed: boolean;
  darkMode: boolean | undefined;
  currentModule: string;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDarkMode: (dark: boolean) => void;
  setCurrentModule: (module: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  darkMode: false, // Force light mode always
  currentModule: 'dashboard',
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setDarkMode: (dark) => set({ darkMode: false }), // Always force light mode
  setCurrentModule: (module) => set({ currentModule: module }),
}));