// netlify/functions/synergy-posts.mjs
// Fetch real LinkedIn posts using the same method as PostPulse

export async function handler(event, context) {
  const startTime = Date.now();
  console.log('🚀 SYNERGY POSTS: Handler started', {
    method: event.httpMethod,
    timestamp: new Date().toISOString(),
    headers: Object.keys(event.headers || {}),
    queryParams: event.queryStringParameters
  });

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    console.log('✅ CORS preflight handled');
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    };
  }

  if (event.httpMethod !== "GET") {
    console.log('❌ Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: "Method not allowed", 
        expected: "GET",
        received: event.httpMethod 
      }),
    };
  }

  try {
    const { authorization } = event.headers;
    const { partnerUserId, limit = "3", currentUserId } = event.queryStringParameters || {};

    console.log("=== SYNERGY POSTS DEBUG ===");
    console.log("🔍 Query Parameters:", {
      partnerUserId,
      limit,
      currentUserId,
      authPresent: !!authorization
    });

    if (!partnerUserId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "partnerUserId parameter is required",
          received: event.queryStringParameters 
        }),
      };
    }

    if (!authorization) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Authorization header is required" }),
      };
    }

    // Extract token from Authorization header
    const token = authorization.replace('Bearer ', '');
    console.log('🔑 Token extracted, length:', token.length);

    // Get partner's sync status
    const partnerSyncStatus = await getPartnerSyncStatus(partnerUserId);
    console.log('👥 Partner sync status:', partnerSyncStatus);

    // Fetch posts from cache/database first
    let cachedPosts = await getCachedPosts(partnerUserId);
    console.log('💾 Cached posts:', cachedPosts ? `${cachedPosts.posts?.length || 0} posts` : 'none');

    // If no cached posts or cache is stale, fetch from LinkedIn
    if (!cachedPosts || isCacheStale(cachedPosts.fetchedAt)) {
      console.log('🔄 Fetching fresh posts from LinkedIn using PostPulse method...');
      
      try {
        // Get partner's token to fetch their posts
        const partnerToken = await getPartnerToken(partnerUserId);
        if (!partnerToken) {
          throw new Error('Partner token not found - partner may not have completed DMA authentication');
        }

        const freshPosts = await fetchPartnerPostsFromLinkedInSnapshot(partnerToken, partnerUserId, parseInt(limit));
        console.log('✅ Fresh posts fetched:', freshPosts.length);
        
        // Cache the posts
        await cachePosts(partnerUserId, freshPosts);
        
        cachedPosts = {
          posts: freshPosts,
          fetchedAt: new Date().toISOString()
        };
      } catch (linkedinError) {
        console.error('❌ LinkedIn API error:', linkedinError);
        
        // If we have stale cache, use it
        if (cachedPosts) {
          console.log('🔄 Using stale cache due to API error');
        } else {
          // Return empty posts instead of error
          console.log('📝 No cache available, returning empty posts');
          cachedPosts = {
            posts: [],
            fetchedAt: new Date().toISOString()
          };
        }
      }
    }

    const posts = cachedPosts.posts || [];
    console.log(`📊 Returning ${posts.length} posts`);

    const response = {
      posts: posts,
      source: cachedPosts.fetchedAt && posts.length > 0 ? "cached" : "live",
      fetchedAt: cachedPosts.fetchedAt || new Date().toISOString(),
      count: posts.length,
      cacheAge: cachedPosts.fetchedAt ? 
        Math.round((new Date().getTime() - new Date(cachedPosts.fetchedAt).getTime()) / (1000 * 60 * 60)) + " hours" : 
        "No cache",
      partnerSyncStatus,
      debugInfo: {
        partnerId: partnerUserId,
        cacheHit: !!cachedPosts.fetchedAt,
        processingTime: Date.now() - startTime
      }
    };

    console.log('📤 Sending response:', {
      postsCount: response.posts.length,
      source: response.source,
      processingTime: response.debugInfo.processingTime
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(response),
    };
    
  } catch (error) {
    console.error("❌ Synergy posts error:", {
      error: error.message,
      stack: error.stack,
      partnerUserId: event.queryStringParameters?.partnerUserId,
      processingTime: Date.now() - startTime
    });
    
    return {
      statusCode: 200, // Return 200 with empty posts instead of 500
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        posts: [],
        source: "error_fallback",
        fetchedAt: new Date().toISOString(),
        count: 0,
        error: error.message,
        debugInfo: {
          partnerId: event.queryStringParameters?.partnerUserId,
          processingTime: Date.now() - startTime
        }
      }),
    };
  }
}

/**
 * Fetch partner posts using LinkedIn Snapshot API (EXACT same method as PostPulse)
 */
async function fetchPartnerPostsFromLinkedInSnapshot(userToken, userId, limit = 3) {
  console.log(`📡 Fetching posts from LinkedIn Snapshot API for user: ${userId}`);
  
  try {
    // EXACT same API call as PostPulse
    const snapshotUrl = 'https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO';
    
    console.log(`📞 Calling LinkedIn Snapshot API: ${snapshotUrl}`);
    
    const response = await fetch(snapshotUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'LinkedIn-Version': '202312',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    console.log(`📊 LinkedIn Snapshot API response status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.log('📭 No posts found in Snapshot API (404 - normal for new users)');
        return [];
      }
      
      const errorText = await response.text();
      console.error('❌ LinkedIn Snapshot API error response:', errorText);
      throw new Error(`LinkedIn Snapshot API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`📋 Snapshot API response:`, {
      hasElements: !!data.elements,
      elementsCount: data.elements?.length || 0,
      firstElementDomain: data.elements?.[0]?.snapshotDomain,
      snapshotDataCount: data.elements?.[0]?.snapshotData?.length || 0
    });

    if (!data.elements || !data.elements[0] || !data.elements[0].snapshotData) {
      console.log('📭 No snapshot data found for MEMBER_SHARE_INFO domain');
      return [];
    }

    const shareInfo = data.elements[0].snapshotData;
    console.log(`📝 Processing ${shareInfo.length} posts from snapshot data`);

    const posts = [];

    // Process snapshot data to extract posts (EXACT same logic as PostPulse)
    for (let index = 0; index < Math.min(shareInfo.length, 50); index++) {
      try {
        const item = shareInfo[index];
        const post = await extractPostFromSnapshotItem(item, index);
        
        if (post) {
          posts.push(post);
          
          // Limit to latest posts for synergy partners
          if (posts.length >= limit) {
            break;
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Error processing snapshot item ${index}:`, error.message);
        // Continue processing other items
      }
    }

    console.log(`✅ Successfully processed ${posts.length} posts from ${shareInfo.length} snapshot items`);
    
    // Sort by date (newest first) and return limited results
    posts.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return posts.slice(0, limit);

  } catch (error) {
    console.error('❌ Error fetching posts from LinkedIn Snapshot API:', error);
    throw error;
  }
}

/**
 * Extract post data from LinkedIn Snapshot item (EXACT same logic as PostPulse)
 */
async function extractPostFromSnapshotItem(item, index) {
  try {
    // ENHANCED: Try multiple field name variations for content (same as PostPulse)
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

    // Only process items with content
    if (!content || content.trim().length === 0) {
      return null;
    }

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

    // Extract date (EXACT same logic as PostPulse)
    let shareDate = 
      item['Share Date'] ||
      item['Date'] ||
      item['created_at'] ||
      item['timestamp'] ||
      item['shareDate'];

    // Convert date to timestamp
    let createdAtMs;
    if (shareDate) {
      if (typeof shareDate === 'string') {
        createdAtMs = new Date(shareDate).getTime();
      } else if (typeof shareDate === 'number') {
        createdAtMs = shareDate;
      } else {
        createdAtMs = Date.now();
      }
    } else {
      createdAtMs = Date.now();
    }

    // ENHANCED: Extract media information (same as PostPulse)
    const mediaUrl = 
      item['MediaUrl'] ||        // LinkedIn's media field
      item['Media URL'] ||
      item['media_url'] ||
      item['mediaUrl'] ||
      item['image'] ||
      item['ImageUrl'] ||
      '';

    // Determine media type from URL or field
    let mediaType = 'TEXT';
    if (mediaUrl) {
      const urlLower = mediaUrl.toLowerCase();
      if (urlLower.includes('image') || urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
        mediaType = 'IMAGE';
      } else if (urlLower.includes('video') || urlLower.match(/\.(mp4|mov|avi|wmv|webm)(\?|$)/i)) {
        mediaType = 'VIDEO';
      } else if (urlLower.match(/\.(pdf|doc|docx|ppt|pptx)(\?|$)/i)) {
        mediaType = 'DOCUMENT';
      } else {
        mediaType = 'ARTICLE';
      }
    }

    // Extract engagement metrics (same as PostPulse)
    const likesCount = parseInt(item['LikesCount'] || item['Likes Count'] || item['likes'] || '0');
    const commentsCount = parseInt(item['CommentsCount'] || item['Comments Count'] || item['comments'] || '0');
    const sharesCount = parseInt(item['SharesCount'] || item['Shares Count'] || item['shares'] || '0');

    // Extract hashtags from content
    const hashtags = extractHashtags(content);
    
    // Extract mentions from content
    const mentions = extractMentions(content);

    // Generate post URN (similar to PostPulse)
    const postUrn = shareUrl ? 
      `urn:li:activity:${shareUrl.split('/').pop()}` : 
      `urn:li:activity:${Date.now()}-${index}`;

    // Generate LinkedIn post ID for external link
    const linkedinPostId = shareUrl ? shareUrl.split('/').pop() : null;

    // Create full text and preview (same as PostPulse)
    const fullText = content;
    const textPreview = fullText.length > 200 ? fullText.substring(0, 200) + '...' : fullText;

    const processedPost = {
      postUrn: postUrn,
      linkedinPostId: linkedinPostId,
      createdAtMs: createdAtMs,
      textPreview: textPreview,
      fullText: fullText, // IMPORTANT: Include full text for modal
      mediaType: mediaType,
      hashtags: hashtags,
      mentions: mentions,
      visibility: item['Visibility'] || 'PUBLIC',
      likesCount: likesCount,
      commentsCount: commentsCount,
      sharesCount: sharesCount,
      impressions: likesCount + commentsCount + sharesCount, // Approximate
      clicks: 0,
      savesCount: 0,
      engagementRate: calculateEngagementRate(likesCount, commentsCount, sharesCount),
      reachScore: likesCount + commentsCount + sharesCount,
      algorithmScore: calculateAlgorithmScore(likesCount, commentsCount, sharesCount),
      sentimentScore: 0,
      repurposeEligible: isRepurposeEligible(createdAtMs),
      repurposeDate: getRepurposeDate(createdAtMs),
      performanceTier: 'UNKNOWN', // Don't show performance indicators
      rawData: item,
      fetchedAt: new Date().toISOString()
    };

    console.log('✅ Processed post:', {
      postUrn: processedPost.postUrn,
      hasFullText: !!processedPost.fullText,
      fullTextLength: processedPost.fullText?.length || 0,
      textPreviewLength: processedPost.textPreview?.length || 0,
      mediaType: processedPost.mediaType,
      createdAt: new Date(processedPost.createdAtMs).toISOString(),
      engagement: `${likesCount}/${commentsCount}/${sharesCount}`
    });

    return processedPost;

  } catch (error) {
    console.error('❌ Failed to process post data:', error);
    return null;
  }
}

/**
 * Helper functions (same as PostPulse)
 */
function extractHashtags(text) {
  if (!text) return [];
  const hashtags = text.match(/#[\w]+/g);
  return hashtags ? hashtags.map(tag => tag.substring(1)) : [];
}

function extractMentions(text) {
  if (!text) return [];
  const mentions = text.match(/@[\w]+/g);
  return mentions ? mentions.map(mention => mention.substring(1)) : [];
}

function calculateEngagementRate(likes, comments, shares) {
  const total = likes + comments + shares;
  const estimated_views = Math.max(total * 10, 100); // Estimate views
  return Math.round((total / estimated_views) * 100 * 100) / 100;
}

function calculateAlgorithmScore(likes, comments, shares) {
  return Math.min(100, (likes + comments * 2 + shares * 3));
}

function isRepurposeEligible(createdAtMs) {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return (now - createdAtMs) > thirtyDaysMs;
}

function getRepurposeDate(createdAtMs) {
  const date = new Date(createdAtMs);
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}

/**
 * Get partner's LinkedIn token from database
 */
async function getPartnerToken(partnerUserId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user, error } = await supabase
      .from('users')
      .select('linkedin_dma_token, linkedin_basic_token')
      .eq('id', partnerUserId)
      .single();

    if (error) {
      console.error('❌ Failed to get partner token:', error);
      return null;
    }

    return user.linkedin_dma_token || user.linkedin_basic_token;

  } catch (error) {
    console.error('❌ Database error getting partner token:', error);
    return null;
  }
}

/**
 * Get partner's sync status from database
 */
async function getPartnerSyncStatus(partnerUserId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('users')
      .select('last_posts_sync, posts_sync_status, dma_active')
      .eq('id', partnerUserId)
      .single();

    if (error) {
      console.warn('⚠️ Could not get partner sync status:', error);
      return { status: 'unknown' };
    }

    return {
      status: data.posts_sync_status || 'unknown',
      lastSync: data.last_posts_sync,
      dmaActive: data.dma_active || false
    };

  } catch (error) {
    console.error('❌ Database error:', error);
    return { status: 'error' };
  }
}

/**
 * Get cached posts from database
 */
async function getCachedPosts(partnerUserId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('post_cache')
      .select('posts_data, fetched_at')
      .eq('user_id', partnerUserId)
      .eq('cache_type', 'synergy_posts')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('💾 No cached posts found for partner:', partnerUserId);
      return null;
    }

    return {
      posts: data.posts_data || [],
      fetchedAt: data.fetched_at
    };

  } catch (error) {
    console.error('❌ Cache read error:', error);
    return null;
  }
}

/**
 * Cache posts to database
 */
async function cachePosts(partnerUserId, posts) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
      .from('post_cache')
      .upsert({
        user_id: partnerUserId,
        cache_type: 'synergy_posts',
        posts_data: posts,
        fetched_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,cache_type'
      });

    if (error) {
      console.error('❌ Cache write error:', error);
    } else {
      console.log('💾 Posts cached for partner:', partnerUserId);
    }

  } catch (error) {
    console.error('❌ Cache write error:', error);
  }
}

/**
 * Check if cache is stale (older than 1 hour)
 */
function isCacheStale(fetchedAt) {
  if (!fetchedAt) return true;
  
  const now = new Date().getTime();
  const cacheTime = new Date(fetchedAt).getTime();
  const oneHour = 60 * 60 * 1000;
  
  return (now - cacheTime) > oneHour;
}