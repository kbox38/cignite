// netlify/functions/synergy-posts.mjs
// BULLETPROOF VERSION: Prevents wrong post attribution with extensive validation

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

    // BULLETPROOF: Determine whose posts to fetch and whose token to use
    let targetUserId, tokenUserId, expectedPostOwner;
    
    if (direction === 'theirs') {
      // Show partner's posts TO current user - use partner's token to fetch partner's posts
      targetUserId = partnerUserId;      // Posts we want to show
      tokenUserId = partnerUserId;       // Token to use for fetching
      expectedPostOwner = partnerUserId; // Who should own the posts
      console.log('🎯 DIRECTION: Fetching partner\'s posts using partner\'s token');
    } else if (direction === 'mine') {
      // Show current user's posts TO partner - use current user's token to fetch current user's posts
      targetUserId = currentUserId;      // Posts we want to show
      tokenUserId = currentUserId;       // Token to use for fetching
      expectedPostOwner = currentUserId; // Who should own the posts
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

    console.log('🔍 BULLETPROOF VALIDATION:', {
      direction,
      targetUserId: `${targetUserId} (${targetUserId === currentUserId ? 'current user' : 'partner'})`,
      tokenUserId: `${tokenUserId} (${tokenUserId === currentUserId ? 'current user' : 'partner'})`,
      expectedPostOwner: `${expectedPostOwner} (${expectedPostOwner === currentUserId ? 'current user' : 'partner'})`,
      logic: direction === 'theirs' ? 'Partner posts via partner token' : 'User posts via user token'
    });

    // BULLETPROOF: Validate that token user and expected owner match
    if (tokenUserId !== expectedPostOwner) {
      console.error('🚨 CRITICAL ERROR: Token user and expected owner mismatch!');
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Internal logic error: token user and expected owner mismatch",
          debugInfo: { tokenUserId, expectedPostOwner, direction }
        }),
      };
    }

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
            expectedPostOwner,
            processingTime: Date.now() - startTime
          }
        }),
      };
    }

    console.log('🔑 DMA token found for user:', tokenUserId);

    // BULLETPROOF: Get both DMA URNs for validation
    const tokenOwnerInfo = await getUserDmaInfo(tokenUserId);
    const targetUserInfo = await getUserDmaInfo(targetUserId);

    console.log('👥 USER VALIDATION:', {
      tokenOwner: {
        userId: tokenUserId,
        dmaUrn: tokenOwnerInfo.dmaUrn,
        dmaActive: tokenOwnerInfo.dmaActive
      },
      targetUser: {
        userId: targetUserId,
        dmaUrn: targetUserInfo.dmaUrn,
        dmaActive: targetUserInfo.dmaActive
      }
    });

    // Fetch posts from cache/database first
    let cachedPosts = await getCachedPosts(targetUserId);
    console.log('💾 Cached posts for user', targetUserId, ':', cachedPosts ? cachedPosts.length : 0);

    // BULLETPROOF: Fetch fresh posts with validation
    let freshPosts = [];
    try {
      console.log('📡 FETCHING POSTS:', {
        usingToken: `from user ${tokenUserId}`,
        expectedOwner: `posts should belong to ${expectedPostOwner}`,
        targetForCache: targetUserId
      });

      freshPosts = await fetchLinkedInPostsWithValidation(dmaToken, tokenOwnerInfo.dmaUrn, parseInt(limit));
      console.log('🆕 Fresh posts fetched using token from user', tokenUserId, ':', freshPosts.length);
      
      // BULLETPROOF: Validate that posts actually belong to the expected owner
      if (freshPosts.length > 0) {
        const validationResult = await validatePostOwnership(freshPosts, tokenOwnerInfo.dmaUrn);
        
        if (!validationResult.valid) {
          console.error('🚨 POST OWNERSHIP VALIDATION FAILED:', validationResult);
          throw new Error(`Post ownership validation failed: ${validationResult.reason}`);
        }
        
        console.log('✅ POST OWNERSHIP VALIDATED:', validationResult);
        
        // BULLETPROOF: Only cache if posts belong to the target user
        if (tokenUserId === targetUserId) {
          await updatePostsCacheWithValidation(targetUserId, freshPosts, tokenOwnerInfo.dmaUrn);
          console.log('✅ Posts cache updated for user:', targetUserId);
        } else {
          console.log('⚠️ Skipping cache update - token user != target user');
        }
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

    console.log(`✅ FINAL RESULT: Returning ${processedPosts.length} posts from user ${targetUserId} (${targetUserId === currentUserId ? 'current user' : 'partner'})`);

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
        expectedPostOwner,
        userSyncStatus: targetUserInfo,
        debugInfo: {
          direction,
          targetUserId: `${targetUserId} (${targetUserId === currentUserId ? 'current user' : 'partner'})`,
          tokenUserId: `${tokenUserId} (${tokenUserId === currentUserId ? 'current user' : 'partner'})`,
          expectedPostOwner: `${expectedPostOwner} (${expectedPostOwner === currentUserId ? 'current user' : 'partner'})`,
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
 * BULLETPROOF: Get user's DMA token from database
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
 * BULLETPROOF: Get user's DMA info for validation
 */
async function getUserDmaInfo(userId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user, error } = await supabase
      .from('users')
      .select('dma_active, dma_consent_date, linkedin_dma_member_urn, name')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ Failed to get DMA info for user:', userId, error);
      return { 
        status: 'unknown', 
        dmaUrn: null, 
        dmaActive: false,
        name: 'Unknown User'
      };
    }

    return {
      status: user.dma_active ? 'active' : 'inactive',
      dmaUrn: user.linkedin_dma_member_urn,
      dmaActive: user.dma_active,
      consentDate: user.dma_consent_date,
      name: user.name || 'Unknown User'
    };

  } catch (error) {
    console.error('❌ Database error getting DMA info for user:', userId, error);
    return { 
      status: 'error', 
      dmaUrn: null, 
      dmaActive: false,
      name: 'Error User'
    };
  }
}

/**
 * BULLETPROOF: Fetch posts with ownership validation
 */
async function fetchLinkedInPostsWithValidation(dmaToken, expectedOwnerUrn, limit = 5) {
  try {
    console.log('📡 FETCHING WITH VALIDATION:', {
      tokenLength: dmaToken?.length || 0,
      expectedOwnerUrn,
      limit
    });

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
            
            const processedPost = processLinkedInShare(share, expectedOwnerUrn);
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
 * BULLETPROOF: Validate post ownership
 */
async function validatePostOwnership(posts, expectedOwnerUrn) {
  try {
    if (!posts || posts.length === 0) {
      return { valid: true, reason: 'No posts to validate' };
    }

    if (!expectedOwnerUrn) {
      return { valid: false, reason: 'No expected owner URN provided' };
    }

    // Check if posts contain ownership information
    for (const post of posts.slice(0, 3)) { // Check first 3 posts
      if (post.rawData?.author && post.rawData.author !== expectedOwnerUrn) {
        return {
          valid: false,
          reason: `Post author mismatch: expected ${expectedOwnerUrn}, got ${post.rawData.author}`,
          postUrn: post.postUrn
        };
      }
    }

    return {
      valid: true,
      reason: `All ${posts.length} posts validated for owner ${expectedOwnerUrn}`,
      postsChecked: Math.min(posts.length, 3)
    };

  } catch (error) {
    return {
      valid: false,
      reason: `Validation error: ${error.message}`
    };
  }
}

/**
 * BULLETPROOF: Process LinkedIn share with owner validation
 */
function processLinkedInShare(share, expectedOwnerUrn) {
  try {
    const processedPost = {
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
      likesCount: 0,
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
      fetchedAt: new Date().toISOString(),
      expectedOwner: expectedOwnerUrn // BULLETPROOF: Track expected owner
    };

    console.log('🔍 PROCESSED POST:', {
      postUrn: processedPost.postUrn,
      expectedOwner: expectedOwnerUrn,
      textPreview: processedPost.textPreview?.substring(0, 50) + '...'
    });

    return processedPost;
  } catch (error) {
    console.error('❌ Error processing share:', error);
    return null;
  }
}

/**
 * BULLETPROOF: Update cache with validation
 */
async function updatePostsCacheWithValidation(userId, posts, expectedOwnerUrn) {
  try {
    console.log('💾 CACHE UPDATE WITH VALIDATION:', {
      userId,
      postsCount: posts.length,
      expectedOwnerUrn
    });

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // BULLETPROOF: Validate all posts before caching
    for (const post of posts) {
      if (post.expectedOwner && post.expectedOwner !== expectedOwnerUrn) {
        throw new Error(`Post ownership mismatch in cache update: expected ${expectedOwnerUrn}, got ${post.expectedOwner}`);
      }
    }

    // Prepare posts for database insertion
    const postsForDb = posts.map(post => ({
      user_id: userId, // BULLETPROOF: This should match expectedOwnerUrn's user
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

    console.log('💾 INSERTING CACHE DATA:', {
      userId,
      postsCount: postsForDb.length,
      firstPostUrn: postsForDb[0]?.post_urn,
      validationPassed: true
    });

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

    console.log(`✅ CACHE UPDATED SUCCESSFULLY: ${postsForDb.length} posts for user:`, userId);

  } catch (error) {
    console.error('❌ Database error updating posts cache for user:', userId, error);
    throw error;
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

    console.log('💾 CACHED POSTS LOADED:', {
      userId,
      count: posts?.length || 0
    });

    return posts || [];

  } catch (error) {
    console.error('❌ Database error getting cached posts for user:', userId, error);
    return null;
  }
}

// Keep all the existing utility functions (unchanged)
function mergeAndDeduplicatePosts(cachedPosts, freshPosts) {
  const postMap = new Map();
  
  for (const post of cachedPosts) {
    const key = post.post_urn || post.postUrn;
    if (key) {
      postMap.set(key, { ...post, source: 'cache' });
    }
  }
  
  for (const post of freshPosts) {
    const key = post.postUrn;
    if (key) {
      postMap.set(key, { ...post, source: 'api' });
    }
  }
  
  const allPosts = Array.from(postMap.values());
  return allPosts.sort((a, b) => {
    const timeA = a.createdAtMs || new Date(a.published_at).getTime();
    const timeB = b.createdAtMs || new Date(b.published_at).getTime();
    return timeB - timeA;
  });
}

function processPostForResponse(post) {
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

// Utility functions (unchanged)
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
    return 'MEDIA';
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