// src/services/postpulse-processor.ts
import { useAuthStore } from '../stores/authStore';
import { PostData } from '../types/linkedin';

interface PostPulseFilters {
  timeFilter: string;
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

// Main data fetching function
export const getPostPulseData = async (forceRefresh = false) => {
  // FIX: Properly import and use auth store
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

  console.log('getPostPulseData: Fetching fresh data from LinkedIn API');
  
  try {
    // Fetch ALL posts from LinkedIn Snapshot API
    const response = await fetch(`/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO&count=1000`, {
      headers: {
        'Authorization': `Bearer ${dmaToken}`,
        'LinkedIn-Version': '202312',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('getPostPulseData: API error response:', errorText);
      throw new Error(`Failed to fetch LinkedIn posts: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('getPostPulseData: Raw API response:', {
      hasElements: !!data.elements,
      elementsLength: data.elements?.length,
      hasSnapshotData: !!data.elements?.[0]?.snapshotData,
      snapshotDataLength: data.elements?.[0]?.snapshotData?.length,
    });

    // Extract posts from the API response
    const rawPosts = data.elements?.[0]?.snapshotData || [];
    console.log(`getPostPulseData: Extracted ${rawPosts.length} raw posts from API`);

    if (rawPosts.length === 0) {
      console.warn('getPostPulseData: No posts found in API response');
      return { posts: [], isCached: false, timestamp: new Date().toISOString() };
    }

    // Process and normalize the posts data
    const processedPosts = rawPosts
      .map((post: any) => ({
        id: post.id || post.post_urn || `post_${Date.now()}_${Math.random()}`,
        content: post.content || post.text || post.commentary || '',
        createdAt: post.created_at || post.published_at || post.createdAt || Date.now(),
        likes: parseInt(post.likes_count || post.likes || '0', 10),
        comments: parseInt(post.comments_count || post.comments || '0', 10),
        shares: parseInt(post.shares_count || post.shares || '0', 10),
        views: parseInt(post.impressions || post.views || '0', 10),
        media_url: post.media_url || post.mediaUrl || null,
        media_type: post.media_type || post.mediaType || null,
        visibility: post.visibility || 'PUBLIC',
        hashtags: post.hashtags || [],
        mentions: post.mentions || [],
        post_url: post.post_url || post.postUrl || null,
        timestamp: post.created_at || post.published_at || post.createdAt || Date.now(),
      }))
      .filter((post: PostData) => {
        // Filter out invalid posts
        const hasValidId = !!post.id;
        const hasValidDate = !isNaN(new Date(post.createdAt).getTime());
        const hasContent = !!(post.content && post.content.trim().length > 0);
        
        return hasValidId && hasValidDate && hasContent;
      });

    console.log(`getPostPulseData: Processed ${processedPosts.length} valid posts`);

    // FIX: Sort all posts by date (newest first) and take the 90 most recent
    const sortedPosts = processedPosts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Take only the 90 most recent posts
    const recentPosts = sortedPosts.slice(0, 90);
    
    console.log(`getPostPulseData: Selected ${recentPosts.length} most recent posts`);
    
    if (recentPosts.length > 0) {
      console.log('getPostPulseData: Date range of selected posts:', {
        newest: new Date(recentPosts[0].createdAt).toLocaleDateString(),
        oldest: new Date(recentPosts[recentPosts.length - 1].createdAt).toLocaleDateString(),
        newestDaysAgo: Math.floor((Date.now() - recentPosts[0].createdAt) / (1000 * 60 * 60 * 24)),
        oldestDaysAgo: Math.floor((Date.now() - recentPosts[recentPosts.length - 1].createdAt) / (1000 * 60 * 60 * 24))
      });
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

// FIX: Updated processing function to handle the 90 most recent posts
export const processPostPulseData = (posts: PostData[], filters: PostPulseFilters): PostData[] => {
  console.log('processPostPulseData: Starting with', posts.length, 'posts');
  
  if (!Array.isArray(posts) || posts.length === 0) {
    console.log('processPostPulseData: No posts to process');
    return [];
  }

  // FIX: Since we already have the 90 most recent posts, just apply additional filters
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

  // FIX: Sort the final results - default to oldest first as requested
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
  
  if (filteredPosts.length > 0) {
    console.log('processPostPulseData: Sample of final posts:', filteredPosts.slice(0, 3).map(post => ({
      date: new Date(post.createdAt).toLocaleDateString(),
      daysOld: Math.floor((Date.now() - post.createdAt) / (1000 * 60 * 60 * 24)),
      hasContent: !!post.content,
      likes: post.likes || 0,
      comments: post.comments || 0
    })));
  }
  
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