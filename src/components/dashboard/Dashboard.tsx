import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Zap,
  RefreshCw,
  Database,
  TrendingUp,
  Users,
  FileText,
  Heart,
  Info,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { useAuthStore } from "../../stores/authStore";
import { useDashboardData } from "../../hooks/useDashboardData";
import { QuickStatsCard } from "./QuickStatsCard";
import { ProfileEvaluationCard } from "./ProfileEvaluationCard";
import { SummaryKPIsCard } from "./SummaryKPIsCard";
import { ProfileCompletenessCard } from "./ProfileCompletenessCard";
import { WeeklyPostsChart } from "./WeeklyPostsChart";
import { ConsistencyRating } from "./ConsistencyRating";
import { ProfileViewersCard } from "./ProfileViewersCard";

export const Dashboard = () => {
  const navigate = useNavigate();
  const { dmaToken } = useAuthStore();
  const { data: dashboardData, isLoading, error, refetch } = useDashboardData();
  const [debugMode, setDebugMode] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);

  // Handle DMA reconnect scenario
  const handleRefetch = async () => {
    setIsRefetching(true);
    try {
      await refetch();
    } finally {
      setIsRefetching(false);
    }
  };

  const handleReconnect = () => {
    // Clear tokens and redirect to auth flow
    localStorage.clear();
    window.location.href = "/";
  };

  // Check for DMA reconnect needed
  if (dashboardData?.needsReconnect) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <Card
          variant="glass"
          className="p-8 text-center bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200"
        >
          <AlertCircle size={64} className="mx-auto text-orange-500 mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            LinkedIn Data Access Required
          </h2>
          <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
            {dashboardData.error === "DMA not enabled"
              ? "Your LinkedIn account needs to be reconnected with data access permissions to view analytics."
              : "We need to verify your LinkedIn data access permissions."}
          </p>
          <div className="space-y-4">
            <Button
              variant="primary"
              onClick={handleReconnect}
              className="px-8 py-3"
            >
              <ExternalLink size={20} className="mr-2" />
              Reconnect LinkedIn Account
            </Button>
            <p className="text-sm text-gray-600">
              This will redirect you to LinkedIn to grant data access
              permissions.
            </p>
          </div>
        </Card>
      </motion.div>
    );
  }

  if (!dmaToken) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="text-center py-12">
          <AlertCircle size={48} className="mx-auto text-orange-400 mb-4" />
          <h2 className="text-2xl font-bold mb-4">Limited Access Mode</h2>
          <p className="text-gray-600 mb-6">
            DMA token is missing. You need to complete the DMA authentication
            flow to access dashboard features.
          </p>
          <Button
            variant="primary"
            onClick={() => (window.location.href = "/")}
          >
            Complete DMA Authentication
          </Button>
        </div>
      </motion.div>
    );
  }

  if (isLoading || !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">Loading LinkedIn analytics...</p>
        <p className="text-sm text-gray-500">
          This may take a moment for larger accounts
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Error Loading Dashboard
        </h2>
        <p className="text-gray-600 mb-4">
          {error.message || "Failed to load dashboard data"}
        </p>
        <div className="space-y-3">
          <Button
            variant="primary"
            onClick={handleRefetch}
            disabled={isRefetching}
          >
            <RefreshCw size={16} className="mr-2" />
            {isRefetching ? "Refreshing..." : "Try Again"}
          </Button>
          <Button variant="outline" onClick={() => setDebugMode(!debugMode)}>
            {debugMode ? "Hide" : "Show"} Debug Info
          </Button>
        </div>
        {debugMode && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg text-left">
            <h3 className="font-semibold mb-2">Debug Information:</h3>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(error, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header with Debug Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-gray-600 mt-1">
            Comprehensive LinkedIn analytics powered by DMA portability data
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDebugMode(!debugMode)}
          >
            <Database size={14} className="mr-1" />
            {debugMode ? "Hide" : "Show"} Debug
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefetch}
            disabled={isRefetching}
          >
            <RefreshCw
              size={14}
              className={`mr-1 ${isRefetching ? "animate-spin" : ""}`}
            />
            {isRefetching ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Debug Panel */}
      {debugMode && dashboardData && (
        <Card
          variant="glass"
          className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center text-blue-900">
              <Database size={16} className="mr-2" />
              Debug Information
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDebugMode(false)}
            >
              Hide
            </Button>
          </div>
          <div className="text-sm space-y-3 text-blue-800">
            <div className="flex items-center space-x-2">
              <span className="font-medium">Last Updated:</span>
              <span className="bg-white px-2 py-1 rounded text-blue-900">
                {new Date(dashboardData.lastUpdated).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">Data Source:</span>
              <span className="bg-white px-2 py-1 rounded text-blue-900">
                {dashboardData.metadata?.dataSource || 'Unknown'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="bg-white p-3 rounded-lg">
                  <strong className="text-blue-900">Scores:</strong>
                  <div className="mt-1 text-sm">
                    Overall:{" "}
                    <span className="font-bold">
                      {dashboardData.scores?.overall || 0}/10
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Profile: {dashboardData.scores?.profileCompleteness || "N/A"}
                    , Posting: {dashboardData.scores?.postingActivity || "N/A"},
                    Engagement:{" "}
                    {dashboardData.scores?.engagementQuality || "N/A"}
                  </div>
                </div>
              </div>
              <div>
                <div className="bg-white p-3 rounded-lg">
                  <strong className="text-blue-900">Summary:</strong>
                  <div className="mt-1 text-sm space-y-1">
                    <div>
                      Connections:{" "}
                      <span className="font-bold">
                        {dashboardData.summary?.totalConnections || 0}
                      </span>
                    </div>
                    <div>
                      Total Posts:{" "}
                      <span className="font-bold">
                        {dashboardData.summary?.totalPosts || 0}
                      </span>
                    </div>
                    <div>
                      Avg Engagement:{" "}
                      <span className="font-bold">
                        {dashboardData.summary?.avgEngagementPerPost || 0}
                      </span>
                    </div>
                    <div>
                      Posts/Week:{" "}
                      <span className="font-bold">
                        {dashboardData.summary?.postsPerWeek || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* New Analytics Grid - Always Show These Components */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ProfileCompletenessCard />
        <WeeklyPostsChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ConsistencyRating />
        <ProfileViewersCard />
      </div>

      {/* Quick Stats Overview - Always Show */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <QuickStatsCard
          title="Overall Score"
          value={`${dashboardData.scores?.overall || 0}/10`}
          change={(dashboardData.scores?.overall || 0) >= 7 ? "+Good" : "Needs Work"}
          icon={TrendingUp}
          color="blue"
          trend={(dashboardData.scores?.overall || 0) >= 7 ? "up" : "down"}
        />
        <QuickStatsCard
          title="Total Connections"
          value={(dashboardData.summary?.totalConnections || 0).toLocaleString()}
          change={`+${dashboardData.summary?.newConnections28d || 0} (28 days)`}
          icon={Users}
          color="green"
          trend="up"
        />
        <QuickStatsCard
          title="Total Posts"
          value={dashboardData.summary?.totalPosts || 0}
          change={
            (dashboardData.summary?.totalPosts || 0) >= 5 ? "Active" : "Growing"
          }
          icon={FileText}
          color="purple"
          trend={(dashboardData.summary?.totalPosts || 0) >= 5 ? "up" : "stable"}
        />
      </div>

      {/* Summary KPIs - Always Show */}
      <div className="mb-8">
        <SummaryKPIsCard
          kpis={{
            totalConnections: dashboardData.summary?.totalConnections || 0,
            totalPosts: dashboardData.summary?.totalPosts || 0,
            avgEngagementPerPost: dashboardData.summary?.avgEngagementPerPost || 0,
            postsPerWeek: dashboardData.summary?.postsPerWeek || 0,
          }}
        />
      </div>

      {/* Profile Evaluation - Always Show */}
      <div className="mb-8">
        <ProfileEvaluationCard
          scores={dashboardData.scores || {
            profileCompleteness: 0,
            postingActivity: 0,
            engagementQuality: 0,
            contentImpact: 0,
            contentDiversity: 0,
            postingConsistency: 0
          }}
          overallScore={dashboardData.scores?.overall || 0}
          analysis={dashboardData.analysis || {}}
        />
      </div>

      {/* Quick Actions - Always Show */}
      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center text-gray-900">
            <Zap className="mr-2" size={20} />
            Quick Actions
          </h3>
          <div className="text-sm text-gray-500">
            Boost your LinkedIn presence
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full p-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl"
            onClick={() => navigate("/analytics")}
          >
            <div className="flex items-center justify-center space-x-2">
              <span className="text-2xl">📊</span>
              <span className="font-semibold">View Detailed Analytics</span>
            </div>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl"
            onClick={() => navigate("/postgen")}
          >
            <div className="flex items-center justify-center space-x-2">
              <span className="text-2xl">✍️</span>
              <span className="font-semibold">Generate New Post</span>
            </div>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full p-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl"
            onClick={() => navigate("/postpulse")}
          >
            <div className="flex items-center justify-center space-x-2">
              <span className="text-2xl">📈</span>
              <span className="font-semibold">Analyze Posts</span>
            </div>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full p-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
            onClick={() => navigate("/scheduler")}
          >
            <div className="flex items-center justify-center space-x-2">
              <span className="text-2xl">📅</span>
              <span className="font-semibold">Schedule Content</span>
            </div>
          </motion.button>
        </div>
      </Card>
    </motion.div>
  );
};