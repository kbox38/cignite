// src/App.tsx - Fixed OAuth token processing
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
import Synergy from './components/modules/Synergy';
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
  const { 
    isBasicAuthenticated, 
    isFullyAuthenticated, 
    accessToken, 
    dmaToken, 
    setTokens,
    setUserId 
  } = useAuthStore();
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
    
    // FIXED: Process tokens and update auth store
    if (hasAuthParams) {
      console.log('App: Processing tokens from URL', {
        accessToken: accessTokenParam ? 'found' : 'missing',
        dmaToken: dmaTokenParam ? 'found' : 'missing',
        userId: userIdParam ? 'found' : 'missing'
      });

      // CRITICAL FIX: Update tokens in auth store
      const newAccessToken = accessTokenParam || accessToken;
      const newDmaToken = dmaTokenParam || dmaToken;
      
      console.log('App: Setting tokens in store', {
        newAccessToken: newAccessToken ? 'present' : 'null',
        newDmaToken: newDmaToken ? 'present' : 'null'
      });
      
      // Update the auth store with new tokens
      setTokens(newAccessToken, newDmaToken);

      // Set userId if provided
      if (userIdParam) {
        console.log('App: Setting userId:', userIdParam);
        setUserId(userIdParam);
      }

      // Clear URL parameters after processing to prevent reprocessing
      const newUrl = new URL(window.location.href);
      newUrl.search = '';
      window.history.replaceState({}, '', newUrl.toString());
      
      console.log('App: URL parameters cleared');
    }
    
    setHasProcessedUrlParams(true);
    
    // Set auth check as complete after processing
    setTimeout(() => {
      setAuthCheckComplete(true);
    }, 500);
  }, [hasProcessedUrlParams, setTokens, setUserId, accessToken, dmaToken]);

  // FIXED: Add login trigger for posts refresh
  useEffect(() => {
    // Trigger login posts refresh when user becomes fully authenticated
    if (isFullyAuthenticated && authCheckComplete) {
      console.log('App: User fully authenticated, triggering login posts refresh');
      
      // Get userId from auth store
      const { userId } = useAuthStore.getState();
      
      if (userId && dmaToken) {
        // Call login-triggered posts refresh
        fetch('/.netlify/functions/login-posts-refresh', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dmaToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId })
        }).then(response => {
          if (response.ok) {
            console.log('App: Login posts refresh triggered successfully');
          } else {
            console.log('App: Login posts refresh failed:', response.status);
          }
        }).catch(error => {
          console.log('App: Login posts refresh error:', error.message);
        });
      }
    }
  }, [isFullyAuthenticated, authCheckComplete, dmaToken]);

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