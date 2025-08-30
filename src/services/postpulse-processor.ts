import { getCachedPostPulseData, setCachedPostPulseData } from './postpulse-cache';
import { PostData } from '../types/linkedin';
import { useAuthStore } from '../stores/authStore';

export const processPostPulseData = (posts: PostData[], filters: { timeFilter: string; postType: string; sortBy: string; }) => {
  // FIX: Handle invalid input
  if (!Array.isArray(posts) || posts.length === 0) {
    console.log('processPostPulseData: No posts to process');
    return [];
  }

  console.log('processPostPulseData: Starting with', posts.length, 'posts');
  console.log('processPostPulseData: First post sample:', {
    id: posts[0]?.id?.substring(0, 20),
    hasContent: !!posts[0]?.content,
    createdAt: posts[0]?.createdAt,
    timestamp: posts[0]?.timestamp,
    date: posts[0]?.createdAt ? new Date(posts[0].createdAt).toLocaleDateString() : 'Invalid date'
  });

  const { timeFilter, postType, sortBy } = filters || {};

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  console.log('processPostPulseData: Date thresholds:', {
    now: new Date(now).toLocaleDateString(),
    sevenDaysAgo: new Date(sevenDaysAgo).toLocaleDateString(),
    thirtyDaysAgo: new Date(thirtyDaysAgo).toLocaleDateString(),
    ninetyDaysAgo: new Date(ninetyDaysAgo).toLocaleDateString()
  });

  let filteredPosts = posts.filter((post, index) => {
    // FIX: Handle invalid post objects
    if (!post || typeof post !== 'object') {
      console.warn(`processPostPulseData: Skipping invalid post at index ${index}:`, post);
      return false;
    }

    // FIX: Safe createdAt access with fallbacks
    const createdAt = post.createdAt || post.timestamp;
    if (typeof createdAt !== 'number' || isNaN(createdAt) || createdAt <= 0) {
      console.warn(`processPostPulseData: Post ${index} has invalid createdAt:`, {
        createdAt,
        timestamp: post.timestamp,
        post: post
      });
      return false;
    }

    const daysOld = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    
    // FIX: Debug time filtering
    console.log(`processPostPulseData: Post ${index} is ${daysOld} days old, timeFilter: ${timeFilter}`);
    
    // Time filtering - FIX: Use correct logic
    if (timeFilter === '7d' && createdAt < sevenDaysAgo) {
      console.log(`processPostPulseData: Filtering out post ${index} - older than 7 days`);
      return false;
    }
    if (timeFilter === '30d' && createdAt < thirtyDaysAgo) {
      console.log(`processPostPulseData: Filtering out post ${index} - older than 30 days`);
      return false;
    }
    if (timeFilter === '90d' && createdAt < ninetyDaysAgo) {
      console.log(`processPostPulseData: Filtering out post ${index} - older than 90 days`);
      return false;
    }
    
    // Post type filtering
    if (postType && postType !== 'all') {
      if (postType === 'text' && (post.media_url || post.document_url)) {
        console.log(`processPostPulseData: Filtering out post ${index} - has media but filtering for text only`);
        return false;
      }
      if (postType === 'image' && !post.media_url) {
        console.log(`processPostPulseData: Filtering out post ${index} - no media but filtering for images`);
        return false;
      }
      if (postType === 'video' && !post.media_url) {
        console.log(`processPostPulseData: Filtering out post ${index} - no media but filtering for videos`);
        return false;
      }
      if (postType === 'document' && !post.document_url) {
        console.log(`processPostPulseData: Filtering out post ${index} - no document but filtering for documents`);
        return false;
      }
    }
    
    console.log(`processPostPulseData: Post ${index} passed all filters`);
    return true;
  });

  console.log(`processPostPulseData: After filtering: ${filteredPosts.length} posts remaining`);

  // FIX: Safe sorting with fallbacks
  try {
    filteredPosts.sort((a, b) => {
      const aCreatedAt = a.createdAt || a.timestamp || 0;
      const bCreatedAt = b.createdAt || b.timestamp || 0;
      const aLikes = parseInt(String(a.likes || 0), 10) || 0;
      const bLikes = parseInt(String(b.likes || 0), 10) || 0;
      const aComments = parseInt(String(a.comments || 0), 10) || 0;
      const bComments = parseInt(String(b.comments || 0), 10) || 0;
      const aViews = parseInt(String(a.views || a.impressions || 0), 10) || 0;
      const bViews = parseInt(String(b.views || b.impressions || 0), 10) || 0;

      if (sortBy === 'recent') return bCreatedAt - aCreatedAt;
      if (sortBy === 'oldest') return aCreatedAt - bCreatedAt;
      if (sortBy === 'likes') return bLikes - aLikes;
      if (sortBy === 'comments') return bComments - aComments;
      if (sortBy === 'views') return bViews - aViews;
      
      // Default to oldest first for repurpose functionality
      return aCreatedAt - bCreatedAt;
    });
  } catch (sortError) {
    console.error('processPostPulseData: Error sorting posts:', sortError);
  }

  console.log(`processPostPulseData: Processed ${filteredPosts.length} posts from ${posts.length} total`);
  
  if (filteredPosts.length > 0) {
    console.log('processPostPulseData: Sample of filtered posts:', filteredPosts.slice(0, 3).map(post => ({
      date: new Date(post.createdAt).toLocaleDateString(),
      daysOld: Math.floor((Date.now() - post.createdAt) / (1000 * 60 * 60 * 24)),
      hasContent: !!post.content
    })));
  }
  
  return filteredPosts;
};

// FIX: Add repurpose status calculation
export const getRepurposeStatus = (postDate: number) => {
  const daysDiff = Math.floor((Date.now() - postDate) / (1000 * 60 * 60 * 24));
  
  if (daysDiff < 42) {
    return { status: 'too-soon', label: 'Too Soon', color: 'bg-red-100 text-red-800' };
  } else if (daysDiff >= 42 && daysDiff <= 45) {
    return { status: 'close', label: 'Close', color: 'bg-yellow-100 text-yellow-800' };
  } else {
    return { status: 'ready', label: 'Ready to Repurpose', color: 'bg-green-100 text-green-800' };
  }
};

// FIX: Add repurpose functionality
export const repurposePost = (post: PostData) => {
  const repurposeData = {
    text: post.content || post.text || '',
    originalDate: new Date(post.createdAt).toISOString(),
    engagement: {
      likes: post.likes || 0,
      comments: post.comments || 0,
      shares: post.shares || 0
    },
    media_url: post.media_url,
    document_url: post.document_url
  };
  
  // Store in session storage for PostGen to pick up
  sessionStorage.setItem('REPURPOSE_POST', JSON.stringify(repurposeData));
  
  // Navigate to PostGen rewrite section
  window.location.href = '/postgen?tab=rewrite';
};

export const getPostPulseData = async (forceRefresh = false) => {
  // Get auth data from the auth store
  const { dmaToken, profile } = useAuthStore.getState();
  
  console.log('getPostPulseData: Starting with auth check:', {
    hasDmaToken: !!dmaToken,
    hasProfile: !!profile,
    profileSub: profile?.sub
  });
  
  if (!dmaToken) {
    throw new Error("LinkedIn DMA token not found. Please reconnect your account.");
  }
  
  if (!profile?.sub) { // FIX: Use profile.sub instead of profile.id
    throw new Error("User profile not found. Please reconnect your account.");
  }
  
  const user_id = profile.sub; // FIX: Use profile.sub

  if (!forceRefresh) {
    const cachedData = getCachedPostPulseData(user_id);
    if (cachedData) {
      console.log('getPostPulseData: Serving from cache:', cachedData.posts.length, 'posts');
      return { posts: cachedData.posts, isCached: true, timestamp: cachedData.timestamp };
    }
  }

  console.log('getPostPulseData: Fetching fresh data from API');
  
  // FIX: First, get the total count to calculate where recent posts are
  const initialResponse = await fetch(`/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO&count=1`, {
    headers: {
      'Authorization': `Bearer ${dmaToken}`,
    },
  });

  if (!initialResponse.ok) {
    const errorText = await initialResponse.text();
    console.error('getPostPulseData: Initial API error response:', errorText);
    throw new Error(`Failed to fetch Post Pulse data. Status: ${initialResponse.status} - ${errorText}`);
  }

  const initialData = await initialResponse.json();
  const totalPosts = initialData.paging?.total || 0;
  console.log('getPostPulseData: Total posts available:', totalPosts);

  // FIX: Calculate starting point for recent posts (get last 100 posts)
  const postsToFetch = Math.min(100, totalPosts);
  const startIndex = Math.max(0, totalPosts - postsToFetch);
  
  console.log('getPostPulseData: Fetching recent posts starting from index:', startIndex);
  
  // FIX: Fetch recent posts from the end of the dataset
  const apiUrl = `/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO&start=${startIndex}&count=${postsToFetch}`;
  console.log('getPostPulseData: Calling API:', apiUrl);
  
  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${dmaToken}`,
    },
  });

  console.log('getPostPulseData: API response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('getPostPulseData: API error response:', errorText);
    throw new Error(`Failed to fetch Post Pulse data. Status: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('getPostPulseData: Raw API response structure:', {
    hasElements: !!data.elements,
    elementsLength: data.elements?.length || 0,
    totalInResponse: data.elements?.[0]?.snapshotData?.length || 0,
    paging: data.paging
  });
  
  // Process the snapshot data to match our PostData format
  const processedPosts = processSnapshotData(data);
  console.log('getPostPulseData: Final processed posts:', processedPosts.length);
  
  setCachedPostPulseData(user_id, processedPosts);
  return { posts: processedPosts, isCached: false, timestamp: new Date().toISOString() };
};

// FIX: Add function to process snapshot data into PostData format
function processSnapshotData(snapshotData: any): PostData[] {
  const posts: PostData[] = [];
  
  console.log('processSnapshotData: Raw data received:', {
    hasElements: !!snapshotData.elements,
    elementsLength: snapshotData.elements?.length || 0
  });
  
  if (snapshotData.elements && snapshotData.elements.length > 0) {
    for (const element of snapshotData.elements) {
      if (element.snapshotDomain === 'MEMBER_SHARE_INFO' && element.snapshotData) {
        console.log(`processSnapshotData: Found ${element.snapshotData.length} posts in MEMBER_SHARE_INFO`);
        
        // Show sample of first few posts to understand data structure
        if (element.snapshotData.length > 0) {
          console.log('processSnapshotData: Sample posts:', element.snapshotData.slice(0, 3).map(post => ({
            date: post.Date,
            hasContent: !!post.ShareCommentary,
            contentPreview: post.ShareCommentary ? post.ShareCommentary.substring(0, 50) + '...' : 'No content'
          })));
        }
        
        for (const post of element.snapshotData) {
          try {
            // FIX: Use correct field names from DMA documentation
            const content = post.ShareCommentary || post.shareCommentary || post.Commentary || post.Text || '';
            const dateStr = post.Date || post.shareDate || post.CreatedDate || post.Timestamp;
            
            // Skip completely empty posts
            if (!content && !dateStr) {
              console.log('Skipping post with no content or date');
              continue;
            }
            
            let createdAt = Date.now();
            if (dateStr) {
              try {
                createdAt = new Date(dateStr).getTime();
                if (isNaN(createdAt)) {
                  console.warn('Invalid date format:', dateStr);
                  createdAt = Date.now();
                }
              } catch (dateError) {
                console.warn('Error parsing date:', dateStr, dateError);
                createdAt = Date.now();
              }
            }
            
            // FIX: For now, let's take the 90 most recent posts regardless of age
            // We'll show ALL posts and let the user filter by time in the UI
            const daysSincePost = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
            
            // FIX: Parse engagement metrics with multiple field name variations
            const parseLikesCount = () => {
              const likes = post.LikesCount || post.likesCount || post['Likes Count'] || post.Likes || '0';
              return parseInt(String(likes), 10) || 0;
            };

            const parseCommentsCount = () => {
              const comments = post.CommentsCount || post.commentsCount || post['Comments Count'] || post.Comments || '0';
              return parseInt(String(comments), 10) || 0;
            };

            const parseSharesCount = () => {
              const shares = post.SharesCount || post.sharesCount || post['Shares Count'] || post.Shares || '0';
              return parseInt(String(shares), 10) || 0;
            };

            const processedPost: PostData = {
              id: post.ShareId || post.shareId || post.Id || post.ShareLink || `post_${Math.random().toString(36).substr(2, 9)}`,
              text: content,
              content: content,
              timestamp: createdAt,
              createdAt: createdAt,
              likes: parseLikesCount(),
              comments: parseCommentsCount(),
              shares: parseSharesCount(),
              impressions: parseInt(String(post.Impressions || post.Views || post.impressions || post.views || '0'), 10) || 0,
              views: parseInt(String(post.Views || post.Impressions || post.views || post.impressions || '0'), 10) || 0,
              media_url: post.MediaUrl || post.mediaUrl || post.Media || post['Media URL'] || null,
              document_url: post.DocumentUrl || post.documentUrl || post.Document || post['Document URL'] || null,
              linkedin_url: post.ShareLink || post.shareLink || post.PostUrl || post['Share URL'] || null,
              resourceName: 'shares',
              source: 'historical'
            };

            console.log(`Processing post from ${daysSincePost} days ago:`, {
              id: processedPost.id.substring(0, 20) + '...',
              hasContent: !!processedPost.content,
              date: new Date(processedPost.createdAt).toLocaleDateString(),
              daysOld: daysSincePost
            });

            posts.push(processedPost);
          } catch (error) {
            console.error('Error processing individual post:', error);
          }
        }
      }
    }
  } else {
    console.warn('processSnapshotData: No elements found in snapshot data');
  }

  console.log(`processSnapshotData: Successfully processed ${posts.length} posts from snapshot data`);
  
  // FIX: Sort newest first (reverse chronological) so recent posts appear first
  const sortedPosts = posts.sort((a, b) => b.createdAt - a.createdAt);
  
  // FIX: Take only the 90 most recent posts for PostPulse
  const recentPosts = sortedPosts.slice(0, 90);
  
  console.log(`processSnapshotData: Returning ${recentPosts.length} most recent posts`, {
    oldestPostDate: recentPosts.length > 0 ? new Date(recentPosts[recentPosts.length - 1].createdAt).toLocaleDateString() : 'N/A',
    newestPostDate: recentPosts.length > 0 ? new Date(recentPosts[0].createdAt).toLocaleDateString() : 'N/A'
  });
  
  return recentPosts;
}