/**
 * FIXED: sync-user-posts.mjs - Dynamic token handling
 * Location: netlify/functions/sync-user-posts.mjs
 * 
 * ISSUE: LINKEDIN_DMA_ACCESS_TOKEN doesn't exist - need to get user's token
 * SOLUTION: Get user's DMA token from database and use it for API calls
 */

/**
 * Fetch user posts from LinkedIn DMA API - FIXED VERSION
 */
async function fetchUserPostsFromLinkedIn(memberUrn, userId) {
  try {
    console.log('🔍 Fetching posts for member:', memberUrn, 'user:', userId);
    
    // FIXED: Get user's DMA token from database instead of environment
    const userToken = await getUserDmaToken(userId);
    
    if (!userToken) {
      throw new Error('User DMA token not found - user needs to complete DMA authentication');
    }

    console.log('✅ Using user DMA token for API call');

    // Use Member Changelog API to get recent posts
    const response = await fetch(
      `https://api.linkedin.com/rest/memberChangeLogs?q=memberAndApplication&count=50`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`, // FIXED: Use user's token
          'LinkedIn-Version': '202312',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ LinkedIn API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`LinkedIn API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ LinkedIn API response received:', {
      elementsCount: data.elements?.length || 0
    });

    // Process changelog entries to extract posts
    const posts = await processChangelogToPosts(data.elements || [], userToken);
    
    console.log(`📊 Processed ${posts.length} posts from changelog`);
    return posts;

  } catch (error) {
    console.error('❌ Error fetching posts from LinkedIn:', error);
    throw error;
  }
}

/**
 * Get user's DMA token from database
 */
async function getUserDmaToken(userId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔑 Getting DMA token for user:', userId);

    const { data: user, error } = await supabase
      .from('users')
      .select('dma_token, dma_token_expires_at, name')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error('❌ User not found:', error);
      return null;
    }

    if (!user.dma_token) {
      console.error('❌ No DMA token found for user:', user.name);
      return null;
    }

    // Check if token is expired
    if (user.dma_token_expires_at) {
      const expiresAt = new Date(user.dma_token_expires_at);
      const now = new Date();
      
      if (now >= expiresAt) {
        console.error('❌ DMA token expired for user:', user.name);
        return null;
      }
    }

    console.log('✅ Valid DMA token found for user:', user.name);
    return user.dma_token;

  } catch (error) {
    console.error('❌ Error getting user DMA token:', error);
    return null;
  }
}

/**
 * Process changelog entries to extract post data
 */
async function processChangelogToPosts(changelogElements, userToken) {
  const posts = [];
  
  console.log(`🔄 Processing ${changelogElements.length} changelog elements`);

  for (const element of changelogElements) {
    try {
      // Only process CREATE events for posts/articles
      if (element.method !== 'CREATE') continue;
      
      // Check if it's a post or article
      const isPost = element.resourceName?.includes('posts') || 
                     element.resourceName?.includes('socialActions') ||
                     element.resourceName?.includes('shares');
      
      if (!isPost) continue;

      console.log('📝 Processing post element:', {
        resourceName: element.resourceName,
        method: element.method,
        activityId: element.activityId
      });

      // Extract post data from the element
      const post = await extractPostFromElement(element, userToken);
      
      if (post) {
        posts.push(post);
      }
      
    } catch (error) {
      console.warn('⚠️ Error processing changelog element:', error);
      // Continue processing other elements
    }
  }

  console.log(`✅ Successfully processed ${posts.length} posts`);
  return posts;
}

/**
 * Extract post data from changelog element
 */
async function extractPostFromElement(element, userToken) {
  try {
    const activity = element.activity || {};
    const createdAt = element.capturedAt || element.processedAt || Date.now();
    
    // Generate a post URN from the element
    const postUrn = element.resourceUri || 
                    `urn:li:activity:${element.activityId}` ||
                    `urn:li:post:${element.id}`;

    // Extract text content
    const textContent = activity.message?.text || 
                       activity.content?.text || 
                       activity.commentary?.text || 
                       '';

    // Determine media type
    let mediaType = 'NONE';
    if (activity.content?.media) {
      mediaType = 'IMAGE'; // Could be refined further
    } else if (activity.content?.article) {
      mediaType = 'ARTICLE';
    }

    // Create post object
    const post = {
      postUrn: postUrn,
      linkedinPostId: element.activityId,
      createdAtMs: new Date(createdAt).getTime(),
      textPreview: textContent.substring(0, 500), // Limit to 500 chars
      mediaType: mediaType,
      mediaUrls: [],
      hashtags: extractHashtags(textContent),
      mentions: extractMentions(textContent),
      visibility: 'PUBLIC', // Default assumption
      
      // Engagement metrics (would need separate API calls to get real data)
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      impressions: 0,
      clicks: 0,
      savesCount: 0,
      engagementRate: 0,
      
      // Algorithm scoring (would be calculated based on engagement)
      reachScore: 0,
      algorithmScore: 0,
      sentimentScore: 0,
      
      // Repurpose eligibility (30+ days old)
      repurposeEligible: (Date.now() - new Date(createdAt).getTime()) > (30 * 24 * 60 * 60 * 1000),
      repurposeDate: null,
      repurposedCount: 0,
      performanceTier: 'UNKNOWN',
      
      // Raw data for debugging
      rawData: element
    };

    console.log('✅ Extracted post:', {
      postUrn: post.postUrn,
      createdAt: new Date(post.createdAtMs).toISOString(),
      textLength: post.textPreview.length,
      mediaType: post.mediaType
    });

    return post;

  } catch (error) {
    console.error('❌ Error extracting post from element:', error);
    return null;
  }
}

/**
 * Extract hashtags from text
 */
function extractHashtags(text) {
  if (!text) return [];
  const hashtags = text.match(/#[\w]+/g) || [];
  return hashtags.map(tag => tag.replace('#', ''));
}

/**
 * Extract mentions from text
 */
function extractMentions(text) {
  if (!text) return [];
  const mentions = text.match(/@[\w]+/g) || [];
  return mentions.map(mention => mention.replace('@', ''));
}

// Export the updated function
export { fetchUserPostsFromLinkedIn };