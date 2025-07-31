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
  const { postUrn, authorUserId } = event.queryStringParameters || {};

  if (!authorization) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  if (!postUrn || !authorUserId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "postUrn and authorUserId are required" }),
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
    const isPartner = await verifyPartnership(userId, authorUserId);
    if (!isPartner) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Not authorized to view this user's comments" }),
      };
    }

    // Check cache first
    const cachedComment = await getCachedComment(authorUserId, postUrn);
    if (cachedComment && !isCacheStale(cachedComment.fetchedAt)) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          comment: cachedComment.comment,
          source: "cache",
          fetchedAt: cachedComment.fetchedAt
        }),
      };
    }

    // Get author's LinkedIn URN
    const authorUrn = await getUserLinkedInUrn(authorUserId);
    if (!authorUrn) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Author LinkedIn URN not found" }),
      };
    }

    // Fetch fresh comment data from LinkedIn
    const comment = await fetchCommentByAuthorOnPost(authorization, authorUrn, postUrn);
    
    // Cache the result (even if null)
    await cacheComment(authorUserId, postUrn, comment);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        comment,
        source: "linkedin",
        fetchedAt: new Date().toISOString()
      }),
    };
  } catch (error) {
    console.error("Synergy comments error:", error);
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
  return true;
}

async function getCachedComment(authorUserId, postUrn) {
  // In a real implementation, query comment_cache table in Supabase
  return null;
}

function isCacheStale(fetchedAt, ttlMinutes = 15) {
  if (!fetchedAt) return true;
  const cacheAge = Date.now() - new Date(fetchedAt).getTime();
  return cacheAge > (ttlMinutes * 60 * 1000);
}

async function getUserLinkedInUrn(userId) {
  // In a real implementation, query Supabase to get the user's LinkedIn URN
  return `urn:li:person:${userId}`;
}

async function fetchCommentByAuthorOnPost(authorization, authorUrn, postUrn) {
  try {
    console.log(`Fetching comments by ${authorUrn} on post ${postUrn}`);

    // Fetch recent comments from changelog
    const response = await fetch(
      "/.netlify/functions/linkedin-changelog?count=100",
      {
        headers: {
          Authorization: authorization,
          "LinkedIn-Version": "202312",
        },
      }
    );

    if (!response.ok) {
      console.error(`LinkedIn changelog API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.elements) return null;

    // Find comments authored by the specified user on the specified post
    const commentEvents = data.elements.filter(event => 
      event.resourceName === "socialActions/comments" &&
      event.method === "CREATE" &&
      event.actor === authorUrn &&
      event.activity?.object === postUrn
    );

    if (commentEvents.length === 0) {
      console.log(`No comments found by ${authorUrn} on post ${postUrn}`);
      return null;
    }

    // Get the most recent comment
    const latestComment = commentEvents.sort((a, b) => b.capturedAt - a.capturedAt)[0];
    
    const commentText = 
      latestComment.activity?.message ||
      latestComment.processedActivity?.message ||
      "Comment content";

    return {
      id: latestComment.resourceId,
      message: commentText,
      createdAtMs: latestComment.capturedAt,
      authorUrn,
      objectUrn: postUrn,
      raw: {
        activity: latestComment.activity,
        processedActivity: latestComment.processedActivity
      }
    };
  } catch (error) {
    console.error("Error fetching comment:", error);
    return null;
  }
}

async function cacheComment(authorUserId, postUrn, comment) {
  // In a real implementation, save to comment_cache table in Supabase
  console.log(`Caching comment for author ${authorUserId} on post ${postUrn}`);
}