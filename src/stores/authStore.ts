import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LinkedInProfile } from "../types/linkedin";

interface AuthState {
  accessToken: string | null;
  dmaToken: string | null;
  userId: string | null;
  profile: LinkedInProfile | null;
  isBasicAuthenticated: boolean;
  isFullyAuthenticated: boolean;
  setTokens: (accessToken: string | null, dmaToken: string | null) => void;
  setUserId: (userId: string | null) => void;
  setProfile: (profile: LinkedInProfile | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      dmaToken: null,
      userId: null,
      profile: null,
      isBasicAuthenticated: false,
      isFullyAuthenticated: false,
      setTokens: (accessToken, dmaToken) =>
        set({
          accessToken,
          dmaToken,
          isBasicAuthenticated: !!accessToken,
          isFullyAuthenticated: !!(accessToken && dmaToken),
        }),
      setUserId: (userId) => set({ userId }),
      setProfile: (profile) => set({ profile }),
      logout: () =>
        set({
          accessToken: null,
          dmaToken: null,
          userId: null,
          profile: null,
          isBasicAuthenticated: false,
          isFullyAuthenticated: false,
        }),
    }),
    {
      name: "linkedin-auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        dmaToken: state.dmaToken,
        userId: state.userId,
        profile: state.profile,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Recalculate auth states on rehydration
          state.isBasicAuthenticated = !!state.accessToken;
          state.isFullyAuthenticated = !!(state.accessToken && state.dmaToken);
          console.log("Auth store rehydrated:", {
            hasAccessToken: !!state.accessToken,
            hasDmaToken: !!state.dmaToken,
            hasUserId: !!state.userId,
            isBasicAuthenticated: state.isBasicAuthenticated,
            isFullyAuthenticated: state.isFullyAuthenticated,
          });
        }
      },
    }
  )
);
