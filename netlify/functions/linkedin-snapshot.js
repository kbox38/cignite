// netlify/functions/linkedin-snapshot.js
// Enhanced version with all-time posts pagination support

export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    };
  }

  const { authorization } = event.headers;
  const { 
    domain, 
    start = '0', 
    count = '50', 
    getAllPosts = 'false',
    maxPages = '20' 
  } = event.queryStringParameters || {};

  console.log("LinkedIn Snapshot Function - Parameters:", {
    domain,
    start,
    count,
    getAllPosts,
    maxPages,
    hasAuth: !!authorization
  });

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
    // If getAllPosts is true and domain is MEMBER_SHARE_INFO, fetch all posts with pagination
    if (getAllPosts === 'true' && domain === 'MEMBER_SHARE_INFO') {
      console.log("Starting all-time posts extraction...");
      
      let allPosts = [];
      let currentStart = parseInt(start);
      let pageSize = parseInt(count);
      let maxPagesToFetch = parseInt(maxPages);
      let pagesFetched = 0;
      let hasMore = true;
      
      while (hasMore && pagesFetched < maxPagesToFetch) {
        console.log(`Fetching page ${pagesFetched + 1}: start=${currentStart}, count=${pageSize}`);
        
        const url = `https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=${domain}&start=${currentStart}&count=${pageSize}`;
        
        const response = await fetch(url, {
          headers: {
            Authorization: authorization,
            "LinkedIn-Version": "202312",
          },
        });

        console.log(`Page ${pagesFetched + 1} response status:`, response.status);

        if (!response.ok) {
          if (response.status === 404 || response.status === 400) {
            console.log(`No more data at start=${currentStart}, stopping pagination`);
            break;
          }
          
          // If first page fails, return error
          if (pagesFetched === 0) {
            const errorData = await response.text();
            console.error(`First page failed:`, response.status, errorData);
            throw new Error(`LinkedIn API error: ${response.status} ${response.statusText}`);
          }
          
          // If subsequent page fails, continue with what we have
          console.log('Subsequent page failed, continuing with existing data');
          break;
        }

        const data = await response.json();
        console.log(`Page ${pagesFetched + 1} data:`, {
          hasElements: !!data.elements,
          elementsLength: data.elements?.length,
          snapshotDataLength: data.elements?.[0]?.snapshotData?.length || 0,
          pagingTotal: data.paging?.total
        });

        // Extract posts from this page
        const pageData = data.elements?.[0]?.snapshotData || [];
        
        if (pageData.length === 0) {
          console.log('No posts in this page, stopping pagination');
          break;
        }
        
        // Process posts and add to collection
        const processedPosts = pageData.map((post, index) => {
          // Handle multiple field name variations
          const shareUrl = post['Share URL'] || post['share_url'] || post.shareUrl || 
                           post['URL'] || post.url;
          const shareDate = post['Share Date'] || post['share_date'] || post.shareDate || 
                           post['Date'] || post.date;
          const shareCommentary = post['Share Commentary'] || post['share_commentary'] || 
                                post.shareCommentary || post['Commentary'] || post.commentary || '';
          const visibility = post['Visibility'] || post.visibility || 'PUBLIC';
          const mediaType = post['Media Type'] || post['media_type'] || post.mediaType || 'TEXT';
          
          // Extract post ID from URL
          let postId = null;
          if (shareUrl) {
            const activityMatch = shareUrl.match(/activity[:-](\d+)/);
            const ugcMatch = shareUrl.match(/ugcPost[:-](\d+)/);
            postId = activityMatch?.[1] || ugcMatch?.[1] || `page_${pagesFetched}_${index}`;
          }
          
          return {
            id: postId,
            url: shareUrl,
            date: shareDate,
            content: shareCommentary,
            visibility: visibility,
            mediaType: mediaType,
            pageIndex: pagesFetched,
            itemIndex: index
          };
        }).filter(post => post.id && post.url); // Only include valid posts
        
        allPosts.push(...processedPosts);
        pagesFetched++;
        
        console.log(`Page ${pagesFetched} processed: ${processedPosts.length} posts, total: ${allPosts.length}`);
        
        // Check pagination info
        if (data.paging && data.paging.links) {
          const hasNextLink = data.paging.links.some(link => link.rel === 'next');
          if (!hasNextLink) {
            console.log('No next link found, stopping');
            hasMore = false;
          }
        } else if (processedPosts.length < pageSize) {
          console.log('Page returned fewer posts than requested, likely last page');
          hasMore = false;
        }
        
        // Update for next iteration
        currentStart += pageSize;
        
        // Rate limiting
        if (hasMore && pagesFetched < maxPagesToFetch) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
      
      console.log(`All-time posts extraction complete: ${pagesFetched} pages, ${allPosts.length} posts`);
      
      // Sort posts by date if possible
      const sortedPosts = allPosts.sort((a, b) => {
        if (a.date && b.date) {
          try {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          } catch (e) {
            return 0;
          }
        }
        return 0;
      });
      
      // Calculate date range
      let dateRange = null;
      const postsWithDates = sortedPosts.filter(p => p.date);
      if (postsWithDates.length > 0) {
        try {
          const dates = postsWithDates.map(p => new Date(p.date).getTime()).filter(d => !isNaN(d));
          if (dates.length > 0) {
            const newest = new Date(Math.max(...dates));
            const oldest = new Date(Math.min(...dates));
            dateRange = {
              newest: newest.toISOString(),
              oldest: oldest.toISOString(),
              spanDays: Math.round((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))
            };
          }
        } catch (e) {
          console.warn('Error calculating date range:', e);
        }
      }
      
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Cache-Control": "public, max-age=300"
        },
        body: JSON.stringify({
          success: true,
          allTimeData: true,
          pagination: {
            requestedStart: parseInt(start),
            requestedCount: parseInt(count),
            pagesFetched: pagesFetched,
            totalPosts: allPosts.length,
            hasMore: pagesFetched >= maxPagesToFetch
          },
          dateRange: dateRange,
          elements: [{
            snapshotDomain: domain,
            snapshotData: sortedPosts
          }],
          metadata: {
            fetchedAt: new Date().toISOString(),
            source: 'MEMBER_SHARE_INFO_ALL_TIME',
            version: '2.0'
          }
        }),
      };
    }

    // Default behavior for single page requests
    let url = "https://api.linkedin.com/rest/memberSnapshotData?q=criteria";
    
    if (domain) {
      url += `&domain=${domain}`;
    }
    if (start !== '0') {
      url += `&start=${start}`;
    }
    if (count !== '50') {
      url += `&count=${count}`;
    }

    console.log("LinkedIn Snapshot Function - Calling URL:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: authorization,
        "LinkedIn-Version": "202312",
      },
    });

    console.log("LinkedIn Snapshot Function - Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LinkedIn API Error:", response.status, errorText);
      
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: `LinkedIn API error: ${response.status}`,
          details: errorText,
          statusCode: response.status
        }),
      };
    }

    const data = await response.json();
    
    console.log("LinkedIn Snapshot Function - Response data structure:", {
      hasElements: !!data.elements,
      elementsLength: data.elements?.length || 0,
      hasSnapshotData: !!data.elements?.[0]?.snapshotData,
      snapshotDataLength: data.elements?.[0]?.snapshotData?.length || 0,
      firstElementKeys: data.elements?.[0] ? Object.keys(data.elements[0]) : [],
      firstSnapshotDataKeys: data.elements?.[0]?.snapshotData?.[0]
        ? Object.keys(data.elements[0].snapshotData[0])
        : [],
      hasPaging: !!data.paging,
      pagingInfo: data.paging
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error("LinkedIn Snapshot Function - Error:", error);
    console.error("LinkedIn Snapshot Function - Error Stack:", error.stack);
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch LinkedIn snapshot data",
        details: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      }),
    };
  }
}