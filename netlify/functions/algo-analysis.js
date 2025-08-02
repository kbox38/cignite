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
    console.log("Algo Analysis: Starting real-time algorithm analysis");
    const startTime = Date.now();

    // Fetch snapshot data for analysis
    const [postsSnapshot, profileSnapshot] = await Promise.all([
      fetchMemberSnapshot(authorization, "MEMBER_SHARE_INFO"),
      fetchMemberSnapshot(authorization, "PROFILE")
    ]);

    const posts = postsSnapshot?.elements?.[0]?.snapshotData || [];
    const profile = profileSnapshot?.elements?.[0]?.snapshotData?.[0] || {};

    console.log(`Algo Analysis: Processing ${posts.length} posts`);

    // Calculate algorithm metrics
    const metrics = {
      postFrequency: calculatePostFrequency(posts),
      engagementRate: calculateEngagementRate(posts),
      reachScore: calculateReachScore(posts),
      contentMixScore: calculateContentMixScore(posts),
      consistencyScore: calculateConsistencyScore(posts),
      algorithmGrade: 'B+' // Will be calculated based on metrics
    };

    // Calculate overall algorithm grade
    metrics.algorithmGrade = calculateAlgorithmGrade(metrics);

    // Generate AI analysis
    const aiAnalysis = await generateAlgorithmAIAnalysis(metrics, posts, profile);

    // Generate optimization recommendations
    const recommendations = generateOptimizationRecommendations(metrics, posts);

    const result = {
      metrics,
      aiAnalysis,
      recommendations,
      insights: {
        bestPostingTimes: calculateBestPostingTimes(posts),
        topPerformingFormats: calculateTopPerformingFormats(posts),
        engagementPatterns: calculateEngagementPatterns(posts)
      },
      metadata: {
        fetchTimeMs: Date.now() - startTime,
        dataSource: "snapshot_algo",
        postsAnalyzed: posts.length,
        hasRecentActivity: posts.length > 0
      },
      lastUpdated: new Date().toISOString()
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
    console.error("Algo Analysis Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to analyze algorithm performance",
        details: error.message,
        timestamp: new Date().toISOString()
      }),
    };
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

function calculatePostFrequency(posts) {
  if (posts.length === 0) return { score: 0, postsPerWeek: 0, recommendation: "Start posting regularly" };

  // Calculate posts per week based on date range
  const postDates = posts
    .map(post => new Date(post.Date || post.date))
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  if (postDates.length < 2) {
    return { score: 2, postsPerWeek: 0, recommendation: "Post more frequently" };
  }

  const oldestPost = postDates[postDates.length - 1];
  const newestPost = postDates[0];
  const daysDiff = Math.max(1, (newestPost.getTime() - oldestPost.getTime()) / (1000 * 60 * 60 * 24));
  const postsPerWeek = (posts.length / daysDiff) * 7;

  let score = 0;
  let recommendation = "";

  if (postsPerWeek >= 3 && postsPerWeek <= 5) {
    score = 10;
    recommendation = "Perfect posting frequency! Keep it up.";
  } else if (postsPerWeek >= 2) {
    score = 8;
    recommendation = "Good frequency. Consider increasing to 3-5 posts per week.";
  } else if (postsPerWeek >= 1) {
    score = 6;
    recommendation = "Increase posting frequency to 3-5 times per week.";
  } else {
    score = 3;
    recommendation = "Post more frequently to maintain algorithm visibility.";
  }

  return { score, postsPerWeek: Math.round(postsPerWeek * 10) / 10, recommendation };
}

function calculateEngagementRate(posts) {
  if (posts.length === 0) return { score: 0, rate: 0, recommendation: "Start posting to track engagement" };

  const totalEngagement = posts.reduce((sum, post) => {
    return sum + parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0");
  }, 0);

  const avgEngagementPerPost = totalEngagement / posts.length;
  
  let score = 0;
  let recommendation = "";

  if (avgEngagementPerPost >= 20) {
    score = 10;
    recommendation = "Excellent engagement! Your content resonates well.";
  } else if (avgEngagementPerPost >= 10) {
    score = 8;
    recommendation = "Good engagement. Focus on creating more conversation-starting content.";
  } else if (avgEngagementPerPost >= 5) {
    score = 6;
    recommendation = "Moderate engagement. Try asking more questions in your posts.";
  } else {
    score = 3;
    recommendation = "Low engagement. Focus on value-driven content that sparks discussion.";
  }

  return { 
    score, 
    rate: Math.round(avgEngagementPerPost * 10) / 10, 
    recommendation,
    totalEngagement
  };
}

function calculateReachScore(posts) {
  if (posts.length === 0) return { score: 0, estimatedReach: 0, recommendation: "Start posting to build reach" };

  // Estimate reach based on engagement patterns
  const totalEngagement = posts.reduce((sum, post) => {
    return sum + parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0");
  }, 0);

  // Rough heuristic: reach is typically 10-20x engagement for good content
  const estimatedReach = totalEngagement * 15;
  const avgReachPerPost = estimatedReach / posts.length;

  let score = 0;
  let recommendation = "";

  if (avgReachPerPost >= 500) {
    score = 10;
    recommendation = "Excellent reach! Your content is performing very well.";
  } else if (avgReachPerPost >= 200) {
    score = 8;
    recommendation = "Good reach. Continue with your current content strategy.";
  } else if (avgReachPerPost >= 100) {
    score = 6;
    recommendation = "Moderate reach. Focus on engaging with your audience more.";
  } else {
    score = 3;
    recommendation = "Low reach. Improve content quality and engagement tactics.";
  }

  return { score, estimatedReach: Math.round(avgReachPerPost), recommendation };
}

function calculateContentMixScore(posts) {
  if (posts.length === 0) return { score: 0, diversity: 0, recommendation: "Start posting different content types" };

  const mediaTypes = new Set();
  posts.forEach(post => {
    const mediaType = post.MediaType || post.mediaType || "TEXT";
    mediaTypes.add(mediaType);
  });

  const diversityCount = mediaTypes.size;
  let score = 0;
  let recommendation = "";

  if (diversityCount >= 4) {
    score = 10;
    recommendation = "Excellent content diversity! Keep mixing formats.";
  } else if (diversityCount >= 3) {
    score = 8;
    recommendation = "Good content mix. Try adding more video content.";
  } else if (diversityCount >= 2) {
    score = 6;
    recommendation = "Add more content formats like carousels and videos.";
  } else {
    score = 3;
    recommendation = "Diversify your content with images, videos, and carousels.";
  }

  return { 
    score, 
    diversity: diversityCount, 
    types: Array.from(mediaTypes),
    recommendation 
  };
}

function calculateConsistencyScore(posts) {
  if (posts.length < 2) return { score: 0, consistency: 0, recommendation: "Post more frequently to establish consistency" };

  const postDates = posts
    .map(post => new Date(post.Date || post.date))
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  // Calculate gaps between posts
  const gaps = [];
  for (let i = 1; i < postDates.length; i++) {
    const gap = (postDates[i].getTime() - postDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
    gaps.push(gap);
  }

  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const consistency = Math.max(0, 1 - (avgGap / 7)); // Penalize gaps > 1 week

  let score = Math.round(consistency * 10);
  let recommendation = "";

  if (consistency >= 0.8) {
    recommendation = "Excellent consistency! The algorithm loves regular posting.";
  } else if (consistency >= 0.6) {
    recommendation = "Good consistency. Try to maintain more regular intervals.";
  } else {
    recommendation = "Improve posting consistency for better algorithm performance.";
  }

  return { score, consistency: Math.round(consistency * 100), recommendation };
}

function calculateAlgorithmGrade(metrics) {
  const scores = [
    metrics.postFrequency.score,
    metrics.engagementRate.score,
    metrics.reachScore.score,
    metrics.contentMixScore.score,
    metrics.consistencyScore.score
  ];

  const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  if (avgScore >= 9) return 'A+';
  if (avgScore >= 8) return 'A';
  if (avgScore >= 7) return 'A-';
  if (avgScore >= 6) return 'B+';
  if (avgScore >= 5) return 'B';
  if (avgScore >= 4) return 'B-';
  if (avgScore >= 3) return 'C+';
  return 'C';
}

function calculateBestPostingTimes(posts) {
  if (posts.length === 0) return [];

  const hourCounts = {};
  const dayOfWeekCounts = {};

  posts.forEach(post => {
    const date = new Date(post.Date || post.date);
    const hour = date.getHours();
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + 1;
  });

  const bestHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }));

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const bestDays = Object.entries(dayOfWeekCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day, count]) => ({ day: dayNames[parseInt(day)], count }));

  return { bestHours, bestDays };
}

function calculateTopPerformingFormats(posts) {
  if (posts.length === 0) return [];

  const formatPerformance = {};

  posts.forEach(post => {
    const mediaType = post.MediaType || "TEXT";
    const engagement = parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0");
    
    if (!formatPerformance[mediaType]) {
      formatPerformance[mediaType] = { totalEngagement: 0, postCount: 0 };
    }
    
    formatPerformance[mediaType].totalEngagement += engagement;
    formatPerformance[mediaType].postCount++;
  });

  return Object.entries(formatPerformance)
    .map(([format, data]) => ({
      format,
      avgEngagement: Math.round((data.totalEngagement / data.postCount) * 10) / 10,
      postCount: data.postCount
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
}

function calculateEngagementPatterns(posts) {
  if (posts.length === 0) return {};

  const patterns = {
    commentsToLikesRatio: 0,
    highEngagementPosts: 0,
    engagementDistribution: { low: 0, medium: 0, high: 0 }
  };

  let totalLikes = 0;
  let totalComments = 0;

  posts.forEach(post => {
    const likes = parseInt(post.LikesCount || "0");
    const comments = parseInt(post.CommentsCount || "0");
    const totalEngagement = likes + comments;

    totalLikes += likes;
    totalComments += comments;

    if (totalEngagement >= 20) {
      patterns.highEngagementPosts++;
      patterns.engagementDistribution.high++;
    } else if (totalEngagement >= 5) {
      patterns.engagementDistribution.medium++;
    } else {
      patterns.engagementDistribution.low++;
    }
  });

  patterns.commentsToLikesRatio = totalLikes > 0 ? Math.round((totalComments / totalLikes) * 100) / 100 : 0;

  return patterns;
}

function generateOptimizationRecommendations(metrics, posts) {
  const recommendations = [];

  // Frequency recommendations
  if (metrics.postFrequency.score < 7) {
    recommendations.push({
      category: "Posting Frequency",
      priority: "high",
      action: metrics.postFrequency.recommendation,
      impact: "Algorithm visibility"
    });
  }

  // Engagement recommendations
  if (metrics.engagementRate.score < 7) {
    recommendations.push({
      category: "Engagement Quality",
      priority: "high",
      action: metrics.engagementRate.recommendation,
      impact: "Content reach and distribution"
    });
  }

  // Content mix recommendations
  if (metrics.contentMixScore.score < 7) {
    recommendations.push({
      category: "Content Diversity",
      priority: "medium",
      action: metrics.contentMixScore.recommendation,
      impact: "Audience engagement variety"
    });
  }

  // Consistency recommendations
  if (metrics.consistencyScore.score < 7) {
    recommendations.push({
      category: "Posting Consistency",
      priority: "medium",
      action: metrics.consistencyScore.recommendation,
      impact: "Algorithm trust and reliability"
    });
  }

  // Always include best practices
  recommendations.push({
    category: "Best Practices",
    priority: "low",
    action: "Reply to comments within 15 minutes and engage with others' content before posting",
    impact: "Maximum algorithm boost"
  });

  return recommendations;
}

async function generateAlgorithmAIAnalysis(metrics, posts, profile) {
  const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    return "Algorithm analysis complete. Focus on consistent posting and engaging content for optimal performance.";
  }

  try {
    const systemPrompt = `You are a LinkedIn algorithm expert. Analyze the provided metrics and provide specific, actionable insights for algorithm optimization. Focus on concrete improvements the user can make immediately.`;

    const userPrompt = `Analyze this LinkedIn algorithm performance data:

Posting Frequency: ${metrics.postFrequency.postsPerWeek} posts/week (Score: ${metrics.postFrequency.score}/10)
Engagement Rate: ${metrics.engagementRate.rate} avg per post (Score: ${metrics.engagementRate.score}/10)
Estimated Reach: ${metrics.reachScore.estimatedReach} per post (Score: ${metrics.reachScore.score}/10)
Content Mix: ${metrics.contentMixScore.diversity} different formats (Score: ${metrics.contentMixScore.score}/10)
Consistency: ${metrics.consistencyScore.consistency}% (Score: ${metrics.consistencyScore.score}/10)
Overall Grade: ${metrics.algorithmGrade}

Total Posts Analyzed: ${posts.length}
Industry: ${profile.Industry || "Professional Services"}

Provide specific recommendations for:
1. Immediate algorithm optimization tactics
2. Content strategy improvements
3. Posting timing and frequency adjustments
4. Engagement optimization techniques

Keep it actionable and specific to their current performance.`;

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
        max_tokens: 600,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "Continue focusing on consistent, engaging content for algorithm success.";

  } catch (error) {
    console.error('Error generating algorithm AI analysis:', error);
    return "Algorithm analysis shows good potential. Focus on consistent posting and meaningful engagement for optimal performance.";
  }
}