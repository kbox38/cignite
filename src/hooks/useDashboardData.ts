import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

export interface MetricAnalysis {
  score: number;
  breakdown?: any;
  recommendations: string[];
  aiInsight?: string;
}

export interface ProfileScore {
  profileCompleteness: number | null;
  postingActivity: number | null;
  engagementQuality: number | null;
  contentImpact: number | null;
  contentDiversity: number | null;
  postingConsistency: number | null;
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
  analysis: {
    profileCompleteness: MetricAnalysis;
    postingActivity: MetricAnalysis;
    engagementQuality: MetricAnalysis;
    contentImpact: MetricAnalysis;
    contentDiversity: MetricAnalysis;
    postingConsistency: MetricAnalysis;
  };
  summary: {
    totalConnections: number;
    totalPosts: number;
    avgEngagementPerPost: number;
    postsPerWeek: number;
  };
  metadata: {
    fetchTimeMs: number;
    dataSource: string;
    hasRecentActivity: boolean;
    profileDataAvailable: boolean;
    postsDataAvailable: boolean;
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
      
      const response = await fetch('/.netlify/functions/dashboard-data-v3', {
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