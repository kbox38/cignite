import crypto from 'crypto';

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

const getUserHash = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 12);
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
      hasContent: !!(item['Commentary'] || item['comment'] || item['content'] || item['text']),
      hasDate: !!(item['Date'] || item['created_at'] || item['timestamp']),
      sampleFields: {
        commentary: typeof item['Commentary'],
        shareUrl: typeof item['Share URL'],
        date: typeof item['Date']
      }
    });

    try {
      // ENHANCED: Try multiple field name variations for content
      const content = 
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

      // Generate ID from content hash or use URL
      const postId = shareUrl ? 
        shareUrl.split('/').pop() || `snapshot_${index}` : 
        `snapshot_${crypto.createHash('md5').update(content).digest('hex').substring(0, 8)}`;

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
export const fetchPostPulseData = async (
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