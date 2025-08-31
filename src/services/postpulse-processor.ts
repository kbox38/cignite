// Enhanced PostPulse processor with fixed historical post extraction
// src/services/postpulse-processor.ts

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
  totalCount?: number;
  isAllTime?: boolean;
  dateRange?: string;
}

export interface PostPulseFilters {
  postType: 'all' | 'text' | 'image' | 'video';
  sortBy: 'recent' | 'oldest' | 'likes' | 'comments' | 'views';
  searchQuery: string;
  showAllTime: boolean;
}

// Cache configuration
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY_PREFIX = 'postpulse_recent_';
const ALL_TIME_CACHE_KEY_PREFIX = 'postpulse_alltime_';

// Extract user ID from token (simplified)
const getUserIdFromToken = (token: string): string => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || payload.user_id || 'fallback_user';
  } catch {
    return 'fallback_user';
  }
};

// Enhanced changelog processing with better logging
const extractChangelogPosts = (changelogData: any): PostData[] => {
  console.log('🔍 CHANGELOG DEBUG: Starting analysis...');
  console.log('🔍 CHANGELOG DEBUG: Raw data structure:', {
    hasElements: !!changelogData?.elements,
    elementsLength: changelogData?.elements?.length,
    dataType: typeof changelogData,
    keys: Object.keys(changelogData || {})
  });
  
  const posts: PostData[] = [];
  const elements = changelogData?.elements || [];
  
  console.log(`🔍 CHANGELOG DEBUG: Processing ${elements.length} elements`);
  
  elements.forEach((event: any, index: number) => {
    console.log(`🔍 CHANGELOG DEBUG: Element ${index}:`, {
      resourceName: event.resourceName,
      method: event.method,
      hasActivity: !!event.activity,
      resourceId: event.resourceId?.substring(0, 30),
      keys: Object.keys(event || {})
    });
    
    if (event.resourceName === 'ugcPosts' && event.method === 'CREATE' && event.activity) {
      console.log(`🔍 CHANGELOG DEBUG: Found UGC post at index ${index}`);
      try {
        const activity = event.activity;
        const content = activity.specificContent?.['com.linkedin.ugc.ShareContent'];
        
        console.log('🔍 CHANGELOG DEBUG: Activity structure:', {
          hasSpecificContent: !!activity.specificContent,
          hasShareContent: !!content,
          shareContentKeys: content ? Object.keys(content) : [],
          commentary: content?.shareCommentary?.text?.substring(0, 100)
        });
        
        if (content) {
          const postId = event.resourceId || `changelog_${index}`;
          const createdAt = event.capturedAt || event.processedAt || Date.now();
          const commentary = content.shareCommentary?.text || '';
          
          console.log(`🔍 CHANGELOG DEBUG: Creating post:`, {
            postId: postId.substring(0, 30),
            createdAt: new Date(createdAt).toISOString(),
            commentaryLength: commentary.length,
            commentaryPreview: commentary.substring(0, 100)
          });
          
          posts.push({
            id: postId,
            content: commentary,
            createdAt: createdAt,
            likes: 0,
            comments: 0,
            reposts: 0,
            url: `https://linkedin.com/feed/activity/${postId}`,
            author: 'You'
          });
        } else {
          console.log(`🔍 CHANGELOG DEBUG: No ShareContent found in element ${index}`);
        }
      } catch (error) {
        console.warn(`🔍 CHANGELOG DEBUG: Error processing element ${index}:`, error);
      }
    } else {
      console.log(`🔍 CHANGELOG DEBUG: Skipping element ${index}: ${event.resourceName}/${event.method}`);
    }
  });

  console.log(`🔍 CHANGELOG DEBUG: Final result: ${posts.length} posts extracted`);
  return posts;
};

// FIXED: Enhanced snapshot processing with relaxed validation and better field mapping
const extractSnapshotPosts = (snapshotData: any): PostData[] => {
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
      hasContent: !!(item['Share Commentary'] || item['share_commentary'] || item.shareCommentary || item['Commentary'] || item.commentary),
      allValues: item
    });
    
    try {
      // ENHANCED: Multiple field name variations with fallbacks
      const url = item['Share URL'] || item['share_url'] || item.shareUrl || 
                 item['URL'] || item.url || item.ShareLink || item['Share Link'];
      
      const date = item['Share Date'] || item['share_date'] || item.shareDate || 
                  item['Date'] || item.date || item['Published Date'] || item.publishedAt;
                  
      const content = item['Share Commentary'] || item['share_commentary'] || 
                     item.shareCommentary || item['Commentary'] || item.commentary || 
                     item.Content || item.text || item.Text || '';
                     
      const visibility = item['Visibility'] || item.visibility || 'PUBLIC';
      const mediaType = item['Media Type'] || item['media_type'] || item.mediaType || 'TEXT';

      console.log(`🔍 SNAPSHOT DEBUG: Extracted fields for item ${index}:`, {
        hasUrl: !!url,
        hasContent: !!content,
        hasDate: !!date,
        urlPreview: url?.substring(0, 50),
        contentPreview: content?.substring(0, 50),
        date: date,
        visibility: visibility,
        contentLength: content?.length || 0
      });

      // FIXED: Relaxed validation - accept posts with URL OR content OR date
      // Only skip if ALL critical fields are missing
      if (!url && !content && !date) {
        console.log(`🔍 SNAPSHOT DEBUG: Skipping item ${index}: ALL critical fields missing (URL, content, date)`);
        return;
      }

      // ENHANCED: Better post ID extraction
      let postId = `snapshot_${index}`;
      if (url) {
        const activityMatch = url.match(/activity[:-](\d+)/);
        const ugcMatch = url.match(/ugcPost[:-](\d+)/);
        const shareMatch = url.match(/share[:-](\d+)/);
        if (activityMatch) postId = activityMatch[1];
        else if (ugcMatch) postId = ugcMatch[1];
        else if (shareMatch) postId = shareMatch[1];
      }

      // ENHANCED: Better date parsing with fallbacks
      let timestamp = Date.now();
      if (date) {
        try {
          // Handle various date formats
          const parsedDate = new Date(date.replace(/-/g, '/'));
          if (!isNaN(parsedDate.getTime())) {
            timestamp = parsedDate.getTime();
          } else {
            // Try parsing as ISO string or timestamp
            const isoDate = new Date(date);
            if (!isNaN(isoDate.getTime())) {
              timestamp = isoDate.getTime();
            }
          }
        } catch (e) {
          console.warn(`🔍 SNAPSHOT DEBUG: Could not parse date for item ${index}:`, date);
          // Use a very old timestamp to indicate this is historical content
          timestamp = new Date('2020-01-01').getTime();
        }
      }

      // ENHANCED: Better content handling
      const finalContent = content || `Historical post from ${new Date(timestamp).toLocaleDateString()}`;
      const finalUrl = url || `#post-${postId}`;

      console.log(`🔍 SNAPSHOT DEBUG: Creating post for item ${index}:`, {
        postId,
        contentLength: finalContent.length,
        timestamp: new Date(timestamp).toISOString(),
        hasRealUrl: !!url,
        finalContentPreview: finalContent.substring(0, 50)
      });

      posts.push({
        id: postId,
        content: finalContent,
        createdAt: timestamp,
        likes: 0, // Will be enriched later with engagement data
        comments: 0,
        reposts: 0,
        url: finalUrl,
        author: 'You'
      });

    } catch (error) {
      console.warn(`🔍 SNAPSHOT DEBUG: Error processing item ${index}:`, error);
    }
  });

  console.log(`🔍 SNAPSHOT DEBUG: Final result: ${posts.length} posts extracted`);
  console.log(`🔍 SNAPSHOT DEBUG: Date range: ${posts.length > 0 ? 
    `${new Date(Math.min(...posts.map(p => p.createdAt))).toLocaleDateString()} - ${new Date(Math.max(...posts.map(p => p.createdAt))).toLocaleDateString()}` : 
    'No posts'}`);
  
  return posts;
};

// Cache management functions
export const getCachedPostPulseData = (userId: string, isAllTime = false): PostPulseData | null => {
  try {
    const cacheKey = (isAllTime ? ALL_TIME_CACHE_KEY_PREFIX : CACHE_KEY_PREFIX) + userId;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) {
      console.log(`No ${isAllTime ? 'all-time' : 'recent'} cache found`);
      return null;
    }

    const cacheData = JSON.parse(cached);
    
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

export const clearPostPulseCache = (userId?: string): void => {
  if (userId) {
    localStorage.removeItem(CACHE_KEY_PREFIX + userId);
    localStorage.removeItem(ALL_TIME_CACHE_KEY_PREFIX + userId);
    console.log('Cleared PostPulse cache for user:', userId);
  } else {
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

// ENHANCED: Main function with improved error handling and logging
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
      
      const snapshotResponse = await fetch(
        '/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO&getAllPosts=true&maxPages=50&count=100',
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('🔍 ALL-TIME API Response:', {
        status: snapshotResponse.status,
        statusText: snapshotResponse.statusText,
        ok: snapshotResponse.ok
      });

      if (snapshotResponse.ok) {
        const snapshotData = await snapshotResponse.json();
        console.log('🔍 ALL-TIME API Data:', {
          success: snapshotData.success,
          allTimeData: snapshotData.allTimeData,
          totalPosts: snapshotData.pagination?.totalPosts,
          dateRange: snapshotData.dateRange,
          hasElements: !!snapshotData.elements,
          elementsLength: snapshotData.elements?.length,
          firstElementKeys: snapshotData.elements?.[0] ? Object.keys(snapshotData.elements[0]) : []
        });

        if (snapshotData.success && snapshotData.elements?.[0]?.snapshotData) {
          const snapshotPosts = extractSnapshotPosts(snapshotData.elements[0].snapshotData);
          console.log(`✅ Extracted ${snapshotPosts.length} all-time posts`);
          allPosts.push(...snapshotPosts);
        }
      } else {
        const errorText = await snapshotResponse.text();
        console.warn('All-time snapshot API failed:', snapshotResponse.status, errorText);
      }
    } else {
      console.log('🔄 Fetching RECENT posts (90 most recent)...');
      
      // Fetch changelog first
      console.log('🔍 Fetching changelog...');
      const changelogResponse = await fetch('/.netlify/functions/linkedin-changelog?count=100', {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('🔍 CHANGELOG API Response:', {
        status: changelogResponse.status,
        statusText: changelogResponse.statusText,
        ok: changelogResponse.ok
      });

      if (changelogResponse.ok) {
        const changelogData = await changelogResponse.json();
        console.log('🔍 CHANGELOG API Data structure:', {
          hasElements: !!changelogData.elements,
          elementsLength: changelogData.elements?.length,
          keys: Object.keys(changelogData || {}),
          firstElementKeys: changelogData.elements?.[0] ? Object.keys(changelogData.elements[0]) : []
        });
        
        const changelogPosts = extractChangelogPosts(changelogData);
        allPosts.push(...changelogPosts);
        console.log(`📊 Added ${changelogPosts.length} posts from changelog`);
      } else {
        const errorText = await changelogResponse.text();
        console.warn('Changelog API failed:', changelogResponse.status, errorText);
      }

      // Fetch snapshot
      console.log('🔍 Fetching snapshot...');
      const snapshotResponse = await fetch('/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO', {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('🔍 SNAPSHOT API Response:', {
        status: snapshotResponse.status,
        statusText: snapshotResponse.statusText,
        ok: snapshotResponse.ok
      });

      if (snapshotResponse.ok) {
        const snapshotData = await snapshotResponse.json();
        console.log('🔍 SNAPSHOT API Data structure:', {
          hasElements: !!snapshotData.elements,
          elementsLength: snapshotData.elements?.length,
          hasSnapshotData: !!snapshotData.elements?.[0]?.snapshotData,
          snapshotDataLength: snapshotData.elements?.[0]?.snapshotData?.length,
          keys: Object.keys(snapshotData || {}),
          firstElementKeys: snapshotData.elements?.[0] ? Object.keys(snapshotData.elements[0]) : [],
          firstSnapshotDataKeys: snapshotData.elements?.[0]?.snapshotData?.[0] ? Object.keys(snapshotData.elements[0].snapshotData[0]) : []
        });
        
        const snapshotPosts = extractSnapshotPosts(snapshotData.elements?.[0]?.snapshotData || []);
        allPosts.push(...snapshotPosts);
        console.log(`📸 Added ${snapshotPosts.length} posts from snapshot`);
      } else {
        const errorText = await snapshotResponse.text();
        console.warn('Snapshot API failed:', snapshotResponse.status, errorText);
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
    
    // Calculate date range
    let dateRange = '';
    if (finalPosts.length > 0) {
      const oldestDate = new Date(Math.min(...finalPosts.map(p => p.createdAt)));
      const newestDate = new Date(Math.max(...finalPosts.map(p => p.createdAt)));
      dateRange = `${oldestDate.toLocaleDateString()} - ${newestDate.toLocaleDateString()}`;
    }
    
    console.log(`📅 Date range: ${dateRange}`);

    // Cache the results
    const result: PostPulseData = {
      posts: finalPosts,
      isCached: false,
      timestamp: new Date().toISOString(),
      totalCount: finalPosts.length,
      isAllTime: showAllTime,
      dateRange
    };

    try {
      const cacheKey = (showAllTime ? ALL_TIME_CACHE_KEY_PREFIX : CACHE_KEY_PREFIX) + user_id;
      const cacheData = {
        posts: finalPosts,
        timestamp: Date.now(),
        lastFetch: result.timestamp,
        totalCount: finalPosts.length,
        isAllTime: showAllTime,
        dateRange
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      const cacheSize = Math.round(JSON.stringify(cacheData).length / 1024);
      console.log(`📦 Cached ${finalPosts.length} ${showAllTime ? 'all-time' : 'recent'} posts (${cacheSize}KB)`);
    } catch (cacheError) {
      console.warn('Failed to cache posts:', cacheError);
    }

    const duration = Date.now() - (performance.now ? performance.now() : 0);
    console.log(`✅ Loaded ${finalPosts.length} posts in ${Math.round(duration)}ms`);

    return result;

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

// ENHANCED: Post filtering and processing function
export const processPostPulseData = (posts: PostData[], filters: PostPulseFilters): PostData[] => {
  let filtered = [...posts];

  // Filter by post type
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

  // Filter by search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(post => 
      post.content.toLowerCase().includes(query)
    );
  }

  // Sort posts
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

// Repurpose status helper
export interface RepurposeStatus {
  canRepurpose: boolean;
  daysOld: number;
  reason?: string;
}

export const getRepurposeStatus = (post: PostData): RepurposeStatus => {
  const now = Date.now();
  const postDate = post.createdAt;
  const daysOld = Math.floor((now - postDate) / (1000 * 60 * 60 * 24));
  
  const canRepurpose = daysOld >= 30;
  
  return {
    canRepurpose,
    daysOld,
    reason: canRepurpose ? 
      `Post is ${daysOld} days old (30+ days rule met)` : 
      `Post is only ${daysOld} days old (need 30+ days)`
  };
};

// ENHANCED: Repurpose post function - handles navigation to PostGen
export const repurposePost = (post: PostData): void => {
  try {
    // Store post data for PostGen to access
    const repurposeData = {
      text: post.content,
      id: post.id,
      createdAt: post.createdAt,
      media_url: post.url,
      linkedin_url: post.url,
      source: 'postpulse'
    };

    // Store in sessionStorage for PostGen to pick up
    sessionStorage.setItem('postgen_repurpose_post', JSON.stringify(repurposeData));
    
    // Navigate to PostGen - check if we're in a React Router context
    if (typeof window !== 'undefined') {
      // Try to use React Router navigation if available
      const event = new CustomEvent('navigate', { detail: { path: '/postgen', tab: 'rewrite' } });
      window.dispatchEvent(event);
      
      // Fallback: direct navigation
      setTimeout(() => {
        if (window.location.pathname !== '/postgen') {
          window.location.href = '/postgen?tab=rewrite';
        }
      }, 100);
    }
    
    console.log('Post prepared for repurposing:', repurposeData);
  } catch (error) {
    console.error('Error repurposing post:', error);
  }
};