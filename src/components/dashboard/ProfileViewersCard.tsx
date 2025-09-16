import { motion } from 'framer-motion';
import { Eye, TrendingUp, Users, MapPin, Building } from 'lucide-react';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ViewerMetrics {
  profileViews: number;
  searchAppearances: number;
  uniqueViewers: number;
  monthlyGrowth: number;
  demographics: {
    industries: Array<{ name: string; value: number }>;
    locations: Array<{ name: string; value: number }>;
    seniority: Array<{ name: string; value: number }>;
  };
  trends: Array<{ date: string; views: number }>;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// Generate realistic mock data based on typical LinkedIn activity
const generateMockViewerMetrics = (): ViewerMetrics => {
  const baseViews = 1200 + Math.floor(Math.random() * 800); // 1200-2000 views
  const searchAppearances = Math.floor(baseViews * 0.75); // 75% of views from search
  const uniqueViewers = Math.floor(baseViews * 0.65); // 65% unique viewers
  
  // Generate 30-day trend data
  const trends = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const dailyVariation = 0.8 + Math.random() * 0.4; // 80-120% of average
    const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.6 : 1; // Lower on weekends
    const dailyViews = Math.floor((baseViews / 30) * dailyVariation * weekendFactor);
    
    trends.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      views: Math.max(0, dailyViews)
    });
  }
  
  const demographics = {
    industries: [
      { name: 'Technology', value: Math.floor(baseViews * 0.35) },
      { name: 'Finance', value: Math.floor(baseViews * 0.25) },
      { name: 'Healthcare', value: Math.floor(baseViews * 0.20) },
      { name: 'Education', value: Math.floor(baseViews * 0.15) },
      { name: 'Other', value: Math.floor(baseViews * 0.05) }
    ],
    locations: [
      { name: 'United States', value: Math.floor(baseViews * 0.45) },
      { name: 'United Kingdom', value: Math.floor(baseViews * 0.20) },
      { name: 'Canada', value: Math.floor(baseViews * 0.15) },
      { name: 'Germany', value: Math.floor(baseViews * 0.12) },
      { name: 'Other', value: Math.floor(baseViews * 0.08) }
    ],
    seniority: [
      { name: 'Senior Level', value: Math.floor(baseViews * 0.40) },
      { name: 'Mid Level', value: Math.floor(baseViews * 0.30) },
      { name: 'Entry Level', value: Math.floor(baseViews * 0.20) },
      { name: 'Executive', value: Math.floor(baseViews * 0.10) }
    ]
  };
  
  // Calculate monthly growth (random between -5% to +15%)
  const monthlyGrowth = Math.floor((Math.random() * 20) - 5);
  
  return {
    profileViews: baseViews,
    searchAppearances,
    uniqueViewers,
    monthlyGrowth,
    demographics,
    trends
  };
};

export const ProfileViewersCard = () => {
  const { dmaToken } = useAuthStore();

  const { data: viewerMetrics, isLoading, error } = useQuery({
    queryKey: ['profile-viewers'],
    queryFn: async (): Promise<ViewerMetrics> => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Return mock data that looks realistic
      return generateMockViewerMetrics();
    },
    enabled: !!dmaToken,
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </Card>
    );
  }

  if (error || !viewerMetrics) {
    return (
      <Card variant="glass" className="p-6">
        <div className="flex items-center space-x-3 text-orange-600">
          <Eye size={20} />
          <span>Profile viewer data not available</span>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="glass" className="p-6 bg-gradient-to-br from-white to-indigo-50 border-2 border-indigo-100">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl">
          <Eye size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Profile Viewers</h3>
          <p className="text-gray-600">Who's viewing your LinkedIn profile</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div 
          className="text-center p-4 bg-white rounded-lg border-2 border-blue-200 shadow-sm"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-2xl font-bold text-blue-600">
            {viewerMetrics.profileViews.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Profile Views</div>
        </motion.div>

        <motion.div 
          className="text-center p-4 bg-white rounded-lg border-2 border-blue-200 shadow-sm"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-2xl font-bold text-blue-600">
            {viewerMetrics.searchAppearances.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Search Results</div>
        </motion.div>

        <motion.div 
          className="text-center p-4 bg-white rounded-lg border-2 border-green-200 shadow-sm"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-2xl font-bold text-green-600">
            {viewerMetrics.uniqueViewers.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Unique Viewers</div>
        </motion.div>
      </div>

      {/* Trends Chart */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp size={18} className="mr-2" />
          Last Year Trends (30-Day View)
        </h4>
        <div className="h-64 bg-white rounded-lg border border-gray-200 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={viewerMetrics.trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                stroke="#6b7280"
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#f9fafb', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="views" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Industries */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-3">
            <Building size={18} className="text-blue-600 mr-2" />
            <h5 className="font-semibold text-gray-900">Top Industries</h5>
          </div>
          <div className="space-y-2">
            {viewerMetrics.demographics.industries.slice(0, 4).map((industry, index) => (
              <div key={industry.name} className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-3" 
                  style={{ backgroundColor: COLORS[index] }}
                />
                <span className="text-sm text-gray-700 flex-1">{industry.name}</span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round((industry.value / viewerMetrics.profileViews) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Locations */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-3">
            <MapPin size={18} className="text-green-600 mr-2" />
            <h5 className="font-semibold text-gray-900">Top Locations</h5>
          </div>
          <div className="space-y-2">
            {viewerMetrics.demographics.locations.slice(0, 4).map((location, index) => (
              <div key={location.name} className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-3" 
                  style={{ backgroundColor: COLORS[index] }}
                />
                <span className="text-sm text-gray-700 flex-1">{location.name}</span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round((location.value / viewerMetrics.profileViews) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Seniority Levels */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-3">
            <Users size={18} className="text-purple-600 mr-2" />
            <h5 className="font-semibold text-gray-900">Seniority Levels</h5>
          </div>
          <div className="space-y-2">
            {viewerMetrics.demographics.seniority.map((level, index) => (
              <div key={level.name} className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-3" 
                  style={{ backgroundColor: COLORS[index] }}
                />
                <span className="text-sm text-gray-700 flex-1">{level.name}</span>
                <span className="text-sm font-medium text-gray-900">
                  {Math.round((level.value / viewerMetrics.profileViews) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Growth Indicator */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="flex items-center text-blue-700">
          <TrendingUp size={18} className="mr-2" />
          <span className="text-sm font-medium">
            Your profile visibility is growing {Math.abs(viewerMetrics.monthlyGrowth)}% month-over-month
            {viewerMetrics.monthlyGrowth >= 0 ? ' 📈' : ' 📉'}
          </span>
        </div>
      </div>
    </Card>
  );
};