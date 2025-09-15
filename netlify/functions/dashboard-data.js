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
    console.log("Dashboard: Starting comprehensive DMA analysis");
    const startTime = Date.now();

    // Verify DMA consent first
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

    // Fetch all required DMA domains with proper error handling
    const [profileSnapshot, memberShareSnapshot, connectionsSnapshot, skillsSnapshot, positionsSnapshot, educationSnapshot] = await Promise.allSettled([
      fetchMemberSnapshot(authorization, "PROFILE"),
      fetchMemberSnapshot(authorization, "MEMBER_SHARE_INFO"),
      fetchMemberSnapshot(authorization, "CONNECTIONS"),
      fetchMemberSnapshot(authorization, "SKILLS"),
      fetchMemberSnapshot(authorization, "POSITIONS"),
      fetchMemberSnapshot(authorization, "EDUCATION")
    ]);

    // Extract data safely from settled promises
    const profile = profileSnapshot.status === 'fulfilled' ? profileSnapshot.value?.elements?.[0]?.snapshotData || [] : [];
    const posts = memberShareSnapshot.status === 'fulfilled' ? memberShareSnapshot.value?.elements?.[0]?.snapshotData || [] : [];
    const connections = connectionsSnapshot.status === 'fulfilled' ? connectionsSnapshot.value?.elements?.[0]?.snapshotData || [] : [];
    const skills = skillsSnapshot.status === 'fulfilled' ? skillsSnapshot.value?.elements?.[0]?.snapshotData || [] : [];
    const positions = positionsSnapshot.status === 'fulfilled' ? positionsSnapshot.value?.elements?.[0]?.snapshotData || [] : [];
    const education = educationSnapshot.status === 'fulfilled' ? educationSnapshot.value?.elements?.[0]?.snapshotData || [] : [];

    console.log(`Dashboard: Data extracted - Profile: ${profile.length}, Posts: ${posts.length}, Connections: ${connections.length}, Skills: ${skills.length}, Positions: ${positions.length}, Education: ${education.length}`);

    // Calculate comprehensive analytics
    const profileAnalysis = analyzeProfileCompleteness(profile, skills, positions, education);
    const postingAnalysis = analyzePostingActivity(posts);
    const engagementAnalysis = analyzeEngagementQuality(posts);
    const contentImpactAnalysis = analyzeContentImpact(posts);
    const contentDiversityScore = calculateContentDiversity(posts);
    const consistencyScore = calculatePostingConsistency(posts);

    // Calculate overall score
    const validScores = [
      profileAnalysis.score,
      postingAnalysis.score,
      engagementAnalysis.score,
      contentImpactAnalysis.score,
      contentDiversityScore,
      consistencyScore
    ].filter(score => score > 0);

    const overallScore = validScores.length > 0 
      ? Math.round((validScores.reduce((sum, score) => sum + score, 0) / validScores.length) * 10) / 10
      : 0;

    // Build comprehensive dashboard data
    const dashboardData = {
      scores: {
        overall: overallScore,
        profileCompleteness: profileAnalysis.score,
        postingActivity: postingAnalysis.score,
        engagementQuality: engagementAnalysis.score,
        contentImpact: contentImpactAnalysis.score,
        contentDiversity: contentDiversityScore,
        postingConsistency: consistencyScore,
      },
      analysis: {
        profileCompleteness: profileAnalysis,
        postingActivity: postingAnalysis,
        engagementQuality: engagementAnalysis,
        contentImpact: contentImpactAnalysis,
        contentDiversity: { 
          score: contentDiversityScore, 
          recommendations: getContentDiversityRecommendations(posts) 
        },
        postingConsistency: { 
          score: consistencyScore, 
          recommendations: getPostingConsistencyRecommendations(posts) 
        },
      },
      summary: {
        totalConnections: connections.length,
        totalPosts: posts.length,
        avgEngagementPerPost: engagementAnalysis.avgEngagementPerPost,
        postsPerWeek: postingAnalysis.postsPerWeek,
        newConnections28d: calculateRecentConnections(connections),
      },
      metadata: {
        fetchTimeMs: Date.now() - startTime,
        dataSource: "linkedin_dma_api",
        hasRecentActivity: true, // Always show dashboard
        profileDataAvailable: profile.length > 0,
        postsDataAvailable: posts.length > 0,
        connectionsDataAvailable: connections.length > 0,
        skillsDataAvailable: skills.length > 0,
        positionsDataAvailable: positions.length > 0,
        postsCount: posts.length,
        connectionsCount: connections.length,
        skillsCount: skills.length,
        positionsCount: positions.length
      },
      lastUpdated: new Date().toISOString()
    };

    console.log("Dashboard: Analysis complete", {
      overallScore,
      profileScore: profileAnalysis.score,
      postsCount: posts.length,
      connectionsCount: connections.length,
      skillsCount: skills.length,
      positionsCount: positions.length
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
    console.error("Dashboard Error Stack:", error.stack);
    
    // Return safe fallback data to prevent 502 errors
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
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
          profileCompleteness: { score: 0, recommendations: ["Error loading profile data"] },
          postingActivity: { score: 0, recommendations: ["Error loading posting data"] },
          engagementQuality: { score: 0, recommendations: ["Error loading engagement data"] },
          contentImpact: { score: 0, recommendations: ["Error loading content data"] },
          contentDiversity: { score: 0, recommendations: ["Error loading diversity data"] },
          postingConsistency: { score: 0, recommendations: ["Error loading consistency data"] },
        },
        summary: {
          totalConnections: 0,
          totalPosts: 0,
          avgEngagementPerPost: 0,
          postsPerWeek: 0,
          newConnections28d: 0,
        },
        metadata: {
          fetchTimeMs: Date.now() - startTime,
          dataSource: "error_fallback",
          hasRecentActivity: true,
          profileDataAvailable: false,
          postsDataAvailable: false,
          connectionsDataAvailable: false,
          error: error.message
        },
        lastUpdated: new Date().toISOString(),
        error: error.message
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
    console.log(`Dashboard: Fetching snapshot for domain: ${domain}`);
    const response = await fetch(`https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=${domain}`, {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      console.warn(`Dashboard: Snapshot API for ${domain} returned ${response.status}`);
      throw new Error(`Snapshot API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Dashboard: ${domain} snapshot data:`, {
      hasElements: !!data.elements,
      elementsLength: data.elements?.length,
      snapshotDataLength: data.elements?.[0]?.snapshotData?.length
    });
    return data;
  } catch (error) {
    console.error(`Dashboard: Error fetching ${domain} snapshot:`, error);
    throw error;
  }
}

function analyzeProfileCompleteness(profileData, skillsData, positionsData, educationData) {
  console.log("Dashboard: Analyzing profile completeness", {
    profileItems: profileData.length,
    skillsItems: skillsData.length,
    positionsItems: positionsData.length,
    educationItems: educationData.length
  });

  if (!profileData || profileData.length === 0) {
    return {
      score: 0,
      breakdown: { basicInfo: 0, headline: 0, summary: 0, experience: 0, skills: 0 },
      recommendations: ["Complete your LinkedIn profile to improve visibility"],
    };
  }

  // Find the main profile object with basic info
  const profile = profileData.find(item => 
    item['First Name'] || item['Last Name'] || item['Headline'] || item['Summary']
  ) || profileData[0] || {};
  
  console.log("Dashboard: Main profile object keys:", Object.keys(profile));

  const breakdown = {
    basicInfo: 0,
    headline: 0,
    summary: 0,
    experience: 0,
    skills: 0
  };

  // Basic Info (20 points)
  if (profile['First Name'] && profile['Last Name']) breakdown.basicInfo += 8;
  if (profile['Industry'] && profile['Industry'].trim()) breakdown.basicInfo += 6;
  if (profile['Location'] && profile['Location'].trim()) breakdown.basicInfo += 6;

  // Professional Headline (20 points)
  if (profile['Headline'] && profile['Headline'].trim()) {
    const headlineLength = profile['Headline'].length;
    if (headlineLength > 80) breakdown.headline = 20;
    else if (headlineLength > 50) breakdown.headline = 15;
    else if (headlineLength > 20) breakdown.headline = 10;
    else breakdown.headline = 5;
  }

  // Summary/About Section (20 points)
  if (profile['Summary'] && profile['Summary'].trim()) {
    const summaryLength = profile['Summary'].length;
    if (summaryLength > 300) breakdown.summary = 20;
    else if (summaryLength > 150) breakdown.summary = 15;
    else if (summaryLength > 50) breakdown.summary = 10;
    else breakdown.summary = 5;
  }

  // Experience (20 points) - Use POSITIONS domain data
  const positionsCount = positionsData.length;
  console.log("Dashboard: Positions count:", positionsCount);
  
  if (positionsCount >= 3) breakdown.experience = 20;
  else if (positionsCount >= 2) breakdown.experience = 15;
  else if (positionsCount >= 1) breakdown.experience = 10;
  else {
    // Fallback: check profile data for experience indicators
    const hasExperienceInProfile = profileData.some(item => 
      item['Position'] || item['Company'] || item['Current Position'] || 
      item['Current Company'] || item['Job Title'] || item['Employer']
    );
    if (hasExperienceInProfile) breakdown.experience = 10;
  }

  // Skills (20 points) - Use SKILLS domain data
  const skillsCount = skillsData.length;
  console.log("Dashboard: Skills count:", skillsCount);
  
  if (skillsCount >= 10) breakdown.skills = 20;
  else if (skillsCount >= 5) breakdown.skills = 15;
  else if (skillsCount >= 3) breakdown.skills = 10;
  else if (skillsCount >= 1) breakdown.skills = 5;
  else {
    // Fallback: check profile data for skills indicators
    const hasSkillsInProfile = profileData.some(item => 
      item['Skills'] || item['Top Skills'] || item['Skill'] || 
      Object.keys(item).some(key => key.toLowerCase().includes('skill'))
    );
    if (hasSkillsInProfile) breakdown.skills = 10;
  }

  const totalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  const finalScore = Math.min(totalScore, 100);

  console.log("Dashboard: Profile completeness breakdown:", breakdown, "Total:", finalScore);

  const recommendations = [];
  if (breakdown.basicInfo < 15) recommendations.push("Complete your basic profile information (name, location, industry)");
  if (breakdown.headline < 15) recommendations.push("Improve your headline with specific skills and value proposition");
  if (breakdown.summary < 15) recommendations.push("Add a compelling summary that tells your professional story");
  if (breakdown.experience < 15) recommendations.push(`Add more work experience (currently ${positionsCount} positions)`);
  if (breakdown.skills < 15) recommendations.push(`Add more skills to your profile (currently ${skillsCount} skills)`);

  if (recommendations.length === 0) {
    recommendations.push("Excellent profile! Your LinkedIn presence is well-optimized");
  }

  return {
    score: Math.round((finalScore / 100) * 10 * 10) / 10, // Convert to 0-10 scale
    breakdown,
    recommendations,
  };
}

function analyzePostingActivity(posts) {
  const totalPosts = posts.length;
  console.log("Dashboard: Analyzing posting activity for", totalPosts, "posts");

  if (totalPosts === 0) {
    return {
      score: 0,
      postsPerWeek: 0,
      totalPosts,
      recommendations: ["Start posting regularly to build your LinkedIn presence"],
    };
  }

  // Calculate posts per week based on date range
  const postDates = posts
    .map(post => {
      const dateStr = post.Date || post.date || post['Share Date'] || post.shareDate;
      return dateStr ? new Date(dateStr) : null;
    })
    .filter(date => date && !isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  console.log("Dashboard: Valid post dates:", postDates.length);

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

  console.log("Dashboard: Posting frequency calculation:", {
    totalPosts,
    daysDiff,
    postsPerWeek
  });

  // Scoring based on posts per week
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
  else recommendations.push("Great posting frequency!");

  return {
    score,
    postsPerWeek: Math.round(postsPerWeek * 10) / 10,
    totalPosts,
    recommendations,
  };
}

function analyzeEngagementQuality(posts) {
  console.log("Dashboard: Analyzing engagement quality for", posts.length, "posts");
  
  if (posts.length === 0) {
    return {
      score: 0,
      avgEngagementPerPost: 0,
      totalEngagement: 0,
      recommendations: ["Start creating content to build engagement"],
    };
  }

  let totalEngagement = 0;
  let postsWithEngagement = 0;

  posts.forEach(post => {
    const likes = parseInt(post.LikesCount || post["Likes Count"] || post.likes || "0") || 0;
    const comments = parseInt(post.CommentsCount || post["Comments Count"] || post.comments || "0") || 0;
    const engagement = likes + comments;
    
    totalEngagement += engagement;
    if (engagement > 0) postsWithEngagement++;
  });

  const avgEngagementPerPost = totalEngagement / posts.length;

  console.log("Dashboard: Engagement analysis:", {
    totalEngagement,
    avgEngagementPerPost,
    postsWithEngagement
  });

  // Scoring based on average engagement
  let score = 0;
  if (avgEngagementPerPost >= 50) score = 10;
  else if (avgEngagementPerPost >= 25) score = 9;
  else if (avgEngagementPerPost >= 15) score = 8;
  else if (avgEngagementPerPost >= 10) score = 7;
  else if (avgEngagementPerPost >= 5) score = 6;
  else if (avgEngagementPerPost >= 2) score = 5;
  else if (avgEngagementPerPost > 0) score = 4;
  else score = 0;

  const recommendations = [];
  if (avgEngagementPerPost === 0) recommendations.push("Start creating content to build engagement");
  else if (avgEngagementPerPost < 2) recommendations.push("Focus on creating more engaging content that sparks conversation");
  else if (avgEngagementPerPost < 10) recommendations.push("Good engagement! Try asking questions to increase interaction");
  else recommendations.push("Excellent engagement! Your content resonates well");

  return {
    score,
    avgEngagementPerPost: Math.round(avgEngagementPerPost * 10) / 10,
    totalEngagement,
    recommendations,
  };
}

function analyzeContentImpact(posts) {
  const engagementThreshold = 10; // Posts with 10+ engagements are high impact
  
  if (posts.length === 0) {
    return {
      score: 0,
      highEngagementPosts: 0,
      recommendations: ["Create content that generates meaningful engagement"],
    };
  }

  const highEngagementPosts = posts.filter(post => {
    const likes = parseInt(post.LikesCount || post["Likes Count"] || "0") || 0;
    const comments = parseInt(post.CommentsCount || post["Comments Count"] || "0") || 0;
    return (likes + comments) >= engagementThreshold;
  }).length;

  const impactRatio = highEngagementPosts / posts.length;
  const score = Math.min(impactRatio * 10, 10);

  const recommendations = [];
  if (impactRatio === 0) recommendations.push("Focus on creating content that resonates with your audience");
  else if (impactRatio < 0.3) recommendations.push("Analyze your high-performing posts and create similar content");
  else recommendations.push("Great content impact! Keep creating engaging posts");

  return {
    score: Math.round(score * 10) / 10,
    highEngagementPosts,
    impactRatio: Math.round(impactRatio * 100) / 100,
    recommendations,
  };
}

function calculateContentDiversity(posts) {
  if (posts.length === 0) return 0;
  
  const mediaTypes = new Set();
  posts.forEach(post => {
    const mediaType = post.MediaType || post.mediaType || post['Media Type'] || "TEXT";
    mediaTypes.add(mediaType);
  });
  
  // Score based on diversity (max 10 for 4+ different types)
  const diversityCount = mediaTypes.size;
  let score = 0;
  if (diversityCount >= 4) score = 10;
  else if (diversityCount >= 3) score = 8;
  else if (diversityCount >= 2) score = 6;
  else score = 3;
  
  console.log("Dashboard: Content diversity:", { diversityCount, score, types: Array.from(mediaTypes) });
  return score;
}

function calculatePostingConsistency(posts) {
  if (posts.length < 2) return 0;
  
  const postDates = posts
    .map(post => {
      const dateStr = post.Date || post.date || post['Share Date'] || post.shareDate;
      return dateStr ? new Date(dateStr) : null;
    })
    .filter(date => date && !isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
    
  if (postDates.length < 2) return 0;
  
  // Calculate gaps between posts
  const gaps = [];
  for (let i = 1; i < postDates.length; i++) {
    const gap = (postDates[i].getTime() - postDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
    gaps.push(gap);
  }
  
  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const consistency = Math.max(0, 1 - (avgGap / 14)); // Penalize gaps > 2 weeks
  const score = Math.round(consistency * 10);
  
  console.log("Dashboard: Posting consistency:", { avgGap, consistency, score });
  return score;
}

function getContentDiversityRecommendations(posts) {
  const mediaTypes = new Set();
  posts.forEach(post => {
    const mediaType = post.MediaType || post.mediaType || post['Media Type'] || "TEXT";
    mediaTypes.add(mediaType);
  });
  
  const recommendations = [];
  if (!mediaTypes.has("IMAGE")) recommendations.push("Add image posts to increase engagement");
  if (!mediaTypes.has("VIDEO")) recommendations.push("Try video content for higher reach");
  if (!mediaTypes.has("ARTICLE")) recommendations.push("Share articles to establish thought leadership");
  if (mediaTypes.size < 2) recommendations.push("Diversify content formats for better algorithm performance");
  
  return recommendations.length > 0 ? recommendations : ["Great content diversity! Keep mixing formats."];
}

function getPostingConsistencyRecommendations(posts) {
  if (posts.length < 2) return ["Post more frequently to establish consistency"];
  
  const postDates = posts
    .map(post => {
      const dateStr = post.Date || post.date || post['Share Date'] || post.shareDate;
      return dateStr ? new Date(dateStr) : null;
    })
    .filter(date => date && !isNaN(date.getTime()));
    
  if (postDates.length < 2) return ["Add dates to your posts for better tracking"];
  
  const gaps = [];
  for (let i = 1; i < postDates.length; i++) {
    const gap = (postDates[i].getTime() - postDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
    gaps.push(gap);
  }
  
  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  
  if (avgGap > 14) return ["Try to post at least every 2 weeks for better visibility"];
  if (avgGap > 7) return ["Aim for weekly posting to maintain audience engagement"];
  return ["Great consistency! Keep up the regular posting schedule"];
}

function calculateRecentConnections(connections) {
  if (!connections || connections.length === 0) return 0;
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 28);
  
  const recentConnections = connections.filter(conn => {
    const connectedDate = new Date(
      conn["Connected On"] || conn.connectedOn || conn.date || conn["Date"] || conn.connectedAt
    );
    return !isNaN(connectedDate.getTime()) && connectedDate >= thirtyDaysAgo;
  });
  
  return recentConnections.length;
}