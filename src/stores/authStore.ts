// src/stores/authStore.ts - Updated for DMA-only OAuth
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LinkedInProfile } from "../types/linkedin";

interface AuthState {
  // Keep both for backward compatibility, but DMA token is primary now
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
      setTokens: (accessToken, dmaToken) => {
        console.log('AuthStore: setTokens called with:', {
          accessToken: accessToken ? 'present' : 'null',
          dmaToken: dmaToken ? 'present' : 'null'
        });

        // Two-step authentication: Basic OAuth first, then DMA OAuth
        set({
          accessToken,
          dmaToken,
          isBasicAuthenticated: !!accessToken,
          isFullyAuthenticated: !!(accessToken && dmaToken), // Need BOTH tokens for full access
        });
      },
      setUserId: (userId) => {
        console.log('AuthStore: Setting userId:', userId);
        set({ userId });
      },
      setProfile: (profile) => {
        console.log('AuthStore: Setting profile:', profile);
        set({ profile });
      },
      logout: () => {
        console.log('AuthStore: Logging out');
        set({
          accessToken: null,
          dmaToken: null,
          userId: null,
          profile: null,
          isBasicAuthenticated: false,
          isFullyAuthenticated: false,
        });
      },
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
          // RESTORED: Original two-step authentication logic
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