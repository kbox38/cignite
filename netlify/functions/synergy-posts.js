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
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const { authorization } = event.headers;
  const { partnerId, limit = "5", direction = "theirs" } = event.queryStringParameters || {};

  if (!authorization) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  if (!partnerId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Partner ID is required" }),
    };
  }

  try {
    const userId = await getUserIdFromToken(authorization);
    
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid token" }),
      };
    }

    // Verify partnership exists
    const isPartner = await verifyPartnership(userId, partnerId);
    if (!isPartner) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Not authorized to view this partner's posts" }),
      };
    }

    // Get partner's LinkedIn member URN
    const partnerUrn = await getPartnerLinkedInUrn(partnerId);
    if (!partnerUrn) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Partner LinkedIn URN not found" }),
      };
    }

    // Check cache first
    const cachedPosts = await getCachedPosts(partnerId, parseInt(limit));
    if (cachedPosts && !isCacheStale(cachedPosts.fetchedAt)) {
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

    // Fetch fresh data from LinkedIn
    const posts = await fetchPartnerPosts(authorization, partnerUrn, parseInt(limit));
    
    // Cache the results
    await cachePosts(partnerId, posts);

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
      body: JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
    };
  }
}

async function getUserIdFromToken(authorization) {
  // Placeholder - implement based on your auth system
  return "user-123";
}

async function verifyPartnership(userId, partnerId) {
  // In a real implementation, query Supabase to verify the partnership exists
  // For now, return true for demo purposes
  return true;
}

async function getPartnerLinkedInUrn(partnerId) {
  // In a real implementation, query Supabase to get the partner's LinkedIn URN
  // For now, return a mock URN
  return `urn:li:person:${partnerId}`;
}

async function getCachedPosts(partnerId, limit) {
  // In a real implementation, query post_cache table in Supabase
  // For now, return null to always fetch fresh data
  return null;
}

function isCacheStale(fetchedAt, ttlMinutes = 15) {
  if (!fetchedAt) return true;
  const cacheAge = Date.now() - new Date(fetchedAt).getTime();
  return cacheAge > (ttlMinutes * 60 * 1000);
}

async function fetchPartnerPosts(authorization, partnerUrn, limit) {
  try {
    console.log(`Fetching posts for partner URN: ${partnerUrn}`);

    // First try to get recent posts from changelog
    const changelogResponse = await fetch(
      "/.netlify/functions/linkedin-changelog?count=50",
      {
        headers: {
          Authorization: authorization,
          "LinkedIn-Version": "202312",
        },
      }
    );

    if (changelogResponse.ok) {
      const changelogData = await changelogResponse.json();
      const posts = processChangelogPosts(changelogData, partnerUrn, limit);
      
      if (posts.length > 0) {
        console.log(`Found ${posts.length} posts from changelog`);
        return posts;
      }
    }

    // Fallback to snapshot data
    console.log("Falling back to snapshot data");
    const snapshotResponse = await fetch(
      "/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO",
      {
        headers: {
          Authorization: authorization,
          "LinkedIn-Version": "202312",
        },
      }
    );

    if (snapshotResponse.ok) {
      const snapshotData = await snapshotResponse.json();
      return processSnapshotPosts(snapshotData, partnerUrn, limit);
    }

    return [];
  } catch (error) {
    console.error("Error fetching partner posts:", error);
    return [];
  }
}

function processChangelogPosts(data, partnerUrn, limit) {
  const posts = [];
  
  if (!data.elements) return posts;

  // Filter for UGC posts created by the partner
  const userPosts = data.elements.filter(event => 
    event.resourceName === "ugcPosts" && 
    event.method === "CREATE" &&
    event.activity?.author === partnerUrn
  );

  // Sort by creation time and take the latest
  userPosts
    .sort((a, b) => b.capturedAt - a.capturedAt)
    .slice(0, limit)
    .forEach(event => {
      const content = event.activity?.specificContent?.["com.linkedin.ugc.ShareContent"];
      const processedContent = event.processedActivity?.specificContent?.["com.linkedin.ugc.ShareContent"];
      
      const textPreview = 
        content?.shareCommentary?.text ||
        processedContent?.shareCommentary?.text ||
        "Post content";

      // Extract media information
      let mediaType = "NONE";
      let mediaAssetUrn = null;
      
      const media = content?.media || processedContent?.media;
      if (media && media.length > 0) {
        const firstMedia = media[0];
        mediaAssetUrn = firstMedia?.media;
        mediaType = firstMedia?.mediaType || "IMAGE";
      }

      posts.push({
        postUrn: event.resourceId,
        createdAtMs: event.capturedAt,
        textPreview: textPreview.substring(0, 200),
        mediaType,
        mediaAssetUrn,
        permalink: `https://linkedin.com/feed/update/${event.resourceId}`,
        raw: {
          activity: event.activity,
          processedActivity: event.processedActivity
        }
      });
    });

  return posts;
}

function processSnapshotPosts(data, partnerUrn, limit) {
  const posts = [];
  
  if (!data.elements || !data.elements[0]?.snapshotData) return posts;

  const shareData = data.elements[0].snapshotData;
  
  // Sort by date and take the latest
  shareData
    .filter(share => share.ShareLink) // Only posts with valid links
    .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
    .slice(0, limit)
    .forEach(share => {
      // Extract post URN from ShareLink
      const activityMatch = share.ShareLink.match(/activity-(\d+)/);
      const postUrn = activityMatch ? `urn:li:activity:${activityMatch[1]}` : share.ShareLink;

      posts.push({
        postUrn,
        createdAtMs: new Date(share.Date).getTime(),
        textPreview: (share.ShareCommentary || "").substring(0, 200),
        mediaType: share.MediaType || "NONE",
        mediaAssetUrn: share.MediaUrl ? `urn:li:digitalmediaAsset:${share.MediaUrl}` : null,
        permalink: share.ShareLink,
        raw: share
      });
    });

  return posts;
}

async function cachePosts(partnerId, posts) {
  // In a real implementation, save to post_cache table in Supabase
  console.log(`Caching ${posts.length} posts for partner ${partnerId}`);
}