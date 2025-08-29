/// <reference types="vite/client" />

// Extend Window interface for file system API
interface Window {
  fs?: {
    readFile: (path: string, options?: { encoding?: string }) => Promise<string | Uint8Array>;
  };
}

// Environment variables
interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_STRIPE_PUBLIC_KEY: string;
  readonly VITE_LINKEDIN_CLIENT_ID: string;
  readonly VITE_LINKEDIN_DMA_CLIENT_ID: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}