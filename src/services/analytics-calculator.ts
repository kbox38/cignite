/**
 * Analytics Calculator Service
 * Calculates meaningful metrics from available LinkedIn DMA data
 * Replaces zero values with actionable insights
 */

// Profile Strength Score Calculator
export const calculateProfileStrength = (allDomainsData: any) => {
  console.log("=== PROFILE STRENGTH CALCULATION ===");
  console.log("Input data:", allDomainsData);

  const profile = allDomainsData.PROFILE?.sample || {};
  const education = allDomainsData.EDUCATION || {};
  const skills = allDomainsData.SKILLS || {};
  const positions = allDomainsData.POSITIONS || {};

  console.log("Extracted data:", {
    profile: Object.keys(profile),
    educationCount: education.count,
    skillsCount: skills.count,
    positionsCount: positions.count,
  });

  let score = 0;
  const breakdown = {
    basicInfo: 0,
    education: 0,
    skills: 0,
    experience: 0,
  };

  // Basic Info (25 points max)
  if (profile["First Name"] && profile["Last Name"]) breakdown.basicInfo += 10;
  if (profile.Headline && profile.Headline.trim()) breakdown.basicInfo += 10;
  if (profile.Industry && profile.Industry.trim()) breakdown.basicInfo += 5;

  // Education (25 points max)
  if (education.count > 0) breakdown.education += 15;
  if (education.count > 1) breakdown.education += 10;

  // Skills (25 points max)
  breakdown.skills = Math.min((skills.count || 0) * 5, 25);

  // Experience (25 points max)
  breakdown.experience = Math.min((positions.count || 0) * 12, 25);

  score = Object.values(breakdown).reduce((sum, points) => sum + points, 0);

  const result = {
    score: Math.min(score, 100),
    breakdown,
    recommendations: generateProfileRecommendations(breakdown),
  };

  console.log("Profile strength calculation result:", result);
  return result;
};

const generateProfileRecommendations = (breakdown: any) => {
  const recommendations = [];
  if (breakdown.skills < 20)
    recommendations.push("Add more skills to your profile");
  if (breakdown.experience < 15)
    recommendations.push("Add work experience or internships");
  if (breakdown.basicInfo < 20)
    recommendations.push("Complete your basic profile information");
  return recommendations;
};

// Network Quality Index Calculator
export const calculateNetworkQuality = (connectionsData: any) => {
  console.log("=== NETWORK QUALITY CALCULATION ===");
  console.log("Input connections data:", connectionsData);

  if (!connectionsData?.sample || connectionsData.count === 0) {
    console.log("No connections data available, returning zero score");
    return { score: 0, analysis: {}, insights: [] };
  }

  const connections = Array.isArray(connectionsData.sample)
    ? connectionsData.sample
    : [connectionsData.sample];

  console.log("Processing connections:", {
    totalConnections: connectionsData.count,
    sampleConnections: connections.length,
    firstConnection: connections[0],
  });

  // Calculate industry diversity
  const companies = connections
    .map((conn) => conn.Company)
    .filter((company) => company && company.trim());

  const uniqueCompanies = [...new Set(companies)].length;
  const diversityScore = uniqueCompanies / Math.max(connections.length, 1);

  // Calculate recent growth
  const currentDate = new Date();
  const thirtyDaysAgo = new Date(
    currentDate.getTime() - 30 * 24 * 60 * 60 * 1000
  );

  const recentConnections = connections.filter((conn) => {
    if (!conn["Connected On"]) return false;
    const connectionDate = new Date(conn["Connected On"]);
    return connectionDate >= thirtyDaysAgo;
  });

  // Calculate professional quality
  const connectionsWithTitles = connections.filter(
    (conn) => conn.Position && conn.Position.trim()
  );
  const professionalRatio = connectionsWithTitles.length / connections.length;

  const qualityScore =
    diversityScore * 0.4 +
    professionalRatio * 0.4 +
    Math.min(recentConnections.length / 5, 1) * 0.2;

  const result = {
    score: Math.round(qualityScore * 10 * 10) / 10,
    analysis: {
      totalConnections: connectionsData.count,
      uniqueCompanies,
      recentGrowth: recentConnections.length,
      professionalRatio: Math.round(professionalRatio * 100),
    },
    insights: [
      `${uniqueCompanies} unique companies in network`,
      `${recentConnections.length} new connections this month`,
      `${Math.round(professionalRatio * 100)}% have professional titles`,
    ],
  };

  console.log("Network quality calculation result:", result);
  return result;
};

// Social Activity Score Calculator
export const calculateSocialActivityScore = (
  likesData: any,
  connectionsCount: number,
  changelogData: any
) => {
  console.log("=== SOCIAL ACTIVITY CALCULATION ===");
  console.log("Input data:", {
    likesData,
    connectionsCount,
    changelogDataLength: changelogData?.elements?.length,
  });

  const likesGiven = likesData?.count || 0;
  const activityItems = changelogData?.elements?.length || 0;

  console.log("Extracted values:", {
    likesGiven,
    activityItems,
    connectionsCount,
  });

  // Calculate engagement rate
  const engagementRate = likesGiven / Math.max(connectionsCount, 1);

  // Calculate activity frequency (activities per day over last 28 days)
  const activityFrequency = activityItems / 28;

  // Calculate composite score
  const engagementScore = Math.min(engagementRate * 10, 5);
  const activityScore = Math.min(activityFrequency * 2, 3);
  const consistencyScore = likesGiven > 0 ? 2 : 0;

  const totalScore = engagementScore + activityScore + consistencyScore;

  const result = {
    score: Math.round(totalScore * 10) / 10,
    metrics: {
      likesGiven,
      engagementRate: Math.round(engagementRate * 100) / 100,
      activityFrequency: Math.round(activityFrequency * 10) / 10,
    },
    insights: [
      `${likesGiven} likes given`,
      `${Math.round(engagementRate * 100) / 100} engagement per connection`,
      `${Math.round(activityFrequency * 10) / 10} activities per day`,
    ],
  };

  console.log("Social activity calculation result:", result);
  return result;
};

// Content Performance Calculator
export const calculateContentPerformance = (memberShareData: any) => {
  console.log("=== CONTENT PERFORMANCE CALCULATION ===");
  console.log("Input member share data:", memberShareData);

  const totalPosts = memberShareData?.count || 0;

  console.log("Total posts:", totalPosts);

  if (totalPosts === 0) {
    console.log("No posts found, returning zero score");
    return {
      score: 0,
      metrics: { totalPosts: 0 },
      insights: ["No posts published yet"],
    };
  }

  const posts = Array.isArray(memberShareData.sample)
    ? memberShareData.sample
    : [memberShareData.sample];

  console.log("Processing posts:", {
    postsLength: posts.length,
    firstPost: posts[0],
  });

  // Analyze hashtag usage
  const hashtagAnalysis = analyzeHashtags(posts);
  console.log("Hashtag analysis:", hashtagAnalysis);

  // Calculate posting frequency
  const postDates = posts
    .map((p) => new Date(p.Date))
    .sort((a, b) => b.getTime() - a.getTime());

  const daysBetweenPosts: number[] = [];

  for (let i = 1; i < postDates.length; i++) {
    const days = Math.floor(
      (postDates[i - 1].getTime() - postDates[i].getTime()) /
        (1000 * 60 * 60 * 24)
    );
    daysBetweenPosts.push(days);
  }

  const avgDaysBetweenPosts =
    daysBetweenPosts.length > 0
      ? (
          daysBetweenPosts.reduce((a, b) => a + b) / daysBetweenPosts.length
        ).toFixed(1)
      : "0";

  return {
    score: Math.round(contentScore * 10) / 10,
    metrics: {
      totalPosts,
      hashtagUsage: hashtagAnalysis.total,
      postsPerWeek: Math.round(postsPerWeek * 10) / 10,
      lastPostDate: postDates[0]?.toISOString().split("T")[0],
    },
    insights: [
      `${totalPosts} posts published`,
      `${hashtagAnalysis.total} hashtags used`,
      `${Math.round(postsPerWeek * 10) / 10} posts per week average`,
    ],
  };

  console.log("Content performance calculation result:", result);
  return result;
};

const analyzeHashtags = (posts: any[]) => {
  const allHashtags: string[] = [];

  posts.forEach((post) => {
    const content = post.ShareCommentary || "";
    const hashtags = content.match(/#[\w]+/g) || [];
    allHashtags.push(...hashtags);
  });

  return {
    total: allHashtags.length,
    unique: [...new Set(allHashtags)].length,
    averagePerPost: posts.length > 0 ? allHashtags.length / posts.length : 0,
    mostUsed: [...new Set(allHashtags)].slice(0, 3),
  };
};