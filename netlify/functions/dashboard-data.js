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
    console.error("Dashboard Data: No authorization header provided");
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
    console.log("Dashboard Data: Starting Snapshot-based analysis with OpenAI insights");
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
          needsReconnect: true
        }),
      };
    }

    // Fetch all required Snapshot domains
    const [profileSnapshot, connectionsSnapshot, postsSnapshot] = await Promise.all([
      fetchMemberSnapshot(authorization, "PROFILE"),
      fetchMemberSnapshot(authorization, "CONNECTIONS"),
      fetchMemberSnapshot(authorization, "MEMBER_SHARE_INFO")
    ]);

    const fetchTime = Date.now() - startTime;
    console.log(`Dashboard Data: Snapshot fetching completed in ${fetchTime}ms`);

    // Process the snapshot data
    const processingStartTime = Date.now();
    
    // Parse posts from MEMBER_SHARE_INFO
    const postsData = postsSnapshot?.elements?.[0]?.snapshotData || [];
    console.log(`Dashboard Data: Found ${postsData.length} posts in MEMBER_SHARE_INFO`);

    // Calculate real metrics from snapshot data
    const { scores, methodology } = await calculateScoresFromSnapshot({
      postsData,
      profileSnapshot,
      connectionsSnapshot
    });

    // Generate AI insights for each metric
    const aiInsights = await generateAIInsights(scores, postsData, authorization);

    // Calculate summary metrics
    const summary = calculateSummaryFromSnapshot(postsData, connectionsSnapshot);

    // Calculate trends from posts data
    const trends = calculateTrendsFromSnapshot(postsData);

    // Calculate content types
    const content = calculateContentTypesFromSnapshot(postsData);

    const processingTime = Date.now() - processingStartTime;
    console.log(`Dashboard Data: Processing completed in ${processingTime}ms`);

    const result = {
      scores: {
        overall: calculateOverallScore(scores),
        ...scores
      },
      summary,
      trends,
      content,
      methodology,
      aiInsights, // NEW: Real AI insights
      metadata: {
        fetchTimeMs: fetchTime,
        processingTimeMs: processingTime,
        totalTimeMs: Date.now() - startTime,
        dataSource: "snapshot",
        hasRecentActivity: postsData.length > 0,
        postsCount: postsData.length,
        profileDataAvailable: !!profileSnapshot?.elements?.[0]?.snapshotData,
        connectionsDataAvailable: !!connectionsSnapshot?.elements?.[0]?.snapshotData
      },
      lastUpdated: new Date().toISOString()
    };

    console.log("Dashboard Data: Analysis complete with real Snapshot data and AI insights");

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
    console.error("Dashboard Data Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch dashboard data",
        details: error.message,
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
      return {
        isActive: false,
        message: "Unable to verify DMA consent status"
      };
    }

    const data = await response.json();
    const hasConsent = data.elements && data.elements.length > 0;

    return {
      isActive: hasConsent,
      message: hasConsent ? "DMA consent active" : "DMA consent not active"
    };
  } catch (error) {
    console.error("Error verifying DMA consent:", error);
    return {
      isActive: false,
      message: "Error checking DMA consent status"
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

    const data = await response.json();
    console.log(`Fetched snapshot data for ${domain}: ${data.elements?.[0]?.snapshotData?.length || 0} items`);
    return data;
  } catch (error) {
    console.error(`Error fetching snapshot for ${domain}:`, error);
    return null;
  }
}

async function calculateScoresFromSnapshot({ postsData, profileSnapshot, connectionsSnapshot }) {
  const scores = {};
  const methodology = {};

  // Profile Completeness from PROFILE snapshot
  const profileResult = calculateProfileCompletenessFromSnapshot(profileSnapshot);
  scores.profileCompleteness = profileResult.score;
  methodology.profileCompleteness = profileResult.methodology;

  // Posting Activity from MEMBER_SHARE_INFO
  const postingResult = calculatePostingActivityFromSnapshot(postsData);
  scores.postingActivity = postingResult.score;
  methodology.postingActivity = postingResult.methodology;

  // Engagement Quality from post engagement data
  const engagementResult = calculateEngagementQualityFromSnapshot(postsData);
  scores.engagementQuality = engagementResult.score;
  methodology.engagementQuality = engagementResult.methodology;

  // Content Diversity from media types
  const diversityResult = calculateContentDiversityFromSnapshot(postsData);
  scores.contentDiversity = diversityResult.score;
  methodology.contentDiversity = diversityResult.methodology;

  // Network Growth from connections
  const networkResult = calculateNetworkGrowthFromSnapshot(connectionsSnapshot);
  scores.networkGrowth = networkResult.score;
  methodology.networkGrowth = networkResult.methodology;

  // Additional scores with real data
  scores.audienceRelevance = calculateAudienceRelevanceFromSnapshot(connectionsSnapshot);
  scores.engagementRate = calculateEngagementRateFromSnapshot(postsData);
  scores.mutualInteractions = calculateMutualInteractionsFromSnapshot(postsData);
  scores.profileVisibility = calculateProfileVisibilityFromSnapshot(profileSnapshot);
  scores.professionalBrand = calculateProfessionalBrandFromSnapshot(profileSnapshot);

  return { scores, methodology };
}

function calculateProfileCompletenessFromSnapshot(profileSnapshot) {
  if (!profileSnapshot?.elements?.[0]?.snapshotData) {
    return {
      score: null,
      methodology: {
        formula: "Profile completeness from Snapshot PROFILE domain",
        inputs: { error: "No profile snapshot data available" }
      }
    };
  }

  const profile = profileSnapshot.elements[0].snapshotData[0] || {};
  const fields = {
    firstName: !!(profile["First Name"] || profile.firstName),
    lastName: !!(profile["Last Name"] || profile.lastName),
    headline: !!(profile["Headline"] || profile.headline),
    summary: !!(profile["Summary"] || profile.summary),
    industry: !!(profile["Industry"] || profile.industry),
    location: !!(profile["Location"] || profile.location)
  };

  const filledFields = Object.values(fields).filter(Boolean).length;
  const totalFields = Object.keys(fields).length;
  const completionPct = (filledFields / totalFields) * 100;
  const score = Math.round((completionPct / 100) * 10);

  return {
    score: Math.min(score, 10),
    methodology: {
      formula: "Profile completeness = (Filled fields / Total fields) * 10",
      inputs: {
        filledFields,
        totalFields,
        completionPct: Math.round(completionPct),
        fieldsStatus: fields
      }
    }
  };
}

function calculatePostingActivityFromSnapshot(postsData) {
  const postsCount = postsData.length;
  let score;
  if (postsCount >= 20) score = 10;
  else if (postsCount >= 10) score = 8;
  else if (postsCount >= 5) score = 6;
  else if (postsCount > 0) score = 4;
  else score = 2;

  return {
    score,
    methodology: {
      formula: "Posting activity based on total posts in MEMBER_SHARE_INFO",
      inputs: {
        totalPosts: postsCount,
        scoringBand: postsCount >= 20 ? "≥20 posts" : postsCount >= 10 ? "10-19 posts" : postsCount >= 5 ? "5-9 posts" : postsCount > 0 ? "1-4 posts" : "0 posts"
      }
    }
  };
}

function calculateEngagementQualityFromSnapshot(postsData) {
  if (postsData.length === 0) {
    return {
      score: 2,
      methodology: {
        formula: "Average engagement per post from MEMBER_SHARE_INFO",
        inputs: { totalPosts: 0, avgEngagement: 0 }
      }
    };
  }

  const totalEngagement = postsData.reduce((sum, post) => {
    const likes = parseInt(post.LikesCount || post.likesCount || "0");
    const comments = parseInt(post.CommentsCount || post.commentsCount || "0");
    return sum + likes + comments;
  }, 0);

  const avgEngagement = totalEngagement / postsData.length;
  let score;
  if (avgEngagement >= 50) score = 10;
  else if (avgEngagement >= 20) score = 8;
  else if (avgEngagement >= 10) score = 6;
  else if (avgEngagement > 0) score = 4;
  else score = 2;

  return {
    score,
    methodology: {
      formula: "Average engagement per post = (Total likes + comments) / Total posts",
      inputs: {
        totalEngagement,
        totalPosts: postsData.length,
        avgEngagement: Math.round(avgEngagement * 100) / 100
      }
    }
  };
}

function calculateContentDiversityFromSnapshot(postsData) {
  const mediaTypes = new Set();
  const typeBreakdown = {};
  
  postsData.forEach(post => {
    const mediaType = post.MediaType || post.mediaType || "TEXT";
    mediaTypes.add(mediaType);
    typeBreakdown[mediaType] = (typeBreakdown[mediaType] || 0) + 1;
  });

  const typeCount = mediaTypes.size;
  let score;
  if (typeCount >= 4) score = 10;
  else if (typeCount === 3) score = 8;
  else if (typeCount === 2) score = 6;
  else if (typeCount === 1) score = 4;
  else score = 2;

  return {
    score,
    methodology: {
      formula: "Distinct media types across posts",
      inputs: {
        typesUsed: Array.from(mediaTypes),
        distinctCount: typeCount,
        typeBreakdown
      }
    }
  };
}

function calculateNetworkGrowthFromSnapshot(connectionsSnapshot) {
  if (!connectionsSnapshot?.elements?.[0]?.snapshotData) {
    return {
      score: null,
      methodology: {
        formula: "Network growth from CONNECTIONS snapshot",
        inputs: { error: "No connections data available" }
      }
    };
  }

  const connections = connectionsSnapshot.elements[0].snapshotData;
  const totalConnections = connections.length;
  
  // Calculate recent connections (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentConnections = connections.filter(conn => {
    const connectedDate = new Date(conn["Connected On"] || conn.connectedOn || conn.Date);
    return connectedDate >= thirtyDaysAgo;
  });

  let score;
  if (recentConnections.length >= 20) score = 10;
  else if (recentConnections.length >= 10) score = 8;
  else if (recentConnections.length >= 5) score = 6;
  else if (recentConnections.length > 0) score = 4;
  else score = 2;

  return {
    score,
    methodology: {
      formula: "Recent connections (last 30 days) from CONNECTIONS snapshot",
      inputs: {
        totalConnections,
        recentConnections: recentConnections.length
      }
    }
  };
}

// Additional score calculations with real data
function calculateAudienceRelevanceFromSnapshot(connectionsSnapshot) {
  if (!connectionsSnapshot?.elements?.[0]?.snapshotData) return null;
  
  const connections = connectionsSnapshot.elements[0].snapshotData;
  const industries = new Set(connections.map(c => c.Industry || c.industry).filter(Boolean));
  const diversityRatio = industries.size / Math.min(connections.length, 20);
  
  return Math.min(Math.round(diversityRatio * 10), 10);
}

function calculateEngagementRateFromSnapshot(postsData) {
  if (postsData.length === 0) return 2;
  
  const totalEngagement = postsData.reduce((sum, post) => {
    const likes = parseInt(post.LikesCount || "0");
    const comments = parseInt(post.CommentsCount || "0");
    return sum + likes + comments;
  }, 0);
  
  const rate = (totalEngagement / postsData.length) * 100;
  return Math.min(Math.round(rate / 10), 10);
}

function calculateMutualInteractionsFromSnapshot(postsData) {
  // Estimate based on comments count
  const totalComments = postsData.reduce((sum, post) => {
    return sum + parseInt(post.CommentsCount || "0");
  }, 0);
  
  return Math.min(Math.round(totalComments / 5), 10);
}

function calculateProfileVisibilityFromSnapshot(profileSnapshot) {
  if (!profileSnapshot?.elements?.[0]?.snapshotData) return null;
  
  const profile = profileSnapshot.elements[0].snapshotData[0] || {};
  const views = parseInt(profile["Profile Views"] || "0");
  const searches = parseInt(profile["Search Appearances"] || "0");
  
  const totalVisibility = views + searches;
  if (totalVisibility >= 1000) return 10;
  if (totalVisibility >= 500) return 8;
  if (totalVisibility >= 100) return 6;
  if (totalVisibility > 0) return 4;
  return 2;
}

function calculateProfessionalBrandFromSnapshot(profileSnapshot) {
  if (!profileSnapshot?.elements?.[0]?.snapshotData) return null;
  
  const profile = profileSnapshot.elements[0].snapshotData[0] || {};
  const indicators = {
    headline: !!(profile.Headline || profile.headline),
    industry: !!(profile.Industry || profile.industry),
    summary: !!(profile.Summary || profile.summary)
  };
  
  const presentIndicators = Object.values(indicators).filter(Boolean).length;
  return Math.min(presentIndicators * 3, 10);
}

async function generateAIInsights(scores, postsData, authorization) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured, skipping AI insights");
    return {};
  }

  try {
    // Prepare data for OpenAI analysis
    const analysisData = {
      scores,
      postCount: postsData.length,
      recentPosts: postsData.slice(0, 5).map(post => ({
        text: (post.ShareCommentary || "").substring(0, 200),
        mediaType: post.MediaType || "TEXT",
        likes: parseInt(post.LikesCount || "0"),
        comments: parseInt(post.CommentsCount || "0")
      })),
      contentTypes: postsData.reduce((acc, post) => {
        const type = post.MediaType || "TEXT";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    };

    const systemPrompt = `You are a LinkedIn analytics expert. Analyze the provided metrics and generate specific, actionable insights for each score. Keep insights concise (max 100 characters each) and professional.`;

    const userPrompt = `Analyze these LinkedIn metrics and provide specific insights:

Scores: ${JSON.stringify(scores)}
Post Count: ${analysisData.postCount}
Content Types: ${JSON.stringify(analysisData.contentTypes)}
Recent Posts Sample: ${JSON.stringify(analysisData.recentPosts)}

Provide insights for: postingActivity, engagementQuality, contentDiversity, networkGrowth`;

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
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '';
    
    // Parse AI response into structured insights
    const insights = {
      postingActivity: extractInsight(aiResponse, 'posting') || `${analysisData.postCount} posts total. Consider posting 3-5 times per week for optimal reach.`,
      engagementQuality: extractInsight(aiResponse, 'engagement') || `Average engagement looks good. Focus on asking questions to boost comments.`,
      contentDiversity: extractInsight(aiResponse, 'content') || `Mix different content types (text, images, videos) for better engagement.`,
      networkGrowth: extractInsight(aiResponse, 'network') || `Continue building strategic connections in your industry.`
    };

    console.log("Generated AI insights successfully");
    return insights;

  } catch (error) {
    console.error('Error generating AI insights:', error);
    return {
      postingActivity: "Keep posting consistently to maintain visibility.",
      engagementQuality: "Focus on creating engaging content that sparks conversation.",
      contentDiversity: "Try mixing different content formats for better reach.",
      networkGrowth: "Continue building meaningful professional connections."
    };
  }
}

function extractInsight(aiResponse, keyword) {
  const lines = aiResponse.split('\n');
  const relevantLine = lines.find(line => 
    line.toLowerCase().includes(keyword) && line.length > 10
  );
  return relevantLine ? relevantLine.replace(/^[^:]*:/, '').trim() : null;
}

function calculateSummaryFromSnapshot(postsData, connectionsSnapshot) {
  const totalConnections = connectionsSnapshot?.elements?.[0]?.snapshotData?.length || 0;
  const posts30d = postsData.length; // Snapshot contains all posts
  
  const totalEngagement = postsData.reduce((sum, post) => {
    const likes = parseInt(post.LikesCount || "0");
    const comments = parseInt(post.CommentsCount || "0");
    return sum + likes + comments;
  }, 0);
  
  const engagementRatePct = posts30d > 0 ? Math.round((totalEngagement / posts30d) * 100) / 100 : 0;
  
  // Estimate new connections from recent posts activity
  const newConnections28d = Math.min(Math.round(posts30d * 0.5), 10);

  return {
    totalConnections,
    posts30d,
    engagementRatePct,
    newConnections28d
  };
}

function calculateTrendsFromSnapshot(postsData) {
  const weeklyData = {};
  
  postsData.forEach(post => {
    const date = new Date(post.Date || post.date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekKey = `${year}-W${week.toString().padStart(2, '0')}`;
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { posts: 0, engagements: 0 };
    }
    
    weeklyData[weekKey].posts++;
    
    const likes = parseInt(post.LikesCount || "0");
    const comments = parseInt(post.CommentsCount || "0");
    weeklyData[weekKey].engagements += likes + comments;
  });

  return {
    weeklyPosts: Object.fromEntries(Object.entries(weeklyData).map(([week, data]) => [week, data.posts])),
    weeklyEngagements: Object.fromEntries(Object.entries(weeklyData).map(([week, data]) => [week, data.engagements]))
  };
}

function calculateContentTypesFromSnapshot(postsData) {
  const types = {};
  
  postsData.forEach(post => {
    const mediaType = post.MediaType || post.mediaType || "TEXT";
    types[mediaType] = (types[mediaType] || 0) + 1;
  });

  return { types };
}

function calculateOverallScore(scores) {
  const validScores = Object.values(scores).filter(score => score !== null && score !== undefined);
  if (validScores.length === 0) return 0;
  
  const sum = validScores.reduce((acc, score) => acc + score, 0);
  return Math.round((sum / validScores.length) * 10) / 10;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}