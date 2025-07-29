import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  TrendingUp,
  Users,
  MessageCircle,
  Eye,
  BarChart3,
  Search,
  Heart,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { useAuthStore } from "../../stores/authStore";
import { AnalyticsProcessor } from "../../services/analytics-processor";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

type TimeRange = "7d" | "30d" | "90d" | "365d" | "custom";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export const Analytics = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [customDateRange, setCustomDateRange] = useState({
    start: "",
    end: "",
  });
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { dmaToken } = useAuthStore();

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!dmaToken) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const processor = new AnalyticsProcessor();
        const data = await processor.calculateAllMetrics(dmaToken);

        setMetrics(data);
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load analytics"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [dmaToken, timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Error loading analytics: {error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  const prepareEngagementData = () => {
    return metrics.content
      .slice(0, 10)
      .map((post: any) => ({
        date: new Date(post.date).toLocaleDateString(),
        engagement:
          post.engagement.likes +
          post.engagement.comments +
          post.engagement.shares,
        likes: post.engagement.likes,
        comments: post.engagement.comments,
        shares: post.engagement.shares,
      }))
      .reverse();
  };

  const prepareContentMixData = () => {
    return Object.entries(metrics.calculated.contentMix).map(
      ([type, count]) => ({
        name: type,
        value: count as number,
      })
    );
  };

  const preparePostingTimesData = () => {
    return metrics.calculated.bestPostingTimes.map((time: any) => ({
      hour: `${time.hour}:00`,
      engagement: parseFloat(time.avgEngagement),
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <div className="flex space-x-2">
          {(["7d", "30d", "90d", "365d"] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "primary" : "outline"}
              size="sm"
              onClick={() => setTimeRange(range)}
            >
              {range}
            </Button>
          ))}
          <Button
            variant={timeRange === "custom" ? "primary" : "outline"}
            size="sm"
            onClick={() => setTimeRange("custom")}
          >
            Custom
          </Button>
        </div>
      </div>

      {/* Custom Date Range */}
      {timeRange === "custom" && (
        <Card variant="glass" className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar size={16} />
              <span className="text-sm">From:</span>
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) =>
                  setCustomDateRange((prev) => ({
                    ...prev,
                    start: e.target.value,
                  }))
                }
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm">To:</span>
              <input
                type="date"
                value={customDateRange.end}
                onChange={(e) =>
                  setCustomDateRange((prev) => ({
                    ...prev,
                    end: e.target.value,
                  }))
                }
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="glass" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Profile Views</p>
              <p className="text-2xl font-bold">
                {metrics.profile.profileViews}
              </p>
              <p className="text-sm text-gray-500">Last 90 days</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-xl">
              <Eye size={24} className="text-white" />
            </div>
          </div>
        </Card>

        <Card variant="glass" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Search Appearances
              </p>
              <p className="text-2xl font-bold">
                {metrics.profile.searchAppearances}
              </p>
              <p className="text-sm text-gray-500">In LinkedIn search</p>
            </div>
            <div className="p-3 bg-green-500 rounded-xl">
              <Search size={24} className="text-white" />
            </div>
          </div>
        </Card>

        <Card variant="glass" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Connections
              </p>
              <p className="text-2xl font-bold">{metrics.network.total}</p>
              <p className="text-sm text-gray-500">
                +{metrics.network.monthlyGrowth} this month
              </p>
            </div>
            <div className="p-3 bg-purple-500 rounded-xl">
              <Users size={24} className="text-white" />
            </div>
          </div>
        </Card>

        <Card variant="glass" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Engagement
              </p>
              <p className="text-2xl font-bold">
                {metrics.calculated.totalEngagement}
              </p>
              <p className="text-sm text-gray-500">
                {metrics.calculated.avgEngagementPerPost} avg per post
              </p>
            </div>
            <div className="p-3 bg-orange-500 rounded-xl">
              <Heart size={24} className="text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Trends */}
        {metrics.content.length > 0 && (
          <Card variant="glass" className="p-6">
            <h3 className="text-lg font-semibold mb-4">Engagement Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={prepareEngagementData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Best Posting Times */}
        {metrics.calculated.bestPostingTimes.length > 0 && (
          <Card variant="glass" className="p-6">
            <h3 className="text-lg font-semibold mb-4">Best Posting Times</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={preparePostingTimesData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="engagement" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Content Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content Mix */}
        {Object.keys(metrics.calculated.contentMix).length > 0 && (
          <Card variant="glass" className="p-6">
            <h3 className="text-lg font-semibold mb-4">Content Mix</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={prepareContentMixData()}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {prepareContentMixData().map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Engagement Breakdown */}
        {metrics.content.length > 0 && (
          <Card variant="glass" className="p-6">
            <h3 className="text-lg font-semibold mb-4">Engagement Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={prepareEngagementData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="likes" stackId="a" fill="#EF4444" />
                <Bar dataKey="comments" stackId="a" fill="#3B82F6" />
                <Bar dataKey="shares" stackId="a" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Top Performing Content */}
      {metrics.calculated.topPerformingPosts.length > 0 && (
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold mb-4">Top Performing Posts</h3>
          <div className="space-y-3">
            {metrics.calculated.topPerformingPosts.map(
              (post: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0
                          ? "bg-yellow-500"
                          : index === 1
                          ? "bg-gray-400"
                          : "bg-orange-500"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium line-clamp-1">
                        {post.commentary || "Post content..."}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(post.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {post.engagement.likes +
                        post.engagement.comments +
                        post.engagement.shares}
                    </p>
                    <p className="text-sm text-gray-500">total engagement</p>
                  </div>
                </div>
              )
            )}
          </div>
        </Card>
      )}

      {/* Network Analysis */}
      {metrics.network.topCompanies.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card variant="glass" className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              Top Companies in Network
            </h3>
            <div className="space-y-3">
              {metrics.network.topCompanies.map(
                (company: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="font-medium">{company.company}</span>
                    <span className="text-blue-600 font-bold">
                      {company.count}
                    </span>
                  </div>
                )
              )}
            </div>
          </Card>

          <Card variant="glass" className="p-6">
            <h3 className="text-lg font-semibold mb-4">Activity Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Posts Created</span>
                <span className="font-bold text-blue-600">
                  {metrics.activity.postsCreated}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Comments Given</span>
                <span className="font-bold text-green-600">
                  {metrics.activity.commentsGiven}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Likes Given</span>
                <span className="font-bold text-red-600">
                  {metrics.activity.likesGiven}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Invitations Sent</span>
                <span className="font-bold text-purple-600">
                  {metrics.activity.invitationsSent}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </motion.div>
  );
};
