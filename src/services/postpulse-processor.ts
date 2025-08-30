// src/services/postpulse-processor.ts - FINAL WORKING VERSION
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

// FIXED: Extract posts from Snapshot API with correct field names
const extractSnapshotPosts = (snapshotData: any[]): PostData[] => {
  console.log('extractSnapshotPosts: Processing snapshot data with correct field mapping');
  
  return snapshotData
    .map((item: any, index) => {
      // FIX: Use the EXACT field names from the API response
      const content = item.ShareCommentary || item.shareCommentary || item.content || item.text || '';
      const dateString = item.Date || item.date || item.created_at || item.createdAt;
      const shareLink = item.ShareLink || item.shareLink || item.post_url;
      const mediaUrl = item.MediaUrl || item.mediaUrl || item.media_url;
      const sharedUrl = item.SharedUrl || item.sharedUrl;
      const visibility = item.Visibility || item.visibility || 'PUBLIC';
      
      // Parse the date string "2020-04-28 04:18:44" to timestamp
      let createdAt = Date.now();
      if (dateString) {
        try {
          createdAt = new Date(dateString).getTime();
        } catch (dateError) {
          console.warn(`Invalid date format: ${dateString}`);
        }
      }
      
      // Extract ID from ShareLink if available
      let id = `snapshot_${index}_${Date.now()}`;
      if (shareLink && shareLink.includes('urn%3Ali%3A')) {
        const matches = shareLink.match(/urn%3Ali%3A[^%]+%3A(\d+)/);
        if (matches) {
          id = matches[1];
        }
      }
      
      console.log(`extractSnapshotPosts: Item ${index}:`, {
        id: id,
        content: content ? content.substring(0, 50) + '...' : 'NO CONTENT',
        hasContent: !!content,
        contentLength: content ? content.length : 0,
        date: dateString,
        createdAt: createdAt,
        mediaUrl: mediaUrl,
        shareLink: shareLink
      });
      
      const post = {
        id: id,
        content: String(content).trim(),
        createdAt: createdAt,
        likes: 0, // Historical data doesn't include engagement metrics
        comments: 0,
        shares: 0,
        views: 0,
        media_url: mediaUrl || null,
        media_type: mediaUrl ? 'IMAGE' : null,
        visibility: visibility,
        hashtags: [],
        mentions: [],
        post_url: shareLink || null,
        timestamp: createdAt,
      };
      
      return post;
    })
    .filter((post: PostData, index) => {
      const hasValidId = !!post.id;
      const hasValidDate = !isNaN(new Date(post.createdAt).getTime()) && post.createdAt > 0;
      const hasContent = post.content && post.content.trim().length > 0;
      
      console.log(`extractSnapshotPosts: Post ${index} validation:`, {
        hasValidId,
        hasValidDate,
        hasContent,
        contentPreview: post.content.substring(0, 50),
        isValid: hasValidId && hasValidDate && hasContent
      });
      
      return hasValidId && hasValidDate && hasContent;
    });
};

// FIXED: Extract posts from Changelog API - look for actual ugcPosts
const extractChangelogPosts = (changelogData: any[]): PostData[] => {
  console.log('extractChangelogPosts: Processing changelog data');
  
  // Filter for actual post creation events
  const ugcPosts = changelogData.filter(item => 
    item.resourceName === 'ugcPosts' && item.method === 'CREATE'
  );
  
  console.log(`extractChangelogPosts: Found ${ugcPosts.length} ugcPost CREATE events out of ${changelogData.length} total events`);
  
  if (ugcPosts.length === 0) {
    // Check what resourceNames we actually have
    const resourceNames = [...new Set(changelogData.map(item => item.resourceName))];
    console.log('extractChangelogPosts: Available resource names:', resourceNames);
    
    // Check if we have any share-related activities
    const shareActivities = changelogData.filter(item => 
      item.resourceName && (
        item.resourceName.includes('share') ||
        item.resourceName.includes('Share') ||
        item.resourceName.includes('ugc') ||
        item.resourceName.includes('post') ||
        item.resourceName.includes('Post')
      )
    );
    
    console.log(`extractChangelogPosts: Found ${shareActivities.length} potential share activities`);
    if (shareActivities.length > 0) {
      console.log('extractChangelogPosts: Sample share activity:', shareActivities[0]);
    }
  }
  
  return ugcPosts
    .map((item, index) => {
      const activity = item.activity || {};
      const shareContent = activity.specificContent?.['com.linkedin.ugc.ShareContent'] || {};
      const shareCommentary = shareContent.shareCommentary || {};
      const created = activity.created || {};
      
      const content = shareCommentary.text || shareCommentary.inferredText || '';
      const media = shareContent.media?.[0];
      const mediaCategory = shareContent.shareMediaCategory || 'NONE';
      const hashtags = shareContent.shareFeatures?.hashtags || [];
      
      console.log(`extractChangelogPosts: Processing ugcPost ${index}:`, {
        resourceId: item.resourceId,
        hasActivity: !!activity,
        hasShareContent: !!shareContent,
        hasCommentary: !!shareCommentary,
        content: content ? content.substring(0, 50) + '...' : 'NO CONTENT',
        createdTime: created.time
      });
      
      return {
        id: item.resourceId || activity.id || `changelog_${item.id}`,
        content: content,
        createdAt: created.time || item.capturedAt || Date.now(),
        likes: 0, // Engagement comes from separate API calls
        comments: 0,
        shares: 0,
        views: 0,
        media_url: null,
        media_type: mediaCategory === 'NONE' ? null : mediaCategory,
        visibility: activity.visibility?.['com.linkedin.ugc.MemberNetworkVisibility'] || 'PUBLIC',
        hashtags: hashtags.map((ht: any) => ht.replace?.('urn:li:hashtag:', '') || ht),
        mentions: [],
        post_url: null,
        timestamp: created.time || item.capturedAt || Date.now(),
      };
    })
    .filter(post => post.content && post.content.trim().length > 0);
};

// Main data fetching function
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

    // 3. Deduplicate posts
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
      
      // Show sample of actual posts found
      console.log('getPostPulseData: Sample posts found:', recentPosts.slice(0, 3).map(post => ({
        id: post.id.toString().substring(0, 20),
        date: new Date(post.createdAt).toLocaleDateString(),
        content: post.content.substring(0, 100) + '...',
        daysAgo: Math.floor((Date.now() - post.createdAt) / (1000 * 60 * 60 * 24))
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

// Processing function
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

// Helper functions
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
  
  sessionStorage.setItem('REPURPOSE_POST', JSON.stringify(repurposeData));
  window.location.href = '/postgen?tab=rewrite';
};