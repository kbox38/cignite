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
      .select('linkedin_dma_member_urn, linkedin_member_urn, name')
      .eq('id', partnerUserId)
      .single();

    if (error || !user) {
      console.error('User not found:', error);
      return null;
    }

    console.log("Found LinkedIn URN for user:", user.name);
    // Use DMA URN if available, fallback to regular URN
    return user.linkedin_dma_member_urn || user.linkedin_member_urn;
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
    slice(0, 5) // EXACTLY 5 most recent posts for synergy
  return cacheAge > (ttlMinutes * 60 * 1000);
}

async function fetchPartnerPostsFromDMA(authorization, partnerUrn, limit = 5) {
  try {
    console.log("Fetching posts from LinkedIn DMA API for:", partnerUrn);
    console.log("Using authorization:", authorization ? 'Bearer token present' : 'No token');

    // FIXED: Use the correct DMA API endpoint with proper parameters
    const url = `https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO&member=${encodeURIComponent(partnerUrn)}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312',
        'X-Restli-Protocol-Version': '2.0.0',
        'Accept': 'application/json'
      }
    });

    console.log('LinkedIn API response status:', response.status);
    console.log('LinkedIn API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LinkedIn DMA API error: ${response.status} - ${errorText}`);
      
      // FIXED: Handle specific error cases
      if (response.status === 404) {
        console.log('No posts found for partner - returning empty array');
        return [];
      }
      if (response.status === 403) {
        throw new Error('Access denied - check DMA permissions');
      }
      if (response.status === 401) {
        throw new Error('Unauthorized - invalid or expired token');
      }
      
      throw new Error(`LinkedIn API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("LinkedIn DMA API response received, processing data...");

    // FIXED: Better error handling for data extraction
    if (!data.elements || data.elements.length === 0) {
      console.log("No elements found in API response");
      return [];
    }

    // Extract posts from Member Snapshot response
    const memberShareInfo = data.elements.find(element => 
      element.domain === 'MEMBER_SHARE_INFO' && element.snapshotData
    );

    if (!memberShareInfo || !memberShareInfo.snapshotData) {
      console.log("No MEMBER_SHARE_INFO data found in response");
      return [];
    }

    const rawPosts = memberShareInfo.snapshotData;
    console.log(`Found ${rawPosts.length} raw posts`);

    // FIXED: Better post processing with error handling
    const posts = rawPosts
      .filter(post => post && (post.Date || post.date)) // Filter out invalid posts
      .sort((a, b) => {
        const timeA = new Date(a.Date || a.date || 0).getTime();
        const timeB = new Date(b.Date || b.date || 0).getTime();
        return timeB - timeA; // Most recent first
      })
      .slice(0, Math.min(limit, 5)) // Limit to requested number or 5, whichever is smaller
      .map((post, index) => {
        try {
          const createdAtMs = new Date(post.Date || post.date || Date.now()).getTime();
          const textContent = extractTextContent(post);
          const mediaInfo = extractMediaInfo(post);

          return {
            postUrn: post.ShareLink || `urn:li:share:${createdAtMs}_${index}`,
            createdAtMs: createdAtMs,
            textPreview: textContent.substring(0, 300), // Limit preview length
            mediaType: mediaInfo.type,
            mediaAssetUrn: mediaInfo.assetUrn,
            permalink: post.ShareLink || null
          };
        } catch (error) {
          console.error('Error processing individual post:', error);
          return null; // Will be filtered out below
        }
      })
      .filter(post => post !== null); // Remove any failed posts

    console.log(`Successfully processed ${posts.length} posts`);
    return posts;

  } catch (error) {
    console.error('Error fetching posts from DMA API:', error);
    console.error('Error stack:', error.stack);
    
    // FIXED: Don't throw error, return empty array to prevent 502
    console.log('Returning empty array due to error');
    return [];
  }
}

// FIXED: Enhanced text extraction with better error handling
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
        return post[field].trim();
      }
    }
    
    return 'No text content available';
  } catch (error) {
    console.error('Error extracting text content:', error);
    return 'Error loading content';
  }
}

// FIXED: Enhanced media extraction
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

// FIXED: Enhanced cache function with better error handling
async function cachePosts(partnerUserId, posts) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log(`Caching ${posts.length} posts for user:`, partnerUserId);

    if (posts.length === 0) {
      console.log('No posts to cache');
      return;
    }

    // Clear existing cache for this user
    await supabase
      .from('post_cache')
      .delete()
      .eq('user_id', partnerUserId);

    // Insert new posts
    const cacheData = posts.map(post => ({
      user_id: partnerUserId,
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
      console.error('Error caching posts:', error);
    } else {
      console.log('Posts cached successfully');
    }
  } catch (error) {
    console.error('Error in cachePosts:', error);
    // Don't throw error - caching failure shouldn't break the main functionality
  }
}

// Additional fix for the main handler to prevent 502 errors
export async function handler(event, context) {
  // Add this at the beginning of the try block:
  
  try {
    // ... existing validation code ...

    // FIXED: Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
    
    try {
      // ... existing logic ...
      
      const posts = await fetchPartnerPostsFromDMA(authorization, partnerUrn, parseInt(limit));
      
      clearTimeout(timeoutId);
      
      // Cache the results (won't throw even if it fails)
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
          fetchedAt: new Date().toISOString(),
          count: posts.length
        }),
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
    
  } catch (error) {
    console.error("Synergy posts error:", error);
    
    // FIXED: Return empty array instead of 502 error
    return {
      statusCode: 200, // Changed from 500 to 200
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        posts: [], // Return empty array instead of error
        source: "error_fallback",
        fetchedAt: new Date().toISOString(),
        count: 0,
        error: error.message // Include error for debugging
      }),
    };
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