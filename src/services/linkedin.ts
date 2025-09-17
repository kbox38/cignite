// src/services/linkedin.ts - Complete DMA-only OAuth version
const API_BASE = import.meta.env.DEV ? 'http://localhost:8888/.netlify/functions' : '/.netlify/functions';

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  profilePicture?: string;
  headline?: string;
  industry?: string;
  location?: string;
}

export interface LinkedInPost {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
  impressions?: number;
  clicks?: number;
  engagementRate?: number;
  mediaType?: 'text' | 'image' | 'video' | 'document';
  mediaUrl?: string;
}

export interface LinkedInAnalytics {
  profileViews: number;
  searchAppearances: number;
  postImpressions: number;
  postClicks: number;
  followers: number;
  connections: number;
  engagementRate: number;
  topPerformingPosts: LinkedInPost[];
}

// SIMPLIFIED: DMA-only OAuth - no more type parameter
export const initiateLinkedInAuth = () => {
  const authUrl = `${API_BASE}/linkedin-oauth-start`;
  console.log("Redirecting to LinkedIn DMA OAuth:", authUrl);
  window.location.href = authUrl;
};

// Remove separate DMA auth - it's the same now
export const initiateLinkedInDMAAuth = () => {
  console.log("DMA auth is now the default OAuth flow");
  return initiateLinkedInAuth();
};

export const fetchLinkedInProfile = async (token: string): Promise<LinkedInProfile> => {
  const response = await fetch(`${API_BASE}/linkedin-profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202312",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch LinkedIn profile");
  }

  return response.json();
};

export const fetchLinkedInAnalytics = async (token: string): Promise<LinkedInAnalytics> => {
  const response = await fetch(`${API_BASE}/linkedin-analytics`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202312",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch LinkedIn analytics");
  }

  return response.json();
};

export const fetchLinkedInPosts = async (
  token: string,
  start: number = 0,
  count: number = 10
): Promise<LinkedInPost[]> => {
  const params = new URLSearchParams({
    start: start.toString(),
    count: count.toString(),
  });

  const response = await fetch(`${API_BASE}/linkedin-posts?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202312",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch LinkedIn posts");
  }

  return response.json();
};

export const fetchProfileMetrics = async (token: string) => {
  try {
    const response = await fetch(`${API_BASE}/fetch-profile-metrics`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('Profile metrics fetch failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      throw new Error(`Failed to fetch profile metrics: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Profile metrics data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching profile metrics:', error);
    throw error;
  }
};

export const fetchNetworkMetrics = async (token: string) => {
  try {
    const response = await fetch(`${API_BASE}/fetch-network-metrics`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Network metrics fetch failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching network metrics:', error);
    throw error;
  }
};

export const fetchEngagementAnalytics = async (token: string) => {
  try {
    const response = await fetch(`${API_BASE}/fetch-engagement-analytics`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Engagement analytics fetch failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching engagement analytics:', error);
    throw error;
  }
};

export const fetchDMAData = async (token: string, domain?: string) => {
  const params = new URLSearchParams();
  if (domain) {
    params.append('domain', domain);
  }

  const queryString = params.toString();
  const url = `${API_BASE}/dma-snapshot-data${queryString ? `?${queryString}` : ''}`;

  console.log('Fetching DMA data from:', url);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202312",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('DMA data fetch failed:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    throw new Error(`Failed to fetch DMA data: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('DMA snapshot data received:', {
    hasElements: !!data.elements,
    elementsCount: data.elements?.length,
    firstElementKeys: data.elements?.[0] ? Object.keys(data.elements[0]) : [],
    snapshotDataCount: data.elements?.[0]?.snapshotData?.length
  });
  
  return data;
};

export const fetchLinkedInHistoricalPosts = async (
  token: string,
  daysBack: number = 90,
  start: number = 0,
  count: number = 10
) => {
  const params = new URLSearchParams({
    domain: "MEMBER_SHARE_INFO",
    start: start.toString(),
    count: count.toString(),
    daysBack: daysBack.toString(),
  });

  const response = await fetch(
    `${API_BASE}/linkedin-historical-posts?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": "202312",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch LinkedIn historical posts");
  }

  return response.json();
};

export const createLinkedInPost = async (
  token: string,
  content: string,
  mediaFile?: File
) => {
  // Convert file to base64 if provided
  let mediaFileBase64: string | undefined;

  if (mediaFile) {
    try {
      mediaFileBase64 = await fileToBase64(mediaFile);
    } catch (error) {
      console.error("Error converting file to base64:", error);
      throw new Error("Failed to process media file");
    }
  }

  const response = await fetch(`${API_BASE}/linkedin-post`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202312",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      mediaFile: mediaFileBase64,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to create LinkedIn post: ${response.statusText}`
    );
  }

  return response.json();
};

// Helper function to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// DMA-specific functions
export const testDMAConnection = async (token: string) => {
  try {
    console.log('Testing DMA connection...');
    
    const response = await fetch(`${API_BASE}/dma-test-connection`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DMA connection test failed:', errorText);
      throw new Error(`DMA connection test failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('DMA connection test result:', result);
    return result;
  } catch (error) {
    console.error('Error testing DMA connection:', error);
    throw error;
  }
};

export const fetchDMAChangelog = async (token: string) => {
  try {
    const response = await fetch(`${API_BASE}/dma-changelog`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": "202312",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch DMA changelog: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching DMA changelog:', error);
    throw error;
  }
};

export const verifyUserIdentity = async (token: string) => {
  try {
    const response = await fetch(`${API_BASE}/synergy-partners`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`User identity verification failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error verifying user identity:', error);
    throw error;
  }
};

export const searchSynergyUsers = async (token: string, searchTerm: string = '') => {
  try {
    const params = new URLSearchParams();
    if (searchTerm) {
      params.append('search', searchTerm);
    }

    const response = await fetch(`${API_BASE}/synergy-user-search?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Search failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error searching synergy users:', error);
    throw error;
  }
};

export const sendSynergyInvitation = async (token: string, targetUserId: string, message?: string) => {
  try {
    const response = await fetch(`${API_BASE}/synergy-invite`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserId,
        message: message || 'Let\'s grow our LinkedIn presence together!'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Invitation failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending synergy invitation:', error);
    throw error;
  }
};

export const respondToSynergyInvitation = async (
  token: string, 
  invitationId: string, 
  action: 'accept' | 'decline'
) => {
  try {
    const response = await fetch(`${API_BASE}/synergy-invite-response`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invitationId,
        action,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Response failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error responding to synergy invitation:', error);
    throw error;
  }
};

// Authentication utilities
export const isValidToken = (token: string | null): token is string => {
  return typeof token === 'string' && token.length > 0;
};

export const getTokenExpiry = (token: string): Date | null => {
  try {
    // LinkedIn tokens are typically valid for 60 days
    // Since we don't have access to the actual expiry from the token,
    // we'll assume 60 days from when this function is called
    return new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  } catch (error) {
    console.error('Error parsing token expiry:', error);
    return null;
  }
};

export const refreshToken = async (refreshToken: string) => {
  // LinkedIn DMA tokens don't support refresh tokens in the same way
  // Users need to re-authenticate when tokens expire
  throw new Error('Token refresh not supported - please re-authenticate');
};

// Constants
export const LINKEDIN_SCOPES = {
  DMA: 'r_dma_portability_3rd_party',
} as const;

export const DMA_DOMAINS = {
  PROFILE: 'PROFILE',
  CONNECTIONS: 'CONNECTIONS',
  MEMBER_SHARE_INFO: 'MEMBER_SHARE_INFO',
  POSTS: 'POSTS',
  ACTIVITIES: 'ACTIVITIES',
} as const;

// Type exports for better TypeScript support
export type DMADomain = typeof DMA_DOMAINS[keyof typeof DMA_DOMAINS];
export type LinkedInScope = typeof LINKEDIN_SCOPES[keyof typeof LINKEDIN_SCOPES];