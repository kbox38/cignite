// netlify/functions/synergy-posts.mjs
// FIXED: Now correctly fetches posts in the right direction for synergy partners

export async function handler(event, context) {
  const startTime = Date.now();
  
  console.log('🚀 SYNERGY POSTS: Handler started', {
    method: event.httpMethod,
    timestamp: new Date().toISOString(),
    headers: Object.keys(event.headers || {}),
    queryParams: event.queryStringParameters,
    body: event.body ? 'present' : 'empty'
  });

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    console.log('✅ CORS preflight handled');
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: "",
    };
  }

  try {
    const { partnerUserId, limit = '5', currentUserId, direction = 'theirs' } = event.queryStringParameters || {};
    const authorization = event.headers.authorization || event.headers.Authorization;

    console.log('=== SYNERGY POSTS DEBUG ===');
    console.log('🔍 Query Parameters:', {
      partnerUserId,
      limit,
      currentUserId,
      direction,
      authPresent: !!authorization
    });

    if (!partnerUserId || !currentUserId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "Both partnerUserId and currentUserId parameters are required",
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

    // FIXED LOGIC: Determine whose posts to fetch and whose token to use
    let targetUserId, tokenUserId;
    
    if (direction === 'theirs') {
      // Show partner's posts TO current user - use partner's token to fetch partner's posts
      targetUserId = partnerUserId;
      tokenUserId = partnerUserId;
      console.log('🎯 DIRECTION: Fetching partner\'s posts using partner\'s token');
    } else if (direction === 'mine') {
      // Show current user's posts TO partner - use current user's token to fetch current user's posts
      targetUserId = currentUserId;
      tokenUserId = currentUserId;
      console.log('🎯 DIRECTION: Fetching current user\'s posts using current user\'s token');
    } else {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "Invalid direction parameter. Must be 'theirs' or 'mine'",
          received: { direction }
        }),
      };
    }

    console.log('🔍 POST FETCH STRATEGY:', {
      direction,
      targetUserId: `${targetUserId} (${targetUserId === currentUserId ? 'current user' : 'partner'})`,
      tokenUserId: `${tokenUserId} (${tokenUserId === currentUserId ? 'current user' : 'partner'})`,
      logic: direction === 'theirs' ? 'Partner posts via partner token' : 'User posts via user token'
    });

    // Get the appropriate DMA token for fetching posts
    const dmaToken = await getPartnerDmaToken(tokenUserId);
    
    if (!dmaToken) {
      console.log('⚠️ DMA token not found for user:', tokenUserId);
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
          message: `User ${tokenUserId} has not granted DMA access`,
          debugInfo: {
            direction,
            targetUserId,
            tokenUserId,
            processingTime: Date.now() - startTime
          }
        }),
      };
    }

    console.log('🔑 DMA token found for user:', tokenUserId);

    // Get user's sync status
    const userSyncStatus = await getPartnerSyncStatus(targetUserId);
    console.log('👥 Target user sync status:', userSyncStatus);

    // Fetch posts from cache/database first
    let cachedPosts = await getCachedPosts(targetUserId);
    console.log('💾 Cached posts for user', targetUserId, ':', cachedPosts ? cachedPosts.length : 0);

    // Fetch fresh posts from LinkedIn API using the appropriate token
    let freshPosts = [];
    try {
      freshPosts = await fetchLinkedInPosts(dmaToken, parseInt(limit));
      console.log('🆕 Fresh posts fetched using token from user', tokenUserId, ':', freshPosts.length);
      
      // Update cache if we got fresh data
      if (freshPosts.length > 0) {
        await updatePostsCache(targetUserId, freshPosts);
        console.log('✅ Posts cache updated for user:', targetUserId);
      }
    } catch (error) {
      console.error('❌ Failed to fetch fresh posts:', error);
      // Fall back to cached posts if API fails
    }

    // Combine and deduplicate posts
    const allPosts = mergeAndDeduplicatePosts(cachedPosts || [], freshPosts);
    const limitedPosts = allPosts.slice(0, parseInt(limit));

    // Process posts for response
    const processedPosts = limitedPosts.map(post => processPostForResponse(post));

    console.log(`✅ Returning ${processedPosts.length} posts from user ${targetUserId} (${targetUserId === currentUserId ? 'current user' : 'partner'})`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        posts: processedPosts,
        source: freshPosts.length > 0 ? "api_with_cache" : "cache_only",
        fetchedAt: new Date().toISOString(),
        count: processedPosts.length,
        direction,
        targetUserId,
        tokenUserId,
        userSyncStatus,
        debugInfo: {
          direction,
          targetUserId: `${targetUserId} (${targetUserId === currentUserId ? 'current user' : 'partner'})`,
          tokenUserId: `${tokenUserId} (${tokenUserId === currentUserId ? 'current user' : 'partner'})`,
          cachedCount: cachedPosts ? cachedPosts.length : 0,
          freshCount: freshPosts.length,
          totalProcessed: allPosts.length,
          processingTime: Date.now() - startTime
        }
      }),
    };

  } catch (error) {
    console.error("❌ Synergy posts error:", error);
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      }),
    };
  }
}

/**
 * Get user's DMA token from database
 */
async function getPartnerDmaToken(userId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user, error } = await supabase
      .from('users')
      .select('linkedin_dma_token')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ Failed to get DMA token for user:', userId, error);
      return null;
    }

    console.log('🔍 DMA token status for user', userId, ':', {
      hasToken: !!user?.linkedin_dma_token,
      tokenLength: user?.linkedin_dma_token?.length || 0
    });

    return user?.linkedin_dma_token || null;

  } catch (error) {
    console.error('❌ Database error getting DMA token for user:', userId, error);
    return null;
  }
}

/**
 * Get user's sync status from database
 */
async function getPartnerSyncStatus(userId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user, error } = await supabase
      .from('users')
      .select('dma_active, dma_consent_date, linkedin_dma_member_urn')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ Failed to get sync status for user:', userId, error);
      return { status: 'unknown' };
    }

    return {
      status: user.dma_active ? 'active' : 'inactive',
      consentDate: user.dma_consent_date,
      hasDmaUrn: !!user.linkedin_dma_member_urn,
      lastSync: null // Could add last_posts_sync column later
    };

  } catch (error) {
    console.error('❌ Database error getting sync status for user:', userId, error);
    return { status: 'error' };
  }
}

/**
 * Get cached posts for user
 */
async function getCachedPosts(userId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: posts, error } = await supabase
      .from('post_cache')
      .select('*')
      .eq('user_id', userId)
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Failed to get cached posts for user:', userId, error);
      return null;
    }

    return posts || [];

  } catch (error) {
    console.error('❌ Database error getting cached posts for user:', userId, error);
    return null;
  }
}

/**
 * Fetch posts from LinkedIn DMA API
 */
async function fetchLinkedInPosts(dmaToken, limit = 5) {
  try {
    // Use Member Snapshot API to get recent posts
    const snapshotResponse = await fetch(
      `https://api.linkedin.com/rest/memberSnapshot?q=member&domains=MEMBER_SHARE_INFO`,
      {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'LinkedIn-Version': '202312',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!snapshotResponse.ok) {
      throw new Error(`Snapshot API failed: ${snapshotResponse.status}`);
    }

    const snapshotData = await snapshotResponse.json();
    console.log('📊 Snapshot data received:', snapshotData.elements?.length || 0, 'items');

    // Process Member Share Info
    const posts = [];
    for (const element of snapshotData.elements || []) {
      if (element.content?.domain === 'MEMBER_SHARE_INFO') {
        const shareData = element.content.value;
        if (shareData.shares) {
          for (const share of shareData.shares) {
            if (posts.length >= limit) break;
            
            const processedPost = processLinkedInShare(share);
            if (processedPost) {
              posts.push(processedPost);
            }
          }
        }
      }
    }

    console.log(`✅ Processed ${posts.length} posts from LinkedIn API`);
    return posts;

  } catch (error) {
    console.error('❌ Failed to fetch LinkedIn posts:', error);
    throw error;
  }
}

/**
 * Process LinkedIn share data into our format
 */
function processLinkedInShare(share) {
  try {
    return {
      postUrn: share.activity || `temp-${Date.now()}`,
      linkedinPostId: extractPostId(share.activity),
      createdAtMs: share.firstPublishedAt ? new Date(share.firstPublishedAt).getTime() : Date.now(),
      textPreview: extractTextPreview(share.commentary?.text || ''),
      fullText: share.commentary?.text || '',
      mediaType: determineMediaType(share),
      mediaUrls: extractMediaUrls(share),
      hashtags: extractHashtags(share.commentary?.text || ''),
      mentions: extractMentions(share.commentary?.text || ''),
      visibility: share.distribution?.feedDistribution || 'PUBLIC',
      likesCount: 0, // Will be updated from engagement data
      commentsCount: 0,
      sharesCount: 0,
      impressions: 0,
      clicks: 0,
      savesCount: 0,
      engagementRate: 0,
      reachScore: 0,
      algorithmScore: 0,
      sentimentScore: 0,
      repurposeEligible: isRepurposeEligible(share.firstPublishedAt),
      repurposeDate: getRepurposeDate(share.firstPublishedAt),
      performanceTier: 'unknown',
      rawData: share,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error processing share:', error);
    return null;
  }
}

/**
 * Update posts cache in database
 */
async function updatePostsCache(userId, posts) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Prepare posts for database insertion
    const postsForDb = posts.map(post => ({
      user_id: userId,
      post_urn: post.postUrn,
      linkedin_post_id: post.linkedinPostId,
      content: post.fullText,
      media_type: post.mediaType,
      media_urls: post.mediaUrls,
      hashtags: post.hashtags,
      mentions: post.mentions,
      visibility: post.visibility,
      published_at: new Date(post.createdAtMs).toISOString(),
      likes_count: post.likesCount,
      comments_count: post.commentsCount,
      shares_count: post.sharesCount,
      impressions: post.impressions,
      clicks: post.clicks,
      engagement_rate: post.engagementRate,
      reach_score: post.reachScore,
      algorithm_score: post.algorithmScore,
      repurpose_eligible: post.repurposeEligible,
      repurpose_date: post.repurposeDate,
      raw_data: post.rawData,
      fetched_at: new Date().toISOString()
    }));

    // Upsert posts (insert or update on conflict)
    const { error } = await supabase
      .from('post_cache')
      .upsert(postsForDb, { 
        onConflict: 'user_id,post_urn',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('❌ Failed to update posts cache for user:', userId, error);
      throw error;
    }

    console.log(`✅ Updated cache with ${postsForDb.length} posts for user:`, userId);

  } catch (error) {
    console.error('❌ Database error updating posts cache for user:', userId, error);
    throw error;
  }
}

/**
 * Merge and deduplicate posts from cache and API
 */
function mergeAndDeduplicatePosts(cachedPosts, freshPosts) {
  const postMap = new Map();
  
  // Add cached posts first
  for (const post of cachedPosts) {
    const key = post.post_urn || post.postUrn;
    if (key) {
      postMap.set(key, {
        ...post,
        source: 'cache'
      });
    }
  }
  
  // Add fresh posts (these will overwrite cached versions)
  for (const post of freshPosts) {
    const key = post.postUrn;
    if (key) {
      postMap.set(key, {
        ...post,
        source: 'api'
      });
    }
  }
  
  // Convert back to array and sort by creation time
  const allPosts = Array.from(postMap.values());
  return allPosts.sort((a, b) => {
    const timeA = a.createdAtMs || new Date(a.published_at).getTime();
    const timeB = b.createdAtMs || new Date(b.published_at).getTime();
    return timeB - timeA; // Newest first
  });
}

/**
 * Process post for API response
 */
function processPostForResponse(post) {
  // Normalize between cached and fresh post formats
  return {
    postUrn: post.postUrn || post.post_urn,
    linkedinPostId: post.linkedinPostId || post.linkedin_post_id,
    createdAtMs: post.createdAtMs || new Date(post.published_at).getTime(),
    textPreview: post.textPreview || extractTextPreview(post.content),
    fullText: post.fullText || post.content,
    mediaType: post.mediaType || post.media_type || 'TEXT',
    mediaUrls: post.mediaUrls || post.media_urls || [],
    hashtags: post.hashtags || [],
    mentions: post.mentions || [],
    visibility: post.visibility || 'PUBLIC',
    likesCount: post.likesCount || post.likes_count || 0,
    commentsCount: post.commentsCount || post.comments_count || 0,
    sharesCount: post.sharesCount || post.shares_count || 0,
    impressions: post.impressions || 0,
    clicks: post.clicks || 0,
    savesCount: post.savesCount || 0,
    engagementRate: post.engagementRate || post.engagement_rate || 0,
    reachScore: post.reachScore || post.reach_score || 0,
    algorithmScore: post.algorithmScore || post.algorithm_score || 0,
    sentimentScore: post.sentimentScore || 0,
    repurposeEligible: post.repurposeEligible ?? post.repurpose_eligible ?? false,
    repurposeDate: post.repurposeDate || post.repurpose_date,
    performanceTier: post.performanceTier || 'unknown',
    source: post.source || 'unknown',
    fetchedAt: post.fetchedAt || post.fetched_at || new Date().toISOString()
  };
}

// Utility functions
function extractPostId(activityUrn) {
  if (!activityUrn) return null;
  const match = activityUrn.match(/urn:li:activity:(\d+)/);
  return match ? match[1] : null;
}

function extractTextPreview(text, maxLength = 200) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function determineMediaType(share) {
  if (share.content?.contentEntities?.length > 0) {
    return 'MEDIA'; // Images, videos, etc.
  }
  if (share.content?.article) {
    return 'ARTICLE';
  }
  return 'TEXT';
}

function extractMediaUrls(share) {
  const urls = [];
  if (share.content?.contentEntities) {
    for (const entity of share.content.contentEntities) {
      if (entity.url) {
        urls.push(entity.url);
      }
    }
  }
  return urls;
}

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

function isRepurposeEligible(publishedAt) {
  if (!publishedAt) return false;
  const now = Date.now();
  const publishedTime = new Date(publishedAt).getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return (now - publishedTime) > thirtyDaysMs;
}

function getRepurposeDate(publishedAt) {
  if (!publishedAt) return null;
  const date = new Date(publishedAt);
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}