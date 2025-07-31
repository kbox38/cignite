import { ProcessedPost } from "./postpulse-cache";

export interface HistoricalPostData {
  paging: {
    start: number;
    count: number;
    total: number;
    hasMore: boolean;
  };
  elements: Array<{
    snapshotDomain: string;
    snapshotData: Array<{
      Visibility: string;
      ShareCommentary: string;
      MediaUrl?: string;
      ShareLink: string;
      Date: string;
      SharedUrl?: string;
      LikesCount: string;
      CommentsCount: string;
      SharesCount: string;
      MediaType: string;
    }>;
  }>;
  cutoffDate: string;
  daysBack: number;
}

export interface ChangelogPostData {
  elements: Array<{
    resourceName: string;
    method: string;
    capturedAt: number;
    resourceId: string;
    processedActivity?: any;
    activity?: any;
  }>;
}

export class PostPulseProcessor {
  static processHistoricalData(data: HistoricalPostData): ProcessedPost[] {
    const posts: ProcessedPost[] = [];
    
    console.log("=== PROCESSING HISTORICAL DATA ===");
    console.log("Raw historical data:", JSON.stringify(data, null, 2));

    if (!data.elements) return posts;

    data.elements.forEach((element) => {
      if (
        element.snapshotDomain === "MEMBER_SHARE_INFO" &&
        element.snapshotData
      ) {
        element.snapshotData.forEach((share, index) => {
          try {
            console.log("Processing historical share:", JSON.stringify(share, null, 2));
            
            // Skip if this is not the user's own post (company posts, etc.)
            if (share.Visibility === "COMPANY" || share.Visibility === "ORGANIZATION") {
              console.log("Skipping company/organization post");
              return;
            }

            const timestamp = new Date(share.Date).getTime();
            const daysSincePosted = Math.floor(
              (Date.now() - timestamp) / (24 * 60 * 60 * 1000)
            );

            // Extract post ID from ShareLink
            let postId = `historical_${timestamp}_${index}`;
            if (share.ShareLink) {
              const activityMatch = share.ShareLink.match(/activity-(\d+)/);
              if (activityMatch) {
                postId = `urn:li:activity:${activityMatch[1]}`;
              }
            }

            // Extract media information from historical posts
            const { media, thumbnail, mediaAssetId } = this.extractMediaFromHistoricalPost(share);

            posts.push({
              id: postId,
              text: share.ShareCommentary || "Historical post content",
              url:
                share.ShareLink || `https://linkedin.com/feed/update/${postId}`,
              timestamp: timestamp,
              likes: parseInt(share.LikesCount) || 0,
              comments: parseInt(share.CommentsCount) || 0,
              shares: parseInt(share.SharesCount) || 0,
              repurposeGrade:
                parseInt(share.LikesCount) +
                  parseInt(share.CommentsCount) +
                  parseInt(share.SharesCount) >
                3
                  ? "red"
                  : "blue",
              media: media,
              thumbnail: thumbnail,
              mediaAssetId: mediaAssetId,
              canRepost: daysSincePosted >= 30,
              daysSincePosted: daysSincePosted,
              visibility: share.Visibility || "PUBLIC",
              mediaType: share.MediaType || "TEXT",
              source: "historical",
            });
          } catch (error) {
            console.error("Error processing historical share:", error, share);
          }
        });
      }
    });

    // Remove duplicates based on post ID and sort by timestamp
    const uniquePosts = posts.filter(
      (post, index, self) => index === self.findIndex((p) => p.id === post.id)
    );
    
    return uniquePosts.sort((a, b) => b.timestamp - a.timestamp);
  }

  static processChangelogData(data: ChangelogPostData): ProcessedPost[] {
    const posts: ProcessedPost[] = [];

    console.log("=== PROCESSING CHANGELOG DATA ===");
    console.log("Raw changelog data:", JSON.stringify(data, null, 2));
    
    if (!data.elements) return posts;

    // Get the current user's ID from the first element (owner field)
    const currentUserId = data.elements.find(e => e.owner)?.owner;
    console.log("Current user ID:", currentUserId);

    // Build engagement map first
    const engagementMap: Record<
      string,
      { likes: number; comments: number; shares: number }
    > = {};

    data.elements.forEach((event) => {
      if (event.resourceName?.includes("socialActions")) {
        const postUrn = event.activity?.object;
        if (postUrn) {
          if (!engagementMap[postUrn]) {
            engagementMap[postUrn] = { likes: 0, comments: 0, shares: 0 };
          }

          if (
            event.resourceName === "socialActions/likes" &&
            event.method === "CREATE"
          ) {
            engagementMap[postUrn].likes++;
          } else if (
            event.resourceName === "socialActions/comments" &&
            event.method === "CREATE"
          ) {
            engagementMap[postUrn].comments++;
          } else if (
            event.resourceName === "socialActions/shares" &&
            event.method === "CREATE"
          ) {
            engagementMap[postUrn].shares++;
          }
        }
      }
    });

    // Process UGC posts - filter for person posts only and exclude deleted
    const postEvents = data.elements.filter((e) => {
      return this.isValidPersonPost(e, currentUserId);
    });

    console.log(`Found ${postEvents.length} user posts out of ${data.elements.length} total events`);

    postEvents.forEach((event) => {
      try {
        console.log("=== PROCESSING POST EVENT ===");
        console.log("Full event:", JSON.stringify(event, null, 2));
        
        const processedContent =
          event.processedActivity?.specificContent?.[
            "com.linkedin.ugc.ShareContent"
          ];
        const activityContent =
          event.activity?.specificContent?.["com.linkedin.ugc.ShareContent"];

        console.log("Extracted content structures:", {
          processedContent: JSON.stringify(processedContent, null, 2),
          activityContent: JSON.stringify(activityContent, null, 2)
        });

        const shareCommentary =
          processedContent?.shareCommentary?.text ||
          activityContent?.shareCommentary?.text ||
          event.processedActivity?.text ||
          event.activity?.text ||
          "Post content from LinkedIn";

        const timestamp = event.capturedAt || event.processedAt || Date.now();
        const daysSincePosted = Math.floor(
          (Date.now() - timestamp) / (24 * 60 * 60 * 1000)
        );

        const postId = event.resourceId || event.id?.toString();
        const engagement = engagementMap[postId] || {
          likes: 0,
          comments: 0,
          shares: 0,
        };

        // Extract media information from the post
        const { media, thumbnail, mediaType, mediaAssetId } = this.extractMediaFromChangelogPost(
          processedContent,
          activityContent,
          postId
        );

        posts.push({
          id: postId,
          text: shareCommentary,
          url: `https://linkedin.com/feed/update/${postId}`,
          timestamp: timestamp,
          likes: engagement.likes,
          comments: engagement.comments,
          shares: engagement.shares,
          repurposeGrade:
            engagement.likes + engagement.comments + engagement.shares > 3
              ? "red"
              : "blue",
          media: media,
          thumbnail: thumbnail,
          mediaAssetId: mediaAssetId,
          canRepost: daysSincePosted >= 30,
          daysSincePosted: daysSincePosted,
          visibility: "PUBLIC",
          mediaType: mediaType,
          source: "realtime",
        });
      } catch (error) {
        console.error("Error processing changelog post event:", error, event);
      }
    });

    // Remove duplicates and sort by timestamp
    const uniquePosts = posts.filter(
      (post, index, self) => index === self.findIndex((p) => p.id === post.id)
    );
    
    return uniquePosts.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Helper method to validate person posts and exclude deleted ones
  private static isValidPersonPost(event: any, currentUserId?: string): boolean {
    // Must be a ugcPost
    if (event.resourceName !== "ugcPosts") return false;

    // Exclude DELETE method (deleted objects don't carry content per PDF)
    if (event.method === "DELETE") {
      console.log("Excluding DELETE post:", event.resourceId);
      return false;
    }

    // Check for deleted lifecycle state
    const lifecycleState = event.processedActivity?.lifecycleState || event.activity?.lifecycleState;
    if (lifecycleState === "DELETED" || lifecycleState === "REMOVED") {
      console.log("Excluding deleted lifecycle post:", event.resourceId);
      return false;
    }

    // Require author to be a person (urn:li:person:), not organization
    const author = event.processedActivity?.author || event.activity?.author || event.owner;
    const isPersonPost = author && typeof author === 'string' && author.startsWith('urn:li:person:');
    
    if (!isPersonPost) {
      console.log("Excluding non-person post:", event.resourceId, "author:", author);
      return false;
    }

    // Only posts where the user is the actor (creator)
    if (event.owner !== event.actor) {
      console.log("Excluding post where user is not the actor:", event.resourceId);
      return false;
    }

    // Ensure it's the current user's post if we have the user ID
    if (currentUserId && event.owner !== currentUserId) {
      console.log("Excluding post from different user:", event.resourceId);
      return false;
    }

    console.log("Including person post:", event.resourceId, "author:", author);
    return true;
  }

  // Helper method to extract media from historical posts
  private static extractMediaFromHistoricalPost(share: any): {
    media: any;
    thumbnail: string | null;
    mediaAssetId: string | null;
  } {
    let media = undefined;
    let thumbnail = null;
    let mediaAssetId = null;
    
    console.log("Checking for media in historical post:", {
      MediaUrl: share.MediaUrl,
      MediaType: share.MediaType,
      allKeys: Object.keys(share)
    });
    
    // Historical posts may have MediaUrl for direct access
    if (share.MediaUrl && share.MediaUrl.trim()) {
      media = { url: share.MediaUrl };
      thumbnail = share.MediaUrl;
      console.log("Found MediaUrl:", share.MediaUrl);
    } else if (share.MediaType && share.MediaType !== "TEXT") {
      // Historical posts may not have direct media URLs
      // We'll show a media type indicator instead
      media = { type: share.MediaType };
      console.log("Found MediaType without URL:", share.MediaType);
    }

    return { media, thumbnail, mediaAssetId };
  }

  // Helper method to extract media from changelog posts
  private static extractMediaFromChangelogPost(
    processedContent: any,
    activityContent: any,
    postId: string
  ): {
    media: any;
    thumbnail: string | null;
    mediaType: string;
    mediaAssetId: string | null;
  } {
    let media = null;
    let thumbnail = null;
    let mediaType = "TEXT";
    let mediaAssetId = null;
    
    console.log("=== MEDIA EXTRACTION ===");
    
    const shareMediaCategory = processedContent?.shareMediaCategory || activityContent?.shareMediaCategory;
    const mediaArray = processedContent?.media || activityContent?.media;
    
    console.log("Media extraction for post:", postId, {
      shareMediaCategory,
      mediaArrayLength: mediaArray?.length,
      firstMedia: mediaArray?.[0]
    });
    
    if (mediaArray && mediaArray.length > 0) {
      const firstMedia = mediaArray[0];
      console.log("Processing media for post:", postId, firstMedia);
      
      // Extract the digital media asset URN
      const mediaUrn = firstMedia?.media;
      console.log("Media URN:", mediaUrn);
      
      if (mediaUrn && typeof mediaUrn === 'string') {
        // Extract asset ID from URN like "urn:li:digitalmediaAsset:C5606AQF245TuEXNVXA"
        const assetMatch = mediaUrn.match(/urn:li:digitalmediaAsset:(.+)/);
        console.log("Asset match result:", assetMatch);
        
        if (assetMatch) {
          mediaAssetId = assetMatch[1];
          console.log("Extracted media asset ID:", mediaAssetId);
          
          // Only set thumbnail if status is READY
          if (firstMedia?.status === "READY") {
            thumbnail = `/.netlify/functions/linkedin-media-download?assetId=${mediaAssetId}`;
            console.log("Asset is READY, generated thumbnail URL:", thumbnail);
          } else {
            console.log("Asset not READY, status:", firstMedia?.status);
          }
          media = { 
            urn: mediaUrn, 
            assetId: mediaAssetId,
            status: firstMedia?.status || "READY"
          };
          mediaType = this.getMediaTypeFromCategory(shareMediaCategory) || firstMedia?.mediaType || "IMAGE";
        }
      }
      
      // Fallback: try to extract direct URLs if available
      if (!mediaAssetId) {
        console.log("No asset ID found, looking for direct URLs...");
        const mediaUrl = firstMedia?.media?.downloadUrl ||
                         firstMedia?.media?.url ||
                         firstMedia?.downloadUrl ||
                         firstMedia?.url;
        
        console.log("Found direct media URL:", mediaUrl);
        
        if (mediaUrl) {
          media = { url: mediaUrl };
          thumbnail = mediaUrl;
          mediaType = this.getMediaTypeFromCategory(shareMediaCategory) || firstMedia?.mediaType || "IMAGE";
          console.log("Using direct URL as thumbnail:", mediaUrl);
        }
      }
    }

    // Handle ARTICLE type posts - look for article thumbnails
    if (shareMediaCategory === "ARTICLE" && !thumbnail) {
      const contentEntities = processedContent?.contentEntities || activityContent?.contentEntities;
      if (contentEntities && contentEntities.length > 0) {
        const firstEntity = contentEntities[0];
        const articleThumbnail = firstEntity?.thumbnails?.[0]?.imageSpecificContent?.media ||
                                firstEntity?.thumbnails?.[0]?.imageUrl;
        
        if (articleThumbnail) {
          thumbnail = articleThumbnail;
          media = { url: articleThumbnail, type: "ARTICLE" };
          mediaType = "ARTICLE";
          console.log("Found article thumbnail:", articleThumbnail);
        }
      }
    }

    console.log("Final media extraction result:", {
      media,
      thumbnail,
      mediaType,
      mediaAssetId
    });

    return { media, thumbnail, mediaType, mediaAssetId };
  }

  // Helper method to map shareMediaCategory to mediaType
  private static getMediaTypeFromCategory(category: string): string {
    switch (category) {
      case "IMAGE":
        return "IMAGE";
      case "VIDEO":
        return "VIDEO";
      case "ARTICLE":
        return "ARTICLE";
      case "URN_REFERENCE":
        return "URN_REFERENCE";
      case "NONE":
      default:
        return "TEXT";
    }
  }

  static mergeAndDeduplicatePosts(
    historicalPosts: ProcessedPost[],
    realtimePosts: ProcessedPost[]
  ): ProcessedPost[] {
    // Create a map to track posts by ID for better deduplication
    const postMap = new Map<string, ProcessedPost>();
    
    // Add historical posts first
    historicalPosts.forEach(post => {
      postMap.set(post.id, post);
    });
    
    // Add realtime posts, but prefer realtime data if there's a conflict
    realtimePosts.forEach(post => {
      const existingPost = postMap.get(post.id);
      if (!existingPost || post.source === "realtime") {
        postMap.set(post.id, post);
      }
    });

    // Convert back to array and sort
    const merged = Array.from(postMap.values());

    console.log(`Merged ${historicalPosts.length} historical + ${realtimePosts.length} realtime = ${merged.length} unique posts`);
    
    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }

  static filterPostsByDateRange(
    posts: ProcessedPost[],
    daysBack: number
  ): ProcessedPost[] {
    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    return posts.filter((post) => post.timestamp >= cutoffTime);
  }

  static paginatePosts(
    posts: ProcessedPost[],
    page: number,
    pageSize: number = 12
  ): {
    posts: ProcessedPost[];
    totalPages: number;
    currentPage: number;
    totalPosts: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  } {
    const totalPosts = posts.length;
    const totalPages = Math.ceil(totalPosts / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPosts = posts.slice(startIndex, endIndex);

    return {
      posts: paginatedPosts,
      totalPages,
      currentPage: page,
      totalPosts,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }
}