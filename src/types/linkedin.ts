export interface LinkedInProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
  locale: string;
}

export interface ChangelogEvent {
  id: number;
  capturedAt: number;
  processedAt: number;
  owner: string;
  actor: string;
  resourceName: string;
  resourceId: string;
  method: 'CREATE' | 'UPDATE' | 'DELETE';
  activity: any;
  processedActivity: any;
}

export interface ChangelogResponse {
  elements: ChangelogEvent[];
  paging: {
    start: number;
    count: number;
    total?: number;
    links?: Array<{
      rel: string;
      href: string;
    }>;
  };
}

export interface SnapshotData {
  elements: Array<{
    snapshotDomain: string;
    snapshotData: any[];
  }>;
  paging: {
    start: number;
    count: number;
    links?: Array<{
      rel: string;
      href: string;
    }>;
  };
}

export interface PostData {
  id: string;
  text: string;
  content?: string; // FIX: Add content field for compatibility
  media?: any[];
  media_url?: string; // FIX: Add media_url for PostPulse
  document_url?: string; // FIX: Add document_url for PostPulse
  timestamp: number;
  createdAt?: number; // FIX: Add createdAt for compatibility
  likes: number;
  comments: number;
  shares: number;
  impressions?: number;
  views?: number; // FIX: Add views alias
  resourceName?: string;
  linkedin_url?: string; // FIX: Add LinkedIn URL
  source?: 'historical' | 'recent'; // FIX: Add source tracking
}

// FIX: Create alias for backward compatibility
export type PostPulseData = PostData;

export interface EngagementMetrics {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  averageEngagement: number;
  bestPerformingPost?: PostData;
  engagementRate: number;
}

// FIX: Add cache status interface
export interface CacheStatus {
  isCached: boolean;
  timestamp: string | null;
}