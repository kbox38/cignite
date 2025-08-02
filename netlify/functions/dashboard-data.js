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
    console.log("Dashboard V3: Starting accurate analysis with improved scoring");
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
    const [profileSnapshot, memberShareSnapshot, connectionsSnapshot] = await Promise.all([
      fetchMemberSnapshot(authorization, "PROFILE"),
      fetchMemberSnapshot(authorization, "MEMBER_SHARE_INFO"),
      fetchMemberSnapshot(authorization, "CONNECTIONS")
    ]);

    // Analyze each metric with improved accuracy
    const profileAnalysis = await analyzeProfileCompleteness(profileSnapshot);
    const postingAnalysis = await analyzePostingActivity(memberShareSnapshot);
    const engagementAnalysis = await analyzeEngagementQuality(memberShareSnapshot);
    const contentImpactAnalysis = await analyzeContentImpact(memberShareSnapshot);
    const contentDiversityAnalysis = await analyzeContentDiversity(memberShareSnapshot);
    const consistencyAnalysis = await analyzePostingConsistency(memberShareSnapshot);

    // Generate AI insights for each metric
    const openaiKey = process.env.VITE_OPENAI_API_KEY;
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
    const connections = connectionsSnapshot?.elements?.[0]?.snapshotData || [];
    
    // Calculate 28-day metrics
    const last28Days = new Date();
    last28Days.setDate(last28Days.getDate() - 28);
    
    const recentPosts = posts.filter(post => {
      const postDate = new Date(post.Date || post.date);
      return postDate >= last28Days;
    });

    const totalEngagement = posts.reduce((sum, post) => {
      return sum + parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0");
    }, 0);

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
        totalConnections: connections.length,
        totalPosts: posts.length,
        posts30d: recentPosts.length,
        avgEngagementPerPost: posts.length > 0 ? Math.round((totalEngagement / posts.length) * 10) / 10 : 0,
        postsPerWeek: postingAnalysis.postsPerWeek,
        engagementRatePct: posts.length > 0 ? Math.round((totalEngagement / posts.length) * 100) / 100 : 0,
        newConnections28d: Math.min(Math.round(recentPosts.length * 0.5), 10), // Estimate
      },
      metadata: {
        fetchTimeMs: Date.now() - startTime,
        dataSource: "snapshot_v3",
        hasRecentActivity: posts.length > 0,
        profileDataAvailable: !!profileSnapshot?.elements?.[0]?.snapshotData,
        postsDataAvailable: !!memberShareSnapshot?.elements?.[0]?.snapshotData,
        connectionsDataAvailable: !!connectionsSnapshot?.elements?.[0]?.snapshotData,
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
    console.error("Dashboard V3 Error:", error);
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
  
  console.log("Profile Completeness Analysis - Raw profile data:", profile);
  
  let score = 0;
  const breakdown = {
    basicInfo: 0,
    headline: 0,
    summary: 0,
    experience: 0,
    skills: 0
  };

  // Basic Info (25 points) - More generous scoring
  if (profile["First Name"] && profile["Last Name"]) {
    breakdown.basicInfo += 15; // Increased from 8
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

  // Headline (25 points) - More generous
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

  // Summary (20 points) - More generous
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

  // Experience (15 points) - Infer from available data
  if (profile["Current Position"] || profile["Position"] || profile["Headline"]) {
    breakdown.experience += 10;
    score += 10;
  }
  if (profile["Company"] || profile["Current Company"]) {
    breakdown.experience += 5;
    score += 5;
  }

  // Skills (15 points) - Estimate from other indicators
  if (profile["Skills"] || profile["Top Skills"]) {
    breakdown.skills = 15;
    score += 15;
  } else if (profile["Industry"] && profile["Headline"]) {
    // If we have industry and headline, assume some skills are present
    breakdown.skills = 10;
    score += 10;
  }

  // Convert to 0-10 scale with minimum of 4 for profiles with basic info
  const finalScore = Math.max(Math.min(score / 10, 10), profile["First Name"] ? 4 : 0);

  const recommendations = [];
  if (breakdown.headline < 20) recommendations.push("Enhance your headline with specific skills and value proposition");
  if (breakdown.summary < 15) recommendations.push("Add a compelling summary that tells your professional story");
  if (breakdown.experience < 10) recommendations.push("Complete your work experience section");
  if (breakdown.skills < 10) recommendations.push("Add relevant skills to showcase your expertise");
  if (finalScore >= 8) recommendations.push("Excellent profile! Your LinkedIn presence is well-optimized");

  console.log("Profile Completeness Result:", {
    finalScore,
    breakdown,
    totalRawScore: score,
    recommendations
  });

  return {
    score: Math.round(finalScore * 10) / 10,
    breakdown,
    totalScore: score,
    completionPercentage: Math.round((score / 100) * 100),
    recommendations,
  };
}

async function analyzePostingActivity(memberShareSnapshot) {
  const posts = memberShareSnapshot?.elements?.[0]?.snapshotData || [];
  const totalPosts = posts.length;

  console.log("Posting Activity Analysis - Total posts:", totalPosts);

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

  // More generous scoring based on posts per week
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

  console.log("Posting Activity Result:", {
    score,
    postsPerWeek: Math.round(postsPerWeek * 10) / 10,
    totalPosts,
    daysDiff,
    recommendations
  });

  return {
    score,
    postsPerWeek: Math.round(postsPerWeek * 10) / 10,
    totalPosts,
    recommendations,
  };
}

async function analyzeEngagementQuality(memberShareSnapshot) {
  const posts = memberShareSnapshot?.elements?.[0]?.snapshotData || [];
  
  console.log("Engagement Quality Analysis - Posts count:", posts.length);

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
    // Try multiple field name variations for likes and comments
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
    
    if (index < 5) {
      console.log(`Post ${index + 1} engagement:`, {
        likes,
        comments,
        total: engagement,
        availableFields: Object.keys(post)
      });
    }
    
    totalEngagement += engagement;
    if (engagement > 0) postsWithEngagement++;
  });

  const avgEngagementPerPost = totalEngagement / posts.length;

  // More realistic scoring based on LinkedIn engagement rates
  let score = 0;
  if (avgEngagementPerPost >= 25) score = 10;      // Excellent
  else if (avgEngagementPerPost >= 15) score = 9;  // Very good
  else if (avgEngagementPerPost >= 10) score = 8;  // Good
  else if (avgEngagementPerPost >= 5) score = 7;   // Above average
  else if (avgEngagementPerPost >= 3) score = 6;   // Average
  else if (avgEngagementPerPost >= 1) score = 5;   // Below average
  else if (avgEngagementPerPost > 0) score = 4;    // Low but present
  else score = 0;                                  // No engagement

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

  console.log("Engagement Quality Result:", {
    score,
    avgEngagementPerPost: Math.round(avgEngagementPerPost * 10) / 10,
    totalEngagement,
    postsWithEngagement,
    recommendations
  });

  return {
    score,
    avgEngagementPerPost: Math.round(avgEngagementPerPost * 10) / 10,
    totalEngagement,
    recommendations,
  };
}

async function analyzeContentImpact(memberShareSnapshot) {
  const posts = memberShareSnapshot?.elements?.[0]?.snapshotData || [];
  const engagementThreshold = 5; // Lowered from 10 for more realistic assessment
  
  console.log("Content Impact Analysis - Posts count:", posts.length);

  if (posts.length === 0) {
    return {
      score: 0,
      highEngagementPosts: 0,
      engagementThreshold,
      recommendations: ["Create content that generates meaningful engagement"],
    };
  }

  const highEngagementPosts = posts.filter(post => {
    const likes = parseInt(
      post.LikesCount || 
      post["Likes Count"] || 
      post.likesCount || 
      "0"
    );
    const comments = parseInt(
      post.CommentsCount || 
      post["Comments Count"] || 
      post.commentsCount || 
      "0"
    );
    return (likes + comments) >= engagementThreshold;
  }).length;

  const impactRatio = highEngagementPosts / posts.length;
  
  // More generous scoring
  let score = 0;
  if (impactRatio >= 0.7) score = 10;      // 70%+ high-engagement posts
  else if (impactRatio >= 0.5) score = 9;  // 50%+ high-engagement posts
  else if (impactRatio >= 0.3) score = 8;  // 30%+ high-engagement posts
  else if (impactRatio >= 0.2) score = 7;  // 20%+ high-engagement posts
  else if (impactRatio >= 0.1) score = 6;  // 10%+ high-engagement posts
  else if (impactRatio > 0) score = 5;     // Some high-engagement posts
  else score = 0;                          // No high-engagement posts

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

  console.log("Content Impact Result:", {
    score,
    highEngagementPosts,
    impactRatio: Math.round(impactRatio * 100),
    engagementThreshold,
    recommendations
  });

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
  
  console.log("Content Diversity Analysis - Posts count:", posts.length);

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
    // Enhanced media type detection
    let mediaType = post.MediaType || post["Media Type"] || post.mediaType;
    
    // If no explicit media type, infer from other fields
    if (!mediaType || mediaType === "NONE") {
      if (post.MediaUrl || post["Media URL"] || post.mediaUrl) {
        mediaType = "IMAGE"; // Assume image if media URL exists
      } else if (post.SharedUrl || post["Shared URL"] || post.sharedUrl) {
        mediaType = "ARTICLE"; // Assume article if shared URL exists
      } else {
        mediaType = "TEXT";
      }
    }
    
    mediaTypes.add(mediaType);
    typeBreakdown[mediaType] = (typeBreakdown[mediaType] || 0) + 1;
    
    if (index < 5) {
      console.log(`Post ${index + 1} media type:`, {
        detected: mediaType,
        originalMediaType: post.MediaType,
        hasMediaUrl: !!(post.MediaUrl || post["Media URL"]),
        hasSharedUrl: !!(post.SharedUrl || post["Shared URL"]),
        availableFields: Object.keys(post)
      });
    }
  });

  const uniqueTypes = Array.from(mediaTypes);
  const diversityRatio = uniqueTypes.length / Math.min(posts.length, 4); // Max 4 expected types

  // More generous scoring for content diversity
  let score = 0;
  if (uniqueTypes.length >= 4) score = 10;      // 4+ different types
  else if (uniqueTypes.length === 3) score = 8; // 3 different types
  else if (uniqueTypes.length === 2) score = 6; // 2 different types
  else if (uniqueTypes.length === 1) score = 4; // Only 1 type
  else score = 0;                               // No posts

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

  console.log("Content Diversity Result:", {
    score,
    uniqueTypes,
    typeBreakdown,
    diversityRatio: Math.round(diversityRatio * 100),
    recommendations
  });

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
  
  console.log("Posting Consistency Analysis - Posts count:", posts.length);

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
      score: 5, // Give some credit for having posts
      consistencyScore: 0,
      avgGapDays: 0,
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
  
  // More generous consistency scoring
  let consistency = 0;
  if (avgGap <= 3) consistency = 1.0;        // Every 3 days or less
  else if (avgGap <= 7) consistency = 0.9;   // Weekly
  else if (avgGap <= 10) consistency = 0.8;  // Every 10 days
  else if (avgGap <= 14) consistency = 0.7;  // Bi-weekly
  else if (avgGap <= 21) consistency = 0.5;  // Every 3 weeks
  else if (avgGap <= 30) consistency = 0.3;  // Monthly
  else consistency = 0.1;                    // Less than monthly

  const score = Math.round(consistency * 10);

  const recommendations = [];
  if (avgGap > 30) recommendations.push("Try to post at least once a month");
  else if (avgGap > 14) recommendations.push("Aim for posting every 1-2 weeks");
  else if (avgGap > 7) recommendations.push("Great consistency! Try for weekly posting");
  else recommendations.push("Excellent posting consistency! Keep up the regular schedule");

  console.log("Posting Consistency Result:", {
    score,
    consistency: Math.round(consistency * 100),
    avgGap: Math.round(avgGap * 10) / 10,
    recommendations
  });

  return {
    score,
    consistencyScore: Math.round(consistency * 100),
    avgGapDays: Math.round(avgGap * 10) / 10,
    recommendations,
  };
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
      Completion: ${data.completionPercentage}%
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
      Impact ratio: ${data.impactRatio * 100}%
      Score: ${data.score}/10
      How can they create more impactful content?`;
      
    case 'contentDiversity':
      return `Analyze this content diversity data:
      Media types used: ${data.mediaTypes.join(', ')}
      Type breakdown: ${JSON.stringify(data.typeBreakdown)}
      Score: ${data.score}/10
      What content formats should they try?`;
      
    case 'postingConsistency':
      return `Analyze this posting consistency data:
      Consistency score: ${data.consistencyScore}%
      Average gap: ${data.avgGapDays} days
      Score: ${data.score}/10
      How can they improve posting consistency?`;
      
    default:
      return `Analyze this LinkedIn metric data: ${JSON.stringify(data)}`;
  }
}