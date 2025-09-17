// src/components/auth/AuthFlow.tsx - Restored two-step authentication
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Card } from '../ui/Card';

interface AuthStep {
  id: 'basic' | 'dma';
  title: string;
  description: string;
  permissions: string[];
  completed: boolean;
}

export const AuthFlow = () => {
  const { 
    isBasicAuthenticated, 
    isFullyAuthenticated, 
    accessToken, 
    dmaToken,
    clearTokens 
  } = useAuthStore();
  
  const [currentStep, setCurrentStep] = useState<'basic' | 'dma'>('basic');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Define auth steps
  const steps: AuthStep[] = [
    {
      id: 'basic',
      title: 'LinkedIn Basic Access',
      description: 'Connect your LinkedIn profile to access basic features',
      permissions: [
        'Profile information',
        'Email address',
        'Basic profile data',
        'Basic posting capabilities'
      ],
      completed: isBasicAuthenticated
    },
    {
      id: 'dma',
      title: 'Advanced Analytics (DMA)',
      description: 'Unlock detailed analytics and insights about your LinkedIn performance',
      permissions: [
        'Historical post data',
        'Post engagement data',
        'Connection analytics',
        'Advanced insights'
      ],
      completed: !!dmaToken
    }
  ];

  // Auto-progress to DMA step if basic is complete
  useEffect(() => {
    if (isBasicAuthenticated && !dmaToken && currentStep === 'basic') {
      setCurrentStep('dma');
    }
  }, [isBasicAuthenticated, dmaToken, currentStep]);

  // Auto-redirect when fully authenticated
  useEffect(() => {
    if (isFullyAuthenticated) {
      console.log('AuthFlow: Fully authenticated, redirecting to dashboard');
      // The App.tsx component handles the redirect
    }
  }, [isFullyAuthenticated]);

  const handleOAuthStart = (type: 'basic' | 'dma') => {
    setIsAuthenticating(true);
    setError(null);
    
    try {
      console.log(`AuthFlow: Starting ${type} OAuth flow`);
      
      // Direct navigation to OAuth start endpoint (avoids CORS issues)
      window.location.href = `/.netlify/functions/linkedin-oauth-start?type=${type}`;
      
    } catch (err) {
      console.error(`AuthFlow: ${type} OAuth start failed:`, err);
      setError(err instanceof Error ? err.message : `Failed to start ${type} authentication`);
      setIsAuthenticating(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setIsAuthenticating(false);
  };

  const handleStartOver = () => {
    clearTokens();
    setCurrentStep('basic');
    setError(null);
    setIsAuthenticating(false);
  };

  const renderStepCard = (step: AuthStep, isActive: boolean) => (
    <Card key={step.id} className={`p-6 transition-all duration-300 ${
      isActive ? 'ring-2 ring-blue-500 bg-blue-50' : 
      step.completed ? 'bg-green-50 border-green-200' : 'bg-white'
    }`}>
      <div className="flex items-start space-x-4">
        {/* Step indicator */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          step.completed ? 'bg-green-500 text-white' :
          isActive ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
        }`}>
          {step.completed ? '✓' : step.id === 'basic' ? '1' : '2'}
        </div>

        <div className="flex-1">
          <h3 className={`text-lg font-semibold mb-2 ${
            step.completed ? 'text-green-800' : 
            isActive ? 'text-blue-800' : 'text-gray-800'
          }`}>
            {step.title}
          </h3>
          
          <p className="text-gray-600 mb-4">{step.description}</p>
          
          {/* Permissions list */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">This grants access to:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {step.permissions.map((permission, index) => (
                <li key={index} className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                  {permission}
                </li>
              ))}
            </ul>
          </div>

          {/* Action button */}
          {step.completed ? (
            <div className="flex items-center text-green-600">
              <span className="text-sm font-medium">✓ Connected successfully</span>
            </div>
          ) : isActive ? (
            <div className="space-y-3">
              <Button
                onClick={() => handleOAuthStart(step.id)}
                disabled={isAuthenticating}
                className="w-full"
              >
                {isAuthenticating ? (
                  <>
                    <LoadingSpinner className="w-4 h-4 mr-2" />
                    Connecting...
                  </>
                ) : (
                  `Connect ${step.title}`
                )}
              </Button>
              
              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <p className="font-medium mb-1">Connection failed</p>
                  <p>{error}</p>
                  <button
                    onClick={handleRetry}
                    className="mt-2 text-red-700 underline hover:no-underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              Complete previous step first
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl"></div>
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Connect Your LinkedIn Account
          </h1>
          <p className="text-lg text-gray-600">
            We need to connect to LinkedIn in two steps to provide you with comprehensive analytics and insights.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Setup Progress</span>
            <span className="text-sm text-gray-500">
              {steps.filter(s => s.completed).length} of {steps.length} complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ 
                width: `${(steps.filter(s => s.completed).length / steps.length) * 100}%` 
              }}
            />
          </div>
        </div>

        {/* Auth steps */}
        <div className="space-y-6 mb-8">
          {steps.map(step => renderStepCard(step, step.id === currentStep))}
        </div>

        {/* Footer actions */}
        <div className="text-center space-y-4 pb-8">
          {(isBasicAuthenticated || dmaToken) && (
            <button
              onClick={handleStartOver}
              className="text-gray-500 hover:text-gray-700 text-sm underline"
            >
              Start over with different account
            </button>
          )}
          
          <div className="text-xs text-gray-500">
            <p>
              By connecting your LinkedIn account, you agree to our{' '}
              <a href="#" className="underline hover:no-underline">Terms of Service</a>{' '}
              and{' '}
              <a href="#" className="underline hover:no-underline">Privacy Policy</a>.
            </p>
          </div>
        </div>

        {/* Debug info (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg text-xs font-mono">
            <p className="font-bold mb-2">Debug Info:</p>
            <p>Basic Auth: {isBasicAuthenticated ? '✓' : '✗'}</p>
            <p>DMA Token: {dmaToken ? '✓' : '✗'}</p>
            <p>Fully Auth: {isFullyAuthenticated ? '✓' : '✗'}</p>
            <p>Current Step: {currentStep}</p>
            <p>Access Token: {accessToken ? `${accessToken.substring(0, 20)}...` : 'None'}</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};