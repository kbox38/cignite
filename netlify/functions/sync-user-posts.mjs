/**
 * Netlify Function: sync-user-posts.mjs
 * Syncs user posts from LinkedIn DMA APIs and stores them in the database
 * FIXED: Uses Authorization header for user's DMA token
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
      // This would typically be called by a scheduled function with elevated privileges
      console.log('🌐 Starting bulk sync for all users');
      
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, linkedin_dma_member_urn, dma_active, name')
        .eq('dma_active', true);

      if (usersError) {
        throw new Error(`Failed to get users: ${usersError.message}`);
      }

      console.log(`📋 Found ${users.length} DMA-active users for bulk sync`);
      
      // For bulk sync, we'd need to either:
      // 1. Have stored encrypted tokens we can decrypt
      // 2. Skip individual sync and just update sync status
      // For now, just update status to indicate bulk sync was attempted
      
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

    // Fetch posts from LinkedIn
    console.log(`📡 Fetching posts from LinkedIn...`);
    const posts = await fetchUserPostsFromLinkedIn(dmaToken, userId, user.linkedin_dma_member_urn);
    
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
 * Fetch user posts from LinkedIn DMA APIs
 */
async function fetchUserPostsFromLinkedIn(userToken, userId, dmaUrn) {
  console.log(`📡 Fetching posts from LinkedIn for user: ${userId}`);
  console.log(`🔍 DMA URN: ${dmaUrn}`);
  
  try {
    // Use LinkedIn changelog API to get recent activity
    const changelogUrl = 'https://api.linkedin.com/v2/changelog';
    
    console.log(`📞 Calling LinkedIn changelog API...`);
    
    const changelogResponse = await fetch(changelogUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'LinkedIn-Version': '202312',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    console.log(`📊 LinkedIn API response status: ${changelogResponse.status}`);

    if (!changelogResponse.ok) {
      const errorText = await changelogResponse.text();
      console.error('❌ LinkedIn API error response:', errorText);
      throw new Error(`LinkedIn API error: ${changelogResponse.status} - ${errorText}`);
    }

    const changelogData = await changelogResponse.json();
    console.log(`📋 Changelog response:`, {
      hasElements: !!changelogData.elements,
      elementsCount: changelogData.elements?.length || 0,
      paging: changelogData.paging
    });

    if (!changelogData.elements || changelogData.elements.length === 0) {
      console.log('📭 No changelog elements found');
      return [];
    }

    const posts = [];

    // Process changelog elements to extract posts
    for (const element of changelogData.elements) {
      try {
        // Check if this element represents a post or article
        const isPost = element.resourceName?.includes('posts') || 
                       element.resourceName?.includes('socialActions') ||
                       element.resourceName?.includes('shares') ||
                       element.resourceName?.includes('ugcPosts');
        
        if (!isPost) {
          continue;
        }

        console.log('📝 Processing post element:', {
          resourceName: element.resourceName,
          method: element.method,
          activityId: element.activityId
        });

        // Extract post data from the element
        const post = await extractPostFromElement(element, userToken);
        
        if (post) {
          posts.push(post);
        }
        
      } catch (error) {
        console.warn('⚠️ Error processing changelog element:', error.message);
        // Continue processing other elements
      }
    }

    console.log(`✅ Successfully processed ${posts.length} posts from ${changelogData.elements.length} elements`);
    return posts;

  } catch (error) {
    console.error('❌ Error fetching posts from LinkedIn:', error);
    throw error;
  }
}

/**
 * Extract post data from changelog element
 */
async function extractPostFromElement(element, userToken) {
  try {
    const activity = element.activity || {};
    const createdAt = element.capturedAt || element.processedAt || Date.now();
    
    // Generate a post URN from the element
    const postUrn = element.resourceUri || 
                    `urn:li:activity:${element.activityId}` ||
                    `urn:li:post:${element.id}` ||
                    `urn:li:share:${Date.now()}`;

    // Extract text content from various possible locations
    const textContent = activity.message?.text || 
                       activity.content?.text || 
                       activity.commentary?.text ||
                       activity.shareText ||
                       element.content?.text ||
                       '';

    // Determine media type from content structure
    let mediaType = 'TEXT';
    if (activity.content?.media || element.content?.media) {
      mediaType = 'IMAGE';
    } else if (activity.content?.article || element.content?.article) {
      mediaType = 'ARTICLE';
    } else if (activity.content?.video || element.content?.video) {
      mediaType = 'VIDEO';
    } else if (activity.content?.poll || element.content?.poll) {
      mediaType = 'POLL';
    }

    // Create post object with extracted data
    const post = {
      postUrn: postUrn,
      linkedinPostId: element.activityId || element.id,
      createdAtMs: new Date(createdAt).getTime(),
      textPreview: textContent.substring(0, 500), // Limit to 500 chars for preview
      mediaType: mediaType,
      mediaUrls: extractMediaUrls(activity.content || element.content),
      hashtags: extractHashtags(textContent),
      mentions: extractMentions(textContent),
      visibility: 'PUBLIC', // Default assumption, could be refined
      
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
      repurposeEligible: (Date.now() - new Date(createdAt).getTime()) > (30 * 24 * 60 * 60 * 1000),
      repurposeDate: null,
      repurposedCount: 0,
      performanceTier: 'UNKNOWN',
      
      // Store raw data for debugging and future processing
      rawData: element
    };

    console.log('✅ Extracted post:', {
      postUrn: post.postUrn,
      createdAt: new Date(post.createdAtMs).toISOString(),
      textLength: post.textPreview.length,
      mediaType: post.mediaType,
      hasHashtags: post.hashtags.length > 0,
      hasMentions: post.mentions.length > 0
    });

    return post;

  } catch (error) {
    console.error('❌ Error extracting post from element:', error);
    return null;
  }
}

/**
 * Extract media URLs from content object
 */
function extractMediaUrls(content) {
  if (!content) return [];
  
  const urls = [];
  
  // Check for media in various content structures
  if (content.media?.elements) {
    content.media.elements.forEach(mediaElement => {
      if (mediaElement.media?.identifiers) {
        mediaElement.media.identifiers.forEach(identifier => {
          if (identifier.identifier) {
            urls.push(identifier.identifier);
          }
        });
      }
    });
  }
  
  return urls;
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
  fetchUserPostsFromLinkedIn, 
  extractPostFromElement, 
  extractHashtags, 
  extractMentions 
};