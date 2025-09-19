/**
 * Netlify Function: sync-user-posts
 * Syncs latest 5 posts for a specific user or all users needing sync
 */

export default async function handler(event, context) {
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
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { userId, syncAll = false } = JSON.parse(event.body || '{}');

    let results = [];

    if (syncAll) {
      // Sync all users needing sync (for cron job)
      console.log("Starting bulk sync for all users needing sync...");
      
      const { data: usersNeedingSync, error: usersError } = await supabase
        .rpc('get_users_needing_sync');

      if (usersError) {
        throw new Error(`Failed to get users needing sync: ${usersError.message}`);
      }

      console.log(`Found ${usersNeedingSync?.length || 0} users needing sync`);

      // Process users in batches to avoid timeouts
      for (const user of usersNeedingSync || []) {
        try {
          const syncResult = await syncUserPosts(supabase, user.user_id);
          results.push({
            userId: user.user_id,
            name: user.name,
            email: user.email,
            status: 'success',
            ...syncResult
          });
        } catch (error) {
          console.error(`Failed to sync posts for user ${user.user_id}:`, error);
          results.push({
            userId: user.user_id,
            name: user.name,
            email: user.email,
            status: 'failed',
            error: error.message
          });
        }
      }
    } else if (userId) {
      // Sync specific user
      console.log(`Starting sync for user: ${userId}`);
      
      const syncResult = await syncUserPosts(supabase, userId);
      results.push({
        userId,
        status: 'success',
        ...syncResult
      });
    } else {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "userId or syncAll=true required" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        results,
        totalProcessed: results.length,
        successCount: results.filter(r => r.status === 'success').length,
        failureCount: results.filter(r => r.status === 'failed').length,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error("Posts sync error:", error);
    
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
    };
  }
}

/**
 * Core function to sync posts for a single user
 */
async function syncUserPosts(supabase, userId) {
  console.log(`Syncing posts for user: ${userId}`);

  // Mark user as syncing
  await supabase.rpc('set_user_sync_status', {
    target_user_id: userId,
    sync_status: 'syncing'
  });

  try {
    // Get user's LinkedIn DMA URN
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('linkedin_dma_member_urn, name, email')
      .eq('id', userId)
      .single();

    if (userError || !user?.linkedin_dma_member_urn) {
      throw new Error(`User not found or missing LinkedIn DMA URN: ${userError?.message}`);
    }

    console.log(`Found LinkedIn URN for ${user.name}: ${user.linkedin_dma_member_urn}`);

    // Fetch latest posts from LinkedIn DMA API
    const posts = await fetchUserPostsFromLinkedIn(user.linkedin_dma_member_urn);
    console.log(`Fetched ${posts.length} posts from LinkedIn`);

    // Get top 5 most recent posts
    const latestPosts = posts
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 5);

    console.log(`Processing ${latestPosts.length} latest posts`);

    // Delete existing cached posts for this user
    await supabase
      .from('post_cache')
      .delete()
      .eq('user_id', userId);

    // Insert new posts
    if (latestPosts.length > 0) {
      const postsToInsert = latestPosts.map(post => ({
        user_id: userId,
        post_urn: post.postUrn,
        linkedin_post_id: post.linkedinPostId || null,
        created_at: new Date(post.createdAtMs).toISOString(),
        content: post.textPreview || '',
        content_length: post.textPreview?.length || 0,
        media_type: post.mediaType || 'NONE',
        media_urls: post.mediaUrls || [],
        hashtags: post.hashtags || [],
        mentions: post.mentions || [],
        visibility: post.visibility || 'PUBLIC',
        likes_count: post.likesCount || 0,
        comments_count: post.commentsCount || 0,
        shares_count: post.sharesCount || 0,
        impressions: post.impressions || 0,
        clicks: post.clicks || 0,
        saves_count: post.savesCount || 0,
        engagement_rate: post.engagementRate || 0,
        reach_score: post.reachScore || 0,
        algorithm_score: post.algorithmScore || 0,
        sentiment_score: post.sentimentScore || 0,
        repurpose_eligible: post.repurposeEligible || false,
        repurpose_date: post.repurposeDate || null,
        repurposed_count: post.repurposedCount || 0,
        performance_tier: post.performanceTier || 'UNKNOWN',
        raw_data: post,
        fetched_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('post_cache')
        .insert(postsToInsert);

      if (insertError) {
        throw new Error(`Failed to insert posts: ${insertError.message}`);
      }
    }

    // Mark sync as completed
    await supabase.rpc('set_user_sync_status', {
      target_user_id: userId,
      sync_status: 'completed',
      sync_timestamp: new Date().toISOString()
    });

    return {
      postsProcessed: latestPosts.length,
      latestPostDate: latestPosts[0]?.createdAtMs ? new Date(latestPosts[0].createdAtMs).toISOString() : null,
      syncedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Error syncing posts for user ${userId}:`, error);
    
    // Mark sync as failed
    await supabase.rpc('set_user_sync_status', {
      target_user_id: userId,
      sync_status: 'failed'
    });

    throw error;
  }
}

/**
 * Fetch user posts from LinkedIn DMA API
 */
async function fetchUserPostsFromLinkedIn(memberUrn) {
  try {
    // Get access token from environment or token management system
    const accessToken = process.env.LINKEDIN_DMA_ACCESS_TOKEN;
    
    if (!accessToken) {
      throw new Error('LinkedIn DMA access token not configured');
    }

    // Use Member Changelog API to get recent posts
    const response = await fetch(
      `https://api.linkedin.com/rest/memberChangeLogs?q=memberAndApplication&count=50`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202312',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const posts = [];

    // Process changelog events to extract posts
    for (const event of data.elements || []) {
      if (event.resourceName === 'memberPost' && event.method === 'CREATE') {
        const post = processLinkedInPost(event);
        if (post) {
          posts.push(post);
        }
      }
    }

    return posts;

  } catch (error) {
    console.error('Error fetching posts from LinkedIn:', error);
    // Return empty array for graceful degradation
    return [];
  }
}

/**
 * Process LinkedIn post event into standardized format
 */
function processLinkedInPost(event) {
  try {
    const postData = event.resourceData || {};
    
    return {
      postUrn: event.resourceUri || `urn:li:share:${event.resourceId}`,
      linkedinPostId: event.resourceId,
      createdAtMs: event.capturedAt || Date.now(),
      textPreview: postData.text || postData.content || '',
      mediaType: postData.mediaType || 'NONE',
      mediaUrns: postData.mediaUrns || [],
      hashtags: extractHashtags(postData.text || ''),
      mentions: extractMentions(postData.text || ''),
      visibility: postData.visibility || 'PUBLIC',
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
      repurposeEligible: checkRepurposeEligibility(event.capturedAt),
      repurposeDate: getRepurposeDate(event.capturedAt),
      repurposedCount: 0,
      performanceTier: 'UNKNOWN'
    };
  } catch (error) {
    console.error('Error processing LinkedIn post:', error);
    return null;
  }
}

/**
 * Helper functions
 */
function extractHashtags(text) {
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  return text.match(hashtagRegex) || [];
}

function extractMentions(text) {
  const mentionRegex = /@[a-zA-Z0-9_]+/g;
  return text.match(mentionRegex) || [];
}

function checkRepurposeEligibility(createdAtMs) {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  return createdAtMs < thirtyDaysAgo;
}

function getRepurposeDate(createdAtMs) {
  const repurposeDate = new Date(createdAtMs + (30 * 24 * 60 * 60 * 1000));
  return repurposeDate.toISOString();
}