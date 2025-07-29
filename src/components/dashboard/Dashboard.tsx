import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Users,
  FileText,
  BarChart3,
  Calendar,
  Zap,
  Eye,
  Search,
  Heart,
  MessageCircle,
  Share,
  User,
  Target,
  Activity,
  Award,
  Sparkles,
  ArrowUpRight,
  Clock,
  Star,
  Briefcase,
  Globe,
  Building,
  CheckCircle,
  AlertCircle,
  Info,
  Lock,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { useAuthStore } from "../../stores/authStore";
import { LinkedInDataService } from "../../services/linkedin-data-service";
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

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  color: string;
}

const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendDirection = "neutral",
  color,
}: MetricCardProps) => (
  <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
    <div className="relative">
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: color }}
      />
      <Card variant="glass" className="p-6 ml-1">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${color}20` }}
              >
                {icon}
              </div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
            <p className="text-sm text-gray-500 mb-2">{subtitle}</p>
            {trend && (
              <div className="flex items-center space-x-1">
                {trendDirection === "up" && (
                  <TrendingUp size={14} className="text-green-500" />
                )}
                {trendDirection === "down" && (
                  <TrendingUp size={14} className="text-red-500 rotate-180" />
                )}
                <span
                  className={`text-sm font-medium ${
                    trendDirection === "up"
                      ? "text-green-600"
                      : trendDirection === "down"
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  {trend}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  </motion.div>
);

const InsightCard = ({
  title,
  insights,
  icon,
  color,
  emptyMessage,
}: {
  title: string;
  insights?: string[];
  icon: React.ReactNode;
  color: string;
  emptyMessage: string;
}) => (
  <Card variant="glass" className="p-6">
    <div className="flex items-center space-x-3 mb-4">
      <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    </div>
    <div className="space-y-3">
      {insights && insights.length > 0 ? (
        insights.map((insight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start space-x-3"
          >
            <div
              className="w-2 h-2 rounded-full mt-2"
              style={{ backgroundColor: color }}
            ></div>
            <span className="text-sm text-gray-700 leading-relaxed">
              {insight}
            </span>
          </motion.div>
        ))
      ) : (
        <div className="flex items-center space-x-2 text-gray-500">
          <Info size={16} />
          <span className="text-sm">{emptyMessage}</span>
        </div>
      )}
    </div>
  </Card>
);

const QuickActionButton = ({
  title,
  description,
  icon,
  gradient,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  onClick: () => void;
}) => (
  <motion.button
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.98 }}
    className={`w-full p-4 rounded-xl text-white transition-all duration-200 ${gradient}`}
    onClick={onClick}
  >
    <div className="flex items-center space-x-3">
      <div className="p-2 bg-white bg-opacity-20 rounded-lg">{icon}</div>
      <div className="text-left">
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm opacity-90">{description}</p>
      </div>
      <ArrowUpRight size={20} className="ml-auto" />
    </div>
  </motion.button>
);

const ProgressRing = ({
  percentage,
  size = 80,
  strokeWidth = 8,
  color = "#3B82F6",
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-bold text-gray-900">{percentage}%</div>
      </div>
    </div>
  );
};

export const Dashboard = () => {
  const { dmaToken, accessToken, isBasicAuthenticated, isFullyAuthenticated } =
    useAuthStore();
  const [metrics, setMetrics] = useState<any>({
    profileViews: 0,
    searchAppearances: 0,
    uniqueViewers: 0,
    connections: 0,
    connectionGrowth: 0,
    totalEngagement: 0,
    avgPerPost: "0",
    totalLikes: 0,
    totalComments: 0,
    totalPosts: 0,
    postsCreated: 0,
    commentsGiven: 0,
    likesGiven: 0,
    profileStrength: 0,
    networkQuality: 0,
    socialActivity: 0,
    contentPerformance: 0,
    profileAnalysis: null,
    networkAnalysis: null,
    socialAnalysis: null,
    contentAnalysis: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      if (!dmaToken) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const service = new LinkedInDataService();
        const profileMetrics = await service.getProfileMetrics();

        const newMetrics = {
          profileViews: profileMetrics.profileViews || 0,
          searchAppearances: profileMetrics.searchAppearances || 0,
          uniqueViewers: profileMetrics.uniqueViewers || 0,
          connections: profileMetrics.totalConnections || 0,
          connectionGrowth:
            profileMetrics.networkAnalysis?.analysis?.recentGrowth || 0,
          totalEngagement: profileMetrics.totalEngagement || 0,
          avgPerPost: "0",
          totalLikes: profileMetrics.totalLikes || 0,
          totalComments: profileMetrics.totalComments || 0,
          totalPosts: profileMetrics.totalPosts || 0,
          postsCreated: profileMetrics.totalPosts || 0,
          commentsGiven: profileMetrics.likesGiven || 0,
          likesGiven: profileMetrics.likesGiven || 0,
          profileStrength: profileMetrics.profileStrength || 0,
          networkQuality: profileMetrics.networkQuality || 0,
          socialActivity: profileMetrics.socialActivity || 0,
          contentPerformance: profileMetrics.contentPerformance || 0,
          profileAnalysis: profileMetrics.profileAnalysis || null,
          networkAnalysis: profileMetrics.networkAnalysis || null,
          socialAnalysis: profileMetrics.socialAnalysis || null,
          contentAnalysis: profileMetrics.contentAnalysis || null,
        };

        setMetrics(newMetrics);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard metrics"
        );
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, [dmaToken]);

  if (!dmaToken) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              Limited Access Mode
            </h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              You have basic LinkedIn access. Enable data access permissions for
              full analytics and insights.
            </p>
            <Button
              variant="primary"
              onClick={() => (window.location.href = "/")}
              className="w-full"
            >
              Enable Full Access
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

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
        {error.includes("Rate Limit") ? (
          <div className="max-w-md mx-auto">
            <div className="mb-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                LinkedIn API Rate Limit Exceeded
              </h2>
              <p className="text-gray-600 mb-4">
                You've reached the daily limit for LinkedIn API calls. This is a
                LinkedIn restriction, not an issue with your account.
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-orange-800 mb-2">
                  What this means:
                </h3>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• LinkedIn limits DMA API calls per day</li>
                  <li>• Your data is still accessible</li>
                  <li>• Limits reset at midnight Pacific Time</li>
                  <li>• This is normal for active users</li>
                </ul>
              </div>
            </div>
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Try Again
              </Button>
              <Button
                variant="primary"
                onClick={() => (window.location.href = "/?module=dma-test")}
                className="w-full"
              >
                Test API Status
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-red-600 mb-4">Error loading metrics: {error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </>
        )}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No metrics available</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Your LinkedIn performance at a glance</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm text-gray-500">
            <Clock size={16} />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Profile Strength"
          value={`${metrics.profileStrength || 0}%`}
          subtitle="Overall profile quality"
          icon={<Target size={20} className="text-blue-600" />}
          trend={getProfileStrengthTrend(metrics.profileStrength)}
          trendDirection={
            metrics.profileStrength >= 80
              ? "up"
              : metrics.profileStrength >= 50
              ? "neutral"
              : "down"
          }
          color="#3B82F6"
        />

        <MetricCard
          title="Network Quality"
          value={`${metrics.networkQuality || 0}/10`}
          subtitle={`${metrics.connections || 0} connections`}
          icon={<Users size={20} className="text-green-600" />}
          trend={getNetworkTrend(metrics.connections)}
          trendDirection={metrics.connections > 100 ? "up" : "neutral"}
          color="#10B981"
        />

        <MetricCard
          title="Social Activity"
          value={`${metrics.socialActivity || 0}/10`}
          subtitle="Engagement level"
          icon={<Activity size={20} className="text-purple-600" />}
          trend={getSocialTrend(metrics.likesGiven, metrics.commentsGiven)}
          trendDirection={
            metrics.likesGiven > 0 || metrics.commentsGiven > 0
              ? "up"
              : "neutral"
          }
          color="#8B5CF6"
        />

        <MetricCard
          title="Content Performance"
          value={`${metrics.contentPerformance || 0}/10`}
          subtitle="Post effectiveness"
          icon={<BarChart3 size={20} className="text-orange-600" />}
          trend={getContentTrend(metrics.totalPosts)}
          trendDirection={metrics.totalPosts > 0 ? "up" : "neutral"}
          color="#F59E0B"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Analytics & Progress */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Overview */}
          <Card variant="glass" className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                Activity Overview
              </h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Calendar size={16} />
                <span>Past 28 days</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {metrics.postsCreated || 0}
                </div>
                <div className="text-sm text-gray-600">Posts Created</div>
                <div className="text-xs text-blue-500 mt-1">
                  {metrics.postsCreated > 0
                    ? "Great activity!"
                    : "Start posting"}
                </div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {metrics.commentsGiven || 0}
                </div>
                <div className="text-sm text-gray-600">Comments Given</div>
                <div className="text-xs text-green-500 mt-1">
                  {metrics.commentsGiven > 0
                    ? "Engaging well!"
                    : "Start commenting"}
                </div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 mb-1">
                  {metrics.likesGiven || 0}
                </div>
                <div className="text-sm text-gray-600">Likes Given</div>
                <div className="text-xs text-purple-500 mt-1">
                  {metrics.likesGiven > 0
                    ? "Active engagement!"
                    : "Start liking posts"}
                </div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 mb-1">
                  {metrics.totalPosts || 0}
                </div>
                <div className="text-sm text-gray-600">Total Posts</div>
                <div className="text-xs text-orange-500 mt-1">
                  {metrics.totalPosts > 0
                    ? "Content published!"
                    : "No posts yet"}
                </div>
              </div>
            </div>
          </Card>

          {/* Performance Chart */}
          <Card variant="glass" className="p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              Performance Trends
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { name: "Profile", value: metrics.profileStrength },
                    { name: "Network", value: metrics.networkQuality * 10 },
                    { name: "Social", value: metrics.socialActivity * 10 },
                    { name: "Content", value: metrics.contentPerformance * 10 },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Right Column - Insights & Actions */}
        <div className="space-y-6">
          {/* Profile Progress */}
          <Card variant="glass" className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Profile Progress
            </h3>
            <div className="flex justify-center mb-4">
              <ProgressRing
                percentage={metrics.profileStrength || 0}
                size={120}
                color="#3B82F6"
              />
            </div>
            <p className="text-sm text-gray-600">
              {metrics.profileStrength >= 80
                ? "Excellent profile strength!"
                : metrics.profileStrength >= 60
                ? "Good progress, keep it up!"
                : "Room for improvement"}
            </p>
          </Card>

          {/* Quick Actions */}
          <Card variant="glass" className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Zap className="mr-2" size={20} />
              Quick Actions
            </h3>
            <div className="space-y-3">
              <QuickActionButton
                title="Find Synergy Partners"
                description="Discover potential collaborators"
                icon={<Users size={20} />}
                gradient="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                onClick={() => (window.location.href = "/?module=synergy")}
              />
              <QuickActionButton
                title="Generate Post"
                description="Create engaging content"
                icon={<FileText size={20} />}
                gradient="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                onClick={() => (window.location.href = "/?module=postgen")}
              />
              <QuickActionButton
                title="View Analytics"
                description="Detailed performance insights"
                icon={<BarChart3 size={20} />}
                gradient="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                onClick={() => (window.location.href = "/?module=analytics")}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InsightCard
          title="Profile Development"
          insights={generateProfileInsights(metrics)}
          icon={<User size={20} className="text-blue-600" />}
          color="#3B82F6"
          emptyMessage="Your profile is looking strong!"
        />
        <InsightCard
          title="Network Insights"
          insights={generateNetworkInsights(metrics)}
          icon={<Building size={20} className="text-green-600" />}
          color="#10B981"
          emptyMessage="Keep building your network!"
        />
        <InsightCard
          title="Content Strategy"
          insights={generateContentInsights(metrics)}
          icon={<FileText size={20} className="text-purple-600" />}
          color="#8B5CF6"
          emptyMessage="Start publishing content!"
        />
        <InsightCard
          title="Social Engagement"
          insights={generateSocialInsights(metrics)}
          icon={<Heart size={20} className="text-orange-600" />}
          color="#F59E0B"
          emptyMessage="Engage with your network!"
        />
      </div>
    </motion.div>
  );
};

// Helper functions for trend calculations
const getProfileStrengthTrend = (strength: number) => {
  if (strength >= 80) return "Excellent profile!";
  if (strength >= 60) return "Good progress";
  if (strength >= 40) return "Needs improvement";
  return "Complete your profile";
};

const getNetworkTrend = (connections: number) => {
  if (connections >= 500) return "Strong network!";
  if (connections >= 100) return "Growing network";
  if (connections >= 50) return "Building connections";
  return "Start connecting";
};

const getSocialTrend = (likes: number, comments: number) => {
  const total = likes + comments;
  if (total >= 100) return "Very active!";
  if (total >= 50) return "Good engagement";
  if (total >= 10) return "Getting started";
  return "Start engaging";
};

const getContentTrend = (posts: number) => {
  if (posts >= 20) return "Content creator!";
  if (posts >= 10) return "Regular poster";
  if (posts >= 5) return "Getting started";
  return "Start posting";
};

// Helper functions to generate actionable insights
const generateProfileInsights = (metrics: any) => {
  const insights = [];

  if (metrics.profileStrength < 50) {
    insights.push("Complete your profile with a professional headline");
    insights.push("Add your current position and company");
    insights.push("Include a professional profile photo");
  } else if (metrics.profileStrength < 80) {
    insights.push("Add more skills to increase your visibility");
    insights.push("Include education and certifications");
    insights.push("Write a compelling summary section");
  } else {
    insights.push("Your profile is well-optimized!");
    insights.push("Consider adding industry-specific keywords");
    insights.push("Keep your experience section updated");
  }

  return insights;
};

const generateNetworkInsights = (metrics: any) => {
  const insights = [];
  const connections = metrics.connections || 0;

  if (connections < 100) {
    insights.push("Start connecting with colleagues and classmates");
    insights.push("Join industry-specific LinkedIn groups");
    insights.push("Engage with posts from your target companies");
  } else if (connections < 500) {
    insights.push("Focus on quality connections over quantity");
    insights.push("Personalize your connection requests");
    insights.push("Attend industry events and connect afterward");
  } else {
    insights.push("Strong network! Focus on engagement");
    insights.push("Share valuable content with your network");
    insights.push("Help others by making introductions");
  }

  return insights;
};

const generateContentInsights = (metrics: any) => {
  const insights = [];
  const totalPosts = metrics.totalPosts || 0;

  if (totalPosts === 0) {
    insights.push("Start by sharing industry insights");
    insights.push("Post about your professional achievements");
    insights.push("Share relevant articles with your thoughts");
  } else if (totalPosts < 10) {
    insights.push("Aim to post 2-3 times per week");
    insights.push("Mix original content with curated posts");
    insights.push("Use relevant hashtags to increase reach");
  } else {
    insights.push("Great content consistency!");
    insights.push("Try different content formats (video, carousel)");
    insights.push("Engage with comments on your posts");
  }

  return insights;
};

const generateSocialInsights = (metrics: any) => {
  const insights = [];
  const likesGiven = metrics.likesGiven || 0;
  const commentsGiven = metrics.commentsGiven || 0;

  if (likesGiven === 0 && commentsGiven === 0) {
    insights.push("Start by liking posts from your network");
    insights.push("Leave thoughtful comments on relevant posts");
    insights.push("Congratulate connections on their achievements");
  } else if (likesGiven < 50) {
    insights.push("Increase your daily engagement activity");
    insights.push("Comment on posts to start conversations");
    insights.push("Share posts that resonate with your audience");
  } else {
    insights.push("Excellent engagement level!");
    insights.push("Continue building meaningful relationships");
    insights.push("Consider creating your own thought leadership content");
  }

  return insights;
};
