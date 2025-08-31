// src/services/postpulse-processor.ts
// Enhanced with all-time posts support

import { PostData } from '../types/linkedin';

export interface PostPulseFilters {
  postType: 'all' | 'text' | 'image' | 'video';
  sortBy: 'oldest' | 'recent' | 'likes' | 'comments' | 'views';
  searchQuery?: string;
  showAllTime?: boolean; // New flag for all-time posts
}

export interface PostPulseData {
  posts: PostData[];
  isCached: boolean;
  timestamp: string;
  totalCount?: number;
  isAllTime?: boolean;
  dateRange?: {
    newest: string;
    oldest: string;
    spanDays: number;
  };
}

// Cache configuration
const CACHE_KEY_PREFIX = 'postpulse_cache_';
const ALL_TIME_CACHE_KEY_PREFIX = 'postpulse_alltime_cache_';
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
const MAX_CACHE_SIZE = 10 * 1024 * 1024; // 10MB

// Get user ID for cache key
const getUserIdFromToken = (token: string): string => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || 'unknown';
  } catch {
    return 'fallback_user';
  }
};

// Enhanced cache management
const setCachedPostPulseData = (userId: string, posts: PostData[], isAllTime = false): void => {
  try {
    const cacheKey = (isAllTime ? ALL_TIME_CACHE_KEY_PREFIX : CACHE_KEY_PREFIX) + userId;
    
    // Calculate date range
    let dateRange = null;
    const postsWithDates = posts.filter(p => p.createdAt > 0);
    if (postsWithDates.length > 0) {
      const timestamps = postsWithDates.map(p => p.createdAt);
      const newest = Math.max(...timestamps);
      const oldest = Math.min(...timestamps);
      dateRange = {
        newest: new Date(newest).toISOString(),
        oldest: new Date(oldest).toISOString(),
        spanDays: Math.round((newest - oldest) / (1000 * 60 * 60 * 24))
      };
    }
    
    const cacheData = {
      timestamp: Date.now(),
      lastFetch: new Date().toISOString(),
      posts: posts,
      version: '2.0',
      totalCount: posts.length,
      isAllTime: isAllTime,
      dateRange: dateRange
    };

    const serialized = JSON.stringify(cacheData);
    
    // Check size before caching
    if (serialized.length > MAX_CACHE_SIZE) {
      console.warn(`Cache data too large (${Math.round(serialized.length / 1024 / 1024)}MB), skipping cache`);
      return;
    }

    localStorage.setItem(cacheKey, serialized);
    console.log(`📦 Cached ${posts.length} ${isAllTime ? 'all-time' : 'recent'} posts (${Math.round(serialized.length / 1024)}KB)`);
  } catch (error) {
    console.error('Error caching PostPulse data:', error);
  }
};

const getCachedPostPulseData = (userId: string, isAllTime = false): PostPulseData | null => {
  try {
    const cacheKey = (isAllTime ? ALL_TIME_CACHE_KEY_PREFIX : CACHE_KEY_PREFIX) + userId;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      console.log(`No ${isAllTime ? 'all-time' : 'recent'} cache found`);
      return null;
    }

    const cacheData = JSON.parse(cached);
    
    // Check cache age
    const age = Date.now() - cacheData.timestamp;
    if (age > CACHE_DURATION) {
      console.log(`${isAllTime ? 'All-time' : 'Recent'} cache expired (${Math.round(age / 60000)}min old), removing`);
      localStorage.removeItem(cacheKey);
      return null;
    }

    console.log(`📦 Using ${isAllTime ? 'all-time' : 'recent'} cache: ${cacheData.posts.length} posts, ${Math.round(age / 60000)}min old`);
    
    return {
      posts: cacheData.posts,
      isCached: true,
      timestamp: cacheData.lastFetch,
      totalCount: cacheData.totalCount,
      isAllTime: cacheData.isAllTime || isAllTime,
      dateRange: cacheData.dateRange
    };
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
};

// Clear cache function
export const clearPostPulseCache = (userId?: string): void => {
  if (userId) {
    localStorage.removeItem(CACHE_KEY_PREFIX + userId);
    localStorage.removeItem(ALL_TIME_CACHE_KEY_PREFIX + userId);
    console.log('Cleared PostPulse cache for user:', userId);
  } else {
    // Clear all PostPulse caches
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(CACHE_KEY_PREFIX) || key.startsWith(ALL_TIME_CACHE_KEY_PREFIX))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('Cleared all PostPulse caches');
  }
};

// Extract posts from changelog API
const extractChangelogPosts = (changelogData: any): PostData[] => {
  console.log('extractChangelogPosts: Processing changelog data...');
  
  const posts: PostData[] = [];
  const elements = changelogData?.elements || [];

  elements.forEach((event: any, index: number) => {
    if (event.resourceName === 'ugcPosts' && event.method === 'CREATE' && event.activity) {
      try {
        const activity = event.activity;
        const content = activity.specificContent?.['com.linkedin.ugc.ShareContent'];
        
        if (content) {
          const postId = event.resourceId || `changelog_${index}`;
          const createdAt = event.capturedAt || event.processedAt || Date.now();
          const commentary = content.shareCommentary?.text || '';
          
          posts.push({
            id: postId,
            content: commentary,
            createdAt: createdAt,
            likes: 0, // Will be filled from engagement data
            comments: 0,
            reposts: 0,
            url: `https://linkedin.com/feed/activity/${postId}`,
            author: 'You'
          });
        }
      } catch (error) {
        console.warn(`Error processing changelog event ${index}:`, error);
      }
    }
  });

  console.log(`extractChangelogPosts: Extracted ${posts.length} posts from changelog`);
  return posts;
};

// Extract posts from snapshot API (all-time or recent)
const extractSnapshotPosts = (snapshotData: any): PostData[] => {
  console.log('extractSnapshotPosts: Processing snapshot data...');
  
  const posts: PostData[] = [];
  const shareInfo = snapshotData || [];

  shareInfo.forEach((item: any, index: number) => {
    try {
      // Handle multiple field name variations
      const url = item['Share URL'] || item['share_url'] || item.shareUrl || 
                 item['URL'] || item.url;
      const date = item['Share Date'] || item['share_date'] || item.shareDate || 
                  item['Date'] || item.date;
      const content = item['Share Commentary'] || item['share_commentary'] || 
                     item.shareCommentary || item['Commentary'] || item.commentary || '';
      const visibility = item['Visibility'] || item.visibility || 'PUBLIC';

      if (url && content) {
        // Extract post ID from URL
        let postId = `snapshot_${index}`;
        const activityMatch = url.match(/activity[:-](\d+)/);
        const ugcMatch = url.match(/ugcPost[:-](\d+)/);
        if (activityMatch) postId = activityMatch[1];
        else if (ugcMatch) postId = ugcMatch[1];

        // Parse date
        let timestamp = Date.now();
        if (date) {
          try {
            timestamp = new Date(date).getTime();
            if (isNaN(timestamp)) timestamp = Date.now();
          } catch (e) {
            console.warn('Could not parse date:', date);
            timestamp = Date.now();
          }
        }

        posts.push({
          id: postId,
          content: content,
          createdAt: timestamp,
          likes: 0, // Will be filled from engagement data
          comments: 0,
          reposts: 0,
          url: url,
          author: 'You'
        });
      }
    } catch (error) {
      console.warn(`Error processing snapshot item ${index}:`, error);
    }
  });

  console.log(`extractSnapshotPosts: Extracted ${posts.length} posts from snapshot`);
  return posts;
};

// Enhanced main function with all-time support
export const getPostPulseData = async (token: string, showAllTime = false): Promise<PostPulseData> => {
  const user_id = getUserIdFromToken(token);
  
  console.log(`🚀 PostPulse: Starting data fetch, showAllTime=${showAllTime}, user=${user_id}`);

  try {
    // Check cache first
    const cached = getCachedPostPulseData(user_id, showAllTime);
    if (cached) {
      console.log(`✅ Using cached data: ${cached.posts.length} posts`);
      return cached;
    }

    let allPosts: PostData[] = [];

    if (showAllTime) {
      console.log('🔄 Fetching ALL-TIME posts using enhanced pagination...');
      
      // Fetch all-time posts using the enhanced API
      const snapshotResponse = await fetch(
        '/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO&getAllPosts=true&maxPages=50&count=100',
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (snapshotResponse.ok) {
        const snapshotData = await snapshotResponse.json();
        console.log('All-time snapshot response:', {
          success: snapshotData.success,
          allTimeData: snapshotData.allTimeData,
          totalPosts: snapshotData.pagination?.totalPosts,
          dateRange: snapshotData.dateRange,
          hasElements: !!snapshotData.elements
        });

        if (snapshotData.success && snapshotData.elements?.[0]?.snapshotData) {
          const snapshotPosts = extractSnapshotPosts(snapshotData.elements[0].snapshotData);
          console.log(`✅ Extracted ${snapshotPosts.length} all-time posts`);
          allPosts.push(...snapshotPosts);
        }
      } else {
        console.warn('All-time snapshot API failed:', snapshotResponse.status);
        // Fallback to regular snapshot
        const fallbackResponse = await fetch(
          '/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO',
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const fallbackPosts = extractSnapshotPosts(fallbackData.elements?.[0]?.snapshotData || []);
          allPosts.push(...fallbackPosts);
          console.log(`🔄 Used fallback snapshot: ${fallbackPosts.length} posts`);
        }
      }
    } else {
      console.log('🔄 Fetching RECENT posts (90 most recent)...');
      
      // Fetch both changelog and snapshot for recent posts
      const [changelogResponse, snapshotResponse] = await Promise.all([
        fetch('/.netlify/functions/linkedin-changelog?count=100', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Process changelog data
      if (changelogResponse.ok) {
        const changelogData = await changelogResponse.json();
        const changelogPosts = extractChangelogPosts(changelogData);
        allPosts.push(...changelogPosts);
        console.log(`📊 Added ${changelogPosts.length} posts from changelog`);
      }

      // Process snapshot data
      if (snapshotResponse.ok) {
        const snapshotData = await snapshotResponse.json();
        const snapshotPosts = extractSnapshotPosts(snapshotData.elements?.[0]?.snapshotData || []);
        allPosts.push(...snapshotPosts);
        console.log(`📸 Added ${snapshotPosts.length} posts from snapshot`);
      }
    }

    console.log(`📊 Total posts collected: ${allPosts.length}`);

    if (allPosts.length === 0) {
      console.warn('⚠️ No posts found from any source');
      return { 
        posts: [], 
        isCached: false, 
        timestamp: new Date().toISOString(),
        isAllTime: showAllTime
      };
    }

    // Deduplicate posts
    const seenIds = new Set<string>();
    const deduplicatedPosts = allPosts.filter(post => {
      if (seenIds.has(post.id)) return false;
      seenIds.add(post.id);
      return true;
    });

    console.log(`🔄 After deduplication: ${deduplicatedPosts.length} posts`);

    // Sort by date (newest first)
    const sortedPosts = deduplicatedPosts.sort((a, b) => b.createdAt - a.createdAt);
    
    // For recent posts, limit to 90
    const finalPosts = showAllTime ? sortedPosts : sortedPosts.slice(0, 90);
    
    console.log(`✅ Final result: ${finalPosts.length} ${showAllTime ? 'all-time' : 'recent'} posts`);
    
    if (finalPosts.length > 0) {
      const newest = new Date(finalPosts[0].createdAt);
      const oldest = new Date(finalPosts[finalPosts.length - 1].createdAt);
      console.log(`📅 Date range: ${oldest.toLocaleDateString()} - ${newest.toLocaleDateString()}`);
    }

    // Cache the results
    setCachedPostPulseData(user_id, finalPosts, showAllTime);

    return { 
      posts: finalPosts, 
      isCached: false, 
      timestamp: new Date().toISOString(),
      totalCount: finalPosts.length,
      isAllTime: showAllTime
    };

  } catch (error) {
    console.error('❌ Error in getPostPulseData:', error);
    throw error;
  }
};

// Enhanced processing with all-time support
export const processPostPulseData = (posts: PostData[], filters: PostPulseFilters): PostData[] => {
  let filtered = [...posts];

  // Apply filters
  if (filters.postType !== 'all') {
    filtered = filtered.filter(post => {
      const content = post.content.toLowerCase();
      switch (filters.postType) {
        case 'text':
          return !content.includes('http') && !content.includes('image') && !content.includes('video');
        case 'image':
          return content.includes('image') || content.includes('photo') || content.includes('pic');
        case 'video':
          return content.includes('video') || content.includes('watch');
        default:
          return true;
      }
    });
  }

  // Apply search filter
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(post => 
      post.content.toLowerCase().includes(query)
    );
  }

  // Apply sorting
  filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case 'oldest':
        return a.createdAt - b.createdAt;
      case 'recent':
        return b.createdAt - a.createdAt;
      case 'likes':
        return b.likes - a.likes;
      case 'comments':
        return b.comments - a.comments;
      case 'views':
        return (b.likes + b.comments + b.reposts) - (a.likes + a.comments + a.reposts);
      default:
        return b.createdAt - a.createdAt;
    }
  });

  return filtered;
};

// Repurpose status and utilities (required by PostCard)
export interface RepurposeStatus {
  canRepurpose: boolean;
  daysOld: number;
  reason?: string;
}

export const getRepurposeStatus = (post: PostData): RepurposeStatus => {
  const now = Date.now();
  const postDate = post.createdAt;
  const daysOld = Math.floor((now - postDate) / (1000 * 60 * 60 * 24));
  
  // LinkedIn's general guideline is 30+ days for reposting
  const canRepurpose = daysOld >= 30;
  
  return {
    canRepurpose,
    daysOld,
    reason: canRepurpose ? 
      `Posted ${daysOld} days ago - safe to repurpose` : 
      `Posted ${daysOld} days ago - wait ${30 - daysOld} more days`
  };
};

export const repurposePost = (post: PostData): void => {
  // Navigate to PostGen with the post content
  const params = new URLSearchParams();
  params.set('mode', 'rewrite');
  params.set('content', post.content);
  params.set('originalUrl', post.url);
  params.set('originalDate', new Date(post.createdAt).toISOString());
  
  // Use hash routing for SPA navigation
  window.location.hash = `postgen?${params.toString()}`;
  
  console.log('Navigating to PostGen for repurposing:', {
    postId: post.id,
    content: post.content.substring(0, 100) + '...',
    originalUrl: post.url
  });
};