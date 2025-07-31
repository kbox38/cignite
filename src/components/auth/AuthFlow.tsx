import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useLinkedInProfile } from '../../hooks/useLinkedInData';
import { initiateLinkedInAuth } from '../../services/linkedin';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Linkedin as LinkedIn, Shield, Users } from 'lucide-react';
import { useState } from 'react';

interface AuthFlowProps {
  isDark?: boolean;
}

export const AuthFlow = ({ isDark = false }: AuthFlowProps) => {
  const { accessToken, dmaToken, isBasicAuthenticated, isFullyAuthenticated, setTokens, setProfile } = useAuthStore();
  const { data: profile, isLoading } = useLinkedInProfile();
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);

  useEffect(() => {
    // Check for tokens in URL params (from OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const accessTokenParam = urlParams.get('access_token');
    const dmaTokenParam = urlParams.get('dma_token');
    
    console.log('AuthFlow useEffect - URL params:', {
      accessTokenParam: accessTokenParam ? 'present' : 'missing',
      dmaTokenParam: dmaTokenParam ? 'present' : 'missing',
      currentAccessToken: accessToken ? 'present' : 'missing',
      currentDmaToken: dmaToken ? 'present' : 'missing',
      isProcessingAuth
    });
    
    if (accessTokenParam && !accessToken && !isProcessingAuth) {
      console.log('AuthFlow - Processing access token');
      setIsProcessingAuth(true);
      setTokens(accessTokenParam, dmaToken);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setIsProcessingAuth(false), 500);
    }
    
    if (dmaTokenParam && !dmaToken && !isProcessingAuth) {
      console.log('AuthFlow - Processing DMA token');
      setIsProcessingAuth(true);
      setTokens(accessToken, dmaTokenParam);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setIsProcessingAuth(false), 500);
    }
  }, [setTokens, accessToken, dmaToken, isProcessingAuth]);

  useEffect(() => {
    if (profile) {
      console.log('AuthFlow - Setting profile:', profile);
      setProfile(profile);
    }
  }, [profile, setProfile]);

  // Handle authentication completion
  useEffect(() => {
    console.log('AuthFlow - Auth state check:', {
      isBasicAuthenticated,
      isFullyAuthenticated,
      isProcessingAuth,
      accessToken: accessToken ? 'present' : 'missing',
      dmaToken: dmaToken ? 'present' : 'missing'
    });
    
    if (isFullyAuthenticated && !isProcessingAuth) {
      console.log('AuthFlow - Fully authenticated, redirecting to dashboard');
      // Force a small delay to ensure state is properly set
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    }
  }, [isBasicAuthenticated, isFullyAuthenticated, isProcessingAuth, accessToken, dmaToken]);

  if (isLoading || isProcessingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">
          {isProcessingAuth ? 'Processing authentication...' : 'Loading...'}
        </p>
      </div>
    );
  }

  if (isFullyAuthenticated) {
    console.log('AuthFlow - Fully authenticated, returning null');
    return null; // Return null when authenticated, parent component will render dashboard
  }

  const handleBasicAuth = () => {
    console.log('Starting LinkedIn Basic OAuth...');
    setIsProcessingAuth(true);
    initiateLinkedInAuth('basic');
  };

  const handleDMAAuth = () => {
    console.log('Starting LinkedIn DMA OAuth...');
    setIsProcessingAuth(true);
    initiateLinkedInAuth('dma');
  };

  // Determine current step
  const currentStep = !accessToken ? 'basic' : !dmaToken ? 'dma' : 'complete';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="text-center">
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center mb-6"
          >
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center">
              <LinkedIn size={32} className="text-white" />
            </div>
          </motion.div>
          <h2 className="text-3xl font-bold mb-2 text-gray-900">
            {currentStep === 'basic' ? 'Welcome to LinkedIn Growth' : 
             currentStep === 'dma' ? 'Enable Advanced Features' : 
             'Setup Complete!'}
          </h2>
          <p className="text-gray-600">
            {currentStep === 'basic' ? 'Connect your LinkedIn account to start growing your presence' :
             currentStep === 'dma' ? 'Grant data access permissions for advanced analytics and insights' :
             'You\'re all set! Redirecting to dashboard...'}
          </p>
        </div>

        <div className="p-8 rounded-2xl border bg-white/80 border-gray-200 shadow-2xl backdrop-blur-xl">
          <div className="space-y-6">
            {/* Basic OAuth Step */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  accessToken ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  {accessToken ? '✓' : '1'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Basic Access</h3>
                  <p className="text-sm text-gray-600">Profile and basic permissions</p>
                </div>
              </div>
              {!accessToken && (
                <Button
                  onClick={handleBasicAuth}
                  className="w-full"
                  variant="primary"
                >
                  <LinkedIn size={20} className="mr-2" />
                  Connect LinkedIn Account
                </Button>
              )}
              {accessToken && !dmaToken && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">✓ Basic access granted! Now let's enable advanced features.</p>
                </div>
              )}
            </motion.div>

            {/* DMA OAuth Step */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  dmaToken ? 'bg-green-500 text-white' : 
                  accessToken ? 'bg-blue-500 text-white' : 
                  'bg-gray-300 text-gray-600'
                }`}>
                  {dmaToken ? '✓' : '2'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Data Access</h3>
                  <p className="text-sm text-gray-600">Full analytics and insights</p>
                </div>
              </div>
              {accessToken && !dmaToken && (
                <Button
                  onClick={handleDMAAuth}
                  className="w-full"
                  variant="primary"
                >
                  <Shield size={20} className="mr-2" />
                  Enable Data Access
                </Button>
              )}
              {!accessToken && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Complete basic access first</p>
                </div>
              )}
              {dmaToken && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">✓ Full access granted! Redirecting to dashboard...</p>
                </div>
              )}
            </motion.div>

            {/* Features Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="border-t pt-6"
            >
              <h4 className="font-semibold mb-3 text-gray-900">
                {currentStep === 'basic' ? 'What you\'ll get:' :
                 currentStep === 'dma' ? 'Advanced features include:' :
                 'You now have access to:'}
              </h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Users size={16} className={accessToken ? "text-green-600" : "text-blue-600"} />
                  <span className={`text-sm ${accessToken ? "text-green-700" : "text-gray-600"}`}>
                    Smart engagement insights {accessToken && "✓"}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <LinkedIn size={16} className={dmaToken ? "text-green-600" : "text-blue-600"} />
                  <span className={`text-sm ${dmaToken ? "text-green-700" : "text-gray-600"}`}>
                    Real-time analytics {dmaToken && "✓"}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield size={16} className={dmaToken ? "text-green-600" : "text-blue-600"} />
                  <span className={`text-sm ${dmaToken ? "text-green-700" : "text-gray-600"}`}>
                    Secure data access {dmaToken && "✓"}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500">
          {currentStep === 'basic' ? 'By connecting your account, you agree to our Terms of Service and Privacy Policy' :
           currentStep === 'dma' ? 'Data access permissions are used only for analytics and insights' :
           'Setup complete! Welcome to LinkedIn Growth'}
        </p>
      </motion.div>
    </div>
  );
};