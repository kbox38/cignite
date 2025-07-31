import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

export interface ProfileScore {
  profileCompleteness: number | null;
  postingActivity: number;
  engagementQuality: number;
  networkGrowth: number;
  audienceRelevance: number | null;
  contentDiversity: number;
  engagementRate: number;
  mutualInteractions: number;
  profileVisibility: number | null;
  professionalBrand: number | null;
}

export interface SummaryKPIs {
  totalConnections: number;
  postsLast30Days: number;
  engagementRate: string;
  connectionsLast30Days: number;
}

export interface MiniTrend {
  date: string;
  value: number;
}

export interface Methodology {
  [key: string]: {
    formula: string;
    inputs: Record<string, any>;
    note?: string;
  };
}

export interface DashboardData {
  scores: {
    overall: number;
  } & ProfileScore;
  summary: {
    totalConnections: number;
    posts30d: number;
    engagementRatePct: number;
    newConnections28d: number;
  };
  trends: {
    weeklyPosts: Record<string, number>;
    weeklyEngagements: Record<string, number>;
  };
  content: {
    types: Record<string, number>;
  };
  methodology: Methodology;
  metadata: {
    fetchTimeMs: number;
    processingTimeMs: number;
    totalTimeMs: number;
    dataSource: string;
    hasRecentActivity: boolean;
    personPostsCount: number;
    totalPostsCount: number;
    filteredEngagements: {
      likes: number;
      comments: number;
      total: number;
    };
  };
  lastUpdated: string;
  error?: string;
  needsReconnect?: boolean;
}

export const useDashboardData = () => {
  const { dmaToken } = useAuthStore();
  
  return useQuery({
    queryKey: ['dashboard-data'],
    queryFn: async (): Promise<DashboardData> => {
      if (!dmaToken) {
        throw new Error('DMA token is required for dashboard data');
      }
      
      const response = await fetch('/api/dashboard-data', {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dashboard API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || data.error);
      }
      
      return data;
    },
    enabled: !!dmaToken,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};