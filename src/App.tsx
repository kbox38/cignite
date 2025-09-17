import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import { useDmaAuth } from './hooks/useDmaAuth';
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
import clsx from 'clsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { isFullyAuthenticated, dmaToken, setTokens, setUserId } = useAuthStore();
  const { sidebarCollapsed } = useAppStore();
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [hasProcessedUrlParams, setHasProcessedUrlParams] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Use DMA auth hook to handle userId extraction
  useDmaAuth();

  // Force light mode always
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Process OAuth callback parameters and errors
  useEffect(() => {
    if (hasProcessedUrlParams) return;

    const urlParams = new URLSearchParams(window.location.search);
    const dmaTokenParam = urlParams.get('dma_token');
    const userIdParam = urlParams.get('user_id');
    const errorParam = urlParams.get('error');
    
    console.log('App: URL parameters detected:', {
      dmaToken: dmaTokenParam ? 'present' : 'missing',
      userId: userIdParam ? 'present' : 'missing',
      error: errorParam || 'none'
    });

    // Handle OAuth errors
    if (errorParam) {
      console.error('App: OAuth error received:', errorParam);
      setAuthError(errorParam);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setHasProcessedUrlParams(true);
      setAuthCheckComplete(true);
      return;
    }

    // Process DMA token if present
    if (dmaTokenParam) {
      console.log('App: Processing DMA OAuth callback token');
      
      console.log('App: Setting DMA token');
      setTokens(dmaTokenParam, dmaTokenParam);
      
      if (userIdParam) {
        console.log('App: Setting userId from URL:', userIdParam);
        setUserId(userIdParam);
      }
      
      // Clean up URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      console.log('App: URL cleaned, DMA token processed');
    }
    
    setHasProcessedUrlParams(true);
    setAuthCheckComplete(true);
  }, [hasProcessedUrlParams, setTokens, setUserId]);

  // Debug logging
  useEffect(() => {
    if (authCheckComplete) {
      console.log('App: Authentication status:', {
        isFullyAuthenticated,
        hasDmaToken: !!dmaToken,
        authCheckComplete,
        authError
      });
    }
  }, [isFullyAuthenticated, dmaToken, authCheckComplete, authError]);

  // Don't render anything until auth check is complete
  if (!authCheckComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state if OAuth failed
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-4">{authError}</p>
          <button
            onClick={() => {
              setAuthError(null);
              window.location.href = '/';
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          {isFullyAuthenticated ? (
            // Authenticated app with dashboard
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
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/synergy" element={<Synergy />} />
                    <Route path="/postpulse" element={<PostPulse />} />
                    <Route path="/postgen" element={<PostGen />} />
                    <Route path="/scheduler" element={<Scheduler />} />
                    <Route path="/creation-engine" element={<CreationEngine />} />
                    <Route path="/algo" element={<TheAlgo />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/dma-test" element={<DMATestPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </div>
          ) : (
            // Landing page for unauthenticated users
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
          )}
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;