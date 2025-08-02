import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Zap, Clock, Users, Eye, BarChart3, Target, Award, RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useAuthStore } from '../../stores/authStore';

export const TheAlgo = () => {
  const { dmaToken } = useAuthStore();
  const [algoData, setAlgoData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlgorithmAnalysis = async () => {
    if (!dmaToken) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/.netlify/functions/algo-analysis', {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch algorithm analysis');
      }

      const data = await response.json();
      setAlgoData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlgorithmAnalysis();
  }, [dmaToken]);

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-yellow-600 bg-yellow-100';
    if (score >= 4) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-600 bg-green-100';
    if (grade.startsWith('B')) return 'text-blue-600 bg-blue-100';
    if (grade.startsWith('C')) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  if (!dmaToken) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="text-center py-12">
          <BarChart3 size={48} className="mx-auto text-orange-400 mb-4" />
          <h2 className="text-2xl font-bold mb-4">Algorithm Analysis Unavailable</h2>
          <p className="text-gray-600 mb-6">
            Algorithm insights require LinkedIn data access permissions.
          </p>
          <Button
            variant="primary"
            onClick={() => (window.location.href = "/")}
          >
            Enable Data Access
          </Button>
        </div>
      </motion.div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
        <p className="ml-4 text-gray-600">Analyzing algorithm performance...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <BarChart3 size={48} className="mx-auto text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Error Loading Algorithm Analysis
        </h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button variant="primary" onClick={fetchAlgorithmAnalysis}>
          <RefreshCw size={16} className="mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (!algoData) {
    return (
      <div className="text-center py-12">
        <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          No Algorithm Data Available
        </h2>
        <p className="text-gray-600 mb-4">
          Start posting on LinkedIn to see algorithm performance insights.
        </p>
        <Button variant="primary" onClick={() => window.open('https://linkedin.com', '_blank')}>
          Post on LinkedIn
        </Button>
      </div>
    );
  }

  const { metrics, aiAnalysis, recommendations, insights } = algoData;


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">The Algo</h2>
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            onClick={fetchAlgorithmAnalysis}
            disabled={isLoading}
          >
            <Zap size={16} className="mr-2" />
            {isLoading ? 'Analyzing...' : 'Refresh Analysis'}
          </Button>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Clock size={16} />
            <span>Last updated: {algoData?.lastUpdated ? new Date(algoData.lastUpdated).toLocaleTimeString() : 'Never'}</span>
          </div>
        </div>
      </div>

      {/* AI Analysis Section */}
      {aiAnalysis && (
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Zap className="mr-2 text-purple-500" size={20} />
            AI Algorithm Analysis
          </h3>
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-line text-gray-700 dark:text-gray-300">
              {aiAnalysis}
            </div>
          </div>
        </Card>
      )}

      {/* Algorithm Status */}
      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Algorithm Performance</h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-600">Active</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-3xl font-bold px-4 py-2 rounded-lg ${getGradeColor(metrics?.algorithmGrade || 'C')}`}>
              {metrics?.algorithmGrade || 'C'}
            </div>
            <div className="text-sm text-gray-500 mt-2">Algorithm Grade</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{metrics?.postFrequency?.postsPerWeek || 0}</div>
            <div className="text-sm text-gray-500">Posts/Week</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{metrics?.engagementRate?.rate || 0}</div>
            <div className="text-sm text-gray-500">Avg Engagement</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{metrics?.reachScore?.estimatedReach || 0}</div>
            <div className="text-sm text-gray-500">Est. Reach</div>
          </div>
        </div>
      </Card>

      {/* Real-time Insights */}
      {metrics && (
        <div className="space-y-4">
          {[
            { key: 'postFrequency', label: 'Posting Frequency', icon: Clock, data: metrics.postFrequency },
            { key: 'engagementRate', label: 'Engagement Rate', icon: Heart, data: metrics.engagementRate },
            { key: 'reachScore', label: 'Reach Score', icon: Eye, data: metrics.reachScore },
            { key: 'contentMixScore', label: 'Content Diversity', icon: BarChart3, data: metrics.contentMixScore },
            { key: 'consistencyScore', label: 'Posting Consistency', icon: Target, data: metrics.consistencyScore }
          ].map((metric, index) => (
            <motion.div
              key={metric.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card variant="glass" className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500">
                      <metric.icon size={24} className="text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{metric.label}</h4>
                      <p className="text-sm text-gray-600">{metric.data?.recommendation || 'No recommendation available'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${getScoreColor(metric.data?.score || 0)}`}>
                      {metric.data?.score || 0}/10
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {metric.key === 'postFrequency' && `${metric.data?.postsPerWeek || 0}/week`}
                      {metric.key === 'engagementRate' && `${metric.data?.rate || 0} avg`}
                      {metric.key === 'reachScore' && `${metric.data?.estimatedReach || 0} reach`}
                      {metric.key === 'contentMixScore' && `${metric.data?.diversity || 0} formats`}
                      {metric.key === 'consistencyScore' && `${metric.data?.consistency || 0}% consistent`}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Optimization Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Target className="mr-2 text-orange-500" size={20} />
            Optimization Recommendations
          </h3>
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div key={index} className={`p-4 rounded-lg border-l-4 ${
                rec.priority === 'high' ? 'border-red-500 bg-red-50' :
                rec.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{rec.category}</h4>
                    <p className="text-sm text-gray-700 mt-1">{rec.action}</p>
                    <p className="text-xs text-gray-600 mt-2">Impact: {rec.impact}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                    rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {rec.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Performance Insights */}
      {insights && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Best Posting Times */}
          <Card variant="glass" className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Clock className="mr-2 text-blue-500" size={20} />
              Best Posting Times
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Best Hours</h4>
                <div className="space-y-2">
                  {insights.bestPostingTimes?.bestHours?.map((hour, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                      <span className="font-medium">{hour.hour}:00</span>
                      <span className="text-sm text-gray-600">{hour.count} posts</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Best Days</h4>
                <div className="space-y-2">
                  {insights.bestPostingTimes?.bestDays?.map((day, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                      <span className="font-medium">{day.day}</span>
                      <span className="text-sm text-gray-600">{day.count} posts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Top Performing Formats */}
          <Card variant="glass" className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Award className="mr-2 text-purple-500" size={20} />
              Top Performing Formats
            </h3>
            <div className="space-y-3">
              {insights.topPerformingFormats?.map((format, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900">{format.format}</span>
                    <div className="text-sm text-gray-600">{format.postCount} posts</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-purple-600">{format.avgEngagement}</div>
                    <div className="text-xs text-gray-500">avg engagement</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Algorithm Tips */}
      <Card variant="glass" className="p-6">
        <h3 className="text-lg font-semibold mb-4">LinkedIn Algorithm Best Practices</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              1
            </div>
            <div>
              <p className="font-medium">Engage Within 15 Minutes</p>
              <p className="text-sm text-gray-600">Reply to comments within 15 minutes of posting for maximum algorithm boost</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              2
            </div>
            <div>
              <p className="font-medium">Pre-Engage Strategy</p>
              <p className="text-sm text-gray-600">Comment on 3-5 posts in your network 15-30 minutes before posting your content</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              3
            </div>
            <div>
              <p className="font-medium">Native Content Only</p>
              <p className="text-sm text-gray-600">Upload media directly to LinkedIn. Put external links in the first comment, not the post</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              4
            </div>
            <div>
              <p className="font-medium">Focus on Dwell Time</p>
              <p className="text-sm text-gray-600">Create content that keeps readers engaged for longer periods (mini-articles work best)</p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};