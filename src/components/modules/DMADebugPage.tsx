import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertTriangle,
  User,
  Key,
  Calendar,
  Search,
  TestTube
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useAuthStore } from '../../stores/authStore';

interface DMAVerification {
  user_id: string;
  name: string;
  email: string;
  linkedin_member_urn: string;
  linkedin_dma_member_urn: string;
  dma_active: boolean;
  dma_consent_date: string;
  recommendations: string[];
}

interface TokenTestResult {
  memberAuthorizations: {
    status: number;
    success: boolean;
    hasElements: boolean;
    elementsCount: number;
    dmaUrn: string | null;
  };
  snapshotData: {
    status: number;
    success: boolean;
    hasElements: boolean;
    elementsCount: number;
  };
}

export const DMADebugPage = () => {
  const { dmaToken, accessToken, profile } = useAuthStore();
  const [verification, setVerification] = useState<DMAVerification | null>(null);
  const [tokenTest, setTokenTest] = useState<TokenTestResult | null>(null);
  const [usersList, setUsersList] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyCurrentUser = async () => {
    if (!profile?.email) {
      setError('No user email available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/.netlify/functions/debug-dma-setup?action=verify&userEmail=${encodeURIComponent(profile.email)}`, {
        headers: {
          'Authorization': `Bearer ${dmaToken || accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setVerification(data.verification);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const testCurrentToken = async () => {
    if (!dmaToken) {
      setError('No DMA token available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/.netlify/functions/debug-dma-setup?action=test-token', {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setTokenTest(data.tokenTest);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const listAllUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/.netlify/functions/debug-dma-setup?action=list', {
        headers: {
          'Authorization': `Bearer ${dmaToken || accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setUsersList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: boolean | null) => {
    if (status === true) return <CheckCircle size={20} className="text-green-600" />;
    if (status === false) return <XCircle size={20} className="text-red-600" />;
    return <AlertTriangle size={20} className="text-yellow-600" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">DMA Setup Debug</h2>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={verifyCurrentUser} disabled={isLoading}>
            <User size={16} className="mr-2" />
            Verify My Setup
          </Button>
          <Button variant="outline" onClick={testCurrentToken} disabled={isLoading}>
            <TestTube size={16} className="mr-2" />
            Test Token
          </Button>
          <Button variant="outline" onClick={listAllUsers} disabled={isLoading}>
            <Search size={16} className="mr-2" />
            List All Users
          </Button>
        </div>
      </div>

      {/* Current User Status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <User size={20} className="mr-2" />
          Current User Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Basic Access Token</span>
              {getStatusIcon(!!accessToken)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">DMA Access Token</span>
              {getStatusIcon(!!dmaToken)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Profile Data</span>
              {getStatusIcon(!!profile)}
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="font-medium">Email:</span> {profile?.email || 'Not available'}
            </div>
            <div className="text-sm">
              <span className="font-medium">Name:</span> {profile?.name || 'Not available'}
            </div>
            <div className="text-sm">
              <span className="font-medium">LinkedIn ID:</span> {profile?.sub || 'Not available'}
            </div>
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center space-x-2">
            <XCircle size={20} className="text-red-600" />
            <span className="text-red-800 font-medium">Error: {error}</span>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card className="p-6">
          <div className="flex items-center justify-center">
            <LoadingSpinner size="lg" />
            <span className="ml-4 text-gray-600">Processing...</span>
          </div>
        </Card>
      )}

      {/* Verification Results */}
      {verification && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Database size={20} className="mr-2" />
            Database Verification Results
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">User Information</h4>
              <div className="space-y-2 text-sm">
                <div><strong>User ID:</strong> {verification.user_id}</div>
                <div><strong>Name:</strong> {verification.name}</div>
                <div><strong>Email:</strong> {verification.email}</div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">LinkedIn Integration</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Basic LinkedIn URN</span>
                  {getStatusIcon(!!verification.linkedin_member_urn)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">DMA LinkedIn URN</span>
                  {getStatusIcon(!!verification.linkedin_dma_member_urn)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">DMA Active</span>
                  {getStatusIcon(verification.dma_active)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">DMA Consent Date</span>
                  {getStatusIcon(!!verification.dma_consent_date)}
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {verification.recommendations && verification.recommendations.length > 0 && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {verification.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-yellow-800 flex items-start">
                    <span className="mr-2">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw Data */}
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-2">Raw Database Data</h4>
            <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
              {JSON.stringify(verification, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {/* Token Test Results */}
      {tokenTest && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Key size={20} className="mr-2" />
            Token Test Results
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Member Authorizations API</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Status</span>
                  <span className={`text-sm font-medium ${
                    tokenTest.memberAuthorizations.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {tokenTest.memberAuthorizations.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Has Elements</span>
                  {getStatusIcon(tokenTest.memberAuthorizations.hasElements)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Elements Count</span>
                  <span className="text-sm font-medium">{tokenTest.memberAuthorizations.elementsCount}</span>
                </div>
                {tokenTest.memberAuthorizations.dmaUrn && (
                  <div className="mt-2 p-2 bg-green-50 rounded">
                    <div className="text-xs font-medium text-green-800">DMA URN Found:</div>
                    <div className="text-xs text-green-700 font-mono">{tokenTest.memberAuthorizations.dmaUrn}</div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Snapshot Data API</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Status</span>
                  <span className={`text-sm font-medium ${
                    tokenTest.snapshotData.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {tokenTest.snapshotData.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Has Elements</span>
                  {getStatusIcon(tokenTest.snapshotData.hasElements)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Elements Count</span>
                  <span className="text-sm font-medium">{tokenTest.snapshotData.elementsCount}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Users List */}
      {usersList && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Search size={20} className="mr-2" />
            All Users DMA Status
          </h3>
          
          <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{usersList.totalUsers}</div>
              <div className="text-sm text-blue-800">Total Users</div>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{usersList.usersWithDmaIssues}</div>
              <div className="text-sm text-red-800">With DMA Issues</div>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{usersList.summary.missingDmaUrn}</div>
              <div className="text-sm text-yellow-800">Missing DMA URN</div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{usersList.summary.dmaInactive}</div>
              <div className="text-sm text-orange-800">DMA Inactive</div>
            </div>
          </div>

          {usersList.usersWithIssues.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <h4 className="font-medium text-gray-900">Users with DMA Issues</h4>
              {usersList.usersWithIssues.map((user: any) => (
                <div key={user.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Created: {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="flex items-center space-x-1">
                      <span>Basic URN:</span>
                      {getStatusIcon(!!user.linkedin_member_urn)}
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>DMA URN:</span>
                      {getStatusIcon(!!user.linkedin_dma_member_urn)}
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>DMA Active:</span>
                      {getStatusIcon(user.dma_active)}
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>Consent Date:</span>
                      {getStatusIcon(!!user.dma_consent_date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold mb-4 text-blue-900">Troubleshooting Steps</h3>
        <div className="space-y-3 text-sm text-blue-800">
          <div className="flex items-start space-x-2">
            <span className="font-bold">1.</span>
            <span>Click "Verify My Setup" to check your current database status</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-bold">2.</span>
            <span>Click "Test Token" to verify your DMA token can access LinkedIn APIs</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-bold">3.</span>
            <span>If DMA URN is missing, try logging out and completing the DMA OAuth flow again</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-bold">4.</span>
            <span>If DMA is inactive, ensure you granted data portability permissions during OAuth</span>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/.netlify/functions/linkedin-oauth-start?type=dma'}
            className="flex flex-col items-center p-4 h-auto"
          >
            <RefreshCw size={24} className="mb-2" />
            <span className="text-sm">Retry DMA OAuth</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={() => {
              localStorage.clear();
              window.location.href = '/';
            }}
            className="flex flex-col items-center p-4 h-auto"
          >
            <Database size={24} className="mb-2" />
            <span className="text-sm">Clear & Restart</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={() => window.location.href = '/settings'}
            className="flex flex-col items-center p-4 h-auto"
          >
            <User size={24} className="mb-2" />
            <span className="text-sm">Go to Settings</span>
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};