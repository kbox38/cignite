// src/App.tsx - Fixed layout positioning
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import clsx from 'clsx';
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
import { DMADebugPage } from './components/modules/DMADebugPage';

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
    
    // Process tokens separately to maintain two-step flow
    if (accessTokenParam || dmaTokenParam) {
      console.log('App: Processing tokens from URL', {
        accessToken: accessTokenParam ? 'found' : 'missing',
        dmaToken: dmaTokenParam ? 'found' : 'missing',
        userId: userIdParam ? 'found' : 'missing'
      });

      // Set userId if provided
      if (userIdParam) {
        setUserId(userIdParam);
      }

      // Clear URL parameters after processing to prevent reprocessing
      const newUrl = new URL(window.location.href);
      newUrl.search = '';
      window.history.replaceState({}, '', newUrl.toString());
    }
    
    setHasProcessedUrlParams(true);
    
    // Set auth check as complete after processing
    setTimeout(() => {
      setAuthCheckComplete(true);
    }, 500);
  }, [hasProcessedUrlParams, setUserId]);

  // Return loading state while checking auth
  if (!authCheckComplete) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page if not authenticated
  if (!isBasicAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <LandingPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  }

  // Show auth flow if basic auth but not fully authenticated
  if (isBasicAuthenticated && !isFullyAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthFlow />
        </BrowserRouter>
      </QueryClientProvider>
    );
  }

  // Main authenticated app layout - FIXED LAYOUT STRUCTURE
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className={clsx(
          'app-container', // Use CSS class for proper layout
          darkMode ? 'dark bg-gray-900' : 'bg-gray-50'
        )}>
          {/* Main Layout Container - FIXED */}
          <div className="flex h-full">
            {/* Sidebar - Fixed positioning */}
            <div className="sidebar-container z-sidebar">
              <Sidebar />
            </div>

            {/* Main Content Area - FIXED */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header - Fixed positioning */}
              <div className="z-header">
                <Header />
              </div>

              {/* Content Area - FIXED */}
              <main className="main-content-area p-6">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
                  <Route path="/dma-debug" element={<DMADebugPage />} />
                </Routes>
              </main>
            </div>
          </div>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;