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
      .select('linkedin_member_urn, name')
      .eq('id', partnerUserId)
      .single();

    if (error || !user) {
      console.error('User not found:', error);
      return null;
    }

    console.log("Found LinkedIn URN for user:", user.name);
    return user.linkedin_member_urn;
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

async function fetchPartnerPostsFromDMA(authorization, partnerUrn, limit = 5) {
  try {
    console.log("Fetching posts from LinkedIn DMA API for:", partnerUrn);

    // Call LinkedIn Member Snapshot API for MEMBER_SHARE_INFO domain
    const response = await fetch(`https://api.linkedin.com/rest/memberSnapshots/${encodeURIComponent(partnerUrn)}?q=member&domains=MEMBER_SHARE_INFO`, {
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

    // Extract posts from MEMBER_SHARE_INFO domain
    const memberShareInfo = data.elements?.find(element => 
      element.domainType === 'MEMBER_SHARE_INFO'
    );

    if (!memberShareInfo || !memberShareInfo.snapshot) {
      console.log("No MEMBER_SHARE_INFO data found");
      return [];
    }

    const rawPosts = memberShareInfo.snapshot;
    console.log(`Found ${rawPosts.length} raw posts`);

    // Process and format posts (limit to 5 most recent)
    const posts = rawPosts
      .sort((a, b) => {
        // Sort by creation time descending (most recent first)
        const timeA = a.createdAt || a.firstPublishedAt || 0;
        const timeB = b.createdAt || b.firstPublishedAt || 0;
        return timeB - timeA;
      })
      .slice(0, limit)
      .map(post => {
        // Extract essential post data only (no engagement metrics)
        const createdAtMs = post.createdAt || post.firstPublishedAt || Date.now();
        const textContent = extractTextContent(post);
        const mediaInfo = extractMediaInfo(post);

        return {
          postUrn: post.urn || `urn:li:share:${Date.now()}`,
          createdAtMs: createdAtMs,
          textPreview: textContent,
          mediaType: mediaInfo.type,
          mediaAssetUrn: mediaInfo.assetUrn,
          permalink: post.permalink || null
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
    if (post.text) return post.text.substring(0, 500);
    if (post.content?.commentary) return post.content.commentary.substring(0, 500);
    if (post.commentary) return post.commentary.substring(0, 500);
    if (post.specificContent?.com_linkedin_ugc_ShareContent?.shareCommentary?.text) {
      return post.specificContent.com_linkedin_ugc_ShareContent.shareCommentary.text.substring(0, 500);
    }
    return '';
  } catch (error) {
    console.error('Error extracting text content:', error);
    return '';
  }
}

function extractMediaInfo(post) {
  try {
    const defaultInfo = { type: 'NONE', assetUrn: null };

    // Check for media in various possible locations
    if (post.content?.media) {
      const media = post.content.media;
      if (media.length > 0) {
        const firstMedia = media[0];
        return {
          type: firstMedia.type || 'IMAGE',
          assetUrn: firstMedia.media || firstMedia.urn || null
        };
      }
    }

    if (post.specificContent?.com_linkedin_ugc_ShareContent?.media) {
      const media = post.specificContent.com_linkedin_ugc_ShareContent.media;
      if (media.length > 0) {
        const firstMedia = media[0];
        return {
          type: firstMedia.mediaType || 'IMAGE',
          assetUrn: firstMedia.media || null
        };
      }
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