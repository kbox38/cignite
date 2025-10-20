import { motion } from 'framer-motion';
import { TrendingUp, FileText, Heart, BarChart3 } from 'lucide-react';
import { Card } from '../ui/Card';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { MiniTrend } from '../../hooks/useDashboardData';
import { useAppStore } from '../../stores/appStore';

interface MiniTrendsCardProps {
  trends: {
    posts: MiniTrend[];
    engagements: MiniTrend[];
  };
}

export const MiniTrendsCard = ({ trends }: MiniTrendsCardProps) => {
  const { setCurrentModule } = useAppStore();

  const calculateTrend = (data: MiniTrend[]) => {
    if (data.length < 2) return 0;
    const recent = data.slice(-3).reduce((sum, item) => sum + item.value, 0);
    const previous = data.slice(-6, -3).reduce((sum, item) => sum + item.value, 0);
    return recent - previous;
  };

  const postsTrend = calculateTrend(trends.posts);
  const engagementsTrend = calculateTrend(trends.engagements);

  return (
    <Card 
      variant="glass" 
      className="p-8 cursor-pointer hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-purple-50 border-2 border-purple-100"
      onClick={() => setCurrentModule('analytics')}
    >
      <div className="flex items-center space-x-3 mb-8">
        <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
          <BarChart3 size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900">7-Day Trends</h3>
          <p className="text-gray-600">Recent activity patterns</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Posts Trend */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-4 rounded-xl border border-blue-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText size={16} className="text-blue-600" />
              </div>
              <span className="font-semibold text-gray-900">Posts</span>
            </div>
            <div className={`text-sm font-bold px-2 py-1 rounded-full ${
              postsTrend > 0 ? 'text-green-600' : postsTrend < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {postsTrend > 0 ? '+' : ''}{postsTrend}
            </div>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends.posts}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  dot={false}
                  strokeLinecap="round"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Engagements Trend */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-4 rounded-xl border border-purple-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Heart size={16} className="text-purple-600" />
              </div>
              <span className="font-semibold text-gray-900">Engagements</span>
            </div>
            <div className={`text-sm font-bold px-2 py-1 rounded-full ${
              engagementsTrend > 0 ? 'text-green-600' : engagementsTrend < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {engagementsTrend > 0 ? '+' : ''}{engagementsTrend}
            </div>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends.engagements}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8B5CF6" 
                  strokeWidth={3}
                  dot={false}
                  strokeLinecap="round"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
        <div className="flex items-center space-x-3">
          <TrendingUp size={20} className="text-purple-600" />
          <div>
            <p className="font-semibold text-purple-900">Dive deeper into your trends</p>
            <p className="text-sm text-purple-700">Click to explore detailed analytics with actionable insights.</p>
          </div>
        </div>
      </div>
    </Card>
  );
};