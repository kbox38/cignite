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
    console.log("Dashboard: Starting database-driven analysis");
    const startTime = Date.now();

    // Get user ID from token
    const userId = await getUserIdFromToken(authorization);
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid token or user not found" }),
      };
    }

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

    // Generate dashboard data with fallbacks
    const dashboardData = await generateDashboardData(userId, authorization, startTime);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify(dashboardData),
    };
  } catch (error) {
    console.error("Dashboard Error:", error);
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

async function getUserIdFromToken(authorization) {
  try {
    // Extract the token from "Bearer TOKEN"
    const token = authorization.replace('Bearer ', '');
    
    // Use the LinkedIn Member Authorization API for DMA tokens
    const response = await fetch('https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication', {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      console.error('LinkedIn member authorization failed:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.elements && data.elements.length > 0) {
      // Extract member URN from the response
      const memberUrn = data.elements[0].memberComplianceAuthorizationKey.member;
      // Extract the ID from "urn:li:person:XXXXX"
      const userId = memberUrn.split(':').pop();
      console.log('LinkedIn member ID success:', userId);
      return userId;
    }

    return null;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
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

async function generateDashboardData(userId, authorization, startTime) {
  try {
    // Fetch LinkedIn data with error handling
    const [profileSnapshot, memberShareSnapshot, connectionsSnapshot] = await Promise.allSettled([
      fetchMemberSnapshot(authorization, "PROFILE"),
      fetchMemberSnapshot(authorization, "MEMBER_SHARE_INFO"),
      fetchMemberSnapshot(authorization, "CONNECTIONS")
    ]);

    // Extract data with fallbacks
    const profile = profileSnapshot.status === 'fulfilled' ? profileSnapshot.value?.elements?.[0]?.snapshotData || [] : [];
    const posts = memberShareSnapshot.status === 'fulfilled' ? memberShareSnapshot.value?.elements?.[0]?.snapshotData || [] : [];
    const connections = connectionsSnapshot.status === 'fulfilled' ? connectionsSnapshot.value?.elements?.[0]?.snapshotData || [] : [];

    console.log(`Data fetched - Profile: ${profile.length}, Posts: ${posts.length}, Connections: ${connections.length}`);

    // Calculate metrics with fallbacks
    const profileAnalysis = analyzeProfileCompleteness(profile);
    const postingAnalysis = analyzePostingActivity(posts);
    const engagementAnalysis = analyzeEngagementQuality(posts);
    const contentImpactAnalysis = analyzeContentImpact(posts);

    // Build scores
    const scores = {
      overall: calculateOverallScore([
        profileAnalysis.score,
        postingAnalysis.score,
        engagementAnalysis.score,
        contentImpactAnalysis.score
      ]),
      profileCompleteness: profileAnalysis.score,
      postingActivity: postingAnalysis.score,
      engagementQuality: engagementAnalysis.score,
      contentImpact: contentImpactAnalysis.score,
      contentDiversity: 0, // Placeholder
      postingConsistency: 0, // Placeholder
    };

    // Build analysis
    const analysis = {
      profileCompleteness: profileAnalysis,
      postingActivity: postingAnalysis,
      engagementQuality: engagementAnalysis,
      contentImpact: contentImpactAnalysis,
      contentDiversity: { score: 0, recommendations: ["Feature coming soon"] },
      postingConsistency: { score: 0, recommendations: ["Feature coming soon"] },
    };

    // Calculate summary metrics
    const last28Days = new Date();
    last28Days.setDate(last28Days.getDate() - 28);
    
    const recentPosts = posts.filter(post => {
      const postDate = new Date(post.Date || post.date);
      return !isNaN(postDate.getTime()) && postDate >= last28Days;
    });

    const totalEngagement = posts.reduce((sum, post) => {
      return sum + parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0");
    }, 0);

    const summary = {
      totalConnections: connections.length,
      totalPosts: posts.length,
      posts30d: recentPosts.length,
      avgEngagementPerPost: posts.length > 0 ? Math.round((totalEngagement / posts.length) * 10) / 10 : 0,
      postsPerWeek: postingAnalysis.postsPerWeek || 0,
      engagementRatePct: posts.length > 0 ? Math.round((totalEngagement / posts.length) * 100) / 100 : 0,
      newConnections28d: Math.min(Math.round(recentPosts.length * 0.5), 10),
    };

    return {
      scores,
      analysis,
      summary,
      metadata: {
        fetchTimeMs: Date.now() - startTime,
        dataSource: "linkedin_api",
        hasRecentActivity: posts.length > 0,
        profileDataAvailable: profile.length > 0,
        postsDataAvailable: posts.length > 0,
        connectionsDataAvailable: connections.length > 0,
        postsCount: posts.length
      },
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error("Error generating dashboard data:", error);
    
    // Return fallback data on error
    return generateFallbackDashboardData(startTime);
  }
}

async function fetchMemberSnapshot(authorization, domain) {
  try {
    console.log(`Fetching snapshot for domain: ${domain}`);
    const response = await fetch(`https://api.linkedin.com/rest/memberSnapshots?q=memberAndDomain&domain=${domain}`, {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      console.warn(`Snapshot API for ${domain} returned ${response.status}`);
      return { elements: [] };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching ${domain} snapshot:`, error);
    return { elements: [] };
  }
}

function analyzeProfileCompleteness(profileData) {
  if (!profileData || profileData.length === 0) {
    return {
      score: 0,
      breakdown: { headline: 0, summary: 0, experience: 0, skills: 0 },
      recommendations: ["Complete your LinkedIn profile to improve visibility"],
    };
  }

  const profile = profileData[0] || {};
  const breakdown = {
    headline: profile.Headline ? 30 : 0,
    summary: profile.Summary ? 25 : 0,
    experience: profile.Experience ? 25 : 0,
    skills: profile.Skills ? 20 : 0
  };

  const finalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0) / 10;

  const recommendations = [];
  if (breakdown.headline === 0) recommendations.push("Add a compelling headline");
  if (breakdown.summary === 0) recommendations.push("Write a professional summary");
  if (breakdown.experience === 0) recommendations.push("Add your work experience");
  if (breakdown.skills === 0) recommendations.push("List your key skills");
  if (finalScore >= 8) recommendations.push("Great profile! Your LinkedIn presence is well-optimized");

  return {
    score: Math.round(finalScore * 10) / 10,
    breakdown,
    recommendations,
  };
}

function analyzePostingActivity(posts) {
  const totalPosts = posts.length;

  if (totalPosts === 0) {
    return {
      score: 0,
      postsPerWeek: 0,
      totalPosts: 0,
      recommendations: ["Start posting regularly to build your LinkedIn presence"],
    };
  }

  const postDates = posts
    .map(post => new Date(post.Date || post.date))
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  if (postDates.length === 0) {
    return {
      score: 2,
      postsPerWeek: 0,
      totalPosts,
      recommendations: ["Add dates to your posts for better tracking"],
    };
  }

  const oldestPost = postDates[postDates.length - 1];
  const newestPost = postDates[0];
  const daysDiff = Math.max(1, (newestPost.getTime() - oldestPost.getTime()) / (1000 * 60 * 60 * 24));
  const postsPerWeek = (totalPosts / daysDiff) * 7;

  let score = 0;
  if (postsPerWeek >= 5) score = 10;
  else if (postsPerWeek >= 3) score = 9;
  else if (postsPerWeek >= 2) score = 8;
  else if (postsPerWeek >= 1) score = 7;
  else if (postsPerWeek >= 0.5) score = 5;
  else score = 3;

  const recommendations = [];
  if (postsPerWeek < 1) recommendations.push("Aim for at least 1 post per week");
  else if (postsPerWeek < 3) recommendations.push("Consider increasing to 3-5 posts per week");
  else recommendations.push("Great posting frequency!");

  return {
    score,
    postsPerWeek: Math.round(postsPerWeek * 10) / 10,
    totalPosts,
    recommendations,
  };
}

function analyzeEngagementQuality(posts) {
  if (posts.length === 0) {
    return {
      score: 0,
      avgEngagementPerPost: 0,
      totalEngagement: 0,
      recommendations: ["Start creating content to build engagement"],
    };
  }

  const totalEngagement = posts.reduce((sum, post) => {
    const likes = parseInt(post.LikesCount || post["Likes Count"] || "0");
    const comments = parseInt(post.CommentsCount || post["Comments Count"] || "0");
    return sum + likes + comments;
  }, 0);

  const avgEngagementPerPost = totalEngagement / posts.length;
  
  let score = 0;
  if (avgEngagementPerPost >= 50) score = 10;
  else if (avgEngagementPerPost >= 25) score = 9;
  else if (avgEngagementPerPost >= 15) score = 8;
  else if (avgEngagementPerPost >= 10) score = 7;
  else if (avgEngagementPerPost >= 5) score = 6;
  else if (avgEngagementPerPost >= 2) score = 5;
  else if (avgEngagementPerPost >= 1) score = 4;
  else score = 3;

  const recommendations = [];
  if (avgEngagementPerPost < 2) {
    recommendations.push("Focus on creating more engaging content");
  } else if (avgEngagementPerPost < 10) {
    recommendations.push("Good engagement! Try asking questions to increase interaction");
  } else {
    recommendations.push("Excellent engagement! Your content resonates well");
  }

  return {
    score,
    avgEngagementPerPost: Math.round(avgEngagementPerPost * 10) / 10,
    totalEngagement,
    recommendations,
  };
}

function analyzeContentImpact(posts) {
  const engagementThreshold = 5;
  
  if (posts.length === 0) {
    return {
      score: 0,
      highEngagementPosts: 0,
      recommendations: ["Create content that generates meaningful engagement"],
    };
  }

  const highEngagementPosts = posts.filter(post => {
    const likes = parseInt(post.LikesCount || "0");
    const comments = parseInt(post.CommentsCount || "0");
    return (likes + comments) >= engagementThreshold;
  }).length;

  const impactRatio = highEngagementPosts / posts.length;
  
  let score = 0;
  if (impactRatio >= 0.7) score = 10;
  else if (impactRatio >= 0.5) score = 9;
  else if (impactRatio >= 0.3) score = 8;
  else if (impactRatio >= 0.2) score = 7;
  else if (impactRatio >= 0.1) score = 6;
  else score = 5;

  const recommendations = [];
  if (impactRatio === 0) {
    recommendations.push("Focus on creating content that resonates with your audience");
  } else if (impactRatio < 0.3) {
    recommendations.push("Analyze your high-performing posts and create similar content");
  } else {
    recommendations.push("Great content impact!");
  }

  return {
    score,
    highEngagementPosts,
    impactRatio: Math.round(impactRatio * 100) / 100,
    recommendations,
  };
}

function calculateOverallScore(scores) {
  const validScores = scores.filter(score => score !== null && score !== undefined && score > 0);
  return validScores.length > 0 
    ? Math.round((validScores.reduce((sum, score) => sum + score, 0) / validScores.length) * 10) / 10
    : 0;
}

function generateFallbackDashboardData(startTime) {
  return {
    scores: {
      overall: 0,
      profileCompleteness: 0,
      postingActivity: 0,
      engagementQuality: 0,
      contentImpact: 0,
      contentDiversity: 0,
      postingConsistency: 0,
    },
    analysis: {
      profileCompleteness: { score: 0, recommendations: ["Unable to analyze profile data"] },
      postingActivity: { score: 0, recommendations: ["Unable to analyze posting activity"] },
      engagementQuality: { score: 0, recommendations: ["Unable to analyze engagement"] },
      contentImpact: { score: 0, recommendations: ["Unable to analyze content impact"] },
      contentDiversity: { score: 0, recommendations: ["Feature temporarily unavailable"] },
      postingConsistency: { score: 0, recommendations: ["Feature temporarily unavailable"] },
    },
    summary: {
      totalConnections: 0,
      totalPosts: 0,
      posts30d: 0,
      avgEngagementPerPost: 0,
      postsPerWeek: 0,
      engagementRatePct: 0,
      newConnections28d: 0,
    },
    metadata: {
      fetchTimeMs: Date.now() - startTime,
      dataSource: "fallback",
      hasRecentActivity: false,
      profileDataAvailable: false,
      postsDataAvailable: false,
      connectionsDataAvailable: false,
      postsCount: 0
    },
    lastUpdated: new Date().toISOString(),
    error: "Unable to fetch LinkedIn data - using fallback"
  };
}