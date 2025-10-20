// Debug flag - set to true for detailed logging
const DEBUG = true;

// Simple hash function for browser compatibility (NO CRYPTO IMPORT)
const simpleHash = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 8);
};

const getUserHash = (token: string): string => {
  return simpleHash(token).substring(0, 12);
};

export interface PostData {
  id: string;
  content: string;
  createdAt: number;
  likes: number;
  comments: number;
  reposts: number;
  url: string;
  author: string;
  mediaUrl?: string;  // Add media support
  mediaType?: 'image' | 'video' | 'document' | 'unknown';
}

export interface PostPulseData {
  posts: PostData[];
  isCached: boolean;
  timestamp: string;
  isAllTime: boolean;
}

export interface PostPulseFilters {
  sortBy: 'newest' | 'oldest' | 'engagement';
  postType: 'all' | 'text' | 'image' | 'video' | 'article';
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Cache management functions for backward compatibility
export const clearPostPulseCache = () => {
  if (DEBUG) console.log('Cache cleared (snapshot-only mode)');
};

export const processPostPulseData = (posts: PostData[], filters?: PostPulseFilters) => {
  if (!filters) return posts;
  
  let filteredPosts = [...posts];
  
  // Apply sorting
  switch (filters.sortBy) {
    case 'oldest':
      filteredPosts.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case 'engagement':
      filteredPosts.sort((a, b) => (b.likes + b.comments + b.reposts) - (a.likes + a.comments + a.reposts));
      break;
    case 'recent':
      filteredPosts.sort((a, b) => b.createdAt - a.createdAt);
      break;
    default: // Default to oldest for repurpose workflow
      filteredPosts.sort((a, b) => a.createdAt - b.createdAt);
  }
  
  // Apply date range filter
  if (filters.dateRange) {
    const startTime = filters.dateRange.start.getTime();
    const endTime = filters.dateRange.end.getTime();
    filteredPosts = filteredPosts.filter(post => 
      post.createdAt >= startTime && post.createdAt <= endTime
    );
  }
  
  return filteredPosts;
};

// PostCard component functions
export const getRepurposeStatus = (post: PostData) => {
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  
  if (post.createdAt < thirtyDaysAgo) {
    return {
      canRepurpose: true,
      status: 'ready',
      message: '✅ Ready to repurpose'
    };
  }
  
  const daysLeft = Math.ceil((post.createdAt - thirtyDaysAgo) / (24 * 60 * 60 * 1000));
  return {
    canRepurpose: false,
    status: 'waiting',
    message: `⏳ ${daysLeft} days left`
  };
};

export const repurposePost = async (post: PostData) => {
  if (DEBUG) console.log('Repurposing post:', post.id);
  
  try {
    // Store post data for repurposing in PostGen
    const repurposeData = {
      text: post.content,
      originalDate: post.createdAt,
      engagement: {
        likes: post.likes,
        comments: post.comments,
        shares: post.reposts
      },
      media_url: post.mediaUrl,
      source: 'postpulse'
    };
    
    sessionStorage.setItem('REPURPOSE_POST', JSON.stringify(repurposeData));
    
    // Navigate to PostGen
    window.location.href = '/postgen?tab=rewrite';
    
    return {
      success: true,
      message: 'Post sent to PostGen for repurposing'
    };
  } catch (error) {
    console.error('Error repurposing post:', error);
    return {
      success: false,
      message: 'Failed to repurpose post'
    };
  }
};

// SIMPLIFIED: Enhanced snapshot processing (data already filtered server-side)
const extractSnapshotPosts = (snapshotData: any, showAllTime = false): PostData[] => {
  // Add at the start of extractSnapshotPosts function:
if (DEBUG && snapshotData.length > 0) {
  console.log('🔍 RAW API RESPONSE - First post item:', JSON.stringify(snapshotData[0], null, 2));
  console.log('🔍 Available fields:', Object.keys(snapshotData[0]));
  console.log('🔍 Engagement fields check:', {
    LikesCount: snapshotData[0]['LikesCount'],
    'Likes Count': snapshotData[0]['Likes Count'],
    CommentsCount: snapshotData[0]['CommentsCount'],
    'Comments Count': snapshotData[0]['Comments Count'],
    SharesCount: snapshotData[0]['SharesCount'],
    'Shares Count': snapshotData[0]['Shares Count']
  });
}
  if (DEBUG) {
    console.log('🔍 CLIENT PROCESSING: Starting analysis of pre-filtered data...');
    console.log('🔍 CLIENT PROCESSING: Raw data structure:', {
      isArray: Array.isArray(snapshotData),
      length: snapshotData?.length,
      dataType: typeof snapshotData,
      firstItemKeys: snapshotData?.[0] ? Object.keys(snapshotData[0]) : []
    });
  }

  if (!Array.isArray(snapshotData) || snapshotData.length === 0) {
    if (DEBUG) console.log('🔍 CLIENT PROCESSING: Empty or invalid data structure');
    return [];
  }

  // Data is already filtered server-side for last year, just process it
  const posts = snapshotData.map((item: any, index: number) => {
    try {
      // Extract date (already validated server-side)
      const shareDate = 
        item['Share Date'] ||
        item['Date'] ||
        item['shareDate'] ||
        item['created_at'] ||
        item['timestamp'] ||
        item['createdAt'] ||
        '';

      let createdAtMs = Date.now(); // fallback to now
      if (shareDate) {
        const parsedDate = new Date(shareDate);
        if (!isNaN(parsedDate.getTime())) {
          createdAtMs = parsedDate.getTime();
        }
      }

      // Extract content
      const content = 
        item['ShareCommentary'] ||
        item['Commentary'] || 
        item['Share Commentary'] ||
        item['comment'] || 
        item['content'] || 
        item['text'] ||
        item['shareCommentary'] ||
        item['post_content'] ||
        '';

      // Extract URL
      const shareUrl = 
        item['ShareLink'] ||
        item['SharedUrl'] ||
        item['Share URL'] || 
        item['share_url'] || 
        item['shareUrl'] || 
        item['URL'] || 
        item['url'] ||
        item['permalink'] ||
        item['link'] ||
        '';

      // Extract media information
      const mediaUrl = 
        item['MediaUrl'] ||
        item['Media URL'] ||
        item['media_url'] ||
        item['mediaUrl'] ||
        item['image'] ||
        item['ImageUrl'] ||
        '';

      // Determine media type
      let mediaType: 'text' | 'image' | 'video' | 'document' | 'unknown' = 'text';
      if (mediaUrl) {
        const urlLower = mediaUrl.toLowerCase();
        if (urlLower.includes('image') || urlLower.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          mediaType = 'image';
        } else if (urlLower.includes('video') || urlLower.match(/\.(mp4|avi|mov|wmv)$/i)) {
          mediaType = 'video';
        } else if (urlLower.includes('document') || urlLower.match(/\.(pdf|doc|docx|ppt|pptx)$/i)) {
          mediaType = 'document';
        } else {
          mediaType = 'unknown';
        }
      }

      // Extract engagement data
      const likes = parseInt(item['LikesCount'] || item['Likes Count'] || item['likes'] || '0');
      const comments = parseInt(item['CommentsCount'] || item['Comments Count'] || item['comments'] || '0');
      const shares = parseInt(item['SharesCount'] || item['Shares Count'] || item['shares'] || item['reposts'] || '0');

      // Generate ID from URL or fallback
      const urlMatch = shareUrl?.match(/activity-(\d+)/);
      const id = urlMatch ? `activity-${urlMatch[1]}` : `snapshot-${index}-${createdAtMs}`;

      if (DEBUG && index < 3) {
        console.log(`🔍 CLIENT PROCESSING: Processing item ${index}:`, {
          hasContent: !!content,
          hasUrl: !!shareUrl,
          hasDate: !!shareDate,
          createdAt: new Date(createdAtMs).toISOString(),
          mediaType: mediaType,
          engagement: { likes, comments, shares }
        });
      }

      return {
        id,
        content: content || 'No content available',
        createdAt: createdAtMs,
        url: shareUrl || '',
        likes,
        comments,
        reposts: shares,
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaType
      };

    } catch (error) {
      if (DEBUG) console.warn(`🔍 CLIENT PROCESSING: Error processing item ${index}:`, error);
      return null;
    }
  })
  .filter((post): post is PostData => post !== null); // Remove null entries

  // Data is already sorted server-side, but ensure newest first and limit
  const sortedPosts = posts.sort((a, b) => b.createdAt - a.createdAt);
  const finalPosts = sortedPosts.slice(0, 90); // Keep top 90 most recent

  if (DEBUG) {
    console.log(`🔍 CLIENT PROCESSING: Final result:`, {
      totalProcessed: snapshotData.length,
      validPosts: posts.length,
      finalPosts: finalPosts.length,
      dateRange: finalPosts.length > 0 ? {
        newest: new Date(finalPosts[0].createdAt).toISOString(),
        oldest: new Date(finalPosts[finalPosts.length - 1].createdAt).toISOString(),
        spanDays: Math.round((finalPosts[0].createdAt - finalPosts[finalPosts.length - 1].createdAt) / (1000 * 60 * 60 * 24))
      } : 'No posts'
    });
  }

  return finalPosts;
};

// MAIN FETCH FUNCTION - SNAPSHOT ONLY
export const getPostPulseData = async (
  token: string, 
  showAllTime = false // Parameter kept for compatibility but always false
): Promise<PostPulseData> => {
  const startTime = Date.now();
  
  let allPosts: PostData[] = [];
  
  try {    
    // Always use recent posts (90 days) - remove all-time functionality
    const snapshotUrl = '/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO';
      
    const snapshotResponse = await fetch(snapshotUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (DEBUG) {
      console.log(`🚀 PostPulse: Starting SNAPSHOT-ONLY data fetch (90 days), user=${getUserHash(token)}`);
      console.log('🔄 Fetching posts with SNAPSHOT API only...');
      console.log('🔍 SNAPSHOT API Response:', {
        status: snapshotResponse.status,
        statusText: snapshotResponse.statusText,
        ok: snapshotResponse.ok
      });
    }

    if (snapshotResponse.ok) {
      const snapshotData = await snapshotResponse.json();
      
      if (DEBUG) {
        console.log('🔍 SNAPSHOT API Data:', {
          hasElements: !!snapshotData.elements,
          elementsLength: snapshotData.elements?.length,
          keys: Object.keys(snapshotData || {}),
          firstElementKeys: snapshotData.elements?.[0] ? Object.keys(snapshotData.elements[0]) : []
        });
      }

      if (snapshotData.elements?.length > 0) {
        snapshotData.elements.forEach((element: any, elementIndex: number) => {
          if (element.snapshotData && Array.isArray(element.snapshotData)) {
            if (DEBUG) console.log(`🔍 Processing snapshot element ${elementIndex}: ${element.snapshotData.length} items`);
            const elementPosts = extractSnapshotPosts(element.snapshotData, showAllTime);
            allPosts.push(...elementPosts);
            if (DEBUG) console.log(`✅ Extracted ${elementPosts.length} posts from element ${elementIndex}`);
          } else {
            if (DEBUG) console.log(`⚠️ Element ${elementIndex} has no snapshotData or is not an array`);
          }
        });
      }
    } else {
      const errorText = await snapshotResponse.text();
      console.warn('Snapshot API failed:', snapshotResponse.status, errorText);
    }

    if (allPosts.length === 0) {
      console.warn('No posts found from snapshot API');
      return { 
        posts: [], 
        isCached: false, 
        timestamp: new Date().toISOString(),
        isAllTime: showAllTime
      };
    }

    // Remove duplicates by ID
    const seenIds = new Set<string>();
    const deduplicatedPosts = allPosts.filter(post => {
      if (seenIds.has(post.id)) {
        if (DEBUG) console.log(`🔄 Removing duplicate post ID: ${post.id}`);
        return false;
      }
      seenIds.add(post.id);
      return true;
    });

    // Sort by date (newest first)
    const sortedPosts = deduplicatedPosts.sort((a, b) => b.createdAt - a.createdAt);
    
    // Limit to 90 most recent posts
    const finalPosts = sortedPosts.slice(0, 90);
    
    // Keep one essential status log
    console.log(`PostPulse: Loaded ${finalPosts.length} recent posts (90 days)`);
    
    return { 
      posts: finalPosts, 
      isCached: false, 
      timestamp: new Date().toISOString(),
      isAllTime: false
    };

  } catch (error) {
    console.error('PostPulse: Fatal error during data fetch:', error);
    return { 
      posts: [], 
      isCached: false, 
      timestamp: new Date().toISOString(),
      isAllTime: false
    };
  }
};