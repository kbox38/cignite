/**
 * SYNERGY BACKEND FIX 2: Enhanced synergy-posts function
 * Location: netlify/functions/synergy-posts.mjs
 * 
 * FIXES:
 * - Proper GET method handling
 * - Enhanced debugging and logging
 * - Better partner sync status tracking
 * - Improved error handling
 */

// Main handler function - ES6 export
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

  const { authorization } = event.headers;
  const { partnerUserId, limit = "5", currentUserId } = event.queryStringParameters || {};

  console.log("=== SYNERGY POSTS DEBUG ===");
  console.log("🔍 Query Parameters:", {
    partnerUserId,
    limit,
    currentUserId,
    authPresent: !!authorization
  });

  // Validation
  if (!authorization) {
    console.log('❌ Missing authorization header');
    return {
      statusCode: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  if (!partnerUserId) {
    console.log('❌ Missing partnerUserId parameter');
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: "partnerUserId is required",
        received: { partnerUserId, currentUserId, limit }
      }),
    };
  }

  try {
    console.log('🔍 Looking up partner sync status...');
    
    // Get partner's sync status first
    const partnerSyncStatus = await getPartnerSyncStatus(partnerUserId);
    console.log('📊 Partner sync status:', partnerSyncStatus);

    // Check if partner needs sync
    if (shouldTriggerSync(partnerSyncStatus)) {
      console.log('🔄 Partner needs sync, triggering...');
      await triggerPartnerSync(partnerUserId);
    }

    // Get cached posts with enhanced debugging
    console.log('📦 Checking cache for partner posts...');
    const cachedPosts = await getCachedPosts(partnerUserId, parseInt(limit));
    
    if (cachedPosts && !isCacheStale(cachedPosts.fetchedAt)) {
      console.log("✅ Returning fresh cached posts");
      const response = {
        posts: cachedPosts.posts,
        source: "cache",
        fetchedAt: cachedPosts.fetchedAt,
        nextRefresh: new Date(new Date(cachedPosts.fetchedAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        partnerSyncStatus,
        debugInfo: {
          partnerId: partnerUserId,
          cacheHit: true,
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
    }

    console.log("⚠️ Cache is stale or missing");
    
    // Return empty array with status info if no cache
    const response = {
      posts: cachedPosts?.posts || [], 
      source: "cache_stale_or_missing",
      message: "Partner posts cache is being refreshed",
      fetchedAt: cachedPosts?.fetchedAt || null,
      cacheAge: cachedPosts?.fetchedAt ? 
        Math.round((new Date().getTime() - new Date(cachedPosts.fetchedAt).getTime()) / (1000 * 60 * 60)) + " hours" : 
        "No cache",
      partnerSyncStatus,
      debugInfo: {
        partnerId: partnerUserId,
        cacheHit: false,
        processingTime: Date.now() - startTime
      }
    };

    console.log('📤 Sending response (no cache):', {
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
      partnerId: partnerUserId,
      processingTime: Date.now() - startTime
    });
    
    // Return empty array instead of error to prevent UI breaking
    return {
      statusCode: 200,
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
          partnerId: partnerUserId,
          processingTime: Date.now() - startTime
        }
      }),
    };
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

    console.log("🔍 Getting sync status for user:", partnerUserId);

    const { data: user, error } = await supabase
      .from('users')
      .select('posts_sync_status, last_posts_sync, name, email')
      .eq('id', partnerUserId)
      .single();

    if (error || !user) {
      console.error('❌ User not found or error:', error);
      return {
        status: 'unknown',
        lastSync: null,
        error: error?.message || 'User not found'
      };
    }

    console.log("✅ Partner sync status:", {
      name: user.name,
      status: user.posts_sync_status,
      lastSync: user.last_posts_sync
    });

    return {
      status: user.posts_sync_status || 'pending',
      lastSync: user.last_posts_sync,
      name: user.name
    };
  } catch (error) {
    console.error('❌ Error getting partner sync status:', error);
    return {
      status: 'error',
      lastSync: null,
      error: error.message
    };
  }
}

/**
 * Determine if partner needs sync
 */
function shouldTriggerSync(syncStatus) {
  const { status, lastSync } = syncStatus;
  
  // Trigger sync if never synced or failed
  if (!status || status === 'pending' || status === 'failed') {
    console.log('🔄 Sync needed: status is', status);
    return true;
  }
  
  // Trigger sync if last sync was more than 24 hours ago
  if (lastSync) {
    const hoursSinceSync = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
    if (hoursSinceSync > 24) {
      console.log('🔄 Sync needed: last sync was', Math.round(hoursSinceSync), 'hours ago');
      return true;
    }
  }
  
  return false;
}

/**
 * Trigger partner sync
 */
async function triggerPartnerSync(partnerUserId) {
  try {
    console.log('🚀 Triggering partner sync for:', partnerUserId);
    
    const syncResponse = await fetch(`${process.env.URL}/.netlify/functions/sync-user-posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: partnerUserId,
        syncAll: false
      })
    });

    if (syncResponse.ok) {
      const result = await syncResponse.json();
      console.log('✅ Partner sync triggered successfully:', result);
      return result;
    } else {
      console.warn('⚠️ Partner sync trigger failed:', syncResponse.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Error triggering partner sync:', error);
    return null;
  }
}

/**
 * Get cached posts for partner
 */
async function getCachedPosts(partnerUserId, limit) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("📦 Checking cache for user:", partnerUserId);

    const { data: cachedPosts, error } = await supabase
      .from('post_cache')
      .select('*')
      .eq('user_id', partnerUserId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching cached posts:', error);
      return null;
    }

    if (!cachedPosts || cachedPosts.length === 0) {
      console.log("📦 No cached posts found");
      return null;
    }

    console.log(`📦 Found ${cachedPosts.length} cached posts`);

    // Transform to frontend format
    const transformedPosts = cachedPosts.map(post => ({
      postUrn: post.post_urn,
      linkedinPostId: post.linkedin_post_id,
      createdAtMs: new Date(post.created_at).getTime(),
      textPreview: post.content,
      mediaType: post.media_type,
      mediaUrls: post.media_urls,
      likesCount: post.likes_count,
      commentsCount: post.comments_count,
      sharesCount: post.shares_count,
      engagementRate: post.engagement_rate,
      raw: post.raw_data
    }));

    return {
      posts: transformedPosts,
      fetchedAt: cachedPosts[0]?.fetched_at || new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error getting cached posts:', error);
    return null;
  }
}

/**
 * Check if cache is stale (older than 24 hours)
 */
function isCacheStale(fetchedAt) {
  if (!fetchedAt) return true;
  
  const hoursSinceFetch = (Date.now() - new Date(fetchedAt).getTime()) / (1000 * 60 * 60);
  const isStale = hoursSinceFetch > 24;
  
  console.log(`📦 Cache age: ${Math.round(hoursSinceFetch)} hours, stale: ${isStale}`);
  
  return isStale;
}