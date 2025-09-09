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
  console.log('Cache cleared (snapshot-only mode)');
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
    default: // newest
      filteredPosts.sort((a, b) => b.createdAt - a.createdAt);
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
      message: 'Ready to repurpose'
    };
  }
  
  const daysLeft = Math.ceil((post.createdAt - thirtyDaysAgo) / (24 * 60 * 60 * 1000));
  return {
    canRepurpose: false,
    status: 'waiting',
    message: `${daysLeft} days remaining`
  };
};

export const repurposePost = async (post: PostData) => {
  // Simplified repurpose function for snapshot-only mode
  console.log('Repurposing post:', post.id);
  
  try {
    // In a full implementation, this would:
    // 1. Copy the post content
    // 2. Navigate to PostGen
    // 3. Pre-fill the content
    
    // For now, just return success
    return {
      success: true,
      message: 'Post prepared for repurposing'
    };
  } catch (error) {
    console.error('Error repurposing post:', error);
    return {
      success: false,
      message: 'Failed to repurpose post'
    };
  }
};

// ENHANCED: Enhanced snapshot processing with better field mapping
const extractSnapshotPosts = (snapshotData: any, showAllTime = false): PostData[] => {
  console.log('🔍 SNAPSHOT DEBUG: Starting analysis...');
  console.log('🔍 SNAPSHOT DEBUG: Raw data structure:', {
    isArray: Array.isArray(snapshotData),
    length: snapshotData?.length,
    dataType: typeof snapshotData,
    firstItemKeys: snapshotData?.[0] ? Object.keys(snapshotData[0]) : [],
    sampleItem: snapshotData?.[0]
  });
  
  const posts: PostData[] = [];
  const shareInfo = snapshotData || [];
  
  console.log(`🔍 SNAPSHOT DEBUG: Processing ${shareInfo.length} items`);
  
  shareInfo.forEach((item: any, index: number) => {
    console.log(`🔍 SNAPSHOT DEBUG: Item ${index}:`, {
      keys: Object.keys(item || {}),
      hasShareURL: !!(item['Share URL'] || item['share_url'] || item.shareUrl || item['URL'] || item.url),
      hasContent: !!(item['ShareCommentary'] || item['Commentary'] || item['comment'] || item['content'] || item['text']),
      hasDate: !!(item['Date'] || item['created_at'] || item['timestamp']),
      sampleFields: {
        shareCommentary: typeof item['ShareCommentary'],
        commentary: typeof item['Commentary'],
        shareUrl: typeof item['Share URL'],
        date: typeof item['Date']
      }
    });

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
        console.log(`🔍 SNAPSHOT DEBUG: Skipping item ${index}: no content (${content?.length || 0} chars)`);
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

      console.log(`🔍 SNAPSHOT DEBUG: Creating post ${index}:`, {
        postId: postId.substring(0, 30),
        contentLength: content.length,
        contentPreview: content.substring(0, 100),
        hasUrl: !!shareUrl,
        createdAt: new Date(createdAt).toISOString(),
        engagement: { likes: likesCount, comments: commentsCount, shares: sharesCount }
      });

      posts.push({
        id: postId,
        content: content.trim(),
        createdAt: createdAt,
        likes: likesCount,
        comments: commentsCount,
        reposts: sharesCount,
        url: shareUrl || `https://linkedin.com/in/you/recent-activity/shares/`,
        author: 'You'
      });

    } catch (error) {
      console.warn(`🔍 SNAPSHOT DEBUG: Error processing item ${index}:`, error);
    }
  });

  console.log(`🔍 SNAPSHOT DEBUG: Final result: ${posts.length} posts extracted`);
  return posts;
};

// MAIN FETCH FUNCTION - SNAPSHOT ONLY
export const getPostPulseData = async (
  token: string, 
  showAllTime = false
): Promise<PostPulseData> => {
  const startTime = Date.now();
  console.log(`🚀 PostPulse: Starting SNAPSHOT-ONLY data fetch, showAllTime=${showAllTime}, user=${getUserHash(token)}`);
  
  let allPosts: PostData[] = [];
  
  try {
    console.log('🔄 Fetching posts with SNAPSHOT API only...');
    
    const snapshotUrl = showAllTime 
      ? '/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO&allTime=true'
      : '/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO';
      
    const snapshotResponse = await fetch(snapshotUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('🔍 SNAPSHOT API Response:', {
      status: snapshotResponse.status,
      statusText: snapshotResponse.statusText,
      ok: snapshotResponse.ok
    });

    if (snapshotResponse.ok) {
      const snapshotData = await snapshotResponse.json();
      console.log('🔍 SNAPSHOT API Data:', {
        hasElements: !!snapshotData.elements,
        elementsLength: snapshotData.elements?.length,
        keys: Object.keys(snapshotData || {}),
        firstElementKeys: snapshotData.elements?.[0] ? Object.keys(snapshotData.elements[0]) : []
      });

      if (snapshotData.elements?.length > 0) {
        snapshotData.elements.forEach((element: any, elementIndex: number) => {
          if (element.snapshotData && Array.isArray(element.snapshotData)) {
            console.log(`🔍 Processing snapshot element ${elementIndex}: ${element.snapshotData.length} items`);
            const elementPosts = extractSnapshotPosts(element.snapshotData, showAllTime);
            allPosts.push(...elementPosts);
            console.log(`✅ Extracted ${elementPosts.length} posts from element ${elementIndex}`);
          } else {
            console.log(`⚠️ Element ${elementIndex} has no snapshotData or is not an array`);
          }
        });
      }
    } else {
      const errorText = await snapshotResponse.text();
      console.warn('Snapshot API failed:', snapshotResponse.status, errorText);
    }

    console.log(`📊 Total posts collected: ${allPosts.length}`);

    if (allPosts.length === 0) {
      console.warn('⚠️ No posts found from snapshot API');
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
        console.log(`🔄 Removing duplicate post ID: ${post.id}`);
        return false;
      }
      seenIds.add(post.id);
      return true;
    });

    console.log(`🔄 After deduplication: ${deduplicatedPosts.length} posts (removed ${allPosts.length - deduplicatedPosts.length} duplicates)`);

    // Sort by date (newest first)
    const sortedPosts = deduplicatedPosts.sort((a, b) => b.createdAt - a.createdAt);
    
    // For recent posts, limit to 90; for all-time, keep everything
    const finalPosts = showAllTime ? sortedPosts : sortedPosts.slice(0, 90);
    
    console.log(`✅ Final result: ${finalPosts.length} ${showAllTime ? 'all-time' : 'recent'} posts loaded in ${Date.now() - startTime}ms`);
    
    return { 
      posts: finalPosts, 
      isCached: false, 
      timestamp: new Date().toISOString(),
      isAllTime: showAllTime
    };

  } catch (error) {
    console.error('PostPulse: Fatal error during data fetch:', error);
    return { 
      posts: [], 
      isCached: false, 
      timestamp: new Date().toISOString(),
      isAllTime: showAllTime
    };
  }
};