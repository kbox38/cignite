import { getCachedPostPulseData, setCachedPostPulseData } from './postpulse-cache';
import { PostData } from '../types/linkedin';
import { useAuthStore } from '../stores/authStore';

export const processPostPulseData = (posts: PostData[], filters: { timeFilter: string; postType: string; sortBy: string; }) => {
  const { timeFilter, postType, sortBy } = filters;

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let filteredPosts = posts.filter(post => {
    if (!post || typeof post.createdAt !== 'number') return false;
    
    if (timeFilter === '7d' && post.createdAt < sevenDaysAgo) return false;
    if (timeFilter === '30d' && post.createdAt < thirtyDaysAgo) return false;
    
    if (postType !== 'all') {
      if (postType === 'text' && (post.media_url || post.document_url)) return false;
      if (postType === 'image' && !post.media_url) return false;
      if (postType === 'video' && !post.media_url) return false; 
      if (postType === 'document' && !post.document_url) return false;
    }
    return true;
  });

  filteredPosts.sort((a, b) => {
    if (sortBy === 'recent') return b.createdAt - a.createdAt;
    if (sortBy === 'oldest') return a.createdAt - b.createdAt; // FIX: Add oldest first option
    if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
    if (sortBy === 'comments') return (b.comments || 0) - (a.comments || 0);
    if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
    // Default to oldest first for repurpose functionality
    return a.createdAt - b.createdAt;
  });

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
      console.log('Serving Post Pulse data from cache');
      return { posts: cachedData.posts, isCached: true, timestamp: cachedData.timestamp };
    }
  }

  console.log('Fetching fresh Post Pulse data');
  
  // FIX: Use existing linkedin-snapshot function instead of postpulse-data
  const response = await fetch(`/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO`, {
    headers: {
      'Authorization': `Bearer ${dmaToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch Post Pulse data. Status: ${response.status}`);
  }

  const data = await response.json();
  
  // Process the snapshot data to match our PostData format
  const processedPosts = processSnapshotData(data);
  
  setCachedPostPulseData(user_id, processedPosts);
  return { posts: processedPosts, isCached: false, timestamp: new Date().toISOString() };
};

// FIX: Add function to process snapshot data into PostData format
function processSnapshotData(snapshotData: any): PostData[] {
  const posts: PostData[] = [];
  
  if (snapshotData.elements && snapshotData.elements.length > 0) {
    for (const element of snapshotData.elements) {
      if (element.snapshotDomain === 'MEMBER_SHARE_INFO' && element.snapshotData) {
        for (const post of element.snapshotData) {
          try {
            const content = post.ShareCommentary || post.Commentary || post.Text || '';
            const dateStr = post.Date || post.CreatedDate || post.Timestamp;
            const createdAt = dateStr ? new Date(dateStr).getTime() : Date.now();
            
            // Skip posts older than 90 days
            const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
            if (createdAt < ninetyDaysAgo) {
              continue;
            }

            const processedPost: PostData = {
              id: post.ShareId || post.Id || `post_${Math.random().toString(36).substr(2, 9)}`,
              text: content,
              content: content,
              timestamp: createdAt,
              createdAt: createdAt,
              likes: parseInt(post.LikesCount || post.Likes || '0', 10),
              comments: parseInt(post.CommentsCount || post.Comments || '0', 10),
              shares: parseInt(post.SharesCount || post.Shares || '0', 10),
              impressions: parseInt(post.Impressions || post.Views || '0', 10),
              views: parseInt(post.Views || post.Impressions || '0', 10),
              media_url: post.MediaUrl || post.Media || null,
              document_url: post.DocumentUrl || post.Document || null,
              linkedin_url: post.ShareLink || post.PostUrl || null,
              resourceName: 'shares',
              source: 'historical'
            };

            posts.push(processedPost);
          } catch (error) {
            console.error('Error processing post:', error);
          }
        }
      }
    }
  }

  console.log(`Processed ${posts.length} posts from snapshot data`);
  return posts.sort((a, b) => a.createdAt - b.createdAt); // Sort oldest first
}