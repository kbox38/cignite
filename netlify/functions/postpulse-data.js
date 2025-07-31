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
  const { timeFilter = "7d", page = "1", pageSize = "12" } = event.queryStringParameters || {};

  console.log("=== POSTPULSE DATA FUNCTION START ===");
  console.log("Time filter:", timeFilter);
  console.log("Page:", page, "Page size:", pageSize);
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

  try {
    const startTime = Date.now();

    // Calculate time range
    const days = timeFilter === "7d" ? 7 : timeFilter === "30d" ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTimestamp = cutoffDate.getTime();

    console.log(`📅 Fetching posts from last ${days} days (since ${cutoffDate.toISOString()})`);

    // Fetch MEMBER_SHARE_INFO directly - this contains ALL posts
    console.log("🔗 Fetching MEMBER_SHARE_INFO snapshot data...");
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
      console.error("❌ MEMBER_SHARE_INFO API error:", memberShareResponse.status, memberShareResponse.statusText);
      throw new Error(`Failed to fetch MEMBER_SHARE_INFO: ${memberShareResponse.status}`);
    }

    const memberShareData = await memberShareResponse.json();
    console.log("📊 MEMBER_SHARE_INFO response:", {
      hasElements: !!memberShareData.elements,
      elementsLength: memberShareData.elements?.length,
      firstElementKeys: memberShareData.elements?.[0] ? Object.keys(memberShareData.elements[0]) : [],
      snapshotDataLength: memberShareData.elements?.[0]?.snapshotData?.length
    });

    // Extract posts from MEMBER_SHARE_INFO
    const shareInfoData = memberShareData.elements?.[0]?.snapshotData || [];
    console.log(`📝 Found ${shareInfoData.length} total shares in MEMBER_SHARE_INFO`);

    if (shareInfoData.length === 0) {
      console.log("⚠️ No shares found in MEMBER_SHARE_INFO");
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
            dataSource: "member_share_info",
          },
          lastUpdated: new Date().toISOString(),
        }),
      };
    }

    // Process and filter posts
    const processedPosts = [];
    
    shareInfoData.forEach((share, index) => {
      try {
        console.log(`=== PROCESSING SHARE ${index + 1}/${shareInfoData.length} ===`);
        console.log("Share data:", {
          Date: share.Date,
          Visibility: share.Visibility,
          ShareCommentary: share.ShareCommentary?.substring(0, 50) + "...",
          ShareLink: share.ShareLink,
          MediaType: share.MediaType,
          MediaUrl: share.MediaUrl,
          LikesCount: share.LikesCount,
          CommentsCount: share.CommentsCount,
          SharesCount: share.SharesCount
        });

        // Skip if no date
        if (!share.Date) {
          console.log("❌ EXCLUDED: No date");
          return;
        }

        // Parse date and check if within time range
        const shareDate = new Date(share.Date);
        const shareTimestamp = shareDate.getTime();
        
        if (shareTimestamp < cutoffTimestamp) {
          console.log("❌ EXCLUDED: Outside time range");
          return;
        }

        // Skip company posts (but be lenient with other visibility types)
        if (share.Visibility === "COMPANY") {
          console.log("❌ EXCLUDED: Company post");
          return;
        }

        // Extract post ID from ShareLink
        let postId = `share_${shareTimestamp}_${index}`;
        if (share.ShareLink) {
          const activityMatch = share.ShareLink.match(/activity-(\d+)/);
          const shareMatch = share.ShareLink.match(/share-(\d+)/);
          if (activityMatch) {
            postId = `urn:li:activity:${activityMatch[1]}`;
          } else if (shareMatch) {
            postId = `urn:li:share:${shareMatch[1]}`;
          }
        }

        // Extract media information
        const mediaInfo = extractMediaFromShare(share, authorization);
        console.log("🖼️ Media info:", mediaInfo);

        // Calculate days since posted
        const daysSincePosted = Math.floor((Date.now() - shareTimestamp) / (24 * 60 * 60 * 1000));

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
          canRepost: daysSincePosted >= 30,
          // Remove engagement metrics as they don't exist in historical data
        };

        processedPosts.push(processedPost);
        console.log("✅ INCLUDED: Post added");

      } catch (error) {
        console.error("❌ Error processing share:", error, share);
      }
    });

    console.log(`🎯 PROCESSING COMPLETE: ${processedPosts.length} posts processed from ${shareInfoData.length} shares`);

    // Sort by timestamp (newest first)
    processedPosts.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(pageSize);
    const startIndex = (pageNum - 1) * pageSizeNum;
    const endIndex = startIndex + pageSizeNum;
    const paginatedPosts = processedPosts.slice(startIndex, endIndex);

    console.log(`📄 PAGINATION: Showing ${paginatedPosts.length} posts (${startIndex + 1}-${Math.min(endIndex, processedPosts.length)} of ${processedPosts.length})`);

    // Return ALL posts without pagination to show all 90 posts
    const result = {
      posts: processedPosts, // Return all posts, not paginated
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalPosts: processedPosts.length,
        hasNextPage: false,
        hasPrevPage: false,
      },
      metadata: {
        fetchTimeMs: Date.now() - startTime,
        timeFilter,
        dataSource: "member_share_info",
        totalSharesFound: shareInfoData.length,
        postsInTimeRange: processedPosts.length,
      },
      lastUpdated: new Date().toISOString(),
    };

    console.log("🚀 FINAL RESULT:", {
      totalPosts: result.pagination.totalPosts,
      currentPagePosts: result.posts.length,
      dataSource: result.metadata.dataSource,
      fetchTime: result.metadata.fetchTimeMs + "ms"
    });

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
    console.error("❌ PostPulse Data Error:", error);
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

function extractMediaFromShare(share, authorization) {
  console.log("🔍 Extracting media from share:", {
    MediaUrl: share.MediaUrl,
    MediaType: share.MediaType,
    SharedUrl: share.SharedUrl,
    hasMediaUrl: !!share.MediaUrl
  });

  // Check for direct media URL (images/videos)
  if (share.MediaUrl && share.MediaUrl.trim()) {
    console.log("✅ Found direct MediaUrl:", share.MediaUrl);
    
    // Check if it's a LinkedIn asset URN
    const assetMatch = share.MediaUrl.match(/urn:li:digitalmediaAsset:(.+)/);
    if (assetMatch) {
      const assetId = assetMatch[1];
      console.log("🎯 Extracted asset ID:", assetId);
      
      // Extract token from authorization header
      const token = authorization.replace('Bearer ', '');
      const thumbnailUrl = `/.netlify/functions/linkedin-media-download?assetId=${assetId}&token=${encodeURIComponent(token)}`;
      
      return {
        thumbnail: thumbnailUrl,
        mediaType: share.MediaType || "IMAGE",
        assetId: assetId
      };
    } else {
      // Direct URL (not an asset URN)
      console.log("🔗 Using direct media URL");
      return {
        thumbnail: share.MediaUrl,
        mediaType: share.MediaType || "IMAGE",
        assetId: null
      };
    }
  }

  // Check for article with shared URL
  if (share.SharedUrl && share.MediaType === "ARTICLE") {
    console.log("📄 Found article with SharedUrl:", share.SharedUrl);
    return {
      thumbnail: null, // Articles might not have thumbnails in historical data
      mediaType: "ARTICLE",
      assetId: null
    };
  }

  // No media found
  console.log("❌ No media found");
  return {
    thumbnail: null,
    mediaType: share.MediaType || "TEXT",
    assetId: null
  };
}