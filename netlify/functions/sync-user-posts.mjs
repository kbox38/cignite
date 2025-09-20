/**
 * Netlify Function: sync-user-posts.mjs
 * FIXED: Uses LinkedIn Snapshot API with MEMBER_SHARE_INFO domain (same as PostPulse)
 * Location: netlify/functions/sync-user-posts.mjs
 */

/**
 * Main handler function - required export for Netlify
 */
export async function handler(event, context) {
  console.log("🔄 Sync user posts handler started at:", new Date().toISOString());

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

    const requestBody = event.body ? JSON.parse(event.body) : {};
    const { userId, syncAll = false } = requestBody;
    
    // FIXED: Extract authorization header for user's DMA token
    const authorizationHeader = event.headers.authorization || event.headers.Authorization;

    console.log('📊 Sync request parameters:', { 
      userId, 
      syncAll, 
      hasAuth: !!authorizationHeader 
    });

    // Validate authorization for single user sync
    if (!syncAll && !authorizationHeader) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Authorization header required for user sync" }),
      };
    }

    let results = [];

    if (syncAll) {
      // For bulk sync, we need a different approach since each user has their own token
      console.log('🌐 Starting bulk sync for all users');
      
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, linkedin_dma_member_urn, dma_active, name')
        .eq('dma_active', true);

      if (usersError) {
        throw new Error(`Failed to get users: ${usersError.message}`);
      }

      console.log(`📋 Found ${users.length} DMA-active users for bulk sync`);
      
      // For bulk sync, we'd need stored tokens - for now just update status
      for (const user of users) {
        try {
          await supabase
            .from('users')
            .update({ 
              posts_sync_status: 'pending',
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
            
          results.push({
            userId: user.id,
            userName: user.name,
            success: true,
            message: 'Bulk sync status updated - individual tokens required for actual sync'
          });
        } catch (error) {
          console.error(`❌ Bulk sync failed for user ${user.id}:`, error.message);
          results.push({
            userId: user.id,
            userName: user.name,
            success: false,
            error: error.message
          });
        }
      }

    } else if (userId) {
      // FIXED: Single user sync with their authorization token
      try {
        const result = await syncUserPosts(supabase, userId, authorizationHeader);
        results.push({
          userId,
          success: true,
          ...result
        });
      } catch (error) {
        console.error(`❌ Sync failed for user ${userId}:`, error.message);
        results.push({
          userId,
          success: false,
          error: error.message
        });
      }

    } else {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "userId is required when not syncing all" }),
      };
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`✅ Sync completed: ${successCount} success, ${failureCount} failures`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        totalProcessed: results.length,
        successCount,
        failureCount,
        results,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error("❌ Sync user posts error:", error);
    
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
 * Sync posts for a specific user using their DMA token
 */
async function syncUserPosts(supabase, userId, authorizationHeader) {
  console.log(`🔄 Starting posts sync for user: ${userId}`);

  // Update sync status to 'syncing'
  await supabase
    .from('users')
    .update({ 
      posts_sync_status: 'syncing',
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  try {
    // Get user's LinkedIn DMA info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id, name, linkedin_dma_member_urn, dma_active,
        linkedin_member_urn
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message || 'No user data'}`);
    }

    if (!user.dma_active) {
      throw new Error('User does not have DMA access enabled');
    }

    console.log(`👤 User info:`, {
      name: user.name,
      dmaUrn: user.linkedin_dma_member_urn,
      dmaActive: user.dma_active
    });

    // FIXED: Extract DMA token from authorization header
    const dmaToken = authorizationHeader.replace('Bearer ', '');
    
    if (!dmaToken) {
      throw new Error('No DMA token provided in authorization header');
    }

    console.log('🔑 Using DMA token from authorization header');

    // FIXED: Fetch posts using LinkedIn Snapshot API (like PostPulse)
    console.log(`📡 Fetching posts from LinkedIn Snapshot API...`);
    const posts = await fetchUserPostsFromLinkedInSnapshot(dmaToken, userId);
    
    console.log(`📝 Fetched ${posts.length} posts for user ${userId}`);

    // Store posts in database
    let postsProcessed = 0;
    let postsInserted = 0;
    let postsUpdated = 0;
    let errors = [];

    for (const post of posts) {
      try {
        const { data, error } = await supabase
          .from('post_cache')
          .upsert({
            user_id: userId,
            post_urn: post.postUrn,
            linkedin_post_id: post.linkedinPostId,
            content: post.textPreview,
            content_length: post.textPreview?.length || 0,
            media_type: post.mediaType,
            media_urls: post.mediaUrls || [],
            hashtags: post.hashtags || [],
            mentions: post.mentions || [],
            visibility: post.visibility || 'PUBLIC',
            published_at: new Date(post.createdAtMs).toISOString(),
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
            repurpose_date: post.repurposeDate,
            repurposed_count: post.repurposedCount || 0,
            performance_tier: post.performanceTier || 'UNKNOWN',
            raw_data: post.rawData,
            fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,post_urn',
            ignoreDuplicates: false
          })
          .select('id');

        if (!error) {
          postsProcessed++;
          postsInserted++; // Simplified - could be refined to detect actual inserts vs updates
        } else {
          console.warn(`⚠️ Failed to store post ${post.postUrn}:`, error.message);
          errors.push({
            postUrn: post.postUrn,
            error: error.message
          });
        }

      } catch (postError) {
        console.warn(`⚠️ Exception storing post ${post.postUrn}:`, postError.message);
        errors.push({
          postUrn: post.postUrn,
          error: postError.message
        });
      }
    }

    // Update sync status to 'completed'
    await supabase
      .from('users')
      .update({ 
        posts_sync_status: 'completed',
        last_posts_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    const syncResult = {
      postsProcessed,
      postsInserted,
      postsUpdated,
      totalFetched: posts.length,
      errorCount: errors.length,
      errors: errors.slice(0, 5) // Limit error details
    };

    console.log(`✅ Sync completed for user ${userId}:`, syncResult);

    return syncResult;

  } catch (error) {
    console.error(`❌ Sync error for user ${userId}:`, error);
    
    // Update sync status to 'failed'
    await supabase
      .from('users')
      .update({ 
        posts_sync_status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    throw error;
  }
}

/**
 * FIXED: Fetch user posts using LinkedIn Snapshot API (MEMBER_SHARE_INFO domain)
 * This is the same approach used by PostPulse
 */
async function fetchUserPostsFromLinkedInSnapshot(userToken, userId) {
  console.log(`📡 Fetching posts from LinkedIn Snapshot API for user: ${userId}`);
  
  try {
    // FIXED: Use the correct Snapshot API endpoint with MEMBER_SHARE_INFO domain
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

    // Process snapshot data to extract posts (same logic as PostPulse)
    for (let index = 0; index < Math.min(shareInfo.length, 50); index++) {
      try {
        const item = shareInfo[index];
        const post = await extractPostFromSnapshotItem(item, index);
        
        if (post) {
          posts.push(post);
          
          // Limit to latest 5 posts for synergy partners
          if (posts.length >= 5) {
            break;
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Error processing snapshot item ${index}:`, error.message);
        // Continue processing other items
      }
    }

    console.log(`✅ Successfully processed ${posts.length} posts from ${shareInfo.length} snapshot items`);
    return posts;

  } catch (error) {
    console.error('❌ Error fetching posts from LinkedIn Snapshot API:', error);
    throw error;
  }
}

/**
 * Extract post data from LinkedIn Snapshot item (same logic as PostPulse)
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

    // Extract date
    const shareDate = 
      item['Share Date'] ||
      item['Date'] ||
      item['created_at'] ||
      item['timestamp'] ||
      item['shareDate'] ||
      Date.now();

    // ENHANCED: Extract media information
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
      }
    }

    if (!shareUrl && !content) {
      return null; // Skip items without URL or content
    }

    // Extract URN from URL if available
    let postUrn = '';
    if (shareUrl) {
      const urnMatch = shareUrl.match(/activity[\/\-](\d+)/);
      if (urnMatch) {
        postUrn = `urn:li:activity:${urnMatch[1]}`;
      } else {
        postUrn = `urn:li:share:${Date.now()}-${index}`;
      }
    } else {
      postUrn = `urn:li:post:${Date.now()}-${index}`;
    }

    // Create post object with extracted data
    const post = {
      postUrn: postUrn,
      linkedinPostId: shareUrl ? shareUrl.match(/activity[\/\-](\d+)/)?.[1] || `snapshot-${index}` : `snapshot-${index}`,
      createdAtMs: new Date(shareDate).getTime(),
      textPreview: content.substring(0, 500), // Limit to 500 chars for preview
      mediaType: mediaType,
      mediaUrls: mediaUrl ? [mediaUrl] : [],
      hashtags: extractHashtags(content),
      mentions: extractMentions(content),
      visibility: 'PUBLIC', // Default assumption
      
      // Engagement metrics (initialized to 0 - would need separate API calls for real data)
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      impressions: 0,
      clicks: 0,
      savesCount: 0,
      engagementRate: 0,
      
      // Algorithm scoring (would be calculated based on engagement and other factors)
      reachScore: 0,
      algorithmScore: 0,
      sentimentScore: 0,
      
      // Repurpose eligibility (30+ days old)
      repurposeEligible: (Date.now() - new Date(shareDate).getTime()) > (30 * 24 * 60 * 60 * 1000),
      repurposeDate: null,
      repurposedCount: 0,
      performanceTier: 'UNKNOWN',
      
      // Store raw data for debugging and future processing
      rawData: item
    };

    console.log(`✅ Extracted post ${index + 1}:`, {
      postUrn: post.postUrn,
      createdAt: new Date(post.createdAtMs).toISOString(),
      textLength: post.textPreview.length,
      mediaType: post.mediaType,
      hasShareUrl: !!shareUrl,
      hasContent: !!content
    });

    return post;

  } catch (error) {
    console.error(`❌ Error extracting post from snapshot item ${index}:`, error);
    return null;
  }
}

/**
 * Extract hashtags from text
 */
function extractHashtags(text) {
  if (!text) return [];
  
  try {
    const hashtags = text.match(/#[\w]+/g) || [];
    return hashtags.map(tag => tag.replace('#', '').toLowerCase());
  } catch (error) {
    console.warn('⚠️ Error extracting hashtags:', error);
    return [];
  }
}

/**
 * Extract mentions from text
 */
function extractMentions(text) {
  if (!text) return [];
  
  try {
    const mentions = text.match(/@[\w]+/g) || [];
    return mentions.map(mention => mention.replace('@', '').toLowerCase());
  } catch (error) {
    console.warn('⚠️ Error extracting mentions:', error);
    return [];
  }
}

// Export helper functions for potential reuse
export { 
  fetchUserPostsFromLinkedInSnapshot, 
  extractPostFromSnapshotItem, 
  extractHashtags, 
  extractMentions 
};