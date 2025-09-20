// netlify/functions/synergy-posts.mjs
// Fixed to fetch real posts from LinkedIn using the same method as PostPulse

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

    // Get partner's DMA token instead of using current user's token
    const partnerToken = await getPartnerDmaToken(partnerUserId);
    
    if (!partnerToken) {
      console.log('⚠️ Partner DMA token not found, using empty posts');
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          posts: [],
          source: "no_token",
          fetchedAt: new Date().toISOString(),
          count: 0,
          message: "Partner has not granted DMA access",
          debugInfo: {
            partnerId: partnerUserId,
            processingTime: Date.now() - startTime
          }
        }),
      };
    }

    console.log('🔑 Partner DMA token found, fetching posts...');

    // Get partner's sync status
    const partnerSyncStatus = await getPartnerSyncStatus(partnerUserId);
    console.log('👥 Partner sync status:', partnerSyncStatus);

    // Fetch posts from cache/database first
    let cachedPosts = await getCachedPosts(partnerUserId);
    console.log('💾 Cached posts:', cachedPosts ? `${cachedPosts.posts?.length || 0} posts` : 'none');

    // If no cached posts or cache is stale, fetch from LinkedIn
    if (!cachedPosts || isCacheStale(cachedPosts.fetchedAt)) {
      console.log('🔄 Fetching fresh posts from LinkedIn...');
      
      try {
        const freshPosts = await fetchPostsFromLinkedIn(partnerToken, parseInt(limit));
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
 * Fetch posts from LinkedIn using the same method as PostPulse
 */
async function fetchPostsFromLinkedIn(partnerToken, limit = 3) {
  try {
    console.log('🔗 Fetching posts from LinkedIn using snapshot API...');

    // Use the same API endpoint as PostPulse - call the linkedin-snapshot function
    const snapshotResponse = await fetch(
      `https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO`,
      {
        headers: {
          'Authorization': `Bearer ${partnerToken}`,
          'LinkedIn-Version': '202312',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    if (!snapshotResponse.ok) {
      if (snapshotResponse.status === 404) {
        console.log('⚠️ No snapshot data available (404)');
        return [];
      }
      
      const errorText = await snapshotResponse.text();
      throw new Error(`LinkedIn Snapshot API error: ${snapshotResponse.status} ${snapshotResponse.statusText} - ${errorText}`);
    }

    const snapshotData = await snapshotResponse.json();
    
    console.log('📊 Snapshot response:', {
      hasElements: !!snapshotData.elements,
      elementsCount: snapshotData.elements?.length || 0,
      totalSnapshotData: snapshotData.elements?.reduce((sum, el) => sum + (el.snapshotData?.length || 0), 0)
    });

    if (!snapshotData.elements || snapshotData.elements.length === 0) {
      console.log('⚠️ No elements in snapshot data');
      return [];
    }

    // Process snapshot data like PostPulse does
    const posts = [];
    
    for (const element of snapshotData.elements) {
      if (element.snapshotData && element.snapshotData.length > 0) {
        console.log(`🔍 Processing ${element.snapshotData.length} snapshot items`);
        
        for (const item of element.snapshotData) {
          try {
            const processedPost = processSnapshotItem(item);
            if (processedPost) {
              posts.push(processedPost);
            }
          } catch (parseError) {
            console.warn('⚠️ Failed to parse snapshot item:', parseError.message);
          }
        }
      }
    }

    console.log(`✅ Processed ${posts.length} posts from snapshot data`);
    
    // Sort posts by creation date (newest first) and limit
    posts.sort((a, b) => b.createdAtMs - a.createdAtMs);
    
    return posts.slice(0, limit);

  } catch (error) {
    console.error('❌ Failed to fetch posts from LinkedIn:', error);
    throw error;
  }
}

/**
 * Process individual snapshot item (same logic as PostPulse)
 */
function processSnapshotItem(item) {
  try {
    // Extract text content using multiple field variations (same as PostPulse)
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

    // Extract URL using multiple field variations
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

    // Extract media information
    const mediaUrl = 
      item['MediaUrl'] ||        // LinkedIn's media field
      item['Media URL'] ||
      item['media_url'] ||
      item['mediaUrl'] ||
      item['image'] ||
      item['ImageUrl'] ||
      '';

    // Extract date using multiple field variations
    const dateStr = 
      item['Date'] || 
      item['Created Date'] ||
      item['created_at'] || 
      item['timestamp'] ||
      item['published_at'] ||
      item['date'] ||
      '';

    // Extract engagement metrics
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

    // Skip items without content
    if (!content || content.trim().length < 3) {
      return null;
    }

    // Parse date
    let createdAt = Date.now();
    if (dateStr) {
      const parsedDate = new Date(dateStr).getTime();
      if (!isNaN(parsedDate)) {
        createdAt = parsedDate;
      }
    }

    // Determine media type
    let mediaType = 'TEXT';
    if (mediaUrl) {
      const urlLower = mediaUrl.toLowerCase();
      if (urlLower.includes('image') || urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
        mediaType = 'IMAGE';
      } else if (urlLower.includes('video') || urlLower.match(/\.(mp4|mov|avi|wmv|webm)(\?|$)/i)) {
        mediaType = 'VIDEO';
      } else if (urlLower.match(/\.(pdf|doc|docx|ppt|pptx)(\?|$)/i)) {
        mediaType = 'ARTICLE';
      }
    }

    // Extract hashtags from text
    const hashtags = extractHashtags(content);
    
    // Extract mentions from text
    const mentions = extractMentions(content);

    // Generate LinkedIn post ID for external link
    const linkedinPostId = generateLinkedInPostId(shareUrl);

    // Generate post URN
    const postUrn = shareUrl ? 
      `urn:li:activity:${shareUrl.split('/').pop()}` : 
      `urn:li:activity:synergy-${Date.now()}`;

    const processedPost = {
      postUrn: postUrn,
      linkedinPostId: linkedinPostId,
      createdAtMs: createdAt,
      textPreview: content.length > 200 ? content.substring(0, 200) + '...' : content,
      fullText: content, // Include full text for modal
      mediaType: mediaType,
      hashtags: hashtags,
      mentions: mentions,
      visibility: 'PUBLIC',
      likesCount: likesCount,
      commentsCount: commentsCount,
      sharesCount: sharesCount,
      impressions: 0, // Not available in snapshot
      clicks: 0,
      savesCount: 0,
      engagementRate: calculateEngagementRate({
        numLikes: likesCount,
        numComments: commentsCount,
        numShares: sharesCount,
        numViews: 1000 // Default for calculation
      }),
      reachScore: 0,
      algorithmScore: 0,
      sentimentScore: 0,
      repurposeEligible: isRepurposeEligible(createdAt),
      repurposeDate: getRepurposeDate(createdAt),
      performanceTier: 'UNKNOWN', // Don't show performance tiers
      rawData: item,
      fetchedAt: new Date().toISOString()
    };

    console.log('✅ Processed post:', {
      postUrn: processedPost.postUrn,
      hasFullText: !!processedPost.fullText,
      fullTextLength: processedPost.fullText?.length || 0,
      textPreviewLength: processedPost.textPreview?.length || 0,
      mediaType: processedPost.mediaType,
      createdAt: new Date(processedPost.createdAtMs).toISOString()
    });

    return processedPost;

  } catch (error) {
    console.error('❌ Failed to process snapshot item:', error);
    return null;
  }
}

/**
 * Helper functions
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

function generateLinkedInPostId(shareUrl) {
  if (!shareUrl) return null;
  // Extract activity ID from URL
  const match = shareUrl.match(/activity-(\d+)/);
  return match ? match[1] : null;
}

function calculateEngagementRate(engagement) {
  const total = (engagement.numLikes || 0) + (engagement.numComments || 0) + (engagement.numShares || 0);
  const views = engagement.numViews || 1;
  return Math.round((total / views) * 100 * 100) / 100;
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
 * Get partner's DMA token from database
 */
async function getPartnerDmaToken(partnerUserId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user, error } = await supabase
      .from('users')
      .select('linkedin_dma_token')
      .eq('id', partnerUserId)
      .single();

    if (error) {
      console.error('❌ Failed to get partner DMA token:', error);
      return null;
    }

    return user.linkedin_dma_token;

  } catch (error) {
    console.error('❌ Database error getting DMA token:', error);
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