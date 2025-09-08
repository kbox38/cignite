exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const authorization = event.headers.authorization;
    if (!authorization) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' })
      };
    }

    console.log('Fetching snapshot posts only...');
    
    // ONLY SNAPSHOT API - Simplified approach
    const snapshotPosts = await fetchSnapshotPosts(authorization);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        posts: snapshotPosts,
        source: 'snapshot_only',
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

async function fetchSnapshotPosts(authorization) {
  try {
    console.log('Fetching snapshot posts from Member Snapshot API...');
    
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
        console.log('No snapshot data available (404)');
        return [];
      }
      throw new Error(`Snapshot API failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Raw snapshot data structure:', {
      hasElements: !!data.elements,
      elementsLength: data.elements?.length,
      keys: Object.keys(data || {})
    });

    const posts = [];
    
    if (data.elements && data.elements.length > 0) {
      for (const element of data.elements) {
        if (element.snapshotDomain === 'MEMBER_SHARE_INFO' && element.snapshotData) {
          console.log(`Processing ${element.snapshotData.length} items from snapshot`);
          
          for (const post of element.snapshotData) {
            const processedPost = processSnapshotPost(post);
            if (processedPost) {
              posts.push(processedPost);
            }
          }
        }
      }
    }

    console.log(`Total snapshot posts processed: ${posts.length}`);
    return posts;
  } catch (error) {
    console.error('Error fetching snapshot posts:', error);
    return [];
  }
}

function processSnapshotPost(post) {
  try {
    console.log('Processing snapshot post:', {
      keys: Object.keys(post || {}),
      hasCommentary: !!(post['Commentary'] || post['Share Commentary']),
      hasUrl: !!(post['Share URL'] || post['URL']),
      hasDate: !!(post['Date'] || post['Created Date'])
    });

    // Enhanced field extraction with multiple variations
    const content = 
      post['Commentary'] || 
      post['Share Commentary'] ||
      post['comment'] || 
      post['content'] || 
      post['text'] ||
      post['shareCommentary'] ||
      '';

    const shareUrl = 
      post['Share URL'] || 
      post['share_url'] || 
      post['URL'] || 
      post['url'] ||
      post['permalink'] ||
      '';

    const dateStr = 
      post['Date'] || 
      post['Created Date'] ||
      post['created_at'] || 
      post['timestamp'] ||
      '';

    // Skip posts without content
    if (!content || content.trim().length < 3) {
      console.log('Skipping post: no content');
      return null;
    }

    // Parse date
    let createdAt = Date.now();
    if (dateStr) {
      const parsedDate = new Date(dateStr).getTime();
      if (!isNaN(parsedDate)) {
        createdAt = parsedDate;
      }
    }

    // Extract engagement metrics
    const likesCount = parseInt(post['Likes Count'] || post['likes'] || '0') || 0;
    const commentsCount = parseInt(post['Comments Count'] || post['comments'] || '0') || 0;
    const sharesCount = parseInt(post['Shares Count'] || post['shares'] || '0') || 0;

    // Generate post ID
    const postId = shareUrl ? 
      shareUrl.split('/').pop() || `snapshot_${Date.now()}` : 
      `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Created snapshot post:', {
      id: postId.substring(0, 20),
      contentLength: content.length,
      hasUrl: !!shareUrl,
      engagement: { likes: likesCount, comments: commentsCount, shares: sharesCount }
    });

    return {
      id: postId,
      content: content.trim(),
      createdAt: createdAt,
      likes: likesCount,
      comments: commentsCount,
      reposts: sharesCount,
      url: shareUrl || 'https://linkedin.com/in/you/recent-activity/shares/',
      author: 'You',
      source: 'snapshot'
    };

  } catch (error) {
    console.error('Error processing snapshot post:', error);
    return null;
  }
}