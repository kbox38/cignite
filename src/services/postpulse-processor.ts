// Debug flag - set to true for detailed logging
const DEBUG = false;

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

// ENHANCED: Enhanced snapshot processing with media extraction
const extractSnapshotPosts = (snapshotData: any, showAllTime = false): PostData[] => {
  if (DEBUG) {
    console.log('🔍 SNAPSHOT DEBUG: Starting analysis...');
    console.log('🔍 SNAPSHOT DEBUG: Raw data structure:', {
      isArray: Array.isArray(snapshotData),
      length: snapshotData?.length,
      dataType: typeof snapshotData,
      firstItemKeys: snapshotData?.[0] ? Object.keys(snapshotData[0]) : [],
      sampleItem: snapshotData?.[0]
    });
  }
  
  const posts: PostData[] = [];
  const shareInfo = snapshotData || [];
  
  if (DEBUG) console.log(`🔍 SNAPSHOT DEBUG: Processing ${shareInfo.length} items`);
  
  shareInfo.forEach((item: any, index: number) => {
    if (DEBUG) {
      console.log(`🔍 SNAPSHOT DEBUG: Item ${index}:`, {
        keys: Object.keys(item || {}),
        hasShareURL: !!(item['Share URL'] || item['share_url'] || item.shareUrl || item['URL'] || item.url),
        hasContent: !!(item['ShareCommentary'] || item['Commentary'] || item['comment'] || item['content'] || item['text']),
        hasDate: !!(item['Date'] || item['created_at'] || item['timestamp']),
        hasMedia: !!(item['MediaUrl'] || item['Media URL'] || item['media_url']),
        sampleFields: {
          shareCommentary: typeof item['ShareCommentary'],
          commentary: typeof item['Commentary'],
          shareUrl: typeof item['Share URL'],
          mediaUrl: typeof item['MediaUrl'],
          date: typeof item['Date']
        }
      });
    }

    try {
      // ENHANCED: Try multiple field name variations for content
      const content = 
        item['ShareCommentary'] ||  // LinkedIn's actual field name
        item['Commentary'] || 
        item['Share Commentary'] ||
        item['comment'] || 
        item['content'] || 
        item['text'] ||
        item['shareCommentary'] ||
        item['post_content'] ||
        '';

      // ENHANCED: Try multiple field name variations for URL
      const shareUrl = 
        item['ShareLink'] ||       // LinkedIn's actual field name
        item['SharedUrl'] ||       // Alternative LinkedIn field
        item['Share URL'] || 
        item['share_url'] || 
        item['shareUrl'] || 
        item['URL'] || 
        item['url'] ||
        item['permalink'] ||
        item['link'] ||
        '';

      // ENHANCED: Extract media information
      const mediaUrl = 
        item['MediaUrl'] ||        // LinkedIn's media field
        item['Media URL'] ||
        item['media_url'] ||
        item['mediaUrl'] ||
        item['image'] ||
        item['ImageUrl'] ||
        '';

      // Determine media type from URL or field
      let mediaType: 'image' | 'video' | 'document' | 'unknown' = 'unknown';
      if (mediaUrl) {
        const urlLower = mediaUrl.toLowerCase();
        if (urlLower.includes('image') || urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
          mediaType = 'image';
        } else if (urlLower.includes('video') || urlLower.match(/\.(mp4|mov|avi|wmv|webm)(\?|$)/i)) {
          mediaType = 'video';
        } else if (urlLower.match(/\.(pdf|doc|docx|ppt|pptx)(\?|$)/i)) {
          mediaType = 'document';
        }
      }

      // ENHANCED: Try multiple field name variations for date
      const dateStr = 
        item['Date'] || 
        item['Created Date'] ||
        item['created_at'] || 
        item['timestamp'] ||
        item['published_at'] ||
        item['date'] ||
        '';

      // ENHANCED: Try multiple field name variations for engagement metrics
      const likesCount = parseInt(
        item['Likes Count'] || 
        item['likes_count'] || 
        item['likes'] || 
        item['reactions'] ||
        '0'
      ) || 0;

      const commentsCount = parseInt(
        item['Comments Count'] || 
        item['comments_count'] || 
        item['comments'] ||
        '0'
      ) || 0;

      const sharesCount = parseInt(
        item['Shares Count'] || 
        item['shares_count'] || 
        item['shares'] ||
        item['reposts'] ||
        '0'
      ) || 0;

      // Skip items without content or minimal content
      if (!content || content.trim().length < 3) {
        if (DEBUG) console.log(`🔍 SNAPSHOT DEBUG: Skipping item ${index}: no content (${content?.length || 0} chars)`);
        return;
      }

      // Parse date
      let createdAt = Date.now();
      if (dateStr) {
        const parsedDate = new Date(dateStr).getTime();
        if (!isNaN(parsedDate)) {
          createdAt = parsedDate;
        }
      }

      // Generate ID using browser-compatible hash (NO CRYPTO)
      const postId = shareUrl ? 
        shareUrl.split('/').pop() || `snapshot_${index}` : 
        `snapshot_${simpleHash(content)}`;

      if (DEBUG) {
        console.log(`🔍 SNAPSHOT DEBUG: Creating post ${index}:`, {
          postId: postId.substring(0, 30),
          contentLength: content.length,
          contentPreview: content.substring(0, 100),
          hasUrl: !!shareUrl,
          hasMedia: !!mediaUrl,
          mediaType: mediaType,
          mediaUrlPreview: mediaUrl?.substring(0, 50),
          createdAt: new Date(createdAt).toISOString(),
          engagement: { likes: likesCount, comments: commentsCount, shares: sharesCount }
        });
      }

      posts.push({
        id: postId,
        content: content.trim(),
        createdAt: createdAt,
        likes: likesCount,
        comments: commentsCount,
        reposts: sharesCount,
        url: shareUrl || `https://linkedin.com/in/you/recent-activity/shares/`,
        author: 'You',
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaUrl ? mediaType : undefined
      });

    } catch (error) {
      if (DEBUG) console.warn(`🔍 SNAPSHOT DEBUG: Error processing item ${index}:`, error);
    }
  });

  if (DEBUG) console.log(`🔍 SNAPSHOT DEBUG: Final result: ${posts.length} posts extracted`);
  return posts;
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