// src/services/postpulse-processor.ts - COMPLETE FIX
import { useAuthStore } from '../stores/authStore';
import { PostData } from '../types/linkedin';

interface PostPulseFilters {
  postType: string;
  sortBy: string;
}

interface CachedData {
  posts: PostData[];
  timestamp: string;
}

// Cache management functions
const getCacheKey = (userId: string) => `postPulseData_${userId}`;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const getCachedPostPulseData = (userId: string): CachedData | null => {
  try {
    const cacheKey = getCacheKey(userId);
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) return null;
    
    const parsed = JSON.parse(cachedData);
    const cacheAge = Date.now() - new Date(parsed.timestamp).getTime();
    
    if (cacheAge > CACHE_DURATION) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Error reading cached data:', error);
    return null;
  }
};

const setCachedPostPulseData = (userId: string, posts: PostData[]): void => {
  try {
    const cacheKey = getCacheKey(userId);
    const dataToCache = {
      posts,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
  } catch (error) {
    console.error('Error caching data:', error);
  }
};

// Extract posts from Changelog API (recent 28 days)
const extractChangelogPosts = (changelogData: any[]): PostData[] => {
  console.log('extractChangelogPosts: Processing changelog data');
  
  return changelogData
    .filter(item => item.resourceName === 'ugcPosts' && item.method === 'CREATE')
    .map(item => {
      const activity = item.activity || {};
      const shareContent = activity.specificContent?.['com.linkedin.ugc.ShareContent'] || {};
      const shareCommentary = shareContent.shareCommentary || {};
      const created = activity.created || {};
      
      // Extract content text
      const content = shareCommentary.text || shareCommentary.inferredText || '';
      
      // Extract media information
      const media = shareContent.media?.[0];
      const mediaCategory = shareContent.shareMediaCategory || 'NONE';
      
      // Extract hashtags
      const hashtags = shareContent.shareFeatures?.hashtags || [];
      
      return {
        id: item.resourceId || activity.id || `changelog_${item.id}`,
        content: content,
        createdAt: created.time || item.capturedAt || Date.now(),
        likes: 0, // Engagement data comes from separate API calls
        comments: 0,
        shares: 0,
        views: 0,
        media_url: null, // Media URL would need separate resolution
        media_type: mediaCategory === 'NONE' ? null : mediaCategory,
        visibility: activity.visibility?.['com.linkedin.ugc.MemberNetworkVisibility'] || 'PUBLIC',
        hashtags: hashtags.map((ht: any) => ht.replace('urn:li:hashtag:', '')),
        mentions: [],
        post_url: null,
        timestamp: created.time || item.capturedAt || Date.now(),
      };
    })
    .filter(post => post.content && post.content.trim().length > 0);
};

// Extract posts from Snapshot API (historical data)
const extractSnapshotPosts = (snapshotData: any[]): PostData[] => {
  console.log('extractSnapshotPosts: Processing snapshot data');
  
  // The exact structure depends on what's actually in MEMBER_SHARE_INFO
  // We need to handle various possible field names based on the actual data
  return snapshotData
    .map((item: any) => {
      // Try different possible field names for content
      const content = item.content || item.text || item.commentary || 
                     item.shareCommentary || item.post_content || 
                     item.message || item.description || '';
      
      // Try different possible field names for dates
      const createdAt = item.created_at || item.published_at || 
                       item.createdAt || item.created || 
                       item.timestamp || item.date || Date.now();
      
      // Try different field names for ID
      const id = item.id || item.post_id || item.urn || item.post_urn || 
                `snapshot_${Date.now()}_${Math.random()}`;
      
      return {
        id: id,
        content: String(content).trim(),
        createdAt: typeof createdAt === 'number' ? createdAt : new Date(createdAt).getTime(),
        likes: parseInt(String(item.likes_count || item.likes || 0), 10),
        comments: parseInt(String(item.comments_count || item.comments || 0), 10),
        shares: parseInt(String(item.shares_count || item.shares || 0), 10),
        views: parseInt(String(item.impressions || item.views || 0), 10),
        media_url: item.media_url || item.mediaUrl || null,
        media_type: item.media_type || item.mediaType || null,
        visibility: item.visibility || 'PUBLIC',
        hashtags: item.hashtags || [],
        mentions: item.mentions || [],
        post_url: item.post_url || item.postUrl || null,
        timestamp: typeof createdAt === 'number' ? createdAt : new Date(createdAt).getTime(),
      };
    })
    .filter((post: PostData) => {
      // Validate the post has essential data
      const hasValidId = !!post.id;
      const hasValidDate = !isNaN(new Date(post.createdAt).getTime()) && post.createdAt > 0;
      const hasContent = post.content && post.content.length > 0;
      
      return hasValidId && hasValidDate && hasContent;
    });
};

// Main data fetching function - FIXED
export const getPostPulseData = async (forceRefresh = false) => {
  const { dmaToken, profile } = useAuthStore.getState();
  
  console.log('getPostPulseData: Starting with auth check:', {
    hasDmaToken: !!dmaToken,
    hasProfile: !!profile,
    profileSub: profile?.sub
  });
  
  if (!dmaToken) {
    throw new Error("LinkedIn DMA token not found. Please reconnect your account.");
  }
  
  if (!profile?.sub) {
    throw new Error("User profile not found. Please reconnect your account.");
  }
  
  const user_id = profile.sub;

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cachedData = getCachedPostPulseData(user_id);
    if (cachedData) {
      console.log('getPostPulseData: Serving from cache:', cachedData.posts.length, 'posts');
      return { 
        posts: cachedData.posts, 
        isCached: true, 
        timestamp: cachedData.timestamp 
      };
    }
  }

  console.log('getPostPulseData: Fetching fresh data from LinkedIn APIs');
  
  try {
    const allPosts: PostData[] = [];
    
    // 1. Fetch recent posts from Changelog API (past 28 days)
    console.log('getPostPulseData: Fetching from Changelog API...');
    try {
      const changelogResponse = await fetch(`/.netlify/functions/linkedin-changelog?count=50`, {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'LinkedIn-Version': '202312',
        },
      });

      if (changelogResponse.ok) {
        const changelogData = await changelogResponse.json();
        console.log('getPostPulseData: Changelog API response:', {
          hasElements: !!changelogData.elements,
          elementsLength: changelogData.elements?.length,
        });

        if (changelogData.elements?.length > 0) {
          const changelogPosts = extractChangelogPosts(changelogData.elements);
          console.log(`getPostPulseData: Extracted ${changelogPosts.length} posts from Changelog API`);
          allPosts.push(...changelogPosts);
        }
      } else {
        console.warn('getPostPulseData: Changelog API failed:', changelogResponse.status);
      }
    } catch (changelogError) {
      console.error('getPostPulseData: Changelog API error:', changelogError);
      // Continue to snapshot API even if changelog fails
    }

    // 2. Fetch historical posts from Snapshot API
    console.log('getPostPulseData: Fetching from Snapshot API...');
    try {
      const snapshotResponse = await fetch(`/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO&count=500`, {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'LinkedIn-Version': '202312',
        },
      });

      if (snapshotResponse.ok) {
        const snapshotData = await snapshotResponse.json();
        console.log('getPostPulseData: Snapshot API response:', {
          hasElements: !!snapshotData.elements,
          elementsLength: snapshotData.elements?.length,
          hasSnapshotData: !!snapshotData.elements?.[0]?.snapshotData,
          snapshotDataLength: snapshotData.elements?.[0]?.snapshotData?.length,
        });

        const rawPosts = snapshotData.elements?.[0]?.snapshotData || [];
        if (rawPosts.length > 0) {
          const snapshotPosts = extractSnapshotPosts(rawPosts);
          console.log(`getPostPulseData: Extracted ${snapshotPosts.length} posts from Snapshot API`);
          allPosts.push(...snapshotPosts);
        }
      } else {
        console.warn('getPostPulseData: Snapshot API failed:', snapshotResponse.status);
      }
    } catch (snapshotError) {
      console.error('getPostPulseData: Snapshot API error:', snapshotError);
    }

    console.log(`getPostPulseData: Total posts collected: ${allPosts.length}`);

    if (allPosts.length === 0) {
      console.warn('getPostPulseData: No posts found from either API');
      return { posts: [], isCached: false, timestamp: new Date().toISOString() };
    }

    // 3. Deduplicate posts (same post might appear in both APIs)
    const seenIds = new Set<string>();
    const deduplicatedPosts = allPosts.filter(post => {
      if (seenIds.has(post.id)) {
        return false;
      }
      seenIds.add(post.id);
      return true;
    });

    console.log(`getPostPulseData: After deduplication: ${deduplicatedPosts.length} posts`);

    // 4. Sort by date (newest first) and take the 90 most recent
    const sortedPosts = deduplicatedPosts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    const recentPosts = sortedPosts.slice(0, 90);
    
    console.log(`getPostPulseData: Selected ${recentPosts.length} most recent posts`);
    
    if (recentPosts.length > 0) {
      console.log('getPostPulseData: Date range of selected posts:', {
        newest: new Date(recentPosts[0].createdAt).toLocaleDateString(),
        oldest: new Date(recentPosts[recentPosts.length - 1].createdAt).toLocaleDateString(),
        newestDaysAgo: Math.floor((Date.now() - recentPosts[0].createdAt) / (1000 * 60 * 60 * 24)),
        oldestDaysAgo: Math.floor((Date.now() - recentPosts[recentPosts.length - 1].createdAt) / (1000 * 60 * 60 * 24))
      });
      
      // Debug: Show sample of posts
      console.log('getPostPulseData: Sample posts:', recentPosts.slice(0, 3).map(post => ({
        id: post.id.substring(0, 30),
        date: new Date(post.createdAt).toLocaleDateString(),
        content: post.content.substring(0, 100) + '...',
        source: post.id.startsWith('changelog_') ? 'changelog' : 'snapshot'
      })));
    }

    // Cache the results
    setCachedPostPulseData(user_id, recentPosts);

    return { 
      posts: recentPosts, 
      isCached: false, 
      timestamp: new Date().toISOString() 
    };

  } catch (error) {
    console.error('getPostPulseData: Error fetching data:', error);
    throw error;
  }
};

// Processing function (same as before but simplified)
export const processPostPulseData = (posts: PostData[], filters: PostPulseFilters): PostData[] => {
  console.log('processPostPulseData: Starting with', posts.length, 'posts');
  
  if (!Array.isArray(posts) || posts.length === 0) {
    console.log('processPostPulseData: No posts to process');
    return [];
  }

  let filteredPosts = [...posts];

  // Apply post type filter
  if (filters.postType && filters.postType !== 'all') {
    const initialCount = filteredPosts.length;
    
    if (filters.postType === 'text') {
      filteredPosts = filteredPosts.filter(post => !post.media_url && !post.media_type);
    } else if (filters.postType === 'image') {
      filteredPosts = filteredPosts.filter(post => 
        post.media_type === 'IMAGE' || post.media_url?.includes('image')
      );
    } else if (filters.postType === 'video') {
      filteredPosts = filteredPosts.filter(post => 
        post.media_type === 'VIDEO' || post.media_url?.includes('video')
      );
    }
    
    console.log(`processPostPulseData: Post type filter (${filters.postType}): ${initialCount} → ${filteredPosts.length} posts`);
  }

  // Sort the final results
  try {
    filteredPosts.sort((a, b) => {
      const aCreatedAt = new Date(a.createdAt || 0).getTime();
      const bCreatedAt = new Date(b.createdAt || 0).getTime();
      const aLikes = parseInt(String(a.likes || 0), 10) || 0;
      const bLikes = parseInt(String(b.likes || 0), 10) || 0;
      const aComments = parseInt(String(a.comments || 0), 10) || 0;
      const bComments = parseInt(String(b.comments || 0), 10) || 0;
      const aViews = parseInt(String(a.views || 0), 10) || 0;
      const bViews = parseInt(String(b.views || 0), 10) || 0;

      switch (filters.sortBy) {
        case 'recent':
          return bCreatedAt - aCreatedAt; // Newest first
        case 'oldest':
          return aCreatedAt - bCreatedAt; // Oldest first (DEFAULT)
        case 'likes':
          return bLikes - aLikes; // Most likes first
        case 'comments':
          return bComments - aComments; // Most comments first
        case 'views':
          return bViews - aViews; // Most views first
        default:
          return aCreatedAt - bCreatedAt; // Default to oldest first
      }
    });
  } catch (sortError) {
    console.error('processPostPulseData: Error sorting posts:', sortError);
  }

  console.log(`processPostPulseData: Final result - ${filteredPosts.length} posts`);
  
  return filteredPosts;
};

// Helper functions for repurposing
export const getRepurposeStatus = (postDate: number) => {
  const daysDiff = Math.floor((Date.now() - postDate) / (1000 * 60 * 60 * 24));
  
  if (daysDiff < 30) {
    return { status: 'too-soon', label: 'Too Soon', color: 'bg-red-100 text-red-800' };
  } else if (daysDiff >= 30 && daysDiff <= 35) {
    return { status: 'close', label: 'Close', color: 'bg-yellow-100 text-yellow-800' };
  } else {
    return { status: 'ready', label: 'Ready to Repurpose', color: 'bg-green-100 text-green-800' };
  }
};

export const repurposePost = (post: PostData) => {
  const repurposeData = {
    text: post.content || '',
    originalDate: new Date(post.createdAt).toISOString(),
    engagement: {
      likes: post.likes || 0,
      comments: post.comments || 0,
      shares: post.shares || 0
    },
    media_url: post.media_url,
  };
  
  // Store in session storage for PostGen to pick up
  sessionStorage.setItem('REPURPOSE_POST', JSON.stringify(repurposeData));
  
  // Navigate to PostGen rewrite section
  window.location.href = '/postgen?tab=rewrite';
};