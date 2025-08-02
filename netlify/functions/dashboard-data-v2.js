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
    console.log("Dashboard V2: Starting comprehensive analysis");
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

    // Fetch required snapshot domains
    const [profileSnapshot, memberShareSnapshot] = await Promise.all([
      fetchMemberSnapshot(authorization, "PROFILE"),
      fetchMemberSnapshot(authorization, "MEMBER_SHARE_INFO")
    ]);

    // Analyze each metric with real data
    const profileAnalysis = await analyzeProfileCompleteness(profileSnapshot);
    const postingAnalysis = await analyzePostingActivity(memberShareSnapshot);
    const engagementAnalysis = await analyzeEngagementQuality(memberShareSnapshot);
    const contentImpactAnalysis = await analyzeContentImpact(memberShareSnapshot);
    const contentDiversityAnalysis = await analyzeContentDiversity(memberShareSnapshot);
    const consistencyAnalysis = await analyzePostingConsistency(memberShareSnapshot);

    // Generate AI insights for each metric
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const [
          profileAI,
          postingAI,
          engagementAI,
          impactAI,
          diversityAI,
          consistencyAI
        ] = await Promise.all([
          generateAIInsight('profileCompleteness', profileAnalysis, openaiKey),
          generateAIInsight('postingActivity', postingAnalysis, openaiKey),
          generateAIInsight('engagementQuality', engagementAnalysis, openaiKey),
          generateAIInsight('contentImpact', contentImpactAnalysis, openaiKey),
          generateAIInsight('contentDiversity', contentDiversityAnalysis, openaiKey),
          generateAIInsight('postingConsistency', consistencyAnalysis, openaiKey)
        ]);

        profileAnalysis.aiInsight = profileAI;
        postingAnalysis.aiInsight = postingAI;
        engagementAnalysis.aiInsight = engagementAI;
        contentImpactAnalysis.aiInsight = impactAI;
        contentDiversityAnalysis.aiInsight = diversityAI;
        consistencyAnalysis.aiInsight = consistencyAI;
      } catch (aiError) {
        console.error("AI insight generation failed:", aiError);
      }
    }

    // Calculate overall score
    const validScores = [
      profileAnalysis.score,
      postingAnalysis.score,
      engagementAnalysis.score,
      contentImpactAnalysis.score,
      contentDiversityAnalysis.score,
      consistencyAnalysis.score
    ].filter(score => score !== null && score !== undefined);

    const overallScore = validScores.length > 0 
      ? Math.round((validScores.reduce((sum, score) => sum + score, 0) / validScores.length) * 10) / 10
      : 0;

    // Calculate summary metrics
    const posts = memberShareSnapshot?.elements?.[0]?.snapshotData || [];
    const totalConnections = await getTotalConnections(authorization);
    
    const result = {
      scores: {
        overall: overallScore,
        profileCompleteness: profileAnalysis.score,
        postingActivity: postingAnalysis.score,
        engagementQuality: engagementAnalysis.score,
        contentImpact: contentImpactAnalysis.score,
        contentDiversity: contentDiversityAnalysis.score,
        postingConsistency: consistencyAnalysis.score,
      },
      analysis: {
        profileCompleteness: profileAnalysis,
        postingActivity: postingAnalysis,
        engagementQuality: engagementAnalysis,
        contentImpact: contentImpactAnalysis,
        contentDiversity: contentDiversityAnalysis,
        postingConsistency: consistencyAnalysis,
      },
      summary: {
        totalConnections,
        totalPosts: posts.length,
        avgEngagementPerPost: engagementAnalysis.avgEngagementPerPost,
        postsPerWeek: postingAnalysis.postsPerWeek,
      },
      metadata: {
        fetchTimeMs: Date.now() - startTime,
        dataSource: "snapshot_v2",
        hasRecentActivity: posts.length > 0,
        profileDataAvailable: !!profileSnapshot?.elements?.[0]?.snapshotData,
        postsDataAvailable: !!memberShareSnapshot?.elements?.[0]?.snapshotData,
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
    console.error("Dashboard V2 Error:", error);
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

async function analyzeProfileCompleteness(profileSnapshot) {
  const profile = profileSnapshot?.elements?.[0]?.snapshotData?.[0] || {};
  
  const breakdown = {
    basicInfo: 0,
    headline: 0,
    summary: 0,
    experience: 0,
    skills: 0
  };

  // Basic Info (20 points)
  if (profile["First Name"] && profile["Last Name"]) breakdown.basicInfo += 10;
  if (profile["Industry"] && profile["Industry"].trim()) breakdown.basicInfo += 5;
  if (profile["Location"] && profile["Location"].trim()) breakdown.basicInfo += 5;

  // Headline (20 points)
  if (profile["Headline"] && profile["Headline"].trim()) {
    const headlineLength = profile["Headline"].length;
    if (headlineLength > 50) breakdown.headline = 20;
    else if (headlineLength > 20) breakdown.headline = 15;
    else breakdown.headline = 10;
  }

  // Summary (20 points)
  if (profile["Summary"] && profile["Summary"].trim()) {
    const summaryLength = profile["Summary"].length;
    if (summaryLength > 200) breakdown.summary = 20;
    else if (summaryLength > 100) breakdown.summary = 15;
    else breakdown.summary = 10;
  }

  // Experience (20 points)
  if (profile["Current Position"] || profile["Position"]) breakdown.experience += 10;
  if (profile["Company"] || profile["Current Company"]) breakdown.experience += 10;

  // Skills (20 points)
  if (profile["Skills"] || profile["Top Skills"]) breakdown.skills = 20;

  const totalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  const score = Math.round((totalScore / 100) * 10 * 10) / 10;

  const recommendations = [];
  if (breakdown.headline < 15) recommendations.push("Improve your headline with specific skills and value proposition");
  if (breakdown.summary < 15) recommendations.push("Add a compelling summary that tells your professional story");
  if (breakdown.experience < 15) recommendations.push("Complete your work experience section");
  if (breakdown.skills < 15) recommendations.push("Add relevant skills to showcase your expertise");

  return {
    score: Math.min(score, 10),
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

  // Calculate posts per week based on date range
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

  // Scoring based on posts per week
  let score = 0;
  if (postsPerWeek >= 5) score = 10;
  else if (postsPerWeek >= 3) score = 8;
  else if (postsPerWeek >= 1) score = 6;
  else if (postsPerWeek >= 0.5) score = 4;
  else score = 2;

  const recommendations = [];
  if (postsPerWeek < 1) recommendations.push("Aim for at least 1 post per week to maintain visibility");
  if (postsPerWeek < 3) recommendations.push("Increase to 3-5 posts per week for optimal engagement");
  if (postsPerWeek > 7) recommendations.push("Consider reducing frequency to avoid audience fatigue");

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

  posts.forEach(post => {
    const likes = parseInt(post.LikesCount || post.likesCount || "0");
    const comments = parseInt(post.CommentsCount || post.commentsCount || "0");
    const engagement = likes + comments;
    
    totalEngagement += engagement;
    if (engagement > 0) postsWithEngagement++;
  });

  const avgEngagementPerPost = totalEngagement / posts.length;

  // Scoring based on average engagement
  let score = 0;
  if (avgEngagementPerPost >= 50) score = 10;
  else if (avgEngagementPerPost >= 20) score = 8;
  else if (avgEngagementPerPost >= 10) score = 6;
  else if (avgEngagementPerPost >= 5) score = 4;
  else if (avgEngagementPerPost > 0) score = 2;
  else score = 0;

  const recommendations = [];
  if (avgEngagementPerPost < 5) recommendations.push("Focus on creating more engaging content that sparks conversation");
  if (avgEngagementPerPost < 10) recommendations.push("Ask questions in your posts to encourage comments");
  if (postsWithEngagement / posts.length < 0.5) recommendations.push("Ensure every post provides value to your audience");

  return {
    score,
    avgEngagementPerPost: Math.round(avgEngagementPerPost * 10) / 10,
    totalEngagement,
    recommendations,
  };
}

async function analyzeContentImpact(memberShareSnapshot) {
  const posts = memberShareSnapshot?.elements?.[0]?.snapshotData || [];
  const engagementThreshold = 10;
  
  if (posts.length === 0) {
    return {
      score: 0,
      highEngagementPosts: 0,
      engagementThreshold,
      recommendations: ["Create content that generates meaningful engagement"],
    };
  }

  const highEngagementPosts = posts.filter(post => {
    const likes = parseInt(post.LikesCount || "0");
    const comments = parseInt(post.CommentsCount || "0");
    return (likes + comments) >= engagementThreshold;
  }).length;

  const impactRatio = highEngagementPosts / posts.length;
  const score = Math.min(impactRatio * 10, 10);

  const recommendations = [];
  if (impactRatio < 0.2) recommendations.push("Focus on creating content that resonates with your audience");
  if (impactRatio < 0.5) recommendations.push("Analyze your high-performing posts and create similar content");

  return {
    score: Math.round(score * 10) / 10,
    highEngagementPosts,
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
  posts.forEach(post => {
    const mediaType = post.MediaType || post.mediaType || "TEXT";
    mediaTypes.add(mediaType);
  });

  const uniqueTypes = Array.from(mediaTypes);
  const diversityRatio = uniqueTypes.length / Math.min(posts.length, 5);
  const score = Math.min(diversityRatio * 10, 10);

  const recommendations = [];
  if (uniqueTypes.length < 2) recommendations.push("Try mixing text posts with images and videos");
  if (uniqueTypes.length < 3) recommendations.push("Experiment with different content formats like carousels and articles");
  if (!uniqueTypes.includes("IMAGE")) recommendations.push("Add visual content to increase engagement");

  return {
    score: Math.round(score * 10) / 10,
    mediaTypes: uniqueTypes,
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
      longestStreak: 0,
      recommendations: ["Establish a consistent posting schedule"],
    };
  }

  const postDates = posts
    .map(post => new Date(post.Date || post.date))
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (postDates.length < 2) {
    return {
      score: 2,
      consistencyScore: 0,
      longestStreak: 1,
      recommendations: ["Post more frequently to establish consistency"],
    };
  }

  // Calculate gaps between posts
  const gaps = [];
  for (let i = 1; i < postDates.length; i++) {
    const gap = (postDates[i].getTime() - postDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
    gaps.push(gap);
  }

  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const consistency = Math.max(0, 1 - (avgGap / 14));
  const score = Math.min(consistency * 10, 10);

  const recommendations = [];
  if (avgGap > 14) recommendations.push("Try to post at least every 2 weeks");
  if (avgGap > 7) recommendations.push("Aim for weekly posting to maintain audience engagement");
  if (consistency > 0.8) recommendations.push("Great consistency! Keep up the regular posting schedule");

  return {
    score: Math.round(score * 10) / 10,
    consistencyScore: Math.round(consistency * 100) / 100,
    longestStreak: Math.max(...gaps.map(gap => Math.floor(7 / gap))),
    recommendations,
  };
}

async function getTotalConnections(authorization) {
  try {
    const response = await fetch("https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=CONNECTIONS", {
      headers: {
        Authorization: authorization,
        "LinkedIn-Version": "202312"
      }
    });

    if (!response.ok) return 0;

    const data = await response.json();
    return data.elements?.[0]?.snapshotData?.length || 0;
  } catch (error) {
    console.error("Error fetching connections:", error);
    return 0;
  }
}

async function generateAIInsight(metric, data, openaiKey) {
  try {
    const prompt = getPromptForMetric(metric, data);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a LinkedIn growth expert. Provide concise, actionable insights based on user data. Keep responses under 100 words and focus on specific improvements.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.choices[0]?.message?.content || `${metric} shows room for improvement. Focus on consistent growth.`;
  } catch (error) {
    console.error('Error generating AI insight:', error);
    return `${metric} analysis: Continue focusing on improvement and consistency.`;
  }
}

function getPromptForMetric(metric, data) {
  switch (metric) {
    case 'profileCompleteness':
      return `Analyze this LinkedIn profile completeness data and provide specific improvement advice:
      Score: ${data.score}/10
      Breakdown: ${JSON.stringify(data.breakdown)}
      What should they focus on first?`;
      
    case 'postingActivity':
      return `Analyze this LinkedIn posting activity and suggest improvements:
      Posts per week: ${data.postsPerWeek}
      Total posts: ${data.totalPosts}
      Score: ${data.score}/10
      What's the optimal posting strategy?`;
      
    case 'engagementQuality':
      return `Analyze this LinkedIn engagement data and suggest content improvements:
      Average engagement per post: ${data.avgEngagementPerPost}
      Total engagement: ${data.totalEngagement}
      Score: ${data.score}/10
      How can they increase engagement?`;
      
    case 'contentImpact':
      return `Analyze this content impact data:
      High engagement posts: ${data.highEngagementPosts}
      Score: ${data.score}/10
      How can they create more impactful content?`;
      
    case 'contentDiversity':
      return `Analyze this content diversity data:
      Media types used: ${data.mediaTypes.join(', ')}
      Diversity ratio: ${data.diversityRatio}
      Score: ${data.score}/10
      What content formats should they try?`;
      
    case 'postingConsistency':
      return `Analyze this posting consistency data:
      Consistency score: ${data.consistencyScore}
      Score: ${data.score}/10
      How can they improve posting consistency?`;
      
    default:
      return `Analyze this LinkedIn metric data: ${JSON.stringify(data)}`;
  }
}