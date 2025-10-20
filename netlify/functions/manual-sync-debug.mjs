/**
 * SYNERGY FIX 5: Enhanced manual sync debug function
 * Location: netlify/functions/manual-sync-debug.mjs
 * 
 * This function provides comprehensive debugging for manual sync operations
 */

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { userId, operation = 'debug' } = JSON.parse(event.body || '{}');

    console.log('🔍 MANUAL SYNC DEBUG:', {
      userId,
      operation,
      timestamp: new Date().toISOString()
    });

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "userId is required" }),
      };
    }

    // Get comprehensive sync status
    const debugInfo = await getComprehensiveSyncStatus(supabase, userId);
    
    // If operation is 'trigger', actually trigger the sync
    if (operation === 'trigger') {
      const syncResult = await triggerSyncWithDebug(userId);
      debugInfo.syncResult = syncResult;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        debugInfo,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error("❌ Manual sync debug error:", error);
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
    };
  }
}

/**
 * Get comprehensive sync status for debugging
 */
async function getComprehensiveSyncStatus(supabase, userId) {
  console.log('📊 Getting comprehensive sync status for:', userId);

  // 1. User basic info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select(`
      id, name, email, 
      linkedin_member_urn, linkedin_dma_member_urn,
      dma_active, posts_sync_status, last_posts_sync
    `)
    .eq('id', userId)
    .single();

  // 2. Posts cache info
  const { data: posts, error: postsError } = await supabase
    .from('post_cache')
    .select('id, created_at, fetched_at, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // 3. Partnership info
  const { data: partnerships, error: partnershipsError } = await supabase
    .from('synergy_partners')
    .select(`
      id, partnership_status, created_at,
      a_user:a_user_id(id, name, posts_sync_status),
      b_user:b_user_id(id, name, posts_sync_status)
    `)
    .or(`a_user_id.eq.${userId},b_user_id.eq.${userId}`)
    .eq('partnership_status', 'active');

  // 4. Check if user needs sync using database function
  const { data: syncCheck, error: syncCheckError } = await supabase
    .rpc('get_partner_sync_debug', { target_user_id: userId });

  const debugInfo = {
    user: {
      data: user,
      error: userError?.message,
      hasDmaUrn: !!user?.linkedin_dma_member_urn,
      dmaActive: user?.dma_active,
      syncStatus: user?.posts_sync_status,
      lastSync: user?.last_posts_sync,
      hoursSinceSync: user?.last_posts_sync ? 
        Math.round((Date.now() - new Date(user.last_posts_sync).getTime()) / (1000 * 60 * 60)) : 
        null
    },
    posts: {
      count: posts?.length || 0,
      error: postsError?.message,
      latest: posts?.[0]?.created_at,
      oldestFetch: posts?.length ? posts[posts.length - 1]?.fetched_at : null,
      samples: posts?.slice(0, 3).map(p => ({
        id: p.id,
        createdAt: p.created_at,
        fetchedAt: p.fetched_at,
        contentPreview: p.content?.substring(0, 100) + '...'
      }))
    },
    partnerships: {
      count: partnerships?.length || 0,
      error: partnershipsError?.message,
      partners: partnerships?.map(p => {
        const isUserA = p.a_user.id === userId;
        const partner = isUserA ? p.b_user : p.a_user;
        return {
          partnerId: partner.id,
          partnerName: partner.name,
          partnerSyncStatus: partner.posts_sync_status,
          partnershipCreated: p.created_at
        };
      })
    },
    syncCheck: {
      data: syncCheck?.[0],
      error: syncCheckError?.message,
      needsSync: syncCheck?.[0]?.sync_needed
    },
    recommendations: []
  };

  // Generate recommendations
  if (!user?.linkedin_dma_member_urn) {
    debugInfo.recommendations.push('❌ Missing LinkedIn DMA URN - user needs to complete DMA authentication');
  }
  
  if (!user?.dma_active) {
    debugInfo.recommendations.push('⚠️ DMA not active - check authentication status');
  }

  if (user?.posts_sync_status === 'failed') {
    debugInfo.recommendations.push('🔄 Last sync failed - manual sync recommended');
  }

  if (!user?.last_posts_sync) {
    debugInfo.recommendations.push('🆕 No sync history - initial sync needed');
  }

  if (debugInfo.posts.count === 0) {
    debugInfo.recommendations.push('📝 No cached posts found - sync required');
  }

  if (debugInfo.user.hoursSinceSync && debugInfo.user.hoursSinceSync > 24) {
    debugInfo.recommendations.push(`⏰ Last sync was ${debugInfo.user.hoursSinceSync}h ago - refresh recommended`);
  }

  console.log('✅ Comprehensive sync status complete:', {
    userId,
    needsSync: debugInfo.syncCheck.needsSync,
    recommendations: debugInfo.recommendations.length
  });

  return debugInfo;
}

/**
 * Trigger sync with detailed debugging
 */
async function triggerSyncWithDebug(userId) {
  console.log('🚀 Triggering sync with debug for:', userId);

  try {
    const syncResponse = await fetch(`${process.env.URL}/.netlify/functions/sync-user-posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        syncAll: false
      })
    });

    const responseText = await syncResponse.text();
    
    console.log('📡 Sync response:', {
      status: syncResponse.status,
      statusText: syncResponse.statusText,
      headers: Object.fromEntries(syncResponse.headers.entries()),
      bodyPreview: responseText.substring(0, 500)
    });

    if (syncResponse.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ Sync completed successfully:', result);
      return {
        success: true,
        result,
        status: syncResponse.status
      };
    } else {
      console.error('❌ Sync failed:', responseText);
      return {
        success: false,
        error: responseText,
        status: syncResponse.status
      };
    }
  } catch (error) {
    console.error('❌ Sync trigger error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}