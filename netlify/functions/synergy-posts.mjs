// netlify/functions/synergy-posts.mjs
// Enhanced synergy-posts function with full text content support

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
    const { partnerUserId, limit = "5", currentUserId } = event.queryStringParameters || {};

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
      console.log('🔄 Fetching fresh posts from LinkedIn...');
      
      try {
        const freshPosts = await fetchPostsFromLinkedIn(token, partnerUserId, parseInt(limit));
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
          throw linkedinError;
        }
      }
    }

    const posts = cachedPosts.posts || [];
    console.log(`📊 Returning ${posts.length} posts`);

    const response = {
      posts: posts,
      source: cachedPosts.fetchedAt ? "cached" : "live",
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
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: "Failed to fetch partner posts",
        message: error.message,
        debugInfo: {
          partnerId: event.queryStringParameters?.partnerUserId,
          processingTime: Date.now() - startTime
        }
      }),
    };
  }
}

/**
 * Fetch posts from LinkedIn DMA API with full text content
 */
async function fetchPostsFromLinkedIn(token, partnerUserId, limit = 5) {
  try {
    console.log('🔗 Fetching posts from LinkedIn for user:', partnerUserId);

    // First, get the partner's DMA member URN
    const memberUrn = await getPartnerMemberUrn(partnerUserId);
    if (!memberUrn) {
      throw new Error('Partner member URN not found');
    }

    console.log('👤 Partner member URN:', memberUrn);

    // Fetch posts from MEMBER_SHARE_INFO domain
    const snapshotResponse = await fetch(
      `https://api.linkedin.com/rest/memberSnapshots?q=criteria&profiles=${encodeURIComponent(memberUrn)}&domains=MEMBER_SHARE_INFO&start=0&count=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202405'
        }
      }
    );

    if (!snapshotResponse.ok) {
      const errorText = await snapshotResponse.text();
      throw new Error(`LinkedIn API error: ${snapshotResponse.status} ${snapshotResponse.statusText} - ${errorText}`);
    }

    const snapshotData = await snapshotResponse.json();
    console.log('📊 Snapshot response:', {
      hasElements: !!snapshotData.elements,
      elementsCount: snapshotData.elements?.length || 0
    });

    if (!snapshotData.elements || snapshotData.elements.length === 0) {
      console.log('⚠️ No snapshot data found for partner');
      return [];
    }

    // Process snapshot data to extract posts
    const posts = [];
    
    for (const element of snapshotData.elements) {
      if (element.snapshotData && element.snapshotData.length > 0) {
        for (const snapshot of element.snapshotData) {
          try {
            // Parse the snapshot data
            const postData = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
            
            if (postData.shareUrn || postData.ugcPostUrn || postData.activityUrn) {
              const processedPost = await processPostData(postData, token);
              if (processedPost) {
                posts.push(processedPost);
              }
            }
          } catch (parseError) {
            console.warn('⚠️ Failed to parse post data:', parseError.message);
          }
        }
      }
    }

    console.log(`✅ Processed ${posts.length} posts from snapshot data`);
    
    // Sort posts by creation date (newest first)
    posts.sort((a, b) => b.createdAtMs - a.createdAtMs);
    
    return posts.slice(0, limit);

  } catch (error) {
    console.error('❌ Failed to fetch posts from LinkedIn:', error);
    throw error;
  }
}

/**
 * Process individual post data with full text extraction
 */
async function processPostData(postData, token) {
  try {
    const postUrn = postData.shareUrn || postData.ugcPostUrn || postData.activityUrn;
    const createdAtMs = postData.createdAt || postData.created?.time || Date.now();
    
    // Extract text content (both preview and full)
    let textPreview = '';
    let fullText = '';
    
    if (postData.text) {
      fullText = postData.text;
      textPreview = fullText.length > 200 ? fullText.substring(0, 200) + '...' : fullText;
    } else if (postData.commentary) {
      fullText = postData.commentary;
      textPreview = fullText.length > 200 ? fullText.substring(0, 200) + '...' : fullText;
    } else if (postData.content && postData.content.commentary) {
      fullText = postData.content.commentary;
      textPreview = fullText.length > 200 ? fullText.substring(0, 200) + '...' : fullText;
    }

    // Extract media type
    let mediaType = 'TEXT';
    if (postData.content) {
      if (postData.content.media) {
        mediaType = 'IMAGE';
      } else if (postData.content.article) {
        mediaType = 'ARTICLE';
      } else if (postData.content.video) {
        mediaType = 'VIDEO';
      }
    }

    // Extract engagement metrics
    const engagement = postData.socialDetail || postData.engagement || {};
    
    // Extract hashtags from text
    const hashtags = extractHashtags(fullText);
    
    // Extract mentions from text
    const mentions = extractMentions(fullText);

    // Generate LinkedIn post ID for external link
    const linkedinPostId = generateLinkedInPostId(postUrn);

    const processedPost = {
      postUrn: postUrn,
      linkedinPostId: linkedinPostId,
      createdAtMs: typeof createdAtMs === 'number' ? createdAtMs : new Date(createdAtMs).getTime(),
      textPreview: textPreview,
      fullText: fullText, // IMPORTANT: Include full text for modal
      mediaType: mediaType,
      hashtags: hashtags,
      mentions: mentions,
      visibility: postData.visibility || 'PUBLIC',
      likesCount: engagement.numLikes || engagement.likes || 0,
      commentsCount: engagement.numComments || engagement.comments || 0,
      sharesCount: engagement.numShares || engagement.shares || 0,
      impressions: engagement.numViews || engagement.impressions || 0,
      clicks: engagement.numClicks || engagement.clicks || 0,
      savesCount: engagement.numSaves || 0,
      engagementRate: calculateEngagementRate(engagement),
      reachScore: engagement.numViews || 0,
      algorithmScore: calculateAlgorithmScore(engagement),
      sentimentScore: 0, // TODO: Implement sentiment analysis
      repurposeEligible: isRepurposeEligible(createdAtMs),
      repurposeDate: getRepurposeDate(createdAtMs),
      performanceTier: calculatePerformanceTier(engagement),
      rawData: postData,
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
    console.error('❌ Failed to process post data:', error);
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

function generateLinkedInPostId(postUrn) {
  if (!postUrn) return null;
  // Extract activity ID from URN for LinkedIn URL
  const match = postUrn.match(/urn:li:activity:(\d+)/);
  return match ? match[1] : null;
}

function calculateEngagementRate(engagement) {
  const total = (engagement.numLikes || 0) + (engagement.numComments || 0) + (engagement.numShares || 0);
  const views = engagement.numViews || engagement.impressions || 1;
  return Math.round((total / views) * 100 * 100) / 100; // Round to 2 decimal places
}

function calculateAlgorithmScore(engagement) {
  // Simple algorithm score based on engagement
  const likes = engagement.numLikes || 0;
  const comments = engagement.numComments || 0;
  const shares = engagement.numShares || 0;
  const views = engagement.numViews || 1;
  
  return Math.round(((likes + comments * 2 + shares * 3) / views) * 100);
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

function calculatePerformanceTier(engagement) {
  const total = (engagement.numLikes || 0) + (engagement.numComments || 0) + (engagement.numShares || 0);
  
  if (total >= 100) return 'HIGH';
  if (total >= 20) return 'MEDIUM';
  return 'LOW';
}

/**
 * Get partner's LinkedIn member URN from database
 */
async function getPartnerMemberUrn(partnerUserId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user, error } = await supabase
      .from('users')
      .select('linkedin_dma_member_urn, linkedin_member_urn')
      .eq('id', partnerUserId)
      .single();

    if (error) {
      console.error('❌ Failed to get partner member URN:', error);
      return null;
    }

    return user.linkedin_dma_member_urn || user.linkedin_member_urn;

  } catch (error) {
    console.error('❌ Database error getting member URN:', error);
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