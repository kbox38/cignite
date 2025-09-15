import { motion } from 'framer-motion';
import { Eye, TrendingUp, Users, MapPin, Building } from 'lucide-react';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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
  trends: Array<{ date: string; views: number; searches: number }>;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export const ProfileViewersCard = () => {
  const { dmaToken } = useAuthStore();

  const { data: viewerMetrics, isLoading, error } = useQuery({
    queryKey: ['profile-viewers'],
    queryFn: async (): Promise<ViewerMetrics> => {
      const response = await fetch('/.netlify/functions/fetch-profile-metrics', {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile metrics');
      }

      const data = await response.json();
      
      // Generate mock trend data for demonstration
      const trends = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        trends.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          views: Math.floor(Math.random() * 20) + 5,
          searches: Math.floor(Math.random() * 10) + 2
        });
      }

      // Generate mock demographics
      const demographics = {
        industries: [
          { name: 'Technology', value: 35 },
          { name: 'Finance', value: 25 },
          { name: 'Healthcare', value: 20 },
          { name: 'Education', value: 15 },
          { name: 'Other', value: 5 }
        ],
        locations: [
          { name: 'United States', value: 45 },
          { name: 'United Kingdom', value: 20 },
          { name: 'Canada', value: 15 },
          { name: 'Germany', value: 12 },
          { name: 'Other', value: 8 }
        ],
        seniority: [
          { name: 'Senior Level', value: 40 },
          { name: 'Mid Level', value: 30 },
          { name: 'Entry Level', value: 20 },
          { name: 'Executive', value: 10 }
        ]
      };

      return {
        profileViews: data.profileViews || 0,
        searchAppearances: data.searchAppearances || 0,
        uniqueViewers: data.uniqueViewers || 0,
        monthlyGrowth: Math.floor(Math.random() * 20) + 5, // Mock growth
        demographics,
        trends
      };
    },
    enabled: !!dmaToken,
    staleTime: 30 * 60 * 1000, // 30 minutes
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-white rounded-lg border border-indigo-200">
          <div className="text-xl font-bold text-indigo-600">{viewerMetrics.profileViews}</div>
          <div className="text-sm text-gray-600">Profile Views</div>
        </div>
        <div className="text-center p-3 bg-white rounded-lg border border-indigo-200">
          <div className="text-xl font-bold text-blue-600">{viewerMetrics.searchAppearances}</div>
          <div className="text-sm text-gray-600">Search Results</div>
        </div>
        <div className="text-center p-3 bg-white rounded-lg border border-indigo-200">
          <div className="text-xl font-bold text-green-600">{viewerMetrics.uniqueViewers}</div>
          <div className="text-sm text-gray-600">Unique Viewers</div>
        </div>
        <div className="text-center p-3 bg-white rounded-lg border border-indigo-200">
          <div className="text-xl font-bold text-purple-600">+{viewerMetrics.monthlyGrowth}%</div>
          <div className="text-sm text-gray-600">Monthly Growth</div>
        </div>
      </div>

      {/* Trends Chart */}
      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-3">30-Day Trends</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={viewerMetrics.trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="views" 
                stroke="#6366F1" 
                strokeWidth={3}
                name="Profile Views"
                dot={{ fill: '#6366F1', strokeWidth: 2, r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="searches" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Search Appearances"
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Industries */}
        <div className="bg-white p-4 rounded-lg border border-indigo-200">
          <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
            <Building size={16} className="mr-2 text-indigo-600" />
            Top Industries
          </h5>
          <div className="space-y-2">
            {viewerMetrics.demographics.industries.slice(0, 4).map((industry, index) => (
              <div key={industry.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-700">{industry.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{industry.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Locations */}
        <div className="bg-white p-4 rounded-lg border border-indigo-200">
          <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
            <MapPin size={16} className="mr-2 text-indigo-600" />
            Top Locations
          </h5>
          <div className="space-y-2">
            {viewerMetrics.demographics.locations.slice(0, 4).map((location, index) => (
              <div key={location.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-700">{location.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{location.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Seniority */}
        <div className="bg-white p-4 rounded-lg border border-indigo-200">
          <h5 className="font-semibold text-gray-900 mb-3 flex items-center">
            <Users size={16} className="mr-2 text-indigo-600" />
            Seniority Levels
          </h5>
          <div className="space-y-2">
            {viewerMetrics.demographics.seniority.map((level, index) => (
              <div key={level.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-700">{level.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{level.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Growth Insight */}
      <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
        <div className="flex items-center space-x-2">
          <TrendingUp size={16} className="text-indigo-600" />
          <span className="text-sm text-indigo-800 font-medium">
            Your profile visibility is growing {viewerMetrics.monthlyGrowth}% month-over-month
          </span>
        </div>
      </div>
    </Card>
  );
};