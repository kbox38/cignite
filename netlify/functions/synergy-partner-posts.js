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
  const { partnerPersonUrn } = event.queryStringParameters || {};

  console.log("=== SYNERGY PARTNER POSTS (SNAPSHOT) ===");
  console.log("Partner URN:", partnerPersonUrn);
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

  if (!partnerPersonUrn) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "partnerPersonUrn is required" }),
    };
  }

  try {
    // Check cache first
    const cacheKey = `synergy_${partnerPersonUrn}_${authorization.substring(0, 20)}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log("Returning cached partner posts");
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(cached),
      };
    }

    // For demo purposes, we'll use the viewer's token for partner data
    // In production, you'd fetch the partner's DMA token from your database
    const partnerDmaToken = authorization.replace('Bearer ', '');
    const myDmaToken = authorization.replace('Bearer ', '');

    console.log("Using tokens for partner posts fetch");

    // Verify partner consent
    const consentCheck = await verifyPartnerConsent(partnerDmaToken);
    if (!consentCheck.isActive) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "partner_not_authorized",
          message: "Partner needs to reconnect with DMA consent"
        }),
      };
    }

    // Fetch partner's posts from MEMBER_SHARE_INFO snapshot
    const partnerPosts = await fetchPartnerPostsFromSnapshot(partnerDmaToken, partnerPersonUrn);
    console.log(`Found ${partnerPosts.length} partner posts from snapshot`);

    // Fetch my comments on those posts from my snapshot
    const myComments = await fetchMyCommentsFromSnapshot(myDmaToken, partnerPosts.map(p => p.urn));
    console.log(`Found ${Object.keys(myComments).length} of my comments on partner posts`);

    // Combine posts with my comments
    const postsWithComments = partnerPosts.map(post => ({
      ...post,
      myComment: myComments[post.urn] || null
    }));

    const result = {
      partner: {
        personUrn: partnerPersonUrn,
        displayName: extractDisplayName(partnerPersonUrn)
      },
      posts: postsWithComments
    };

    // Cache the result for 10 minutes
    setInCache(cacheKey, result, 10 * 60 * 1000);

    console.log(`Returning ${result.posts.length} posts for partner`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error("Synergy partner posts error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch partner posts",
        details: error.message
      }),
    };
  }
}

// Simple in-memory cache (in production, use Redis or similar)
const cache = new Map();

function getFromCache(key) {
  const item = cache.get(key);
  if (item && Date.now() < item.expiry) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setInCache(key, data, ttlMs) {
  cache.set(key, {
    data,
    expiry: Date.now() + ttlMs
  });
}

async function verifyPartnerConsent(partnerDmaToken) {
  try {
    const response = await fetch("https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication", {
      headers: {
        Authorization: `Bearer ${partnerDmaToken}`,
        "LinkedIn-Version": "202312"
      }
    });

    if (!response.ok) {
      return { isActive: false, message: "Unable to verify partner consent" };
    }

    const data = await response.json();
    const hasConsent = data.elements && data.elements.length > 0;

    return {
      isActive: hasConsent,
      message: hasConsent ? "Partner consent active" : "Partner consent not active"
    };
  } catch (error) {
    console.error("Error verifying partner consent:", error);
    return { isActive: false, message: "Error checking partner consent" };
  }
}

async function fetchPartnerPostsFromSnapshot(partnerDmaToken, partnerPersonUrn) {
  try {
    console.log(`Fetching MEMBER_SHARE_INFO snapshot for partner: ${partnerPersonUrn}`);
    
    const response = await fetch(
      "https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO",
      {
        headers: {
          Authorization: `Bearer ${partnerDmaToken}`,
          "LinkedIn-Version": "202312"
        }
      }
    );

    if (!response.ok) {
      console.warn(`Partner snapshot API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const shareData = data.elements?.[0]?.snapshotData || [];

    console.log(`Processing ${shareData.length} shares from partner snapshot`);

    // Filter and process posts
    const posts = shareData
      .filter(share => {
        // Only include posts that are not company posts
        return share.Visibility !== "COMPANY" && share.ShareCommentary;
      })
      .sort((a, b) => new Date(b.Date || b.date).getTime() - new Date(a.Date || a.date).getTime())
      .slice(0, 5) // Take latest 5
      .map(share => {
        // Extract post URN from ShareLink
        let postUrn = share.ShareLink || `share_${Date.now()}`;
        const activityMatch = share.ShareLink?.match(/activity-(\d+)/);
        const shareMatch = share.ShareLink?.match(/share-(\d+)/);
        if (activityMatch) {
          postUrn = `urn:li:activity:${activityMatch[1]}`;
        } else if (shareMatch) {
          postUrn = `urn:li:share:${shareMatch[1]}`;
        }

        // Extract thumbnail
        const thumbnail = extractThumbnailFromSnapshot(share);
        
        return {
          urn: postUrn,
          createdAt: new Date(share.Date || share.date).getTime(),
          text: share.ShareCommentary || "Post content",
          mediaType: share.MediaType || "TEXT",
          thumbnail: thumbnail
        };
      });

    console.log(`Returning ${posts.length} processed partner posts from snapshot`);
    return posts;

  } catch (error) {
    console.error("Error fetching partner posts from snapshot:", error);
    return [];
  }
}

async function fetchMyCommentsFromSnapshot(myDmaToken, postUrns) {
  try {
    console.log(`Fetching my comments for ${postUrns.length} post URNs from snapshot`);
    
    // For now, return empty comments since MEMBER_SHARE_INFO doesn't contain comment data
    // In a full implementation, you'd need to fetch from a comments-specific domain or use changelog
    const myComments = {};

    console.log(`Found ${Object.keys(myComments).length} of my comments from snapshot`);
    return myComments;

  } catch (error) {
    console.error("Error fetching my comments from snapshot:", error);
    return {};
  }
}

function extractThumbnailFromSnapshot(share) {
  // Handle direct media URLs from snapshot
  if (share.MediaUrl && share.MediaUrl.trim()) {
    // Check if it's a LinkedIn asset URN
    const assetMatch = share.MediaUrl.match(/urn:li:digitalmediaAsset:(.+)/);
    if (assetMatch) {
      const assetId = assetMatch[1];
      return `/.netlify/functions/linkedin-media-download?assetId=${assetId}`;
    } else {
      // Direct URL
      return share.MediaUrl;
    }
  }

  // Handle articles with shared URLs
  if (share.SharedUrl && share.MediaType === "ARTICLE") {
    return null; // Articles might not have thumbnails in snapshot data
  }

  return null;
}

function extractDisplayName(personUrn) {
  // Extract a display name from the URN for demo purposes
  const urnParts = personUrn.split(':');
  const id = urnParts[urnParts.length - 1];
  return `Partner ${id.substring(0, 8)}`;
}