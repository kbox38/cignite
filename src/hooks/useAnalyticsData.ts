import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

export interface PostingTrend {
  date: string;
  posts: number;
  likes: number;
  comments: number;
  totalEngagement: number;
}

export interface ContentFormat {
  name: string;
  value: number;
  percentage: number;
}

export interface EngagementAnalysis {
  postId: string;
  content: string;
  likes: number;
  comments: number;
  shares: number;
  totalEngagement: number;
  createdAt: number;
  engagementRate: number;
}

export interface HashtagTrend {
  hashtag: string;
  count: number;
  posts: number;
}

export interface AudienceInsights {
  industries: Array<{ name: string; value: number; percentage: number }>;
  positions: Array<{ name: string; value: number; percentage: number }>;
  locations: Array<{ name: string; value: number; percentage: number }>;
  totalConnections: number;
}

export interface PerformanceMetrics {
  totalEngagement: number;
  avgEngagementPerPost: number;
  bestPerformingPost: {
    content: string;
    engagement: number;
    date: string;
  } | null;
  engagementDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface TimeBasedInsights {
  bestPostingDays: Array<{ day: string; count: number }>;
  bestPostingHours: Array<{ hour: number; count: number }>;
  postingFrequency: number;
}

export interface AnalyticsData {
  postingTrends: PostingTrend[];
  contentFormats: ContentFormat[];
  engagementAnalysis: EngagementAnalysis[];
  hashtagTrends: HashtagTrend[];
  audienceInsights: AudienceInsights;
  performanceMetrics: PerformanceMetrics;
  timeBasedInsights: TimeBasedInsights;
  timeRange: string;
  lastUpdated: string;
  aiNarrative?: string;
  metadata?: {
    hasRecentActivity: boolean;
    dataSource: string;
    postsCount: number;
    totalPostsCount: number;
    connectionsCount: number;
    fetchTimeMs: number;
    description?: string;
  };
  error?: string;
}

export const useAnalyticsData = (timeRange: '7d' | '30d' | '90d' = '30d') => {
  const { dmaToken } = useAuthStore();
  
  return useQuery({
    queryKey: ['analytics-data', timeRange],
    queryFn: async (): Promise<AnalyticsData> => {
      const response = await fetch(`/api/analytics-data?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Failed to fetch analytics data');
      }

      const data = await response.json();
      
      if (data.error && !data.postingTrends) {
        throw new Error(data.message || data.error);
      }
      
      // Ensure all required fields exist with safe defaults
      return {
        postingTrends: data.postingTrends || [],
        contentFormats: data.contentFormats || [],
        engagementAnalysis: data.engagementAnalysis || [],
        hashtagTrends: data.hashtagTrends || [],
        audienceInsights: data.audienceInsights || {
          industries: [],
          positions: [],
          locations: [],
          totalConnections: 0
        },
        performanceMetrics: data.performanceMetrics || {
          totalEngagement: 0,
          avgEngagementPerPost: 0,
          bestPerformingPost: null,
          engagementDistribution: { low: 0, medium: 0, high: 0 }
        },
        timeBasedInsights: data.timeBasedInsights || {
          bestPostingDays: [],
          bestPostingHours: [],
          postingFrequency: 0
        },
        timeRange: data.timeRange || timeRange,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        aiNarrative: data.aiNarrative,
        metadata: data.metadata || {
          hasRecentActivity: false,
          dataSource: "unknown",
          postsCount: 0,
          totalPostsCount: 0,
          connectionsCount: 0,
          fetchTimeMs: 0,
          description: ""
        },
        error: data.error
      };
    },
    enabled: !!dmaToken,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};