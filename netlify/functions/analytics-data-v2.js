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
    console.log(`Analytics V2: Starting deep-dive analysis for ${timeRange} period`);
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
          analytics: getEmptyAnalytics(timeRange)
        }),
      };
    }

    // Calculate time range
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Fetch snapshot data
    const [postsSnapshot, connectionsSnapshot, profileSnapshot] = await Promise.all([
      fetchMemberSnapshot(authorization, "MEMBER_SHARE_INFO"),
      fetchMemberSnapshot(authorization, "CONNECTIONS"),
      fetchMemberSnapshot(authorization, "PROFILE")
    ]);

    const postsData = postsSnapshot?.elements?.[0]?.snapshotData || [];
    const connectionsData = connectionsSnapshot?.elements?.[0]?.snapshotData || [];
    const profileData = profileSnapshot?.elements?.[0]?.snapshotData?.[0] || {};

    // Filter posts by time range
    const filteredPosts = postsData.filter(post => {
      const postDate = new Date(post.Date || post.date);
      return postDate >= cutoffDate;
    });

    console.log(`Analytics V2: Processing ${filteredPosts.length} posts in ${timeRange} range`);

    // Calculate comprehensive analytics
    const analytics = {
      // Posting trends over time
      postingTrends: calculatePostingTrends(filteredPosts, days),
      
      // Content format breakdown
      contentFormats: calculateContentFormats(filteredPosts),
      
      // Engagement analysis per post
      engagementAnalysis: calculateEngagementAnalysis(filteredPosts),
      
      // Hashtag trends
      hashtagTrends: calculateHashtagTrends(filteredPosts),
      
      // Audience insights from connections
      audienceInsights: calculateAudienceInsights(connectionsData),
      
      // Performance metrics
      performanceMetrics: calculatePerformanceMetrics(filteredPosts),
      
      // Time-based insights
      timeBasedInsights: calculateTimeBasedInsights(filteredPosts),
      
      timeRange,
      lastUpdated: new Date().toISOString(),
      metadata: {
        hasRecentActivity: filteredPosts.length > 0,
        dataSource: "snapshot_v2",
        postsCount: filteredPosts.length,
        totalPostsCount: postsData.length,
        connectionsCount: connectionsData.length,
        fetchTimeMs: Date.now() - startTime,
        description: `Deep analytics for ${filteredPosts.length} posts from ${timeRange} period`
      }
    };

    // Generate AI narrative analysis
    if (filteredPosts.length > 0) {
      analytics.aiNarrative = await generateAnalyticsNarrative(analytics, authorization);
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
    console.error("Analytics V2 Error:", error);
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch analytics data",
        details: error.message,
        analytics: getEmptyAnalytics(timeRange),
        timestamp: new Date().toISOString()
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

    return await response.json();
  } catch (error) {
    console.error(`Error fetching snapshot for ${domain}:`, error);
    return null;
  }
}

function calculatePostingTrends(posts, days) {
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

function calculateContentFormats(posts) {
  const formats = {};
  
  posts.forEach(post => {
    const mediaType = post.MediaType || post.mediaType || "TEXT";
    formats[mediaType] = (formats[mediaType] || 0) + 1;
  });

  return Object.entries(formats).map(([name, value]) => ({ 
    name: name || "TEXT", 
    value: value || 0,
    percentage: Math.round((value / posts.length) * 100)
  }));
}

function calculateEngagementAnalysis(posts) {
  return posts
    .map(post => ({
      postId: post.ShareLink || `post_${Date.now()}`,
      content: (post.ShareCommentary || "Post content").substring(0, 50) + "...",
      likes: parseInt(post.LikesCount || "0"),
      comments: parseInt(post.CommentsCount || "0"),
      shares: parseInt(post.SharesCount || "0"),
      totalEngagement: parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0") + parseInt(post.SharesCount || "0"),
      createdAt: new Date(post.Date || post.date).getTime(),
      engagementRate: calculatePostEngagementRate(post)
    }))
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 10);
}

function calculatePostEngagementRate(post) {
  const likes = parseInt(post.LikesCount || "0");
  const comments = parseInt(post.CommentsCount || "0");
  const shares = parseInt(post.SharesCount || "0");
  const total = likes + comments + shares;
  
  // Estimate reach based on engagement (rough heuristic)
  const estimatedReach = Math.max(total * 10, 100);
  return Math.round((total / estimatedReach) * 100 * 100) / 100;
}

function calculateHashtagTrends(posts) {
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
    .slice(0, 15)
    .map(([hashtag, count]) => ({ 
      hashtag: hashtag || "", 
      count: count || 0,
      posts: posts.filter(p => (p.ShareCommentary || "").includes(hashtag)).length
    }));
}

function calculateAudienceInsights(connectionsData) {
  if (!connectionsData || connectionsData.length === 0) {
    return { industries: [], positions: [], locations: [], totalConnections: 0 };
  }

  const industries = {};
  const positions = {};
  const locations = {};

  connectionsData.forEach(conn => {
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
      .map(([name, value]) => ({ name, value, percentage: Math.round((value / connectionsData.length) * 100) })),
    positions: Object.entries(positions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name, value, percentage: Math.round((value / connectionsData.length) * 100) })),
    locations: Object.entries(locations)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name, value, percentage: Math.round((value / connectionsData.length) * 100) })),
    totalConnections: connectionsData.length
  };
}

function calculatePerformanceMetrics(posts) {
  if (posts.length === 0) {
    return {
      totalEngagement: 0,
      avgEngagementPerPost: 0,
      bestPerformingPost: null,
      engagementDistribution: { low: 0, medium: 0, high: 0 }
    };
  }

  const totalEngagement = posts.reduce((sum, post) => {
    return sum + parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0");
  }, 0);

  const avgEngagementPerPost = totalEngagement / posts.length;

  const bestPost = posts.reduce((best, current) => {
    const currentEngagement = parseInt(current.LikesCount || "0") + parseInt(current.CommentsCount || "0");
    const bestEngagement = parseInt(best.LikesCount || "0") + parseInt(best.CommentsCount || "0");
    return currentEngagement > bestEngagement ? current : best;
  });

  // Categorize posts by engagement level
  const engagementDistribution = { low: 0, medium: 0, high: 0 };
  posts.forEach(post => {
    const engagement = parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0");
    if (engagement < 5) engagementDistribution.low++;
    else if (engagement < 20) engagementDistribution.medium++;
    else engagementDistribution.high++;
  });

  return {
    totalEngagement,
    avgEngagementPerPost: Math.round(avgEngagementPerPost * 10) / 10,
    bestPerformingPost: {
      content: (bestPost.ShareCommentary || "").substring(0, 100),
      engagement: parseInt(bestPost.LikesCount || "0") + parseInt(bestPost.CommentsCount || "0"),
      date: bestPost.Date
    },
    engagementDistribution
  };
}

function calculateTimeBasedInsights(posts) {
  if (posts.length === 0) {
    return { bestPostingDays: [], bestPostingHours: [], postingFrequency: 0 };
  }

  const dayOfWeekCounts = {};
  const hourCounts = {};

  posts.forEach(post => {
    const date = new Date(post.Date || post.date);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
    const hour = date.getHours();

    dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + 1;
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const bestPostingDays = Object.entries(dayOfWeekCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day, count]) => ({ day, count }));

  const bestPostingHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }));

  // Calculate posting frequency
  const postDates = posts.map(p => new Date(p.Date || p.date)).sort((a, b) => a.getTime() - b.getTime());
  const daysBetween = postDates.length > 1 
    ? (postDates[postDates.length - 1].getTime() - postDates[0].getTime()) / (1000 * 60 * 60 * 24)
    : 1;
  const postingFrequency = posts.length / Math.max(daysBetween / 7, 1); // posts per week

  return {
    bestPostingDays,
    bestPostingHours,
    postingFrequency: Math.round(postingFrequency * 10) / 10
  };
}

async function generateAnalyticsNarrative(analytics, authorization) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured, skipping AI narrative");
    return "Analytics processed successfully. Review the detailed metrics above to optimize your LinkedIn strategy.";
  }

  try {
    const summaryData = {
      postsCount: analytics.metadata.postsCount,
      topContentFormats: analytics.contentFormats.slice(0, 3),
      avgEngagement: analytics.performanceMetrics.avgEngagementPerPost,
      topHashtags: analytics.hashtagTrends.slice(0, 5),
      postingFrequency: analytics.timeBasedInsights.postingFrequency,
      bestPerformingPost: analytics.performanceMetrics.bestPerformingPost,
      timeRange: analytics.timeRange
    };

    const systemPrompt = `You are a LinkedIn analytics expert. Analyze the provided comprehensive metrics and write a detailed summary with 3-4 specific, actionable recommendations. Focus on content strategy, posting optimization, and engagement improvement. Keep it under 400 words.`;

    const userPrompt = `Analyze these comprehensive LinkedIn analytics:

Posts in ${analytics.timeRange}: ${summaryData.postsCount}
Content formats: ${summaryData.topContentFormats.map(f => `${f.name}: ${f.value} (${f.percentage}%)`).join(', ')}
Average engagement per post: ${summaryData.avgEngagement}
Posting frequency: ${summaryData.postingFrequency} posts/week
Top hashtags: ${summaryData.topHashtags.map(h => `${h.hashtag} (${h.count})`).join(', ')}
Best performing post: ${summaryData.bestPerformingPost?.engagement || 0} engagement

Provide a comprehensive analysis with specific recommendations for:
1. Content strategy optimization
2. Posting frequency and timing
3. Engagement improvement tactics
4. Format diversification`;

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
        max_tokens: 500,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "Analytics show good potential. Focus on consistent posting and engaging content for optimal growth.";

  } catch (error) {
    console.error('Error generating analytics narrative:', error);
    return "Your LinkedIn analytics show promising trends. Continue posting consistently and engaging with your network for optimal growth.";
  }
}

function getEmptyAnalytics(timeRange) {
  return {
    postingTrends: [],
    contentFormats: [],
    engagementAnalysis: [],
    hashtagTrends: [],
    audienceInsights: { industries: [], positions: [], locations: [], totalConnections: 0 },
    performanceMetrics: {
      totalEngagement: 0,
      avgEngagementPerPost: 0,
      bestPerformingPost: null,
      engagementDistribution: { low: 0, medium: 0, high: 0 }
    },
    timeBasedInsights: { bestPostingDays: [], bestPostingHours: [], postingFrequency: 0 },
    timeRange,
    lastUpdated: new Date().toISOString(),
    metadata: {
      hasRecentActivity: false,
      dataSource: "error",
      postsCount: 0,
      description: "No data available"
    }
  };
}