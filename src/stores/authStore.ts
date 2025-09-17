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

        // For DMA-only OAuth:
        // - If we get a dmaToken, treat it as both access and DMA token
        // - If we get an accessToken but no dmaToken, it's legacy basic auth
        const finalDmaToken = dmaToken || accessToken; // Use accessToken as DMA if no explicit DMA token
        const finalAccessToken = accessToken || dmaToken; // Use DMA token as access if no explicit access token

        console.log('AuthStore: Final tokens:', {
          finalAccessToken: finalAccessToken ? 'present' : 'null',
          finalDmaToken: finalDmaToken ? 'present' : 'null'
        });

        set({
          accessToken: finalAccessToken,
          dmaToken: finalDmaToken,
          // For DMA-only flow, we're authenticated if we have any token
          isBasicAuthenticated: !!(finalAccessToken || finalDmaToken),
          isFullyAuthenticated: !!(finalDmaToken), // Full auth requires DMA token
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