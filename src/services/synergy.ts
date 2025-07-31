const API_BASE = "/.netlify/functions";

export interface SynergyPartner {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  linkedinMemberUrn?: string;
  dmaActive: boolean;
  createdAt: string;
}

export interface PartnerPost {
  postUrn: string;
  createdAtMs: number;
  textPreview: string;
  mediaType: string;
  mediaAssetUrn?: string;
  permalink?: string;
  raw?: any;
}

export interface CrossComment {
  id: string;
  message: string;
  createdAtMs: number;
  authorUrn: string;
  objectUrn: string;
  raw?: any;
}

export interface CommentSuggestion {
  suggestion: string;
  postUrn: string;
  createdAt: string;
}

export const synergyService = {
  // Partner management
  async getPartners(token: string): Promise<SynergyPartner[]> {
    const response = await fetch(`${API_BASE}/synergy-partner-posts`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch synergy partners");
    }

    const data = await response.json();
    return data.partners;
  },

  async addPartner(token: string, partnerId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/synergy-partners`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ partnerId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add partner");
    }
  },

  async removePartner(token: string, partnerId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/synergy-partners`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ partnerId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to remove partner");
    }
  },

  // Post fetching
  async getPartnerPosts(
    token: string,
    partnerId: string,
    limit: number = 5,
    direction: "theirs" | "mine" = "theirs"
  ): Promise<PartnerPost[]> {
    const response = await fetch(
      `${API_BASE}/synergy-posts?partnerId=${partnerId}&limit=${limit}&direction=${direction}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch partner posts");
    }

    const data = await response.json();
    return data.posts;
  },

  // Comment fetching
  async getCommentByAuthorOnPost(
    token: string,
    authorUserId: string,
    postUrn: string
  ): Promise<CrossComment | null> {
    const response = await fetch(
      `${API_BASE}/synergy-comments?authorUserId=${authorUserId}&postUrn=${encodeURIComponent(postUrn)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null; // No comment found
      }
      throw new Error("Failed to fetch comment");
    }

    const data = await response.json();
    return data.comment;
  },

  // AI comment suggestions
  async suggestComment(
    token: string,
    post: {
      urn: string;
      text: string;
      mediaType: string;
      partnerName?: string;
    },
    viewerProfile?: {
      headline?: string;
      topics?: string[];
    }
  ): Promise<string[]> {
    const response = await fetch(`${API_BASE}/synergy-suggest-comment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post,
        viewerProfile,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to generate comment suggestions");
    }

    const data = await response.json();
    return [data.suggestion]; // Return as array for compatibility
  },
};

// Utility functions
export const synergyUtils = {
  formatPostDate(createdAtMs: number): string {
    const date = new Date(createdAtMs);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  },

  truncateText(text: string, maxLength: number = 200): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  getMediaThumbnail(post: PartnerPost, dmaToken?: string): string | null {
    if (post.mediaAssetUrn && dmaToken) {
      // Extract asset ID from URN
      const assetMatch = post.mediaAssetUrn.match(/urn:li:digitalmediaAsset:(.+)/);
      if (assetMatch) {
        return `/.netlify/functions/linkedin-media-download?assetId=${assetMatch[1]}&token=${encodeURIComponent(dmaToken)}`;
      }
    }
    return null;
  },

  getMediaTypeIcon(mediaType: string): string {
    switch (mediaType) {
      case 'IMAGE':
        return '🖼️';
      case 'VIDEO':
        return '🎥';
      case 'ARTICLE':
        return '📄';
      case 'URN_REFERENCE':
        return '🔗';
      default:
        return '📝';
    }
  },

  validatePartnerEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  generatePartnerInviteLink(partnerId: string): string {
    return `${window.location.origin}/?invite=${partnerId}`;
  }
};