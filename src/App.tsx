import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { useAppStore } from "./stores/appStore";
import { AuthFlow } from "./components/auth/AuthFlow";
import { LandingPage } from "./components/landing/LandingPage";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { AppContent } from "./components/AppContent";
import { DMATestPage } from "./components/modules/DMATestPage";
import clsx from "clsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { isBasicAuthenticated, isFullyAuthenticated } = useAuthStore();
  const { sidebarCollapsed } = useAppStore();
  const darkMode = false; // Force bright mode always
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Force light mode always
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  // Check for OAuth callback parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessTokenParam = urlParams.get("access_token");
    const dmaTokenParam = urlParams.get("dma_token");
    const hasAuthParams = accessTokenParam || dmaTokenParam;

    // Set auth check as complete after checking URL params
    setAuthCheckComplete(true);
  }, [isBasicAuthenticated, isFullyAuthenticated]);

  // Don't render anything until auth check is complete
  if (!authCheckComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          {(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const hasAuthParams =
              urlParams.has("access_token") || urlParams.has("dma_token");

            // Show AuthFlow if we have auth params in URL
            if (hasAuthParams) {
              return <AuthFlow isDark={false} />;
            }

            // Show LandingPage if not authenticated at all
            if (!isBasicAuthenticated) {
              return <LandingPage />;
            }

            // Show AuthFlow for DMA step if basic auth but no DMA
            if (isBasicAuthenticated && !isFullyAuthenticated) {
              return <AuthFlow isDark={false} />;
            }

            // Show Dashboard if fully authenticated
            if (isFullyAuthenticated) {
              return (
                <div className="flex h-screen">
                  <Sidebar />
                  <div
                    className={clsx(
                      "flex-1 flex flex-col overflow-hidden transition-all duration-300",
                      sidebarCollapsed ? "ml-0" : "ml-0"
                    )}
                  >
                    <Header />
                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
                      <Routes>
                        <Route path="/" element={<AppContent />} />
                        <Route path="/dma-test" element={<DMATestPage />} />
                        <Route
                          path="/admin"
                          element={<div>Admin Panel (Coming Soon)</div>}
                        />
                      </Routes>
                    </main>
                  </div>
                </div>
              );
            }

            // Fallback - show loading or landing page
            return <LandingPage />;
          })()}
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
