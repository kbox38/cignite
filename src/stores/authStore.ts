// src/stores/authStore.ts - Updated for DMA-only OAuth
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
      setTokens: (accessToken, dmaToken) => {
        console.log('AuthStore: setTokens called with:', {
          accessToken: accessToken ? 'present' : 'null',
          dmaToken: dmaToken ? 'present' : 'null'
        });

        // DMA-only OAuth: Use DMA token as primary, fallback to access token
        const primaryToken = dmaToken || accessToken;

        console.log('AuthStore: Final tokens:', {
          primaryToken: primaryToken ? 'present' : 'null'
        });

        set({
          accessToken: primaryToken,
          dmaToken: primaryToken,
          isBasicAuthenticated: !!primaryToken,
          isFullyAuthenticated: !!primaryToken, // DMA-only: any token means fully authenticated
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
          // For DMA-only flow, recalculate auth states
          const hasDmaToken = !!state.dmaToken;
          const hasAccessToken = !!state.accessToken;
          
          // If we have either token, we're authenticated
          state.isBasicAuthenticated = !!(hasAccessToken || hasDmaToken);
          state.isFullyAuthenticated = !!(hasDmaToken); // Full auth requires DMA token
          
          console.log("Auth store rehydrated:", {
            hasAccessToken: hasAccessToken,
            hasDmaToken: hasDmaToken,
            hasUserId: !!state.userId,
            isBasicAuthenticated: state.isBasicAuthenticated,
            isFullyAuthenticated: state.isFullyAuthenticated,
          });
        }
      },
    }
  )
);