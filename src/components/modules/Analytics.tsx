import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp, Users, MessageCircle, Eye, BarChart3, Heart, FileText, Info, RefreshCw, AlertCircle, Filter, Download, Share2, ExternalLink, Zap, FileDown, X, Link, Mail } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { AIAnalysisText } from '../ui/AIAnalysisText';
import { useAuthStore } from '../../stores/authStore';
import { useAnalyticsData } from '../../hooks/useAnalyticsData';
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
  Area
} from 'recharts';

type TimeRange = '7d' | '30d' | '90d';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7300'];

export const Analytics = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [debugMode, setDebugMode] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const { dmaToken } = useAuthStore();
  const { data: analyticsData, isLoading, error, refetch } = useAnalyticsData(timeRange);

  const generatePDFReport = async () => {
    setIsGeneratingPDF(true);
    try {
      // Dynamic import for PDF generation libraries
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Add header
      pdf.setFontSize(20);
      pdf.setTextColor(59, 130, 246); // Blue color
      pdf.text('LinkedIn Analytics Report', 20, 25);
      
      pdf.setFontSize(12);
      pdf.setTextColor(107, 114, 128); // Gray color
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 35);
      pdf.text(`Time Range: ${timeRange === '7d' ? '7 Days' : timeRange === '30d' ? '30 Days' : '90 Days'}`, 20, 42);
      
      let yPosition = 55;
      
      // Add performance metrics
      if (performanceMetrics) {
        pdf.setFontSize(16);
        pdf.setTextColor(0, 0, 0);
        pdf.text('Performance Overview', 20, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(11);
        pdf.setTextColor(75, 85, 99);
        pdf.text(`Total Engagement: ${performanceMetrics.totalEngagement || 0}`, 20, yPosition);
        yPosition += 7;
        pdf.text(`Average per Post: ${performanceMetrics.avgEngagementPerPost || 0}`, 20, yPosition);
        yPosition += 7;
        pdf.text(`Posting Frequency: ${timeBasedInsights.postingFrequency || 0} posts/week`, 20, yPosition);
        yPosition += 15;
      }
      
      // Add content formats
      if (contentFormats.length > 0) {
        pdf.setFontSize(16);
        pdf.setTextColor(0, 0, 0);
        pdf.text('Content Formats', 20, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(11);
        pdf.setTextColor(75, 85, 99);
        contentFormats.forEach(format => {
          pdf.text(`${format.name}: ${format.value} posts (${format.percentage}%)`, 20, yPosition);
          yPosition += 7;
        });
        yPosition += 10;
      }
      
      // Add top hashtags
      if (hashtagTrends.length > 0) {
        pdf.setFontSize(16);
        pdf.setTextColor(0, 0, 0);
        pdf.text('Top Hashtags', 20, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(11);
        pdf.setTextColor(75, 85, 99);
        hashtagTrends.slice(0, 10).forEach(hashtag => {
          pdf.text(`${hashtag.hashtag}: ${hashtag.count} uses`, 20, yPosition);
          yPosition += 7;
        });
        yPosition += 10;
      }
      
      // Add AI narrative if available
      if (aiNarrative) {
        if (yPosition > pageHeight - 50) {
          pdf.addPage();
          yPosition = 25;
        }
        
        pdf.setFontSize(16);
        pdf.setTextColor(0, 0, 0);
        pdf.text('AI Analysis', 20, yPosition);
        yPosition += 10;
        
        pdf.setFontSize(10);
        pdf.setTextColor(75, 85, 99);
        
        // Split AI narrative into lines that fit the page
        const lines = pdf.splitTextToSize(aiNarrative, pageWidth - 40);
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 25;
          }
          pdf.text(line, 20, yPosition);
          yPosition += 5;
        });
      }
      
      // Save the PDF
      pdf.save(`LinkedIn_Analytics_Report_${timeRange}_${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSharePDF = async () => {
    try {
      // Generate PDF first
      await generatePDFReport();
      
      // Then handle sharing
      if (navigator.share && navigator.canShare) {
        // Native sharing on mobile/supported browsers
        await navigator.share({
          title: 'LinkedIn Analytics Report',
          text: 'Check out my LinkedIn analytics report',
          url: window.location.href
        });
      } else {
        // Desktop fallback - copy link to clipboard
        await navigator.clipboard.writeText(window.location.href);
        
        // Show success message (you can replace alert with a better notification)
        alert('Link copied to clipboard! Your PDF report has been downloaded.');
      }
    } catch (error) {
      console.error('Share failed:', error);
      
      // Fallback - just show the PDF was generated
      alert('PDF report downloaded successfully!');
    }
  };

  // Null-safe data extraction with defaults
  const postingTrends = analyticsData?.postingTrends ?? [];
  const contentFormats = analyticsData?.contentFormats ?? [];
  const engagementAnalysis = analyticsData?.engagementAnalysis ?? [];
  const hashtagTrends = analyticsData?.hashtagTrends ?? [];
  const audienceInsights = analyticsData?.audienceInsights ?? { industries: [], positions: [], locations: [], totalConnections: 0 };
  const performanceMetrics = analyticsData?.performanceMetrics ?? {};
  const timeBasedInsights = analyticsData?.timeBasedInsights ?? {};
  const aiNarrative = analyticsData?.aiNarrative;
  const metadata = analyticsData?.metadata ?? {
    hasRecentActivity: false,
    dataSource: "unknown",
    postsCount: 0,
    description: ""
  };

  // Create postsEngagementsTrend from postingTrends for compatibility
  const postsEngagementsTrend = postingTrends || [];
  if (!dmaToken) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Analytics Unavailable</h2>
          <p className="text-gray-600 mb-6">
            Advanced analytics require LinkedIn data access permissions.
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
      </div>
    );
  }

  if (error && !analyticsData) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Error Loading Analytics
        </h2>
        <p className="text-gray-600 mb-4">
          {error?.message || 'Failed to load analytics data'}
        </p>
        <div className="space-y-3">
          <Button variant="primary" onClick={() => refetch()}>
            <RefreshCw size={16} className="mr-2" />
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => setDebugMode(!debugMode)}
          >
            {debugMode ? "Hide" : "Show"} Debug Info
          </Button>
        </div>
        {debugMode && error && (
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

  // Show note if no recent activity
  const showEmptyState = !metadata.hasRecentActivity && postsEngagementsTrend.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">LinkedIn Analytics</h2>
          <p className="text-gray-600 mt-1">
            {metadata.description || "Comprehensive insights into your LinkedIn performance"}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={generatePDFReport}
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <FileDown size={16} className="mr-2" />
            )}
            {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowShareModal(true)}
          >
            <Share2 size={16} className="mr-2" />
            Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDebugMode(!debugMode)}
          >
            <Eye size={16} className="mr-2" />
            {debugMode ? "Hide" : "Show"} Debug
          </Button>
        </div>
      </div>

      {/* AI Narrative Analysis */}
      {aiNarrative && (
        <Card variant="glass" className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Zap className="mr-2 text-purple-500" size={20} />
            AI Analytics Summary
          </h3>
          <AIAnalysisText content={aiNarrative} />
        </Card>
      )}

      {/* Show note for no recent activity */}
      {!metadata.hasRecentActivity && (
        <Card variant="glass" className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200">
          <div className="flex items-center space-x-3">
            <AlertCircle size={20} className="text-yellow-600" />
            <p className="text-yellow-800 font-medium">No posts found in {timeRange} range. Try selecting a longer time period or start posting to see analytics.</p>
          </div>
        </Card>
      )}

      {/* Time Filter Section */}
      <Card variant="glass" className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Filter size={20} className="text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Time Range</h3>
              <p className="text-sm text-gray-600">Select the period for analysis</p>
            </div>
          </div>
          <div className="flex space-x-2">
            {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setTimeRange(range)}
                className={timeRange === range ? 'shadow-lg' : 'hover:bg-blue-100'}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Debug Panel */}
      {debugMode && (
        <Card variant="glass" className="p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-yellow-900 flex items-center">
              <Eye size={16} className="mr-2" />
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
          <div className="text-sm space-y-3 text-yellow-800">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-lg">
                <div className="font-medium">Time Range</div>
                <div className="text-yellow-900">{analyticsData?.timeRange || timeRange}</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="font-medium">Last Updated</div>
                <div className="text-yellow-900">{analyticsData?.lastUpdated ? new Date(analyticsData.lastUpdated).toLocaleString() : 'Unknown'}</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="font-medium">Data Points</div>
                <div className="text-yellow-900">{postingTrends.length} trends</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="font-medium">Data Source</div>
                <div className="text-yellow-900">{metadata.dataSource}</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="font-medium">Posts Count</div>
                <div className="text-yellow-900">{metadata.postsCount}</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="font-medium">Has Activity</div>
                <div className="text-yellow-900">{metadata.hasRecentActivity ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Empty State for No Data */}
      {!metadata.hasRecentActivity && (
        <Card variant="glass" className="p-12 text-center bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-gray-200">
          <BarChart3 size={64} className="mx-auto text-gray-300 mb-6" />
          <h3 className="text-2xl font-bold text-gray-900 mb-4">No Analytics Data Available</h3>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            No recent LinkedIn activity found in the {timeRange} period. Start posting and engaging to see analytics here.
          </p>
          <div className="space-y-4">
            <Button
              variant="primary"
              onClick={() => window.open('https://linkedin.com', '_blank')}
            >
              <ExternalLink size={16} className="mr-2" />
              Post on LinkedIn
            </Button>
          </div>
        </Card>
      )}

      {/* Charts Grid */}
      {metadata.hasRecentActivity && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Posting Trends */}
        <Card variant="glass" className="p-8 bg-gradient-to-br from-white to-blue-50 border-2 border-blue-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl">
                <TrendingUp size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Posting Trends</h3>
                <p className="text-sm text-gray-600">Daily posting activity and engagement</p>
              </div>
            </div>
          </div>
          {postingTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={postingTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                  }} 
                />
                <Line type="monotone" dataKey="posts" stroke="#3B82F6" strokeWidth={3} name="Posts" dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }} />
                <Line type="monotone" dataKey="totalEngagement" stroke="#10B981" strokeWidth={3} name="Total Engagement" dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }} />
                <Line type="monotone" dataKey="likes" stroke="#EF4444" strokeWidth={2} name="Likes" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="comments" stroke="#8B5CF6" strokeWidth={2} name="Comments" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500 bg-gray-50 rounded-xl">
              <div className="text-center">
                <TrendingUp size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="font-medium text-gray-900">Loading engagement data...</p>
                <p className="text-sm mt-1 text-gray-600">Processing your LinkedIn activity</p>
              </div>
            </div>
          )}
        </Card>

        {/* Content Formats */}
        <Card variant="glass" className="p-8 bg-gradient-to-br from-white to-purple-50 border-2 border-purple-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
                <BarChart3 size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Content Formats</h3>
                <p className="text-sm text-gray-600">Distribution of your content types</p>
              </div>
            </div>
          </div>
          {contentFormats.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={contentFormats}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={40}
                  dataKey="value"
                  label={({ name, percentage }) => `${name} ${percentage}%`}
                  labelLine={false}
                >
                  {contentFormats.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500 bg-gray-50 rounded-xl">
              <div className="text-center">
                <BarChart3 size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="font-medium text-gray-900">Loading content formats...</p>
                <p className="text-sm mt-1 text-gray-600">Analyzing your content types</p>
              </div>
            </div>
          )}
        </Card>
        </div>
      )}

      {/* Second Row of Charts */}
      {metadata.hasRecentActivity && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Engagement Analysis */}
        <Card variant="glass" className="p-8 bg-gradient-to-br from-white to-pink-50 border-2 border-pink-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl">
                <Heart size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Top Performing Posts</h3>
                <p className="text-sm text-gray-600">Posts with highest engagement</p>
              </div>
            </div>
          </div>
          {engagementAnalysis.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={engagementAnalysis}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="content" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                  }} 
                />
                <Bar dataKey="likes" stackId="a" fill="#EF4444" name="Likes" radius={[0, 0, 4, 4]} />
                <Bar dataKey="comments" stackId="a" fill="#8B5CF6" name="Comments" radius={[0, 0, 0, 0]} />
                <Bar dataKey="shares" stackId="a" fill="#10B981" name="Shares" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500 bg-gray-50 rounded-xl">
              <div className="text-center">
                <Heart size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="font-medium">No engagement data available</p>
                <p className="text-sm mt-1">Start posting to see engagement metrics</p>
              </div>
            </div>
          )}
        </Card>

        {/* Top Hashtags Chart */}
        <Card variant="glass" className="p-8 bg-gradient-to-br from-white to-orange-50 border-2 border-orange-100 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl">
                <FileText size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Top Hashtags</h3>
                <p className="text-sm text-gray-600">Most used hashtags in your content</p>
              </div>
            </div>
          </div>
          {hashtagTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={hashtagTrends} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" />
                <YAxis dataKey="hashtag" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                  }} 
                />
                <Bar dataKey="count" fill="url(#colorHashtags)" radius={[0, 8, 8, 0]} />
                <defs>
                  <linearGradient id="colorHashtags" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500 bg-gray-50 rounded-xl">
              <div className="text-center">
                <BarChart3 size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="font-medium">No hashtags found in your posts</p>
                <p className="text-sm mt-1">Start using hashtags to increase visibility</p>
              </div>
            </div>
          )}
        </Card>
        </div>
      )}


      {/* Audience Distribution */}
      {metadata.hasRecentActivity && audienceInsights.totalConnections > 0 && (
        <Card variant="glass" className="p-8 bg-gradient-to-br from-white to-gray-50 border-2 border-gray-100">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-3 bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl">
              <Users size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Audience Analysis</h3>
              <p className="text-gray-600">Understanding your network composition</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Top Industries List */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-gray-900">Top Industries</h4>
              </div>
              {audienceInsights.industries.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {audienceInsights.industries.slice(0, 10).map((industry, index) => (
                    <div key={industry.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="font-medium text-gray-900">{industry.name || 'Unknown'}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{industry.value || 0}</div>
                        <div className="text-xs text-gray-500">{industry.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Users size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No industry data available</p>
                  </div>
                </div>
              )}
            </div>

            {/* Top Positions List */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-gray-900">Top Positions</h4>
              </div>
              {audienceInsights.positions.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {audienceInsights.positions.slice(0, 10).map((position, index) => (
                    <div key={position.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: COLORS[(index + 3) % COLORS.length] }}></div>
                        <span className="font-medium text-gray-900 text-sm">{position.name || 'Unknown'}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{position.value || 0}</div>
                        <div className="text-xs text-gray-500">{position.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Users size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No position data available</p>
                  </div>
                </div>
              )}
            </div>

            {/* Location Distribution */}
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-gray-900">Locations</h4>
              </div>
              {audienceInsights.locations.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={audienceInsights.locations.slice(0, 8)} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }} 
                  />
                  <Bar dataKey="value" fill="#ffc658" radius={[0, 4, 4, 0]} />
                </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-72 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Users size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No location data</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Performance Insights */}
      {metadata.hasRecentActivity && performanceMetrics && (
        <Card variant="glass" className="p-8 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl">
              <TrendingUp size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Performance Insights</h3>
              <p className="text-gray-600">Key metrics and optimization opportunities</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-2">Total Engagement</h4>
              <div className="text-3xl font-bold text-indigo-600">{performanceMetrics.totalEngagement || 0}</div>
              <p className="text-sm text-gray-600 mt-1">Across all posts</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-2">Avg per Post</h4>
              <div className="text-3xl font-bold text-green-600">{performanceMetrics.avgEngagementPerPost || 0}</div>
              <p className="text-sm text-gray-600 mt-1">Likes + Comments</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-2">Posting Frequency</h4>
              <div className="text-3xl font-bold text-purple-600">{timeBasedInsights.postingFrequency || 0}</div>
              <p className="text-sm text-gray-600 mt-1">Posts per week</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-2">Best Format</h4>
              <div className="text-lg font-bold text-orange-600">{contentFormats[0]?.name || 'TEXT'}</div>
              <p className="text-sm text-gray-600 mt-1">{contentFormats[0]?.percentage || 0}% of posts</p>
            </div>
          </div>
        </Card>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Card variant="glass" className="p-6 w-96 max-w-[90vw] bg-white border-2 border-gray-200">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Share Analytics Report</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </Button>
              </div>
              
              {/* Share Options */}
              <div className="space-y-3 mb-6">
                {/* Generate & Download PDF */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    await generatePDFReport();
                    setShowShareModal(false);
                  }}
                  disabled={isGeneratingPDF}
                  className="w-full flex items-center p-4 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 rounded-xl transition-all border border-gray-200 hover:border-red-200"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mr-4">
                    <FileDown size={20} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Download PDF Report</div>
                    <div className="text-sm text-gray-600">Generate and save report locally</div>
                  </div>
                </motion.button>
                
                {/* Copy Link */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      setShowShareModal(false);
                      // Success notification - you can enhance this later
                      alert('Link copied to clipboard!');
                    } catch (error) {
                      console.error('Failed to copy link');
                      alert('Failed to copy link');
                    }
                  }}
                  className="w-full flex items-center p-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 rounded-xl transition-all border border-gray-200 hover:border-blue-200"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mr-4">
                    <Link size={20} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Copy Link</div>
                    <div className="text-sm text-gray-600">Share URL to this analytics page</div>
                  </div>
                </motion.button>
                
                {/* Email Share */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const subject = 'LinkedIn Analytics Report';
                    const body = `Check out my LinkedIn analytics: ${window.location.href}`;
                    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                    setShowShareModal(false);
                  }}
                  className="w-full flex items-center p-4 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 rounded-xl transition-all border border-gray-200 hover:border-green-200"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-4">
                    <Mail size={20} className="text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Email</div>
                    <div className="text-sm text-gray-600">Share via email</div>
                  </div>
                </motion.button>
              </div>
              
              {/* Copy URL Input */}
              <Card variant="glass" className="p-3 bg-gray-50 border border-gray-200">
                <div className="flex items-center space-x-2">
                  <input 
                    type="text" 
                    value={window.location.href}
                    readOnly
                    className="flex-1 bg-transparent text-sm text-gray-600 outline-none"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(window.location.href);
                        alert('Link copied!');
                      } catch (error) {
                        alert('Failed to copy');
                      }
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </Card>
            </Card>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

const EmptyActivityState = ({ dashboardData, onRefetch, isRefetching, setCurrentModule }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-gray-600 mt-1">No recent activity (28 days). Showing snapshot totals.</p>
        </div>
        <Button
          variant="outline"
          onClick={onRefetch}
          disabled={isRefetching}
        >
          <RefreshCw size={14} className={`mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
          {isRefetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Card variant="glass" className="p-12 text-center bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
        <div className="max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText size={32} className="text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">No Recent LinkedIn Activity</h3>
          <p className="text-gray-700 mb-8 leading-relaxed">
            We haven't detected any posts, comments, or network activity in the last 28 days. 
            Your dashboard will show meaningful insights once you start engaging on LinkedIn.
          </p>
          
          {/* Show baseline metrics if available */}
          {dashboardData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white p-4 rounded-xl border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{dashboardData.summary?.totalConnections || 0}</div>
                <div className="text-sm text-gray-600">Total Connections</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{dashboardData.scores?.profileCompleteness || 0}/10</div>
                <div className="text-sm text-gray-600">Profile Completeness</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{dashboardData.scores?.professionalBrand || 0}/10</div>
                <div className="text-sm text-gray-600">Professional Brand</div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900">Get Started with LinkedIn Growth</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="primary"
                onClick={() => window.open('https://linkedin.com', '_blank')}
                className="flex items-center justify-center space-x-2"
              >
                <ExternalLink size={16} />
                <span>Post on LinkedIn</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentModule('postgen')}
                className="flex items-center justify-center space-x-2"
              >
                <Zap size={16} />
                <span>Generate Content</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};