export interface CachedPostData {
  timestamp: number;
  lastFetch: string;
  posts: ProcessedPost[];
  version: string;
  totalCount: number;
  hasMoreData: boolean;
}

export interface ProcessedPost {
  id: string;
  text: string;
  url: string;
  timestamp: number;
  likes: number;
  comments: number;
  shares: number;
  repurposeGrade: "red" | "blue";
  media?: any;
  thumbnail?: string;
  mediaAssetId?: string | null;
  canRepost: boolean;
  daysSincePosted: number;
  resourceName?: string;
  visibility?: string;
  mediaType?: string;
  source: "historical" | "realtime";
}

const CACHE_KEY = "postpulse_historical_data";
const CACHE_VERSION = "1.0";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export class PostPulseCache {
  static getCache(): CachedPostData | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: CachedPostData = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() - data.timestamp > CACHE_EXPIRY) {
        this.clearCache();
        return null;
      }

      // Check version compatibility
      if (data.version !== CACHE_VERSION) {
        this.clearCache();
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error reading cache:", error);
      this.clearCache();
      return null;
    }
  }

  static setCache(
    posts: ProcessedPost[],
    totalCount: number,
    hasMoreData: boolean
  ): void {
    try {
      const cacheData: CachedPostData = {
        timestamp: Date.now(),
        lastFetch: new Date().toISOString(),
        posts,
        version: CACHE_VERSION,
        totalCount,
        hasMoreData,
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error("Error setting cache:", error);
    }
  }

  static clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }

  static getCacheStatus(): {
    exists: boolean;
    isExpired: boolean;
    lastFetch?: string;
    postCount?: number;
    age?: number;
  } {
    const cached = this.getCache();
    if (!cached) {
      return { exists: false, isExpired: false };
    }

    const age = Date.now() - cached.timestamp;
    const isExpired = age > CACHE_EXPIRY;

    return {
      exists: true,
      isExpired,
      lastFetch: cached.lastFetch,
      postCount: cached.posts.length,
      age,
    };
  }

  static mergeWithRealtimeData(
    historicalPosts: ProcessedPost[],
    realtimePosts: ProcessedPost[]
  ): ProcessedPost[] {
    const merged = [...historicalPosts];
    const existingIds = new Set(historicalPosts.map((p) => p.id));

    realtimePosts.forEach((post) => {
      if (!existingIds.has(post.id)) {
        merged.push(post);
      }
    });

    // Sort by timestamp (newest first) and remove duplicates
    return merged
      .sort((a, b) => b.timestamp - a.timestamp)
      .filter(
        (post, index, self) => index === self.findIndex((p) => p.id === post.id)
      );
  }

  static filterPostsByDateRange(
    posts: ProcessedPost[],
    daysBack: number
  ): ProcessedPost[] {
    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    return posts.filter((post) => post.timestamp >= cutoffTime);
  }
}
