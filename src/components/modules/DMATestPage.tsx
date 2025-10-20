import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Eye, 
  Users, 
  FileText,
  Activity,
  AlertCircle,
  Search,
  Heart,
  MessageCircle,
  Share,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useAuthStore } from '../../stores/authStore';
import { LinkedInDataService, debugLinkedInData } from '../../services/linkedin-data-service';

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'loading' | 'pending';
  data?: any;
  error?: string;
  count?: number;
  metrics?: any;
}

export const DMATestPage = () => {
  const { accessToken, dmaToken } = useAuthStore();
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Profile Data', status: 'pending' },
    { name: 'Profile Views & Search Appearances', status: 'pending' },
    { name: 'Member Changelog', status: 'pending' },
    { name: 'Member Snapshot - Profile', status: 'pending' },
    { name: 'Member Snapshot - Connections', status: 'pending' },
    { name: 'Member Snapshot - Posts', status: 'pending' },
    { name: 'UGC Posts', status: 'pending' },
    { name: 'Social Actions - Likes', status: 'pending' },
    { name: 'Social Actions - Comments', status: 'pending' },
    { name: 'Engagement Calculation', status: 'pending' },
    { name: 'Activity Metrics', status: 'pending' },
    { name: 'All Available Domains', status: 'pending' }
  ]);

  const [selectedTest, setSelectedTest] = useState<TestResult | null>(null);
  const [debugOutput, setDebugOutput] = useState<string>('');

  const updateTest = (name: string, updates: Partial<TestResult>) => {
    setTests(prev => prev.map(test => 
      test.name === name ? { ...test, ...updates } : test
    ));
  };

  const testProfileData = async () => {
    if (!accessToken) {
      updateTest('Profile Data', { status: 'error', error: 'No access token available' });
      return;
    }

    updateTest('Profile Data', { status: 'loading' });
    
    try {
      const response = await fetch('/.netlify/functions/linkedin-profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202312'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      updateTest('Profile Data', { 
        status: 'success', 
        data,
        count: 1
      });
    } catch (error) {
      updateTest('Profile Data', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const testProfileViews = async () => {
    if (!dmaToken) {
      updateTest('Profile Views & Search Appearances', { status: 'error', error: 'No DMA token available' });
      return;
    }

    updateTest('Profile Views & Search Appearances', { status: 'loading' });
    
    try {
      const service = new LinkedInDataService();
      const metrics = await service.fetchProfileViews(dmaToken);
      
      updateTest('Profile Views & Search Appearances', { 
        status: 'success', 
        data: metrics,
        metrics,
        count: Object.values(metrics).reduce((sum: number, val) => sum + (typeof val === 'number' ? val : 0), 0)
      });
    } catch (error) {
      updateTest('Profile Views & Search Appearances', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const testEngagementCalculation = async () => {
    if (!dmaToken) {
      updateTest('Engagement Calculation', { status: 'error', error: 'No DMA token available' });
      return;
    }

    updateTest('Engagement Calculation', { status: 'loading' });
    
    try {
      // Test the dashboard data endpoint directly
      const response = await fetch('/.netlify/functions/dashboard-data', {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const metrics = {
        overallScore: data.profileEvaluation?.overallScore || 0,
        totalConnections: data.summaryKPIs?.totalConnections || 0,
        posts30d: data.summaryKPIs?.postsLast30Days || 0,
        engagementRate: data.summaryKPIs?.engagementRate || '0%'
      };
      
      updateTest('Engagement Calculation', { 
        status: 'success', 
        data: data,
        metrics,
        count: metrics.totalConnections
      });
    } catch (error) {
      updateTest('Engagement Calculation', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const testActivityMetrics = async () => {
    if (!dmaToken) {
      updateTest('Activity Metrics', { status: 'error', error: 'No DMA token available' });
      return;
    }

    updateTest('Activity Metrics', { status: 'loading' });
    
    try {
      // Test the analytics data endpoint directly
      const response = await fetch('/.netlify/functions/analytics-data?timeRange=30d', {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const metrics = {
        postsCount: data.postsEngagementsTrend?.length || 0,
        connectionsCount: data.connectionsGrowth?.length || 0,
        postTypesCount: data.postTypesBreakdown?.length || 0,
        hashtagsCount: data.topHashtags?.length || 0
      };
      
      updateTest('Activity Metrics', { 
        status: 'success', 
        data: data,
        metrics,
        count: metrics.postsCount + metrics.connectionsCount
      });
    } catch (error) {
      updateTest('Activity Metrics', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const testChangelog = async () => {
    if (!dmaToken) {
      updateTest('Member Changelog', { status: 'error', error: 'No DMA token available' });
      return;
    }

    updateTest('Member Changelog', { status: 'loading' });
    
    try {
      const response = await fetch('/.netlify/functions/linkedin-changelog?count=50', {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'LinkedIn-Version': '202312'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Analyze the data
      const metrics = {
        totalEvents: data.elements?.length || 0,
        eventTypes: {} as Record<string, number>,
        methods: {} as Record<string, number>,
        recentActivity: data.elements?.slice(0, 5) || []
      };
      
      data.elements?.forEach((event: any) => {
        metrics.eventTypes[event.resourceName] = (metrics.eventTypes[event.resourceName] || 0) + 1;
        metrics.methods[event.method] = (metrics.methods[event.method] || 0) + 1;
      });
      
      updateTest('Member Changelog', { 
        status: 'success', 
        data,
        metrics,
        count: data.elements?.length || 0
      });
    } catch (error) {
      updateTest('Member Changelog', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const testSnapshot = async (domain: string, testName: string) => {
    if (!dmaToken) {
      updateTest(testName, { status: 'error', error: 'No DMA token available' });
      return;
    }

    updateTest(testName, { status: 'loading' });
    
    try {
      const url = domain 
        ? `/.netlify/functions/linkedin-snapshot?domain=${domain}`
        : '/.netlify/functions/linkedin-snapshot';
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'LinkedIn-Version': '202312'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const count = data.elements?.reduce((acc: number, el: any) => 
        acc + (el.snapshotData?.length || 0), 0) || 0;
      
      // Extract sample data and keys
      const sampleData = data.elements?.[0]?.snapshotData?.[0];
      const availableKeys = sampleData ? Object.keys(sampleData) : [];
        
      updateTest(testName, { 
        status: 'success', 
        data,
        metrics: {
          count,
          sampleData,
          availableKeys,
          domains: data.elements?.map((el: any) => el.snapshotDomain) || []
        },
        count
      });
    } catch (error) {
      updateTest(testName, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const testSpecificResource = async (resourceName: string, testName: string) => {
    if (!dmaToken) {
      updateTest(testName, { status: 'error', error: 'No DMA token available' });
      return;
    }

    updateTest(testName, { status: 'loading' });
    
    try {
      const response = await fetch('/.netlify/functions/linkedin-changelog?count=50', {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'LinkedIn-Version': '202312'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const filteredData = {
        ...data,
        elements: data.elements?.filter((el: any) => el.resourceName === resourceName) || []
      };
      
      updateTest(testName, { 
        status: 'success', 
        data: filteredData,
        count: filteredData.elements.length,
        metrics: {
          resourceName,
          count: filteredData.elements.length,
          sampleEvent: filteredData.elements[0] || null
        }
      });
    } catch (error) {
      updateTest(testName, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const testAllDomains = async () => {
    if (!dmaToken) {
      updateTest('All Available Domains', { status: 'error', error: 'No DMA token available' });
      return;
    }

    updateTest('All Available Domains', { status: 'loading' });
    
    try {
      const domains = [
        'PROFILE', 'CONNECTIONS', 'MEMBER_SHARE_INFO', 'SKILLS', 
        'POSITIONS', 'EDUCATION', 'ALL_COMMENTS', 'ALL_LIKES',
        'RECOMMENDATIONS', 'ENDORSEMENTS', 'CERTIFICATIONS',
        'COURSES', 'HONORS', 'LANGUAGES', 'PATENTS', 'PROJECTS',
        'PUBLICATIONS', 'TEST_SCORES', 'VOLUNTEER_EXPERIENCES'
      ];
      
      const results: Record<string, any> = {};
      
      for (const domain of domains) {
        try {
          const response = await fetch(`/.netlify/functions/linkedin-snapshot?domain=${domain}`, {
            headers: { 'Authorization': `Bearer ${dmaToken}` }
          });
          const data = await response.json();
          
          results[domain] = {
            available: true,
            count: data.elements?.[0]?.snapshotData?.length || 0,
            sample: data.elements?.[0]?.snapshotData?.[0] || null,
            keys: data.elements?.[0]?.snapshotData?.[0] ? Object.keys(data.elements[0].snapshotData[0]) : []
          };
        } catch (error) {
          results[domain] = {
            available: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      updateTest('All Available Domains', { 
        status: 'success', 
        data: results,
        metrics: results,
        count: Object.values(results).filter((r: any) => r.available).length
      });
    } catch (error) {
      updateTest('All Available Domains', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const runDebugAnalysis = async () => {
    if (!dmaToken) {
      setDebugOutput('No DMA token available for debugging');
      return;
    }
    
    setDebugOutput('Running comprehensive LinkedIn data analysis...\n');
    
    // Capture console.log output
    const originalLog = console.log;
    let output = '';
    console.log = (...args) => {
      output += args.join(' ') + '\n';
      originalLog(...args);
    };
    
    try {
      await debugLinkedInData(dmaToken);
      setDebugOutput(output);
    } catch (error) {
      setDebugOutput(output + '\nError: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      console.log = originalLog;
    }
  };

  const runAllTests = async () => {
    await testProfileData();
    await testProfileViews();
    await testChangelog();
    await testSnapshot('PROFILE', 'Member Snapshot - Profile');
    await testSnapshot('CONNECTIONS', 'Member Snapshot - Connections');
    await testSnapshot('MEMBER_SHARE_INFO', 'Member Snapshot - Posts');
    await testSpecificResource('ugcPosts', 'UGC Posts');
    await testSpecificResource('socialActions/likes', 'Social Actions - Likes');
    await testSpecificResource('socialActions/comments', 'Social Actions - Comments');
    await testEngagementCalculation();
    await testActivityMetrics();
    await testAllDomains();
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'error':
        return <XCircle size={20} className="text-red-600" />;
      case 'loading':
        return <LoadingSpinner size="sm" />;
      default:
        return <AlertCircle size={20} className="text-gray-400" />;
    }
  };

  const getTestIcon = (testName: string) => {
    if (testName.includes('Profile Data')) return <Users size={16} />;
    if (testName.includes('Profile Views')) return <Eye size={16} />;
    if (testName.includes('Search')) return <Search size={16} />;
    if (testName.includes('Engagement')) return <Heart size={16} />;
    if (testName.includes('Activity')) return <Activity size={16} />;
    if (testName.includes('Posts')) return <FileText size={16} />;
    if (testName.includes('Likes')) return <Heart size={16} />;
    if (testName.includes('Comments')) return <MessageCircle size={16} />;
    if (testName.includes('Connections')) return <Users size={16} />;
    if (testName.includes('Changelog')) return <TrendingUp size={16} />;
    return <Database size={16} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">LinkedIn DMA Comprehensive Test</h2>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={runDebugAnalysis}>
            <BarChart3 size={16} className="mr-2" />
            Debug Analysis
          </Button>
          <Button variant="primary" onClick={runAllTests}>
            <RefreshCw size={16} className="mr-2" />
            Run All Tests
          </Button>
        </div>
      </div>

      {/* Token Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            {accessToken ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <XCircle size={20} className="text-red-600" />
            )}
            <div>
              <h3 className="font-semibold text-gray-900">Basic Access Token</h3>
              <p className="text-sm text-gray-600">
                {accessToken ? 'Available' : 'Not available'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            {dmaToken ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <XCircle size={20} className="text-red-600" />
            )}
            <div>
              <h3 className="font-semibold text-gray-900">DMA Access Token</h3>
              <p className="text-sm text-gray-600">
                {dmaToken ? 'Available' : 'Not available'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Test Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">API Tests</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {tests.map((test, index) => (
              <motion.div
                key={test.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setSelectedTest(test)}
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(test.status)}
                  {getTestIcon(test.name)}
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{test.name}</p>
                    {test.count !== undefined && (
                      <p className="text-xs text-gray-600">{test.count} items</p>
                    )}
                  </div>
                </div>
                <Eye size={16} className="text-gray-400" />
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Test Details */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Test Details</h3>
          {selectedTest ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                {getStatusIcon(selectedTest.status)}
                <h4 className="font-semibold text-gray-900">{selectedTest.name}</h4>
              </div>
              
              {selectedTest.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{selectedTest.error}</p>
                </div>
              )}
              
              {selectedTest.metrics && (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      Success! Retrieved {selectedTest.count || 0} items
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-medium mb-2">Processed Metrics:</h5>
                    <div className="max-h-32 overflow-y-auto">
                      <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
                        {JSON.stringify(selectedTest.metrics, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
              
              {selectedTest.data && (
                <div>
                  <h5 className="font-medium mb-2">Raw Data:</h5>
                  <div className="max-h-64 overflow-y-auto">
                    <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
                      {JSON.stringify(selectedTest.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600">Select a test to view details</p>
          )}
        </Card>
      </div>

      {/* Debug Output */}
      {debugOutput && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Debug Analysis Output</h3>
          <div className="max-h-96 overflow-y-auto">
            <pre className="text-xs bg-gray-100 p-4 rounded-lg whitespace-pre-wrap">
              {debugOutput}
            </pre>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            variant="outline"
            onClick={() => testProfileViews()}
            className="flex flex-col items-center p-4 h-auto"
          >
            <Eye size={24} className="mb-2" />
            <span className="text-sm">Profile Views</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={() => testEngagementCalculation()}
            className="flex flex-col items-center p-4 h-auto"
          >
            <Heart size={24} className="mb-2" />
            <span className="text-sm">Engagement</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={() => testSnapshot('CONNECTIONS', 'Member Snapshot - Connections')}
            className="flex flex-col items-center p-4 h-auto"
          >
            <Users size={24} className="mb-2" />
            <span className="text-sm">Connections</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={() => testSnapshot('MEMBER_SHARE_INFO', 'Member Snapshot - Posts')}
            className="flex flex-col items-center p-4 h-auto"
          >
            <FileText size={24} className="mb-2" />
            <span className="text-sm">Posts</span>
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};