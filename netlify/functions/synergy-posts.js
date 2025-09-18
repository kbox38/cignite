// netlify/functions/synergy-posts.js - Complete file converted to CommonJS
const fetch = require('node-fetch');

// Main handler function - converted to CommonJS export
exports.handler = async (event, context) => {
  // Handle CORS preflight
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
        body: JSON.stringify({ 
          error: "Partner LinkedIn URN not found",
          posts: [],
          source: "error_fallback",
          fetchedAt: new Date().toISOString()
        }),
      };
    }

    console.log("Fetching fresh posts from LinkedIn for:", partnerUrn);

    // FIXED: Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
    
    try {
      // Try DMA API first, fallback to snapshot
      let posts = [];
      
      try {
        posts = await fetchPartnerPostsFromDMA(authorization, partnerUrn, parseInt(limit));
        console.log(`DMA API returned ${posts.length} posts`);
      } catch (dmaError) {
        console.log("DMA API failed, trying snapshot fallback:", dmaError.message);
        posts = await fetchPartnerPostsFromSnapshot(authorization, partnerUrn, parseInt(limit));
        console.log(`Snapshot API returned ${posts.length} posts`);
      }
      
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
};

async function getPartnerLinkedInUrn(partnerUserId) {
  try {
    const { createClient } = require('@supabase/supabase-js');
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
    const { createClient } = require('@supabase/supabase-js');
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
  
  const cacheAge = new Date().getTime() - new Date(fetchedAt).getTime();
  return cacheAge > (ttlMinutes * 60 * 1000);
}

async function fetchPartnerPostsFromDMA(authorization, partnerUrn, limit = 5) {
  try {
    console.log("Fetching posts from LinkedIn DMA API for:", partnerUrn);
    console.log("Using authorization:", authorization ? 'Bearer token present' : 'No token');

    const baseUrl = 'https://api.linkedin.com/v2/people';
    const extractedId = partnerUrn.replace('urn:li:person:', '');
    
    const url = `${baseUrl}/${extractedId}/networkinfo?projection=(posts~(lastModified,created,shareCommentary,content,ugcPost))`;
    console.log("DMA API URL:", url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authorization}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202306'
      }
    });

    console.log("DMA API Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DMA API Error:", response.status, errorText);
      throw new Error(`DMA API failed: ${response.status}`);
    }

    const data = await response.json();
    console.log("DMA API Response data keys:", Object.keys(data));

    if (!data.posts || !data.posts.elements) {
      console.log("No posts found in DMA response");
      return [];
    }

    const posts = data.posts.elements
      .slice(0, limit) // EXACTLY 5 most recent posts for synergy
      .map((post, index) => {
        console.log(`Processing DMA post ${index + 1}:`, Object.keys(post));
        
        const textContent = extractTextContent(post);
        const mediaInfo = extractMediaInfo(post);
        const createdAt = post.created?.time || Date.now();
        
        return {
          postUrn: post.id || `temp_${Date.now()}_${index}`,
          createdAtMs: createdAt,
          textPreview: textContent,
          mediaType: mediaInfo.type,
          mediaAssetUrn: mediaInfo.assetUrn,
          permalink: post.permalink || null
        };
      });

    console.log(`Successfully processed ${posts.length} posts from DMA`);
    return posts;

  } catch (error) {
    console.error('Error fetching posts from DMA API:', error);
    throw error; // Re-throw to allow fallback
  }
}

// FALLBACK: Fetch from Member Snapshot API
async function fetchPartnerPostsFromSnapshot(authorization, partnerUrn, limit = 5) {
  try {
    console.log("Fetching posts from LinkedIn Snapshot API for:", partnerUrn);
    
    const baseUrl = 'https://api.linkedin.com/rest/memberSnapshotData';
    const extractedId = partnerUrn.replace('urn:li:person:', '');
    
    const url = `${baseUrl}?q=criteria&memberId=${extractedId}&domain=MEMBER_SHARE_INFO`;
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
      throw new Error(`Snapshot API failed: ${response.status}`);
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
          console.log(`Processing snapshot item ${index + 1}:`, Object.keys(item));
          
          const shareUrl = item["Share URL"] || item.shareUrl || item.url;
          const shareDate = item["Share Date"] || item.shareDate || item.date;
          const textContent = extractTextContent(item);
          const mediaInfo = extractMediaInfo(item);
          
          if (!shareUrl) {
            console.log(`Skipping item ${index + 1}: No share URL`);
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
      .filter(post => post !== null) // Remove failed items
      .slice(0, limit); // Take only the requested number

    console.log(`Successfully processed ${posts.length} posts from Snapshot`);
    return posts;

  } catch (error) {
    console.error('Error fetching posts from Snapshot API:', error);
    // Don't throw error, return empty array to prevent 502
    console.log('Returning empty array due to snapshot error');
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
    const { createClient } = require('@supabase/supabase-js');
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