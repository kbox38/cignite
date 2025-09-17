export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") {
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
  const { partnerUserId, limit = "5" } = event.queryStringParameters || {};

  console.log("=== SYNERGY POSTS ===");
  console.log("Partner User ID:", partnerUserId);
  console.log("Limit:", limit);
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

  if (!partnerUserId) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "partnerUserId is required" }),
    };
  }

  try {
    // Check cache first
    const cachedPosts = await getCachedPosts(partnerUserId, parseInt(limit));
    if (cachedPosts && !isCacheStale(cachedPosts.fetchedAt)) {
      console.log("Returning cached posts");
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          posts: cachedPosts.posts,
          source: "cache",
          fetchedAt: cachedPosts.fetchedAt
        }),
      };
    }

    // Get partner's LinkedIn URN from database
    const partnerUrn = await getPartnerLinkedInUrn(partnerUserId);
    if (!partnerUrn) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Partner LinkedIn URN not found" }),
      };
    }

    console.log("Fetching fresh posts from LinkedIn DMA API for:", partnerUrn);

    // Fetch fresh data from LinkedIn DMA API
    const posts = await fetchPartnerPostsFromDMA(authorization, partnerUrn, parseInt(limit));
    
    // Cache the results
    await cachePosts(partnerUserId, posts);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        posts,
        source: "linkedin",
        fetchedAt: new Date().toISOString()
      }),
    };
  } catch (error) {
    console.error("Synergy posts error:", error);
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

async function getPartnerLinkedInUrn(partnerUserId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Looking up LinkedIn URN for user:", partnerUserId);

    const { data: user, error } = await supabase
      .from('users')
      .select('linkedin_dma_member_urn, name')
      .eq('id', partnerUserId)
      .single();

    if (error || !user) {
      console.error('User not found:', error);
      return null;
    }

    console.log("Found LinkedIn URN for user:", user.name);
    return user.linkedin_dma_member_urn;
  } catch (error) {
    console.error('Error getting partner LinkedIn URN:', error);
    return null;
  }
}

async function getCachedPosts(partnerUserId, limit) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Checking cache for user:", partnerUserId);

    const { data: cachedPosts, error } = await supabase
      .from('post_cache')
      .select('*')
      .eq('user_id', partnerUserId)
      .order('created_at_ms', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching cached posts:', error);
      return null;
    }

    if (!cachedPosts || cachedPosts.length === 0) {
      console.log("No cached posts found");
      return null;
    }

    // Check if we have a recent cache entry
    const latestCache = cachedPosts[0];
    const posts = cachedPosts.map(post => ({
      postUrn: post.post_urn,
      createdAtMs: post.created_at_ms,
      textPreview: post.text_preview || '',
      mediaType: post.media_type || 'NONE',
      mediaAssetUrn: post.media_asset_urn,
      permalink: post.permalink
    }));

    return {
      posts,
      fetchedAt: latestCache.fetched_at
    };
  } catch (error) {
    console.error('Error getting cached posts:', error);
    return null;
  }
}

function isCacheStale(fetchedAt, ttlMinutes = 30) {
  if (!fetchedAt) return true;
  const cacheAge = Date.now() - new Date(fetchedAt).getTime();
  return cacheAge > (ttlMinutes * 60 * 1000);
}

async function fetchPartnerPostsFromDMA(authorization, partnerUrn, limit = 10) {
  try {
    console.log("Fetching posts from LinkedIn DMA API for:", partnerUrn);

    // Use Member Snapshot API to get latest posts
    const response = await fetch(`https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO`, {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LinkedIn DMA API error: ${response.status} - ${errorText}`);
      throw new Error(`LinkedIn API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("LinkedIn DMA API response received");

    // Extract posts from Member Snapshot response
    const memberShareInfo = data.elements?.[0];

    if (!memberShareInfo || !memberShareInfo.snapshotData) {
      console.log("No MEMBER_SHARE_INFO data found");
      return [];
    }

    const rawPosts = memberShareInfo.snapshotData;
    console.log(`Found ${rawPosts.length} raw posts`);

    // Process and format posts (limit to latest 5 for synergy)
    const posts = rawPosts
      .sort((a, b) => {
        // Sort by creation time descending (most recent first)
        const timeA = new Date(a.Date || a.date || 0).getTime();
        const timeB = new Date(b.Date || b.date || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, 5) // Always limit to 5 most recent posts for synergy
      .map(post => {
        // Extract essential post data only (no engagement metrics)
        const createdAtMs = new Date(post.Date || post.date || Date.now()).getTime();
        const textContent = extractTextContent(post);
        const mediaInfo = extractMediaInfo(post);

        return {
          postUrn: post.ShareLink || `urn:li:share:${Date.now()}`,
          createdAtMs: createdAtMs,
          textPreview: textContent,
          mediaType: mediaInfo.type,
          mediaAssetUrn: mediaInfo.assetUrn,
          permalink: post.ShareLink || null
        };
      });

    console.log(`Processed ${posts.length} posts`);
    return posts;
  } catch (error) {
    console.error('Error fetching posts from DMA API:', error);
    throw error;
  }
}

function extractTextContent(post) {
  try {
    // Try different possible text content fields
    const textContent = 
      post.ShareCommentary || 
      post['Share Commentary'] ||
      post.shareCommentary ||
      post.Commentary ||
      post.commentary ||
      post.text ||
      '';
    
    return textContent.substring(0, 500);
  } catch (error) {
    console.error('Error extracting text content:', error);
    return '';
  }
}

function extractMediaInfo(post) {
  try {
    const defaultInfo = { type: 'NONE', assetUrn: null };

    // FIXED: Check for media in snapshot data format
    const mediaUrl = post.MediaUrl || post['Media URL'] || post.mediaUrl;
    const mediaType = post.MediaType || post['Media Type'] || post.mediaType || 'NONE';
    
    if (mediaUrl) {
      return {
        type: mediaType,
        assetUrn: mediaUrl
      };
    }

    return defaultInfo;
  } catch (error) {
    console.error('Error extracting media info:', error);
    return { type: 'NONE', assetUrn: null };
  }
}

async function cachePosts(partnerUserId, posts) {
  try {
    if (!posts || posts.length === 0) {
      console.log("No posts to cache");
      return;
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log(`Caching ${posts.length} posts for user:`, partnerUserId);

    // Delete existing cache for this user
    await supabase
      .from('post_cache')
      .delete()
      .eq('user_id', partnerUserId);

    // Insert new cached posts
    const cacheEntries = posts.map(post => ({
      user_id: partnerUserId,
      post_urn: post.postUrn,
      created_at_ms: post.createdAtMs,
      text_preview: post.textPreview,
      media_type: post.mediaType,
      media_asset_urn: post.mediaAssetUrn,
      permalink: post.permalink,
      fetched_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('post_cache')
      .insert(cacheEntries);

    if (error) {
      console.error('Error caching posts:', error);
    } else {
      console.log("Posts cached successfully");
    }
  } catch (error) {
    console.error('Error in cachePosts:', error);
  }
}