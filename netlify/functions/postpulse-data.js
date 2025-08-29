// netlify/functions/postpulse-data.js
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const authorization = event.headers.authorization;
    if (!authorization) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header missing' })
      };
    }

    console.log('Fetching PostPulse data...');

    // Fetch historical posts from Member Snapshot API
    const historicalPosts = await fetchHistoricalPosts(authorization);
    console.log(`Found ${historicalPosts.length} historical posts`);

    // Fetch recent posts from Changelog API
    const recentPosts = await fetchRecentPosts(authorization);
    console.log(`Found ${recentPosts.length} recent posts`);

    // Merge and deduplicate posts
    const allPosts = mergeAndDeduplicatePosts(historicalPosts, recentPosts);
    console.log(`Total unique posts: ${allPosts.length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        posts: allPosts,
        totalCount: allPosts.length,
        historical: historicalPosts.length,
        recent: recentPosts.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error fetching PostPulse data:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch post data',
        details: error.message 
      })
    };
  }
};

async function fetchHistoricalPosts(authorization) {
  try {
    console.log('Fetching historical posts from Member Snapshot API...');
    
    const response = await fetch(
      'https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO',
      {
        headers: {
          'Authorization': authorization,
          'LinkedIn-Version': '202312',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log('No historical data available (404)');
        return [];
      }
      throw new Error(`Historical posts API failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Raw historical data:', JSON.stringify(data, null, 2));

    const posts = [];
    
    if (data.elements && data.elements.length > 0) {
      for (const element of data.elements) {
        if (element.snapshotDomain === 'MEMBER_SHARE_INFO' && element.snapshotData) {
          for (const post of element.snapshotData) {
            const processedPost = processHistoricalPost(post);
            if (processedPost) {
              posts.push(processedPost);
            }
          }
        }
      }
    }

    return posts;
  } catch (error) {
    console.error('Error fetching historical posts:', error);
    return [];
  }
}

async function fetchRecentPosts(authorization) {
  try {
    console.log('Fetching recent posts from Changelog API...');
    
    const response = await fetch(
      'https://api.linkedin.com/rest/memberChangeLogs?q=memberAndApplication',
      {
        headers: {
          'Authorization': authorization,
          'LinkedIn-Version': '202312',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    if (!response.ok) {
      console.log(`Changelog API failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const posts = [];

    if (data.elements && data.elements.length > 0) {
      for (const element of data.elements) {
        if (element.resourceName === 'shares' && element.method === 'CREATE') {
          const processedPost = processChangelogPost(element);
          if (processedPost) {
            posts.push(processedPost);
          }
        }
      }
    }

    return posts;
  } catch (error) {
    console.error('Error fetching recent posts:', error);
    return [];
  }
}

function processHistoricalPost(post) {
  try {
    // Extract post data from historical format
    const content = post.ShareCommentary || post.Commentary || '';
    const dateStr = post.Date || post.CreatedDate || post.Timestamp;
    const createdAt = dateStr ? new Date(dateStr).getTime() : Date.now();
    
    // Skip posts older than 90 days
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    if (createdAt < ninetyDaysAgo) {
      return null;
    }

    return {
      id: post.ShareId || post.Id || `hist_${Math.random().toString(36).substr(2, 9)}`,
      content: content,
      text: content,
      createdAt: createdAt,
      likes: parseInt(post.LikesCount || post.Likes || '0', 10),
      comments: parseInt(post.CommentsCount || post.Comments || '0', 10),
      shares: parseInt(post.SharesCount || post.Shares || '0', 10),
      impressions: parseInt(post.Impressions || post.Views || '0', 10),
      media_url: post.MediaUrl || post.Media || null,
      document_url: post.DocumentUrl || post.Document || null,
      linkedin_url: post.ShareLink || post.PostUrl || null,
      source: 'historical'
    };
  } catch (error) {
    console.error('Error processing historical post:', error);
    return null;
  }
}

function processChangelogPost(element) {
  try {
    const activity = element.activity || element.processedActivity || {};
    const content = activity.commentary?.text || activity.text || '';
    const createdAt = element.capturedAt || element.processedAt || Date.now();

    return {
      id: element.resourceId || element.activityId || `recent_${Math.random().toString(36).substr(2, 9)}`,
      content: content,
      text: content,
      createdAt: createdAt,
      likes: 0, // Engagement data might not be available in changelog
      comments: 0,
      shares: 0,
      impressions: 0,
      media_url: activity.content?.media?.[0]?.url || null,
      document_url: activity.content?.document?.url || null,
      linkedin_url: activity.shareUrl || null,
      source: 'recent'
    };
  } catch (error) {
    console.error('Error processing changelog post:', error);
    return null;
  }
}

function mergeAndDeduplicatePosts(historicalPosts, recentPosts) {
  const allPosts = [...historicalPosts, ...recentPosts];
  const seenIds = new Set();
  const uniquePosts = [];

  // Sort by creation date (oldest first for repurpose functionality)
  allPosts.sort((a, b) => a.createdAt - b.createdAt);

  for (const post of allPosts) {
    if (!seenIds.has(post.id)) {
      seenIds.add(post.id);
      uniquePosts.push(post);
    }
  }

  console.log(`Deduplicated ${allPosts.length} posts to ${uniquePosts.length} unique posts`);
  return uniquePosts;
}