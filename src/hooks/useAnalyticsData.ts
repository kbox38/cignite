import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

export interface PostEngagementTrend {
  date: string;
  posts: number;
  likes: number;
  comments: number;
  totalEngagement: number;
}

export interface ConnectionGrowth {
  date: string;
  totalConnections: number;
  newConnections: number;
}

export interface PostType {
  name: string;
  value: number;
}

export interface Hashtag {
  hashtag: string;
  count: number;
}

export interface PostEngagement {
  postId: string;
  content: string;
  likes: number;
  comments: number;
  shares: number;
  totalEngagement: number;
  createdAt: number;
}

export interface MessageData {
  date: string;
  sent: number;
  received: number;
}

export interface AudienceDistribution {
  industries: Array<{ name: string; value: number }>;
  positions: Array<{ name: string; value: number }>;
  locations: Array<{ name: string; value: number }>;
}

export interface ScoreImpact {
  description: string;
  impact: string;
  tips: string[];
}

export interface AnalyticsData {
  postsEngagementsTrend: PostEngagementTrend[];
  connectionsGrowth: ConnectionGrowth[];
  postTypesBreakdown: PostType[];
  topHashtags: Hashtag[];
  engagementPerPost: PostEngagement[];
  messagesSentReceived: MessageData[];
  audienceDistribution: AudienceDistribution;
  scoreImpacts: Record<string, ScoreImpact>;
  timeRange: string;
  lastUpdated: string;
  metadata?: {
    hasRecentActivity: boolean;
    dataSource: string;
    eventCount: number;
    description?: string;
  };
  note?: string;
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
      
      if (data.error && !data.postsEngagementsTrend) {
        throw new Error(data.message || data.error);
      }
      
      // Ensure all required fields exist with safe defaults
      return {
        postsEngagementsTrend: data.postsEngagementsTrend || [],
        connectionsGrowth: data.connectionsGrowth || [],
        postTypesBreakdown: data.postTypesBreakdown || [],
        topHashtags: data.topHashtags || [],
        engagementPerPost: data.engagementPerPost || [],
        messagesSentReceived: data.messagesSentReceived || [],
        audienceDistribution: data.audienceDistribution || {
          industries: [],
          positions: [],
          locations: []
        },
        scoreImpacts: data.scoreImpacts || {},
        timeRange: data.timeRange || timeRange,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        metadata: data.metadata || {
          hasRecentActivity: false,
          dataSource: "unknown",
          eventCount: 0,
          description: ""
        },
        note: data.note,
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