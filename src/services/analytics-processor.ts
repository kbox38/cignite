interface ProfileMetrics {
  profileViews: number;
  searchAppearances: number;
  uniqueViewers: number;
  viewerCompanies: string[];
  viewerTitles: string[];
}

interface ConnectionStats {
  total: number;
  monthlyGrowth: number;
  growthRate: string;
  topCompanies: Array<{ company: string; count: number }>;
  topPositions: Array<{ position: string; count: number }>;
}

interface PostAnalytics {
  urn: string;
  url: string;
  date: string;
  commentary: string;
  visibility: string;
  mediaType: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
}

interface ActivityMetrics {
  postsCreated: number;
  commentsGiven: number;
  likesGiven: number;
  articlesPublished: number;
  messagesSent: number;
  invitationsSent: number;
}

interface DerivedMetrics {
  totalEngagement: number;
  avgEngagementPerPost: string;
  engagementRate: string;
  postingFrequency: string;
  contentMix: Record<string, number>;
  bestPostingTimes: Array<{ hour: number; avgEngagement: string }>;
  topPerformingPosts: PostAnalytics[];
}

interface ComprehensiveMetrics {
  profile: ProfileMetrics;
  network: ConnectionStats;
  content: PostAnalytics[];
  activity: ActivityMetrics;
  calculated: DerivedMetrics;
}

export class AnalyticsProcessor {
  async calculateAllMetrics(token: string): Promise<ComprehensiveMetrics> {
    try {
      const [profileMetrics, connectionStats, postAnalytics, activityMetrics] =
        await Promise.all([
          this.fetchProfileMetrics(token),
          this.fetchConnectionStats(token),
          this.fetchPostAnalytics(token),
          this.fetchActivityMetrics(token),
        ]);

      return {
        profile: profileMetrics,
        network: connectionStats,
        content: postAnalytics,
        activity: activityMetrics,
        calculated: this.calculateDerivedMetrics(
          postAnalytics,
          activityMetrics
        ),
      };
    } catch (error) {
      console.error("Error calculating metrics:", error);
      return this.getDefaultMetrics();
    }
  }

  private async fetchProfileMetrics(token: string): Promise<ProfileMetrics> {
    try {
      console.log("Analytics processor: Fetching profile metrics");

      const response = await fetch(
        "/.netlify/functions/linkedin-snapshot?domain=PROFILE",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Analytics processor: Profile snapshot data:", data);

      // Handle different possible response structures
      let profileData = [];
      if (data.elements && data.elements.length > 0) {
        profileData = data.elements[0]?.snapshotData || [];
      } else if (data.snapshotData) {
        profileData = data.snapshotData;
      } else if (Array.isArray(data)) {
        profileData = data;
      }

      console.log("Analytics processor: Extracted profile data:", profileData);

      let metrics = {
        profileViews: 0,
        searchAppearances: 0,
        uniqueViewers: 0,
        viewerCompanies: [],
        viewerTitles: [],
      };

      // Parse the array of profile data - LinkedIn returns data in various key formats
      profileData.forEach((dataPoint: any) => {
        console.log(
          "Analytics processor: Processing profile data point:",
          dataPoint
        );

        // Look for profile views with different possible key names
        if (dataPoint["Profile Views"] !== undefined) {
          metrics.profileViews =
            parseInt(String(dataPoint["Profile Views"])) || 0;
        } else if (dataPoint["profile_views"] !== undefined) {
          metrics.profileViews =
            parseInt(String(dataPoint["profile_views"])) || 0;
        } else if (dataPoint.profileViews !== undefined) {
          metrics.profileViews = parseInt(String(dataPoint.profileViews)) || 0;
        }

        // Look for search appearances
        if (dataPoint["Search Appearances"] !== undefined) {
          metrics.searchAppearances =
            parseInt(String(dataPoint["Search Appearances"])) || 0;
        } else if (dataPoint["search_appearances"] !== undefined) {
          metrics.searchAppearances =
            parseInt(String(dataPoint["search_appearances"])) || 0;
        } else if (dataPoint.searchAppearances !== undefined) {
          metrics.searchAppearances =
            parseInt(String(dataPoint.searchAppearances)) || 0;
        }

        // Look for unique viewers
        if (dataPoint["Unique Viewers"] !== undefined) {
          metrics.uniqueViewers =
            parseInt(String(dataPoint["Unique Viewers"])) || 0;
        } else if (dataPoint["unique_viewers"] !== undefined) {
          metrics.uniqueViewers =
            parseInt(String(dataPoint["unique_viewers"])) || 0;
        } else if (dataPoint.uniqueViewers !== undefined) {
          metrics.uniqueViewers =
            parseInt(String(dataPoint.uniqueViewers)) || 0;
        }
      });

      console.log("Analytics processor: Processed profile metrics:", metrics);
      return metrics;
    } catch (error) {
      console.error(
        "Analytics processor: Error fetching profile metrics:",
        error
      );
      return {
        profileViews: 0,
        searchAppearances: 0,
        uniqueViewers: 0,
        viewerCompanies: [],
        viewerTitles: [],
      };
    }
  }

  private async fetchConnectionStats(token: string): Promise<ConnectionStats> {
    try {
      console.log("Analytics processor: Fetching connection stats");

      const connectionsResponse = await fetch(
        "/.netlify/functions/linkedin-snapshot?domain=CONNECTIONS",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!connectionsResponse.ok) {
        throw new Error(
          `HTTP ${connectionsResponse.status}: ${connectionsResponse.statusText}`
        );
      }

      const data = await connectionsResponse.json();
      console.log("Analytics processor: Raw connections response:", data);

      // Handle different possible response structures
      let connections = [];
      if (data.elements && data.elements.length > 0) {
        connections = data.elements[0]?.snapshotData || [];
      } else if (data.snapshotData) {
        connections = data.snapshotData;
      } else if (Array.isArray(data)) {
        connections = data;
      }

      console.log(
        "Analytics processor: Extracted connections:",
        connections.length
      );

      // Calculate growth over time
      const last30Days = connections.filter((conn: any) => {
        const connectedDate = new Date(
          conn["Connected On"] || conn.connectedOn || conn.date || conn["Date"]
        );
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return connectedDate >= thirtyDaysAgo;
      });

      const result = {
        total: connections.length,
        monthlyGrowth: last30Days.length,
        growthRate:
          connections.length > 0
            ? ((last30Days.length / connections.length) * 100).toFixed(2)
            : "0",
        topCompanies: this.getTopCompanies(connections),
        topPositions: this.getTopPositions(connections),
      };

      console.log("Analytics processor: Processed connection stats:", result);
      return result;
    } catch (error) {
      console.error(
        "Analytics processor: Error fetching connection stats:",
        error
      );
      return {
        total: 0,
        monthlyGrowth: 0,
        growthRate: "0",
        topCompanies: [],
        topPositions: [],
      };
    }
  }

  private async fetchPostAnalytics(token: string): Promise<PostAnalytics[]> {
    try {
      console.log("Analytics processor: Fetching post analytics");

      // Get all posts from Snapshot API
      const postsResponse = await fetch(
        "/.netlify/functions/linkedin-snapshot?domain=MEMBER_SHARE_INFO",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!postsResponse.ok) {
        throw new Error(
          `HTTP ${postsResponse.status}: ${postsResponse.statusText}`
        );
      }

      const postsData = await postsResponse.json();
      console.log("Analytics processor: Raw posts response:", postsData);

      const posts = this.parsePostsFromSnapshot(postsData);
      console.log("Analytics processor: Parsed posts:", posts.length);

      // Get recent engagement from Changelog
      const engagementMap = await this.fetchRecentEngagement(token);

      // Enrich posts with engagement data
      return posts.map((post) => ({
        ...post,
        engagement: engagementMap[post.urn] || {
          likes: 0,
          comments: 0,
          shares: 0,
        },
      }));
    } catch (error) {
      console.error(
        "Analytics processor: Error fetching post analytics:",
        error
      );
      return [];
    }
  }

  private parsePostsFromSnapshot(
    snapshotData: any
  ): Omit<PostAnalytics, "engagement">[] {
    const posts: Omit<PostAnalytics, "engagement">[] = [];

    // Handle different possible response structures
    let shareInfo = [];
    if (snapshotData.elements && snapshotData.elements.length > 0) {
      shareInfo = snapshotData.elements[0]?.snapshotData || [];
    } else if (snapshotData.snapshotData) {
      shareInfo = snapshotData.snapshotData;
    } else if (Array.isArray(snapshotData)) {
      shareInfo = snapshotData;
    }

    console.log("Analytics processor: Parsing share info:", shareInfo.length);

    shareInfo.forEach((item: any) => {
      const url = item["Share URL"] || item.shareUrl || item.url || item["URL"];
      if (url) {
        posts.push({
          urn: this.extractUrnFromUrl(url),
          url: url,
          date:
            item["Share Date"] || item.shareDate || item.date || item["Date"],
          commentary:
            item["Share Commentary"] ||
            item.shareCommentary ||
            item.commentary ||
            item["Commentary"] ||
            "",
          visibility: item["Visibility"] || item.visibility || "PUBLIC",
          mediaType: item["Media Type"] || item.mediaType || "TEXT",
        });
      }
    });

    return posts;
  }

  private extractUrnFromUrl(url: string): string {
    // Extract URN from LinkedIn URL
    const match = url.match(/activity-(\d+)/);
    return match ? `urn:li:activity:${match[1]}` : url;
  }

  private async fetchRecentEngagement(
    token: string
  ): Promise<
    Record<string, { likes: number; comments: number; shares: number }>
  > {
    try {
      console.log("Analytics processor: Fetching recent engagement");

      const engagementMap: Record<
        string,
        { likes: number; comments: number; shares: number }
      > = {};

      const response = await fetch(
        "/.netlify/functions/linkedin-changelog?count=50",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(
        "Analytics processor: Raw engagement changelog response:",
        data
      );

      // Handle different possible response structures
      let elements = [];
      if (data.elements) {
        elements = data.elements;
      } else if (Array.isArray(data)) {
        elements = data;
      }

      console.log(
        "Analytics processor: Extracted engagement elements:",
        elements.length
      );

      // First, get all your posts to track engagement for
      const userPosts =
        elements?.filter(
          (event: any) =>
            event.resourceName === "ugcPosts" &&
            event.method === "CREATE" &&
            event.actor === event.owner // Your own posts
        ) || [];

      console.log(
        "Analytics processor: Found user posts for engagement:",
        userPosts.length
      );

      // Initialize engagement tracking for your posts
      userPosts.forEach((post: any) => {
        engagementMap[post.resourceId] = { likes: 0, comments: 0, shares: 0 };
      });

      // Process each event
      elements?.forEach((event: any) => {
        // Likes on your posts
        if (
          event.resourceName === "socialActions/likes" &&
          event.method === "CREATE"
        ) {
          const postUrn = event.activity?.object || event.resourceId;
          if (postUrn && engagementMap[postUrn]) {
            engagementMap[postUrn] = engagementMap[postUrn] || {
              likes: 0,
              comments: 0,
              shares: 0,
            };
            engagementMap[postUrn].likes++;
          }
        }
        // Comments on your posts
        else if (
          event.resourceName === "socialActions/comments" &&
          event.method === "CREATE"
        ) {
          const postUrn = event.activity?.object || event.resourceId;
          if (postUrn && engagementMap[postUrn]) {
            engagementMap[postUrn] = engagementMap[postUrn] || {
              likes: 0,
              comments: 0,
              shares: 0,
            };
            engagementMap[postUrn].comments++;
          }
        }
        // Shares on your posts
        else if (
          event.resourceName === "socialActions/shares" &&
          event.method === "CREATE"
        ) {
          const postUrn = event.activity?.object || event.resourceId;
          if (postUrn && engagementMap[postUrn]) {
            engagementMap[postUrn] = engagementMap[postUrn] || {
              likes: 0,
              comments: 0,
              shares: 0,
            };
            engagementMap[postUrn].shares++;
          }
        }
      });

      console.log("Analytics processor: Engagement map:", engagementMap);
      return engagementMap;
    } catch (error) {
      console.error(
        "Analytics processor: Error fetching recent engagement:",
        error
      );
      return {};
    }
  }

  private async fetchActivityMetrics(token: string): Promise<ActivityMetrics> {
    try {
      console.log("Analytics processor: Fetching activity metrics");

      const response = await fetch(
        "/.netlify/functions/linkedin-changelog?count=50",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(
        "Analytics processor: Raw activity changelog response:",
        data
      );

      // Handle different possible response structures
      let elements = [];
      if (data.elements) {
        elements = data.elements;
      } else if (Array.isArray(data)) {
        elements = data;
      }

      console.log(
        "Analytics processor: Extracted activity elements:",
        elements.length
      );

      const activities: ActivityMetrics = {
        postsCreated: 0,
        commentsGiven: 0,
        likesGiven: 0,
        articlesPublished: 0,
        messagesSent: 0,
        invitationsSent: 0,
      };

      elements?.forEach((event: any) => {
        console.log(
          "Analytics processor: Processing activity event:",
          event.resourceName,
          event.method
        );

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

      console.log(
        "Analytics processor: Processed activity metrics:",
        activities
      );
      return activities;
    } catch (error) {
      console.error(
        "Analytics processor: Error fetching activity metrics:",
        error
      );
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

  private calculateDerivedMetrics(
    postAnalytics: PostAnalytics[],
    activityMetrics: ActivityMetrics
  ): DerivedMetrics {
    const totalEngagement = postAnalytics.reduce(
      (sum, post) =>
        sum +
        post.engagement.likes +
        post.engagement.comments +
        post.engagement.shares,
      0
    );

    const avgEngagementPerPost =
      postAnalytics.length > 0
        ? (totalEngagement / postAnalytics.length).toFixed(2)
        : "0";

    console.log("Calculated engagement:", {
      totalEngagement,
      avgEngagementPerPost,
      postCount: postAnalytics.length,
    });

    // Calculate posting frequency
    const postDates = postAnalytics
      .map((p) => new Date(p.date))
      .filter((date) => !isNaN(date.getTime()))
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
      totalEngagement,
      avgEngagementPerPost,
      engagementRate:
        postAnalytics.length > 0
          ? ((totalEngagement / (postAnalytics.length * 100)) * 100).toFixed(2)
          : "0",
      postingFrequency: avgDaysBetweenPosts,
      contentMix: this.analyzeContentMix(postAnalytics),
      bestPostingTimes: this.analyzeBestTimes(postAnalytics),
      topPerformingPosts: this.getTopPosts(postAnalytics, 5),
    };
  }

  private analyzeContentMix(posts: PostAnalytics[]): Record<string, number> {
    const types: Record<string, number> = {};
    posts.forEach((post) => {
      const type = post.mediaType || "TEXT";
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  }

  private analyzeBestTimes(
    posts: PostAnalytics[]
  ): Array<{ hour: number; avgEngagement: string }> {
    const hourlyEngagement = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    posts.forEach((post) => {
      const hour = new Date(post.date).getHours();
      hourlyEngagement[hour] +=
        post.engagement.likes + post.engagement.comments;
      hourlyCounts[hour]++;
    });

    return hourlyEngagement.map((engagement, hour) => ({
      hour,
      avgEngagement:
        hourlyCounts[hour] > 0
          ? (engagement / hourlyCounts[hour]).toFixed(2)
          : "0",
    }));
  }

  private getTopPosts(posts: PostAnalytics[], limit: number): PostAnalytics[] {
    return posts
      .sort((a, b) => {
        const aTotal =
          a.engagement.likes + a.engagement.comments + a.engagement.shares;
        const bTotal =
          b.engagement.likes + b.engagement.comments + b.engagement.shares;
        return bTotal - aTotal;
      })
      .slice(0, limit);
  }

  private getTopCompanies(
    connections: any[]
  ): Array<{ company: string; count: number }> {
    const companies: Record<string, number> = {};
    connections.forEach((conn) => {
      const company = conn["Company"] || conn.company || "Unknown";
      companies[company] = (companies[company] || 0) + 1;
    });

    return Object.entries(companies)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private getTopPositions(
    connections: any[]
  ): Array<{ position: string; count: number }> {
    const positions: Record<string, number> = {};
    connections.forEach((conn) => {
      const position = conn["Position"] || conn.position || "Unknown";
      positions[position] = (positions[position] || 0) + 1;
    });

    return Object.entries(positions)
      .map(([position, count]) => ({ position, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private getDefaultMetrics(): ComprehensiveMetrics {
    return {
      profile: {
        profileViews: 0,
        searchAppearances: 0,
        uniqueViewers: 0,
        viewerCompanies: [],
        viewerTitles: [],
      },
      network: {
        total: 0,
        monthlyGrowth: 0,
        growthRate: "0",
        topCompanies: [],
        topPositions: [],
      },
      content: [],
      activity: {
        postsCreated: 0,
        commentsGiven: 0,
        likesGiven: 0,
        articlesPublished: 0,
        messagesSent: 0,
        invitationsSent: 0,
      },
      calculated: {
        totalEngagement: 0,
        avgEngagementPerPost: "0",
        engagementRate: "0",
        postingFrequency: "0",
        contentMix: {},
        bestPostingTimes: [],
        topPerformingPosts: [],
      },
    };
  }
}