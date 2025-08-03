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

    // Initialize Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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

    // Fetch or generate dashboard insights from database
    const dashboardData = await getDashboardDataFromDB(supabase, userId, authorization);

    // Log activity
    await supabase.rpc('log_user_activity', {
      p_user_id: userId,
      p_activity_type: 'dashboard_viewed',
      p_description: 'User viewed dashboard'
    });

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
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info from LinkedIn');
    }

    const userInfo = await response.json();
    const linkedinUrn = `urn:li:person:${userInfo.sub}`;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('linkedin_member_urn', linkedinUrn)
      .single();

    return user?.id || null;
  } catch (error) {
    console.error('Error getting user ID from token:', error);
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

async function getDashboardDataFromDB(supabase, userId, authorization) {
  try {
    // Check for existing dashboard insights
    const { data: existingInsights } = await supabase
      .from('dashboard_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('is_current', true);

    // Get user profile data
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get posts from cache
    const { data: userPosts } = await supabase
      .from('post_cache')
      .select('*')
      .eq('user_id', userId)
      .order('published_at', { ascending: false });

    // Calculate metrics if no existing insights or they're old
    const needsRefresh = !existingInsights || existingInsights.length === 0 || 
      existingInsights.some(insight => 
        new Date(insight.generated_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)
      );

    let scores = {};
    let analysis = {};

    if (needsRefresh) {
      // Fetch fresh data from LinkedIn and calculate scores
      const [profileSnapshot, memberShareSnapshot, connectionsSnapshot] = await Promise.all([
        fetchMemberSnapshot(authorization, "PROFILE"),
        fetchMemberSnapshot(authorization, "MEMBER_SHARE_INFO"),
        fetchMemberSnapshot(authorization, "CONNECTIONS")
      ]);

      // Calculate all metrics
      const profileAnalysis = await analyzeProfileCompleteness(profileSnapshot);
      const postingAnalysis = await analyzePostingActivity(memberShareSnapshot);
      const engagementAnalysis = await analyzeEngagementQuality(memberShareSnapshot);
      const contentImpactAnalysis = await analyzeContentImpact(memberShareSnapshot);
      const contentDiversityAnalysis = await analyzeContentDiversity(memberShareSnapshot);
      const consistencyAnalysis = await analyzePostingConsistency(memberShareSnapshot);

      scores = {
        overall: calculateOverallScore([
          profileAnalysis.score,
          postingAnalysis.score,
          engagementAnalysis.score,
          contentImpactAnalysis.score,
          contentDiversityAnalysis.score,
          consistencyAnalysis.score
        ]),
        profileCompleteness: profileAnalysis.score,
        postingActivity: postingAnalysis.score,
        engagementQuality: engagementAnalysis.score,
        contentImpact: contentImpactAnalysis.score,
        contentDiversity: contentDiversityAnalysis.score,
        postingConsistency: consistencyAnalysis.score,
      };

      analysis = {
        profileCompleteness: profileAnalysis,
        postingActivity: postingAnalysis,
        engagementQuality: engagementAnalysis,
        contentImpact: contentImpactAnalysis,
        contentDiversity: contentDiversityAnalysis,
        postingConsistency: consistencyAnalysis,
      };

      // Save insights to database
      await saveInsightsToDatabase(supabase, userId, scores, analysis);
    } else {
      // Load from database
      scores = existingInsights.reduce((acc, insight) => {
        acc[insight.metric_type] = insight.score;
        return acc;
      }, {});
      
      analysis = existingInsights.reduce((acc, insight) => {
        acc[insight.metric_type] = {
          score: insight.score,
          recommendations: insight.recommendations || [],
          aiInsight: insight.insight_text
        };
        return acc;
      }, {});

      scores.overall = calculateOverallScore(Object.values(scores));
    }

    // Calculate summary metrics
    const posts = memberShareSnapshot?.elements?.[0]?.snapshotData || [];
    const connections = connectionsSnapshot?.elements?.[0]?.snapshotData || [];
    
    const last28Days = new Date();
    last28Days.setDate(last28Days.getDate() - 28);
    
    const recentPosts = posts.filter(post => {
      const postDate = new Date(post.Date || post.date);
      return postDate >= last28Days;
    });

    const totalEngagement = posts.reduce((sum, post) => {
      return sum + parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0");
    }, 0);

    return {
      scores,
      analysis,
      summary: {
        totalConnections: connections.length,
        totalPosts: posts.length,
        posts30d: recentPosts.length,
        avgEngagementPerPost: posts.length > 0 ? Math.round((totalEngagement / posts.length) * 10) / 10 : 0,
        postsPerWeek: postingAnalysis?.postsPerWeek || 0,
        engagementRatePct: posts.length > 0 ? Math.round((totalEngagement / posts.length) * 100) / 100 : 0,
        newConnections28d: Math.min(Math.round(recentPosts.length * 0.5), 10),
      },
      metadata: {
        fetchTimeMs: Date.now() - startTime,
        dataSource: "database_driven",
        hasRecentActivity: posts.length > 0,
        profileDataAvailable: !!profileSnapshot?.elements?.[0]?.snapshotData,
        postsDataAvailable: !!memberShareSnapshot?.elements?.[0]?.snapshotData,
        connectionsDataAvailable: !!connectionsSnapshot?.elements?.[0]?.snapshotData,
      },
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error getting dashboard data from DB:", error);
    throw error;
  }
}

async function saveInsightsToDatabase(supabase, userId, scores, analysis) {
  try {
    // Mark old insights as not current
    await supabase
      .from('dashboard_insights')
      .update({ is_current: false })
      .eq('user_id', userId);

    // Insert new insights
    const insights = Object.entries(analysis).map(([metricType, data]) => ({
      user_id: userId,
      metric_type: metricType,
      insight_text: data.aiInsight || `${metricType} analysis complete`,
      score: data.score,
      recommendations: data.recommendations || [],
      is_current: true
    }));

    const { error } = await supabase
      .from('dashboard_insights')
      .insert(insights);

    if (error) {
      console.error('Error saving insights:', error);
    } else {
      console.log('Dashboard insights saved to database');
    }
  } catch (error) {
    console.error('Error saving insights to database:', error);
  }
}

function calculateOverallScore(scores) {
  const validScores = scores.filter(score => score !== null && score !== undefined);
  return validScores.length > 0 
    ? Math.round((validScores.reduce((sum, score) => sum + score, 0) / validScores.length) * 10) / 10
    : 0;
}

// Include the analysis functions from the previous implementation
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

async function analyzeProfileCompleteness(profileSnapshot) {
  const profile = profileSnapshot?.elements?.[0]?.snapshotData?.[0] || {};
  
  let score = 0;
  const breakdown = {
    basicInfo: 0,
    headline: 0,
    summary: 0,
    experience: 0,
    skills: 0
  };

  // Basic Info (25 points)
  if (profile["First Name"] && profile["Last Name"]) {
    breakdown.basicInfo += 15;
    score += 15;
  }
  if (profile["Industry"] && profile["Industry"].trim()) {
    breakdown.basicInfo += 5;
    score += 5;
  }
  if (profile["Location"] && profile["Location"].trim()) {
    breakdown.basicInfo += 5;
    score += 5;
  }

  // Headline (25 points)
  if (profile["Headline"] && profile["Headline"].trim()) {
    const headlineLength = profile["Headline"].length;
    if (headlineLength > 30) {
      breakdown.headline = 25;
      score += 25;
    } else if (headlineLength > 10) {
      breakdown.headline = 20;
      score += 20;
    } else {
      breakdown.headline = 15;
      score += 15;
    }
  }

  // Summary (20 points)
  if (profile["Summary"] && profile["Summary"].trim()) {
    const summaryLength = profile["Summary"].length;
    if (summaryLength > 100) {
      breakdown.summary = 20;
      score += 20;
    } else if (summaryLength > 50) {
      breakdown.summary = 15;
      score += 15;
    } else {
      breakdown.summary = 10;
      score += 10;
    }
  }

  // Experience (15 points)
  if (profile["Current Position"] || profile["Position"] || profile["Headline"]) {
    breakdown.experience += 10;
    score += 10;
  }
  if (profile["Company"] || profile["Current Company"]) {
    breakdown.experience += 5;
    score += 5;
  }

  // Skills (15 points)
  if (profile["Skills"] || profile["Top Skills"]) {
    breakdown.skills = 15;
    score += 15;
  } else if (profile["Industry"] && profile["Headline"]) {
    breakdown.skills = 10;
    score += 10;
  }

  const finalScore = Math.max(Math.min(score / 10, 10), profile["First Name"] ? 4 : 0);

  const recommendations = [];
  if (breakdown.headline < 20) recommendations.push("Enhance your headline with specific skills and value proposition");
  if (breakdown.summary < 15) recommendations.push("Add a compelling summary that tells your professional story");
  if (breakdown.experience < 10) recommendations.push("Complete your work experience section");
  if (breakdown.skills < 10) recommendations.push("Add relevant skills to showcase your expertise");
  if (finalScore >= 8) recommendations.push("Excellent profile! Your LinkedIn presence is well-optimized");

  return {
    score: Math.round(finalScore * 10) / 10,
    breakdown,
    recommendations,
  };
}

async function analyzePostingActivity(memberShareSnapshot) {
  const posts = memberShareSnapshot?.elements?.[0]?.snapshotData || [];
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
  if (postsPerWeek < 1) recommendations.push("Aim for at least 1 post per week to maintain visibility");
  else if (postsPerWeek < 3) recommendations.push("Consider increasing to 3-5 posts per week for optimal engagement");
  else if (postsPerWeek > 7) recommendations.push("Consider reducing frequency to avoid audience fatigue");
  else recommendations.push("Great posting frequency! Keep up the consistent activity");

  return {
    score,
    postsPerWeek: Math.round(postsPerWeek * 10) / 10,
    totalPosts,
    recommendations,
  };
}

async function analyzeEngagementQuality(memberShareSnapshot) {
  const posts = memberShareSnapshot?.elements?.[0]?.snapshotData || [];
  
  if (posts.length === 0) {
    return {
      score: 0,
      avgEngagementPerPost: 0,
      totalEngagement: 0,
      recommendations: ["Start posting to track engagement metrics"],
    };
  }

  let totalEngagement = 0;
  let postsWithEngagement = 0;

  posts.forEach((post, index) => {
    const likes = parseInt(
      post.LikesCount || 
      post["Likes Count"] || 
      post.likesCount || 
      post.likes || 
      "0"
    );
    
    const comments = parseInt(
      post.CommentsCount || 
      post["Comments Count"] || 
      post.commentsCount || 
      post.comments || 
      "0"
    );
    
    const engagement = likes + comments;
    totalEngagement += engagement;
    if (engagement > 0) postsWithEngagement++;
  });

  const avgEngagementPerPost = totalEngagement / posts.length;

  let score = 0;
  if (avgEngagementPerPost >= 25) score = 10;
  else if (avgEngagementPerPost >= 15) score = 9;
  else if (avgEngagementPerPost >= 10) score = 8;
  else if (avgEngagementPerPost >= 5) score = 7;
  else if (avgEngagementPerPost >= 3) score = 6;
  else if (avgEngagementPerPost >= 1) score = 5;
  else if (avgEngagementPerPost > 0) score = 4;
  else score = 0;

  const recommendations = [];
  if (avgEngagementPerPost === 0) {
    recommendations.push("Focus on creating engaging content that sparks conversation");
  } else if (avgEngagementPerPost < 3) {
    recommendations.push("Ask questions in your posts to encourage comments");
  } else if (avgEngagementPerPost < 10) {
    recommendations.push("Great engagement! Try varying content formats to increase further");
  } else {
    recommendations.push("Excellent engagement! Your content resonates well with your audience");
  }

  return {
    score,
    avgEngagementPerPost: Math.round(avgEngagementPerPost * 10) / 10,
    totalEngagement,
    recommendations,
  };
}

async function analyzeContentImpact(memberShareSnapshot) {
  const posts = memberShareSnapshot?.elements?.[0]?.snapshotData || [];
  const engagementThreshold = 5;
  
  if (posts.length === 0) {
    return {
      score: 0,
      highEngagementPosts: 0,
      engagementThreshold,
      recommendations: ["Create content that generates meaningful engagement"],
    };
  }

  const highEngagementPosts = posts.filter(post => {
    const likes = parseInt(post.LikesCount || post["Likes Count"] || post.likesCount || "0");
    const comments = parseInt(post.CommentsCount || post["Comments Count"] || post.commentsCount || "0");
    return (likes + comments) >= engagementThreshold;
  }).length;

  const impactRatio = highEngagementPosts / posts.length;
  
  let score = 0;
  if (impactRatio >= 0.7) score = 10;
  else if (impactRatio >= 0.5) score = 9;
  else if (impactRatio >= 0.3) score = 8;
  else if (impactRatio >= 0.2) score = 7;
  else if (impactRatio >= 0.1) score = 6;
  else if (impactRatio > 0) score = 5;
  else score = 0;

  const recommendations = [];
  if (impactRatio === 0) {
    recommendations.push("Focus on creating content that resonates with your audience");
  } else if (impactRatio < 0.3) {
    recommendations.push("Analyze your high-performing posts and create similar content");
  } else if (impactRatio < 0.5) {
    recommendations.push("Good content impact! Try to maintain this quality consistently");
  } else {
    recommendations.push("Excellent content impact! Your posts consistently engage your audience");
  }

  return {
    score,
    highEngagementPosts,
    impactRatio: Math.round(impactRatio * 100) / 100,
    engagementThreshold,
    recommendations,
  };
}

async function analyzeContentDiversity(memberShareSnapshot) {
  const posts = memberShareSnapshot?.elements?.[0]?.snapshotData || [];
  
  if (posts.length === 0) {
    return {
      score: 0,
      mediaTypes: [],
      diversityRatio: 0,
      recommendations: ["Start posting different types of content"],
    };
  }

  const mediaTypes = new Set();
  const typeBreakdown = {};

  posts.forEach((post, index) => {
    let mediaType = post.MediaType || post["Media Type"] || post.mediaType;
    
    if (!mediaType || mediaType === "NONE") {
      if (post.MediaUrl || post["Media URL"] || post.mediaUrl) {
        mediaType = "IMAGE";
      } else if (post.SharedUrl || post["Shared URL"] || post.sharedUrl) {
        mediaType = "ARTICLE";
      } else {
        mediaType = "TEXT";
      }
    }
    
    mediaTypes.add(mediaType);
    typeBreakdown[mediaType] = (typeBreakdown[mediaType] || 0) + 1;
  });

  const uniqueTypes = Array.from(mediaTypes);
  const diversityRatio = uniqueTypes.length / Math.min(posts.length, 4);

  let score = 0;
  if (uniqueTypes.length >= 4) score = 10;
  else if (uniqueTypes.length === 3) score = 8;
  else if (uniqueTypes.length === 2) score = 6;
  else if (uniqueTypes.length === 1) score = 4;
  else score = 0;

  const recommendations = [];
  if (uniqueTypes.length < 2) {
    recommendations.push("Try mixing text posts with images and videos");
  } else if (uniqueTypes.length < 3) {
    recommendations.push("Experiment with different content formats like carousels and articles");
  } else if (uniqueTypes.length < 4) {
    recommendations.push("Great diversity! Consider adding video content for even better engagement");
  } else {
    recommendations.push("Excellent content diversity! You're using multiple formats effectively");
  }

  return {
    score,
    mediaTypes: uniqueTypes,
    typeBreakdown,
    diversityRatio: Math.round(diversityRatio * 100) / 100,
    recommendations,
  };
}

async function analyzePostingConsistency(memberShareSnapshot) {
  const posts = memberShareSnapshot?.elements?.[0]?.snapshotData || [];
  
  if (posts.length === 0) {
    return {
      score: 0,
      consistencyScore: 0,
      avgGapDays: 0,
      recommendations: ["Establish a consistent posting schedule"],
    };
  }

  const postDates = posts
    .map(post => new Date(post.Date || post.date))
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (postDates.length < 2) {
    return {
      score: 5,
      consistencyScore: 0,
      avgGapDays: 0,
      recommendations: ["Post more frequently to establish consistency"],
    };
  }

  const gaps = [];
  for (let i = 1; i < postDates.length; i++) {
    const gap = (postDates[i].getTime() - postDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
    gaps.push(gap);
  }

  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  
  let consistency = 0;
  if (avgGap <= 3) consistency = 1.0;
  else if (avgGap <= 7) consistency = 0.9;
  else if (avgGap <= 10) consistency = 0.8;
  else if (avgGap <= 14) consistency = 0.7;
  else if (avgGap <= 21) consistency = 0.5;
  else if (avgGap <= 30) consistency = 0.3;
  else consistency = 0.1;

  const score = Math.round(consistency * 10);

  const recommendations = [];
  if (avgGap > 30) recommendations.push("Try to post at least once a month");
  else if (avgGap > 14) recommendations.push("Aim for posting every 1-2 weeks");
  else if (avgGap > 7) recommendations.push("Great consistency! Try for weekly posting");
  else recommendations.push("Excellent posting consistency! Keep up the regular schedule");

  return {
    score,
    consistencyScore: Math.round(consistency * 100),
    avgGapDays: Math.round(avgGap * 10) / 10,
    recommendations,
  };
}