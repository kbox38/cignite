// src/App.tsx - Complete restored version without syntax errors
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import { useDmaAuth } from './hooks/useDmaAuth';
import { AuthFlow } from './components/auth/AuthFlow';
import { LandingPage } from './components/landing/LandingPage';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/dashboard/Dashboard';
import { Analytics } from './components/modules/Analytics';
import { Synergy } from './components/modules/Synergy';
import { PostPulse } from './components/modules/PostPulse';
import { PostGen } from './components/modules/PostGen';
import { Scheduler } from './components/modules/Scheduler';
import { CreationEngine } from './components/modules/CreationEngine';
import { TheAlgo } from './components/modules/TheAlgo';
import { Settings } from './components/modules/Settings';
import { DMATestPage } from './components/modules/DMATestPage';
      // Process tokens separately to maintain two-step flow

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { isBasicAuthenticated, isFullyAuthenticated, accessToken, dmaToken, setUserId } = useAuthStore();
  const { sidebarCollapsed } = useAppStore();
  const darkMode = false; // Force bright mode always
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [hasProcessedUrlParams, setHasProcessedUrlParams] = useState(false);
  
  // Use DMA auth hook to handle userId extraction
  useDmaAuth();

  // Force light mode always
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Check for OAuth callback parameters only once on initial load
  useEffect(() => {
    if (hasProcessedUrlParams) return;

    const urlParams = new URLSearchParams(window.location.search);
    const accessTokenParam = urlParams.get('access_token');
    const dmaTokenParam = urlParams.get('dma_token');
    const userIdParam = urlParams.get('user_id');
    const hasAuthParams = accessTokenParam || dmaTokenParam;
    
    // RESTORED: Process tokens separately to maintain two-step flow
    if (accessTokenParam || dmaTokenParam) {
      console.log('App: Processing tokens from URL', {
        accessToken: accessTokenParam ? 'found' : 'missing',
        dmaToken: dmaTokenParam ? 'found' : 'missing'
      });
      
      // Preserve existing tokens when adding new ones
      const finalAccessToken = accessTokenParam || accessToken;
      const finalDmaToken = dmaTokenParam || dmaToken;
      
      console.log('App: About to call setTokens with:', {
        finalAccessToken: finalAccessToken ? 'present' : 'null',
        finalDmaToken: finalDmaToken ? 'present' : 'null',
        currentAccessToken: accessToken ? 'present' : 'null',
        currentDmaToken: dmaToken ? 'present' : 'null'
      });

      useAuthStore.getState().setTokens(finalAccessToken, finalDmaToken);
    }
    
    // Process userId from URL if available
    if (userIdParam) {
      console.log('App: Setting userId from URL:', userIdParam);
      setUserId(userIdParam);
    }
    
    // Clean up URL parameters after processing
    if (hasAuthParams) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
    
    setHasProcessedUrlParams(true);
    setAuthCheckComplete(true);
  }, [hasProcessedUrlParams, isBasicAuthenticated, isFullyAuthenticated, accessToken, dmaToken, setUserId]);

  // Debug logging
  useEffect(() => {
    if (authCheckComplete) {
      console.log('App: Authentication status:', {
        isBasicAuthenticated,
        isFullyAuthenticated,
        hasAccessToken: !!accessToken,
        hasDmaToken: !!dmaToken,
        authCheckComplete
      });
    }
  }, [isBasicAuthenticated, isFullyAuthenticated, accessToken, dmaToken, authCheckComplete]);

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
            console.log('App: Rendering decision - isFullyAuthenticated:', isFullyAuthenticated);
            
            // Show authenticated app only when FULLY authenticated (both tokens)
            if (isFullyAuthenticated) {
              return (
                <div className="flex h-screen">
                  <Sidebar />
                  <div
                    className={clsx(
                      'flex-1 flex flex-col transition-all duration-300',
                      sidebarCollapsed ? 'ml-20' : 'ml-64'
                    )}
                  >
                    <Header />
                    <main className="flex-1 overflow-auto bg-gray-50">
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/synergy" element={<Synergy />} />
                        <Route path="/post-pulse" element={<PostPulse />} />
                        <Route path="/post-gen" element={<PostGen />} />
                        <Route path="/scheduler" element={<Scheduler />} />
                        <Route path="/creation-engine" element={<CreationEngine />} />
                        <Route path="/the-algo" element={<TheAlgo />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/dma-test" element={<DMATestPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </main>
                  </div>
                </div>
              );
            }
            
            // Show AuthFlow for basic authenticated users (need DMA step)
            if (isBasicAuthenticated && !isFullyAuthenticated) {
              return (
                <Routes>
                  <Route path="/" element={<AuthFlow />} />
                  <Route path="/auth" element={<AuthFlow />} />
                  <Route path="*" element={<Navigate to="/auth" replace />} />
                </Routes>
              );
            }
            
            // Show landing page for unauthenticated users
            return (
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<AuthFlow />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            );
          })()}
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;