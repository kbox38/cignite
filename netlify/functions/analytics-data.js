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
  const { timeRange = "30d" } = event.queryStringParameters || {};

  if (!authorization) {
    console.error("Analytics Data: No authorization header provided");
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
    console.log(`Analytics Data: Starting Snapshot-based analysis for ${timeRange} period`);
    const startTime = Date.now();

    // Verify DMA consent
    const consentCheck = await verifyDMAConsent(authorization);
    if (!consentCheck.isActive) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "DMA not enabled",
          message: consentCheck.message,
          needsReconnect: true,
          // Return empty structure to prevent crashes
          postsEngagementsTrend: [],
          connectionsGrowth: [],
          postTypesBreakdown: [],
          topHashtags: [],
          engagementPerPost: [],
          messagesSentReceived: [],
          audienceDistribution: { industries: [], positions: [], locations: [] },
          scoreImpacts: {},
          timeRange,
          lastUpdated: new Date().toISOString()
        }),
      };
    }

    // Calculate time range
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Fetch Snapshot data
    const [postsSnapshot, connectionsSnapshot, profileSnapshot] = await Promise.all([
      fetchMemberSnapshot(authorization, "MEMBER_SHARE_INFO"),
      fetchMemberSnapshot(authorization, "CONNECTIONS"),
      fetchMemberSnapshot(authorization, "PROFILE")
    ]);

    const postsData = postsSnapshot?.elements?.[0]?.snapshotData || [];
    console.log(`Analytics: Processing ${postsData.length} posts from MEMBER_SHARE_INFO`);

    // Filter posts by time range
    const filteredPosts = postsData.filter(post => {
      const postDate = new Date(post.Date || post.date);
      return postDate >= cutoffDate;
    });

    console.log(`Analytics: ${filteredPosts.length} posts in ${timeRange} range`);

    const hasRecentActivity = filteredPosts.length > 0;

    // Calculate analytics with real Snapshot data
    const analytics = {
      postsEngagementsTrend: calculatePostsTrendFromSnapshot(filteredPosts, days),
      connectionsGrowth: calculateConnectionsTrendFromSnapshot(connectionsSnapshot, days),
      postTypesBreakdown: calculatePostTypesFromSnapshot(filteredPosts),
      topHashtags: calculateTopHashtagsFromSnapshot(filteredPosts),
      engagementPerPost: calculateEngagementPerPostFromSnapshot(filteredPosts),
      messagesSentReceived: [], // Not available in Snapshot
      audienceDistribution: calculateAudienceDistributionFromSnapshot(connectionsSnapshot),
      scoreImpacts: getScoreImpactsFromSnapshot(),
      timeRange: timeRange,
      lastUpdated: new Date().toISOString(),
      metadata: {
        hasRecentActivity,
        dataSource: "snapshot",
        postsCount: filteredPosts.length,
        totalPostsCount: postsData.length,
        fetchTimeMs: Date.now() - startTime,
        description: hasRecentActivity 
          ? `Showing ${filteredPosts.length} posts from MEMBER_SHARE_INFO snapshot`
          : `No posts in ${timeRange} range. Total posts available: ${postsData.length}`
      }
    };

    // Generate AI narrative analysis
    if (hasRecentActivity) {
      analytics.aiNarrative = await generateAINarrative(analytics, authorization);
    }

    if (!hasRecentActivity) {
      analytics.note = `No posts found in ${timeRange} range. Try selecting a longer time period.`;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify(analytics),
    };
  } catch (error) {
    console.error("Analytics Data Error:", error);
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch analytics data",
        details: error.message,
        timestamp: new Date().toISOString(),
        // Safe defaults to prevent frontend crashes
        postsEngagementsTrend: [],
        connectionsGrowth: [],
        postTypesBreakdown: [],
        topHashtags: [],
        engagementPerPost: [],
        messagesSentReceived: [],
        audienceDistribution: { industries: [], positions: [], locations: [] },
        scoreImpacts: {},
        timeRange: "30d",
        lastUpdated: new Date().toISOString(),
        metadata: {
          hasRecentActivity: false,
          dataSource: "error",
          postsCount: 0,
          description: "Error loading data"
        }
      }),
    };
  }
}

async function verifyDMAConsent(authorization) {
  try {
    const response = await fetch("https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication", {
      headers: {
        Authorization: authorization,
        "LinkedIn-Version": "202312"
      }
    });

    if (!response.ok) {
      return { isActive: false, message: "Unable to verify DMA consent status" };
    }

    const data = await response.json();
    const hasConsent = data.elements && data.elements.length > 0;

    return {
      isActive: hasConsent,
      message: hasConsent ? "DMA consent active" : "DMA consent not active"
    };
  } catch (error) {
    console.error("Error verifying DMA consent:", error);
    return { isActive: false, message: "Error checking DMA consent status" };
  }
}

async function fetchMemberSnapshot(authorization, domain) {
  try {
    const url = `https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=${domain}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: authorization,
        "LinkedIn-Version": "202312"
      }
    });

    if (!response.ok) {
      console.warn(`Snapshot API for ${domain} returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching snapshot for ${domain}:`, error);
    return null;
  }
}

function calculatePostsTrendFromSnapshot(posts, days) {
  const dateRange = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dateRange.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      posts: 0,
      likes: 0,
      comments: 0,
      totalEngagement: 0
    });
  }

  posts.forEach(post => {
    const postDate = new Date(post.Date || post.date);
    const dateStr = postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayData = dateRange.find(day => day.date === dateStr);

    if (dayData) {
      dayData.posts++;
      dayData.likes += parseInt(post.LikesCount || "0");
      dayData.comments += parseInt(post.CommentsCount || "0");
      dayData.totalEngagement = dayData.likes + dayData.comments;
    }
  });

  return dateRange;
}

function calculateConnectionsTrendFromSnapshot(connectionsSnapshot, days) {
  if (!connectionsSnapshot?.elements?.[0]?.snapshotData) {
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      totalConnections: 0,
      newConnections: 0
    }));
  }

  const connections = connectionsSnapshot.elements[0].snapshotData;
  const totalConnections = connections.length;

  // Generate trend based on connection dates
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Count connections made on this day
    const dayConnections = connections.filter(conn => {
      const connDate = new Date(conn["Connected On"] || conn.connectedOn || conn.Date);
      return connDate.toDateString() === date.toDateString();
    }).length;
    
    return {
      date: dateStr,
      totalConnections: totalConnections,
      newConnections: dayConnections
    };
  });
}

function calculatePostTypesFromSnapshot(posts) {
  const types = {};

  posts.forEach(post => {
    const mediaType = post.MediaType || post.mediaType || "TEXT";
    types[mediaType] = (types[mediaType] || 0) + 1;
  });

  return Object.entries(types).map(([name, value]) => ({ 
    name: name || "TEXT", 
    value: value || 0
  }));
}

function calculateTopHashtagsFromSnapshot(posts) {
  const hashtagCounts = {};

  posts.forEach(post => {
    const text = post.ShareCommentary || post.shareCommentary || "";
    const hashtags = text.match(/#[\w]+/g) || [];
    
    hashtags.forEach(hashtag => {
      hashtagCounts[hashtag] = (hashtagCounts[hashtag] || 0) + 1;
    });
  });

  return Object.entries(hashtagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([hashtag, count]) => ({ 
      hashtag: hashtag || "", 
      count: count || 0
    }));
}

function calculateEngagementPerPostFromSnapshot(posts) {
  return posts
    .map(post => ({
      postId: post.ShareLink || `post_${Date.now()}`,
      content: (post.ShareCommentary || "Post content").substring(0, 50) + "...",
      likes: parseInt(post.LikesCount || "0"),
      comments: parseInt(post.CommentsCount || "0"),
      shares: parseInt(post.SharesCount || "0"),
      totalEngagement: parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0") + parseInt(post.SharesCount || "0"),
      createdAt: new Date(post.Date || post.date).getTime()
    }))
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 10);
}

function calculateAudienceDistributionFromSnapshot(connectionsSnapshot) {
  if (!connectionsSnapshot?.elements?.[0]?.snapshotData) {
    return { industries: [], positions: [], locations: [] };
  }

  const connections = connectionsSnapshot.elements[0].snapshotData;
  const industries = {};
  const positions = {};
  const locations = {};

  connections.forEach(conn => {
    const industry = conn.Industry || conn.industry;
    const position = conn.Position || conn.position;
    const location = conn.Location || conn.location;

    if (industry && industry.trim() && industry !== "Unknown") {
      industries[industry] = (industries[industry] || 0) + 1;
    }
    if (position && position.trim() && position !== "Unknown") {
      positions[position] = (positions[position] || 0) + 1;
    }
    if (location && location.trim() && location !== "Unknown") {
      locations[location] = (locations[location] || 0) + 1;
    }
  });

  return {
    industries: Object.entries(industries)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name: name || "Unknown", value: value || 0 })),
    positions: Object.entries(positions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name: name || "Unknown", value: value || 0 })),
    locations: Object.entries(locations)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name: name || "Unknown", value: value || 0 }))
  };
}

function getScoreImpactsFromSnapshot() {
  return {
    profileCompleteness: {
      description: "A complete profile increases visibility and credibility",
      impact: "Affects profile visibility and professional brand scores",
      tips: ["Add a professional headline", "Complete work experience", "Add relevant skills"]
    },
    postingActivity: {
      description: "Regular posting keeps you visible in your network's feed",
      impact: "Directly affects engagement quality and professional brand",
      tips: ["Post 3-5 times per week", "Share industry insights", "Engage with others' content"]
    },
    engagementQuality: {
      description: "High engagement indicates valuable content and strong network",
      impact: "Influences audience relevance and mutual interactions",
      tips: ["Ask questions in posts", "Share personal experiences", "Respond to comments quickly"]
    },
    contentDiversity: {
      description: "Varied content types keep your audience engaged",
      impact: "Affects engagement quality and professional brand",
      tips: ["Mix text, images, and videos", "Share articles and insights", "Use polls and questions"]
    }
  };
}

async function generateAINarrative(analytics, authorization) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured, skipping AI narrative");
    return "Analytics data processed successfully. Consider the trends and metrics above to optimize your LinkedIn strategy.";
  }

  try {
    const summaryData = {
      postsCount: analytics.metadata.postsCount,
      topHashtags: analytics.topHashtags.slice(0, 3),
      postTypes: analytics.postTypesBreakdown,
      topEngagementPost: analytics.engagementPerPost[0],
      timeRange: analytics.timeRange
    };

    const systemPrompt = `You are a LinkedIn analytics expert. Analyze the provided metrics and write a concise summary with 2-3 specific recommendations. Keep it under 300 words and focus on actionable insights.`;

    const userPrompt = `Analyze these LinkedIn metrics and trends:

Posts in ${analytics.timeRange}: ${summaryData.postsCount}
Top hashtags: ${summaryData.topHashtags.map(h => h.hashtag).join(', ')}
Content types: ${summaryData.postTypes.map(t => `${t.name}: ${t.value}`).join(', ')}
Best performing post: ${summaryData.topEngagementPost?.totalEngagement || 0} total engagement

Write a summary and provide 2-3 specific recommendations for improving LinkedIn performance.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 400,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "Analytics processed successfully. Focus on consistent posting and engaging content.";

  } catch (error) {
    console.error('Error generating AI narrative:', error);
    return "Your LinkedIn analytics show good activity. Continue posting consistently and engaging with your network for optimal growth.";
  }
}