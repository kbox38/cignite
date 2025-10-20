// netlify/functions/scheduled-posts-refresh.mjs - Midnight batch refresh for all users
export async function handler(event, context) {
  console.log("=== SCHEDULED POSTS REFRESH (MIDNIGHT) ===");
  console.log("Event source:", event.source);
  console.log("Time:", new Date().toISOString());

  // Verify this is a scheduled event (security)
  if (event.source !== "aws.events" && event.httpMethod) {
    // If called via HTTP, require admin key
    const adminKey = process.env.ADMIN_SECRET_KEY;
    const { authorization } = event.headers;
    
    if (!adminKey || authorization !== `Bearer ${adminKey}`) {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Unauthorized - Admin access required" }),
      };
    }
  }

  try {
    // Get all users who need their posts refreshed
    const usersToRefresh = await getUsersNeedingRefresh();
    console.log(`Found ${usersToRefresh.length} users needing refresh`);

    const results = {
      total: usersToRefresh.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Process users in batches to avoid overwhelming APIs
    const batchSize = 5;
    for (let i = 0; i < usersToRefresh.length; i += batchSize) {
      const batch = usersToRefresh.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(usersToRefresh.length/batchSize)}`);
      
      const batchPromises = batch.map(async (user) => {
        try {
          console.log(`Refreshing posts for user: ${user.name} (${user.id})`);
          
          // Skip if user doesn't have DMA token
          if (!user.linkedin_dma_token) {
            console.log(`Skipping user ${user.name} - no DMA token`);
            return { success: false, error: "No DMA token", userId: user.id };
          }

          const posts = await fetchUserPostsFromSnapshot(user.linkedin_dma_token, 5);
          await updateUserPostsCache(user.id, posts);
          
          console.log(`✅ Successfully updated ${posts.length} posts for ${user.name}`);
          results.successful++;
          
          return { success: true, postsCount: posts.length, userId: user.id };
          
        } catch (error) {
          console.error(`❌ Failed to refresh posts for user ${user.id}:`, error.message);
          results.failed++;
          results.errors.push({
            userId: user.id,
            name: user.name,
            error: error.message
          });
          
          return { success: false, error: error.message, userId: user.id };
        }
      });

      // Wait for batch to complete
      await Promise.all(batchPromises);
      
      // Add delay between batches to be respectful to LinkedIn API
      if (i + batchSize < usersToRefresh.length) {
        console.log("Waiting 10 seconds before next batch...");
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    const summary = {
      timestamp: new Date().toISOString(),
      results,
      nextScheduledRun: getNextMidnight().toISOString()
    };

    console.log("=== REFRESH COMPLETED ===");
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Total: ${results.total}`);

    // Log summary to database for monitoring
    await logRefreshSummary(summary);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(summary),
    };

  } catch (error) {
    console.error("Scheduled refresh error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        error: "Scheduled refresh failed",
        details: error.message,
        timestamp: new Date().toISOString()
      }),
    };
  }
}

async function getUsersNeedingRefresh() {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get all users with DMA tokens
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, linkedin_dma_token')
      .not('linkedin_dma_token', 'is', null);

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    console.log(`Found ${users?.length || 0} users with DMA tokens`);
    return users || [];

  } catch (error) {
    console.error('Error getting users needing refresh:', error);
    return [];
  }
}

async function fetchUserPostsFromSnapshot(token, limit = 5) {
  try {
    const url = 'https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LinkedIn API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.elements || !data.elements[0] || !data.elements[0].snapshotData) {
      return [];
    }

    const shareInfo = data.elements[0].snapshotData;

    const posts = shareInfo
      .slice(0, limit * 2)
      .map((item, index) => {
        try {
          const shareUrl = item["Share URL"] || item.shareUrl || item.url;
          const shareDate = item["Share Date"] || item.shareDate || item.date;
          const textContent = extractTextContent(item);
          const mediaInfo = extractMediaInfo(item);
          
          if (!shareUrl) return null;
          
          const urnMatch = shareUrl.match(/activity-(\d+)/);
          const postUrn = urnMatch ? `urn:li:activity:${urnMatch[1]}` : `temp_${Date.now()}_${index}`;
          
          let createdAtMs = Date.now();
          if (shareDate) {
            const parsedDate = new Date(shareDate);
            if (!isNaN(parsedDate.getTime())) {
              createdAtMs = parsedDate.getTime();
            }
          }
          
          return {
            postUrn,
            createdAtMs,
            textPreview: textContent,
            mediaType: mediaInfo.type,
            mediaAssetUrn: mediaInfo.assetUrn,
            permalink: shareUrl
          };
        } catch (error) {
          return null;
        }
      })
      .filter(post => post !== null)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, limit);

    return posts;

  } catch (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }
}

function extractTextContent(post) {
  try {
    const textFields = [
      'ShareCommentary', 'Share Commentary', 'shareCommentary',
      'Commentary', 'commentary', 'text', 'content', 'Text'
    ];
    
    for (const field of textFields) {
      if (post[field] && typeof post[field] === 'string') {
        const text = post[field].trim();
        return text.length > 500 ? text.substring(0, 500) + '...' : text;
      }
    }
    
    return 'No text content available';
  } catch (error) {
    return 'Error loading content';
  }
}

function extractMediaInfo(post) {
  try {
    const mediaUrlFields = ['MediaUrl', 'Media URL', 'mediaUrl', 'MediaURL'];
    const mediaTypeFields = ['MediaType', 'Media Type', 'mediaType', 'Type'];
    
    let mediaUrl = null;
    let mediaType = 'NONE';
    
    for (const field of mediaUrlFields) {
      if (post[field]) {
        mediaUrl = post[field];
        break;
      }
    }
    
    for (const field of mediaTypeFields) {
      if (post[field]) {
        mediaType = post[field];
        break;
      }
    }
    
    if (mediaUrl && mediaType === 'NONE') {
      if (mediaUrl.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl)) {
        mediaType = 'IMAGE';
      } else if (mediaUrl.includes('video') || /\.(mp4|mov|avi|webm)$/i.test(mediaUrl)) {
        mediaType = 'VIDEO';
      } else {
        mediaType = 'URN_REFERENCE';
      }
    }
    
    return { type: mediaType, assetUrn: mediaUrl };
  } catch (error) {
    return { type: 'NONE', assetUrn: null };
  }
}

async function updateUserPostsCache(userId, posts) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Clear existing cache
    await supabase
      .from('post_cache')
      .delete()
      .eq('user_id', userId);

    if (posts.length === 0) return;

    // Insert new posts
    const cacheData = posts.map(post => ({
      user_id: userId,
      post_urn: post.postUrn,
      created_at_ms: post.createdAtMs,
      text_preview: post.textPreview || '',
      media_type: post.mediaType || 'NONE',
      media_asset_urn: post.mediaAssetUrn,
      permalink: post.permalink,
      fetched_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('post_cache')
      .insert(cacheData);

    if (error) throw error;

  } catch (error) {
    throw new Error(`Cache update failed: ${error.message}`);
  }
}

function getNextMidnight() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

async function logRefreshSummary(summary) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Log to a monitoring table (create if needed)
    await supabase
      .from('refresh_logs')
      .insert({
        timestamp: summary.timestamp,
        total_users: summary.results.total,
        successful: summary.results.successful,
        failed: summary.results.failed,
        errors: summary.results.errors,
        type: 'scheduled_midnight'
      });

  } catch (error) {
    console.error('Failed to log refresh summary:', error);
    // Don't throw - logging failure shouldn't break the main process
  }
}