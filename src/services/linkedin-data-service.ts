import {
  calculateProfileStrength,
  calculateNetworkQuality,
  calculateSocialActivityScore,
  calculateContentPerformance,
} from "./analytics-calculator";

export class LinkedInDataService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async fetchProfileViews(token: string) {
    try {
      const cacheKey = `profile_views_${token.substring(0, 20)}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await fetch(
        "/.netlify/functions/linkedin-snapshot?domain=PROFILE",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok)
        return response.status === 429
          ? (() => {
              throw new Error("LinkedIn API Rate Limit Exceeded");
            })()
          : { profileViews: 0, searchAppearances: 0, uniqueViewers: 0 };

      const data = await response.json();
      if (data.status === 429)
        throw new Error("LinkedIn API Rate Limit Exceeded");

      const profileData =
        data.elements?.[0]?.snapshotData || data.snapshotData || data || [];
      const result = {
        profileViews: 0,
        searchAppearances: 0,
        uniqueViewers: 0,
      };

      const extractMetrics = (obj: any) => {
        Object.keys(obj).forEach((key) => {
          const value = parseInt(String(obj[key])) || 0;
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes("view") && !lowerKey.includes("search"))
            result.profileViews = Math.max(result.profileViews, value);
          if (lowerKey.includes("search"))
            result.searchAppearances = Math.max(
              result.searchAppearances,
              value
            );
          if (lowerKey.includes("unique"))
            result.uniqueViewers = Math.max(result.uniqueViewers, value);
        });
      };

      Array.isArray(profileData)
        ? profileData.forEach(extractMetrics)
        : extractMetrics(profileData);

      this.setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Rate Limit"))
        throw error;
      return { profileViews: 0, searchAppearances: 0, uniqueViewers: 0 };
    }
  }

  async fetchConnections(token: string) {
    try {
      const response = await fetch(
        "/.netlify/functions/linkedin-snapshot?domain=CONNECTIONS",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok)
        return response.status === 429
          ? (() => {
              throw new Error("LinkedIn API Rate Limit Exceeded");
            })()
          : {
              total: 0,
              monthlyGrowth: 0,
              growthRate: "0",
              topCompanies: [],
              topPositions: [],
            };

      const data = await response.json();
      if (data.status === 429)
        throw new Error("LinkedIn API Rate Limit Exceeded");

      const connections =
        data.elements?.[0]?.snapshotData || data.snapshotData || data || [];
      const last30Days = connections.filter((conn: any) => {
        const connectedDate = new Date(
          conn["Connected On"] || conn.connectedOn || conn.date || conn["Date"]
        );
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return connectedDate >= thirtyDaysAgo;
      });

      return {
        total: connections.length,
        monthlyGrowth: last30Days.length,
        growthRate:
          connections.length > 0
            ? ((last30Days.length / connections.length) * 100).toFixed(2)
            : "0",
        topCompanies: this.getTopItems(connections, "Company", 5),
        topPositions: this.getTopItems(connections, "Position", 5),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("Rate Limit"))
        throw error;
      return {
        total: 0,
        monthlyGrowth: 0,
        growthRate: "0",
        topCompanies: [],
        topPositions: [],
      };
    }
  }

  async calculateEngagementMetrics(token: string) {
    try {
      const [postsResponse, changelogResponse] = await Promise.all([
        fetch(
          "/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        ),
        fetch("/.netlify/functions/linkedin-changelog?count=100", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!postsResponse.ok || !changelogResponse.ok) {
        throw new Error("Failed to fetch engagement data");
      }

      const [postsData, changelogData] = await Promise.all([
        postsResponse.json(),
        changelogResponse.json(),
      ]);

      const changelogElements = changelogData.elements || changelogData || [];
      const userPosts = changelogElements.filter(
        (event: any) =>
          event.resourceName === "ugcPosts" && event.method === "CREATE"
      );

      const engagementByPost: Record<string, any> = {};
      userPosts.forEach((post: any) => {
        engagementByPost[post.resourceId] = {
          likes: 0,
          comments: 0,
          shares: 0,
        };
      });

      let totalLikes = 0,
        totalComments = 0,
        totalShares = 0;

      changelogElements.forEach((event: any) => {
        const postUrn = event.activity?.object || event.resourceId;
        if (!postUrn || !engagementByPost[postUrn]) return;

        if (event.method === "CREATE") {
          switch (event.resourceName) {
            case "socialActions/likes":
              engagementByPost[postUrn].likes++;
              totalLikes++;
              break;
            case "socialActions/comments":
              engagementByPost[postUrn].comments++;
              totalComments++;
              break;
            case "socialActions/shares":
              engagementByPost[postUrn].shares++;
              totalShares++;
              break;
          }
        }
      });

      return {
        totalLikes,
        totalComments,
        totalShares,
        totalEngagement: totalLikes + totalComments + totalShares,
        avgPerPost:
          userPosts.length > 0
            ? (totalLikes / userPosts.length).toFixed(2)
            : "0",
        engagementByPost,
      };
    } catch (error) {
      return {
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalEngagement: 0,
        avgPerPost: "0",
        engagementByPost: {},
      };
    }
  }

  async fetchActivityMetrics(token: string) {
    try {
      const response = await fetch(
        "/.netlify/functions/linkedin-changelog?count=100",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok)
        return {
          postsCreated: 0,
          commentsGiven: 0,
          likesGiven: 0,
          articlesPublished: 0,
          messagesSent: 0,
          invitationsSent: 0,
        };

      const data = await response.json();
      const elements = data.elements || data || [];

      const activities = {
        postsCreated: 0,
        commentsGiven: 0,
        likesGiven: 0,
        articlesPublished: 0,
        messagesSent: 0,
        invitationsSent: 0,
      };

      elements.forEach((event: any) => {
        switch (event.resourceName) {
          case "ugcPosts":
            if (event.method === "CREATE") activities.postsCreated++;
            break;
          case "socialActions/comments":
            activities.commentsGiven++;
            break;
          case "socialActions/likes":
            activities.likesGiven++;
            break;
          case "originalArticles":
            activities.articlesPublished++;
            break;
          case "messages":
            if (event.actor === event.owner) activities.messagesSent++;
            break;
          case "invitations":
            activities.invitationsSent++;
            break;
        }
      });

      return activities;
    } catch (error) {
      return {
        postsCreated: 0,
        commentsGiven: 0,
        likesGiven: 0,
        articlesPublished: 0,
        messagesSent: 0,
        invitationsSent: 0,
      };
    }
  }

  private getTopItems(data: any[], keyName: string, limit: number) {
    const items: Record<string, number> = {};

    data.forEach((item) => {
      const key = item[keyName] || item[keyName.toLowerCase()] || "Unknown";
      items[key] = (items[key] || 0) + 1;
    });

    return Object.entries(items)
      .map(([name, count]) => ({ [keyName.toLowerCase()]: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getProfileMetrics(): Promise<any> {
    try {
      // Fetch all required domain data
      const [
        profileData,
        connectionsData,
        memberShareData,
        likesData,
        educationData,
        skillsData,
        positionsData,
        changelogData,
      ] = await Promise.all([
        this.fetchDomainData("PROFILE"),
        this.fetchDomainData("CONNECTIONS"),
        this.fetchDomainData("MEMBER_SHARE_INFO"),
        this.fetchDomainData("ALL_LIKES"),
        this.fetchDomainData("EDUCATION"),
        this.fetchDomainData("SKILLS"),
        this.fetchDomainData("POSITIONS"),
        this.fetchChangelogData(),
      ]);

      // Calculate advanced metrics

      try {
        const profileStrength = calculateProfileStrength({
          PROFILE: profileData,
          EDUCATION: educationData,
          SKILLS: skillsData,
          POSITIONS: positionsData,
        });

        const networkQuality = calculateNetworkQuality(connectionsData);

        const socialActivity = calculateSocialActivityScore(
          likesData,
          connectionsData?.count || 0,
          changelogData
        );

        const contentPerformance = calculateContentPerformance(memberShareData);

        const result = {
          // Keep original zeros for now
          profileViews: 0,
          searchAppearances: 0,
          uniqueViewers: 0,

          // New meaningful metrics
          profileStrength: profileStrength.score,
          networkQuality: networkQuality.score,
          socialActivity: socialActivity.score,
          contentPerformance: contentPerformance.score,

          // Detailed breakdowns
          profileAnalysis: profileStrength,
          networkAnalysis: networkQuality,
          socialAnalysis: socialActivity,
          contentAnalysis: contentPerformance,

          // Keep existing working metrics
          totalConnections: connectionsData?.count || 0,
          totalPosts: memberShareData?.count || 0,
          likesGiven: likesData?.count || 0,
        };

        return result;
      } catch (analyticsError) {
        console.error("Analytics calculation error:", analyticsError);
        console.error(
          "Analytics error stack:",
          analyticsError instanceof Error
            ? analyticsError.stack
            : "No stack trace"
        );
        throw analyticsError;
      }
    } catch (error) {
      console.error("Error fetching profile metrics:", error);
      console.error(
        "Error stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      return this.getDefaultMetrics();
    }
  }

  private async fetchDomainData(domain: string): Promise<any> {
    try {
      const response = await fetch(
        `/.netlify/functions/linkedin-snapshot?domain=${domain}`
      );

      if (!response.ok) {
        return { count: 0, sample: null };
      }

      const data = await response.json();
      const result = data.elements?.[0] || { count: 0, sample: null };

      return result;
    } catch (error) {
      return { count: 0, sample: null };
    }
  }

  private async fetchChangelogData(): Promise<any> {
    try {
      const response = await fetch(
        "/.netlify/functions/linkedin-changelog?count=100"
      );

      if (!response.ok) {
        return { elements: [] };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return { elements: [] };
    }
  }

  private getDefaultMetrics(): any {
    return {
      profileViews: 0,
      searchAppearances: 0,
      uniqueViewers: 0,
      profileStrength: 0,
      networkQuality: 0,
      socialActivity: 0,
      contentPerformance: 0,
      totalConnections: 0,
      totalPosts: 0,
      likesGiven: 0,
    };
  }
}


