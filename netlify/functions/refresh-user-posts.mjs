// netlify/functions/refresh-user-posts.mjs - Update user's own posts cache
export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
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

  const { authorization } = event.headers;
  const { userId, forceRefresh = false, trigger = "manual" } = JSON.parse(event.body || '{}');

  console.log("=== REFRESH USER POSTS ===");
  console.log("User ID:", userId);
  console.log("Force refresh:", forceRefresh);
  console.log("Trigger:", trigger);
  console.log("Authorization present:", !!authorization);

  if (!authorization) {
    return {
      statusCode: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

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

  try {
    // Check if refresh is needed based on trigger type
    const { trigger = "manual" } = JSON.parse(event.body || '{}');
    
    if (!forceRefresh && trigger !== "login" && trigger !== "scheduled") {
      const lastRefresh = await getLastRefreshTime(userId);
      if (lastRefresh && !isRefreshNeeded(lastRefresh)) {
        const nextRefresh = getNextMidnight();
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ 
            message: "Posts refreshed recently",
            lastRefresh,
            nextRefresh: nextRefresh.toISOString(),
            hoursUntilNextRefresh: Math.ceil((nextRefresh.getTime() - new Date().getTime()) / (1000 * 60 * 60)),
            trigger: "none_needed"
          }),
        };
      }
    }

    console.log(`Refreshing posts triggered by: ${trigger}`);

    console.log("Refreshing user's own posts from LinkedIn...");

    // Fetch fresh posts using user's own token
    let posts = [];
    
    try {
      posts = await fetchUserPostsFromSnapshot(authorization, 5);
      console.log(`Fetched ${posts.length} posts from Snapshot API`);
    } catch (error) {
      console.error("Error fetching posts:", error);
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "Failed to fetch posts",
          details: error.message
        }),
      };
    }

    // Update cache with user's latest posts
    await updateUserPostsCache(userId, posts);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        success: true,
        postsUpdated: posts.length,
        lastRefresh: new Date().toISOString(),
        nextRefresh: getNextMidnight().toISOString(),
        trigger,
        posts: posts.map(p => ({ 
          text: p.textPreview.substring(0, 100) + '...',
          date: new Date(p.createdAtMs).toLocaleDateString()
        }))
      }),
    };

  } catch (error) {
    console.error("Refresh user posts error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
    };
  }
}

async function getLastRefreshTime(userId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('post_cache')
      .select('fetched_at')
      .eq('user_id', userId)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data?.fetched_at;
  } catch (error) {
    console.error('Error getting last refresh time:', error);
    return null;
  }
}

function isRefreshNeeded(lastRefresh) {
  const now = new Date();
  const lastRefreshDate = new Date(lastRefresh);
  
  // Check if it's a different day (past midnight)
  return now.toDateString() !== lastRefreshDate.toDateString();
}

function getNextMidnight() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

async function fetchUserPostsFromSnapshot(authorization, limit = 5) {
  try {
    console.log("Fetching user's own posts from LinkedIn Snapshot API");
    
    const url = 'https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO';
    console.log("Snapshot API URL:", url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authorization}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202312'
      }
    });

    console.log("Snapshot API Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Snapshot API Error:", response.status, errorText);
      throw new Error(`Snapshot API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Snapshot API Response data keys:", Object.keys(data));

    if (!data.elements || !data.elements[0] || !data.elements[0].snapshotData) {
      console.log("No posts found in Snapshot response");
      return [];
    }

    const shareInfo = data.elements[0].snapshotData;
    console.log(`Found ${shareInfo.length} items in snapshot data`);

    const posts = shareInfo
      .slice(0, limit * 2) // Get more to account for filtering
      .map((item, index) => {
        try {
          const shareUrl = item["Share URL"] || item.shareUrl || item.url;
          const shareDate = item["Share Date"] || item.shareDate || item.date;
          const textContent = extractTextContent(item);
          const mediaInfo = extractMediaInfo(item);
          
          if (!shareUrl) {
            return null;
          }
          
          // Extract URN from URL
          const urnMatch = shareUrl.match(/activity-(\d+)/);
          const postUrn = urnMatch ? `urn:li:activity:${urnMatch[1]}` : `temp_${Date.now()}_${index}`;
          
          // Parse date
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
          console.warn(`Error processing snapshot item ${index}:`, error);
          return null;
        }
      })
      .filter(post => post !== null)
      .sort((a, b) => b.createdAtMs - a.createdAtMs) // Sort by newest first
      .slice(0, limit); // Take only the requested number

    console.log(`Successfully processed ${posts.length} posts from Snapshot`);
    return posts;

  } catch (error) {
    console.error('Error fetching posts from Snapshot API:', error);
    throw error;
  }
}

function extractTextContent(post) {
  try {
    const textFields = [
      'ShareCommentary',
      'Share Commentary', 
      'shareCommentary',
      'Commentary',
      'commentary',
      'text',
      'content',
      'Text'
    ];
    
    for (const field of textFields) {
      if (post[field] && typeof post[field] === 'string') {
        const text = post[field].trim();
        return text.length > 500 ? text.substring(0, 500) + '...' : text;
      }
    }
    
    return 'No text content available';
  } catch (error) {
    console.error('Error extracting text content:', error);
    return 'Error loading content';
  }
}

function extractMediaInfo(post) {
  try {
    const mediaUrlFields = ['MediaUrl', 'Media URL', 'mediaUrl', 'MediaURL'];
    const mediaTypeFields = ['MediaType', 'Media Type', 'mediaType', 'Type'];
    
    let mediaUrl = null;
    let mediaType = 'NONE';
    
    // Look for media URL
    for (const field of mediaUrlFields) {
      if (post[field]) {
        mediaUrl = post[field];
        break;
      }
    }
    
    // Look for media type
    for (const field of mediaTypeFields) {
      if (post[field]) {
        mediaType = post[field];
        break;
      }
    }
    
    // If we have a URL but no type, try to infer type
    if (mediaUrl && mediaType === 'NONE') {
      if (mediaUrl.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl)) {
        mediaType = 'IMAGE';
      } else if (mediaUrl.includes('video') || /\.(mp4|mov|avi|webm)$/i.test(mediaUrl)) {
        mediaType = 'VIDEO';
      } else {
        mediaType = 'URN_REFERENCE';
      }
    }
    
    return {
      type: mediaType,
      assetUrn: mediaUrl
    };
  } catch (error) {
    console.error('Error extracting media info:', error);
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

    console.log(`Updating cache with ${posts.length} posts for user:`, userId);

    // Clear existing cache for this user
    await supabase
      .from('post_cache')
      .delete()
      .eq('user_id', userId);

    if (posts.length === 0) {
      console.log('No posts to cache');
      return;
    }

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

    if (error) {
      console.error('Error updating cache:', error);
      throw error;
    } else {
      console.log('Cache updated successfully');
    }
  } catch (error) {
    console.error('Error in updateUserPostsCache:', error);
    throw error;
  }
}