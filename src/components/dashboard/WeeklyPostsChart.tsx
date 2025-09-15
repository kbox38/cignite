import { motion } from 'framer-motion';
import { Calendar, TrendingUp, Target } from 'lucide-react';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useLinkedInSnapshot } from '../../hooks/useLinkedInData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface WeeklyPostData {
  week: string;
  posts: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
}

export const WeeklyPostsChart = () => {
  const { data: postsSnapshot, isLoading, error } = useLinkedInSnapshot('MEMBER_SHARE_INFO');

  const calculateWeeklyPostsData = (): WeeklyPostData[] => {
    if (!postsSnapshot?.elements?.[0]?.snapshotData) {
      return [];
    }

    const posts = postsSnapshot.elements[0].snapshotData;
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    
    // Create 52 weeks of data
    const weeklyData: WeeklyPostData[] = [];
    
    for (let i = 51; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      
      // Count posts in this week
      const postsInWeek = posts.filter((post: any) => {
        const postDate = new Date(post.Date || post.date);
        return postDate >= weekStart && postDate <= weekEnd;
      }).length;

      weeklyData.push({
        week: `Week ${52 - i}`,
        posts: postsInWeek,
        weekNumber: 52 - i,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0]
      });
    }

    return weeklyData;
  };

  const getBarColor = (posts: number) => {
    if (posts >= 7) return '#10B981'; // Green
    if (posts >= 3) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const weeklyData = calculateWeeklyPostsData();

  // Fix 1: Get total posts from actual data source (not weekly aggregation)
  const totalPosts = postsSnapshot?.elements?.[0]?.snapshotData?.length || 0;
  
  // Fix 2: Use same calculation as dashboard analytics (date range method)
  const getCorrectAvgPostsPerWeek = () => {
    const posts = postsSnapshot?.elements?.[0]?.snapshotData || [];
    
    if (posts.length === 0) return '0';
    
    // Same logic as dashboard-analytics.ts
    const postDates = posts
      .map((post: any) => new Date(post.Date || post.date))
      .filter((date: Date) => !isNaN(date.getTime()))
      .sort((a: Date, b: Date) => b.getTime() - a.getTime());
  
    if (postDates.length === 0) return '0';
  
    const oldestPost = postDates[postDates.length - 1];
    const newestPost = postDates[0];
    const daysDiff = Math.max(1, (newestPost.getTime() - oldestPost.getTime()) / (1000 * 60 * 60 * 24));
    const postsPerWeek = (posts.length / daysDiff) * 7;
  
    return (Math.round(postsPerWeek * 10) / 10).toFixed(1);
  };
  
  const avgPostsPerWeek = getCorrectAvgPostsPerWeek();

  const weeksAboveTarget = weeklyData.filter(week => week.posts >= 7).length;
  const consistencyPercentage = weeklyData.length > 0 ? Math.round((weeksAboveTarget / weeklyData.length) * 100) : 0;

  if (isLoading) {
    return (
      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </Card>
    );
  }

  if (error || weeklyData.length === 0) {
    return (
      <Card variant="glass" className="p-6">
        <div className="flex items-center space-x-3 text-orange-600">
          <Calendar size={20} />
          <span>No posting data available for the past 12 months</span>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="glass" className="p-6 bg-gradient-to-br from-white to-green-50 border-2 border-green-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl">
            <Calendar size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Weekly Posts Analytics</h3>
            <p className="text-gray-600">12-month posting frequency tracker</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-600">{avgPostsPerWeek}</div>
          <div className="text-sm text-gray-500">Avg/Week</div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-white rounded-lg border border-green-200">
          <div className="text-xl font-bold text-gray-900">{totalPosts}</div>
          <div className="text-sm text-gray-600">Total Posts</div>
        </div>
        <div className="text-center p-3 bg-white rounded-lg border border-green-200">
          <div className="text-xl font-bold text-green-600">{weeksAboveTarget}</div>
          <div className="text-sm text-gray-600">Weeks @ Target</div>
        </div>
        <div className="text-center p-3 bg-white rounded-lg border border-green-200">
          <div className="text-xl font-bold text-blue-600">{consistencyPercentage}%</div>
          <div className="text-sm text-gray-600">Consistency</div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="weekNumber" 
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as WeeklyPostData;
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-semibold">{data.week}</p>
                      <p className="text-sm text-gray-600">{data.startDate} to {data.endDate}</p>
                      <p className="text-sm">
                        <span className="font-medium">{data.posts} posts</span>
                        {data.posts >= 7 && <span className="text-green-600 ml-2">✓ Target met</span>}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey="posts" 
              fill={(entry) => getBarColor(entry?.posts || 0)}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};