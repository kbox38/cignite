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

  const { authorization } = event.headers;
  const { timeFilter = "7d", page = "1", pageSize = "12", searchTerm = "" } = event.queryStringParameters || {};

  console.log("=== POSTPULSE V2 DATA FUNCTION START ===");
  console.log("Time filter:", timeFilter);
  console.log("Page:", page, "Page size:", pageSize);
  console.log("Search term:", searchTerm);

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

  try {
    const startTime = Date.now();

    // Calculate time range
    const days = timeFilter === "7d" ? 7 : timeFilter === "30d" ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTimestamp = cutoffDate.getTime();

    console.log(`📅 Fetching posts from last ${days} days (since ${cutoffDate.toISOString()})`);

    // Fetch MEMBER_SHARE_INFO snapshot data
    const memberShareResponse = await fetch(
      "https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO",
      {
        headers: {
          Authorization: authorization,
          "LinkedIn-Version": "202312"
        }
      }
    );

    if (!memberShareResponse.ok) {
      console.error("❌ MEMBER_SHARE_INFO API error:", memberShareResponse.status);
      throw new Error(`Failed to fetch MEMBER_SHARE_INFO: ${memberShareResponse.status}`);
    }

    const memberShareData = await memberShareResponse.json();
    const shareInfoData = memberShareData.elements?.[0]?.snapshotData || [];
    
    console.log(`📝 Found ${shareInfoData.length} total shares in MEMBER_SHARE_INFO`);

    if (shareInfoData.length === 0) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          posts: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalPosts: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
          metadata: {
            fetchTimeMs: Date.now() - startTime,
            timeFilter,
            dataSource: "member_share_info_v2",
          },
          lastUpdated: new Date().toISOString(),
        }),
      };
    }

    // Process and filter posts with repurpose readiness
    const processedPosts = [];
    
    shareInfoData.forEach((share, index) => {
      try {
        // Skip if no date
        if (!share.Date) return;

        // Parse date and check if within time range
        const shareDate = new Date(share.Date);
        const shareTimestamp = shareDate.getTime();
        
        if (shareTimestamp < cutoffTimestamp) return;

        // Skip company posts
        if (share.Visibility === "COMPANY") return;

        // Calculate repurpose readiness
        const daysSincePosted = Math.floor((Date.now() - shareTimestamp) / (24 * 60 * 60 * 1000));
        const repurposeStatus = getRepurposeStatus(daysSincePosted);

        // Extract post ID from ShareLink
        let postId = `share_${shareTimestamp}_${index}`;
        if (share.ShareLink) {
          const activityMatch = share.ShareLink.match(/activity-(\d+)/);
          if (activityMatch) {
            postId = `urn:li:activity:${activityMatch[1]}`;
          }
        }

        // Extract media information
        const mediaInfo = extractMediaFromShare(share, authorization);

        const processedPost = {
          id: postId,
          urn: postId,
          title: share.ShareCommentary || "LinkedIn post",
          text: share.ShareCommentary || "LinkedIn post",
          url: share.ShareLink || `https://linkedin.com/feed/update/${postId}`,
          timestamp: shareTimestamp,
          thumbnail: mediaInfo.thumbnail,
          mediaType: mediaInfo.mediaType,
          mediaAssetId: mediaInfo.assetId,
          source: "member_share_info",
          daysSincePosted: daysSincePosted,
          canRepost: repurposeStatus.canRepost,
          repurposeStatus: repurposeStatus,
          likes: parseInt(share.LikesCount || "0"),
          comments: parseInt(share.CommentsCount || "0"),
          shares: parseInt(share.SharesCount || "0"),
        };

        // Apply search filter if provided
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          if (!processedPost.text.toLowerCase().includes(searchLower) &&
              !processedPost.title.toLowerCase().includes(searchLower)) {
            return;
          }
        }

        processedPosts.push(processedPost);

      } catch (error) {
        console.error("❌ Error processing share:", error);
      }
    });

    console.log(`🎯 PROCESSING COMPLETE: ${processedPosts.length} posts processed`);

    // Sort by timestamp (newest first)
    processedPosts.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(pageSize);
    const startIndex = (pageNum - 1) * pageSizeNum;
    const endIndex = startIndex + pageSizeNum;
    const paginatedPosts = processedPosts.slice(startIndex, endIndex);

    const totalPages = Math.ceil(processedPosts.length / pageSizeNum);

    const result = {
      posts: paginatedPosts,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalPosts: processedPosts.length,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      metadata: {
        fetchTimeMs: Date.now() - startTime,
        timeFilter,
        dataSource: "member_share_info_v2",
        totalSharesFound: shareInfoData.length,
        postsInTimeRange: processedPosts.length,
      },
      lastUpdated: new Date().toISOString(),
    };

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
    console.error("❌ PostPulse V2 Data Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch PostPulse data",
        details: error.message,
        posts: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalPosts: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
        metadata: {
          fetchTimeMs: 0,
          timeFilter,
          dataSource: "error",
        },
        lastUpdated: new Date().toISOString(),
      }),
    };
  }
}

function getRepurposeStatus(daysSincePosted) {
  if (daysSincePosted < 40) {
    return {
      status: "too_soon",
      label: "Too Soon",
      color: "bg-red-100 text-red-800 border-red-200",
      canRepost: false,
      daysUntilReady: 40 - daysSincePosted
    };
  } else if (daysSincePosted < 45) {
    return {
      status: "close",
      label: "Close to Repurpose",
      color: "bg-amber-100 text-amber-800 border-amber-200",
      canRepost: false,
      daysUntilReady: 45 - daysSincePosted
    };
  } else {
    return {
      status: "ready",
      label: "Ready to Repurpose",
      color: "bg-green-100 text-green-800 border-green-200",
      canRepost: true,
      daysUntilReady: 0
    };
  }
}

function extractMediaFromShare(share, authorization) {
  console.log("🔍 Extracting media from share:", {
    MediaUrl: share.MediaUrl,
    MediaType: share.MediaType,
    SharedUrl: share.SharedUrl,
  });

  // Check for direct media URL
  if (share.MediaUrl && share.MediaUrl.trim()) {
    const assetMatch = share.MediaUrl.match(/urn:li:digitalmediaAsset:(.+)/);
    if (assetMatch) {
      const assetId = assetMatch[1];
      const token = authorization.replace('Bearer ', '');
      const thumbnailUrl = `/.netlify/functions/linkedin-media-download?assetId=${assetId}&token=${encodeURIComponent(token)}`;
      
      return {
        thumbnail: thumbnailUrl,
        mediaType: share.MediaType || "IMAGE",
        assetId: assetId
      };
    } else {
      return {
        thumbnail: share.MediaUrl,
        mediaType: share.MediaType || "IMAGE",
        assetId: null
      };
    }
  }

  // Check for article with shared URL
  if (share.SharedUrl && share.MediaType === "ARTICLE") {
    return {
      thumbnail: null,
      mediaType: "ARTICLE",
      assetId: null
    };
  }

  return {
    thumbnail: null,
    mediaType: share.MediaType || "TEXT",
    assetId: null
  };
}