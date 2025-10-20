// src/services/auth.ts
// Updated auth service to trigger posts sync on login

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  linkedinMemberUrn?: string;
  linkedinDmaMemberUrn?: string;
  dmaActive: boolean;
  lastLogin: string;
  lastPostsSync?: string;
  postsSyncStatus?: 'pending' | 'syncing' | 'completed' | 'failed';
}

export interface LoginResponse {
  user: User;
  basicToken?: string;
  dmaToken?: string;
  postsSyncTriggered?: boolean;
  postsSyncStatus?: string;
}

class AuthService {
  private readonly API_BASE = "/.netlify/functions";

  /**
   * Handle OAuth callback and complete authentication
   */
  async handleOAuthCallback(params: URLSearchParams): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/linkedin-oauth-callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: params.get("code"),
          state: params.get("state"),
          error: params.get("error"),
          error_description: params.get("error_description"),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Authentication failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Store auth tokens
      if (data.basicToken) {
        localStorage.setItem("linkedin_basic_token", data.basicToken);
      }
      if (data.dmaToken) {
        localStorage.setItem("linkedin_dma_token", data.dmaToken);
      }

      // Store user data
      localStorage.setItem("user", JSON.stringify(data.user));

      // Trigger posts sync on login
      const postsSyncResult = await this.triggerPostsSync(data.user.id);
      
      return {
        ...data,
        postsSyncTriggered: postsSyncResult.triggered,
        postsSyncStatus: postsSyncResult.status
      };
    } catch (error) {
      console.error("OAuth callback error:", error);
      throw error;
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const user = this.getCurrentUser();
    const basicToken = localStorage.getItem("linkedin_basic_token");
    return !!(user && basicToken);
  }

  /**
   * Check if user has DMA access
   */
  hasDmaAccess(): boolean {
    const user = this.getCurrentUser();
    const dmaToken = localStorage.getItem("linkedin_dma_token");
    return !!(user?.dmaActive && dmaToken);
  }

  /**
   * Trigger posts sync for user (called on every login)
   */
  async triggerPostsSync(userId: string): Promise<{triggered: boolean, status: string}> {
    try {
      console.log(`🔄 Triggering posts sync for user: ${userId}`);
      
      const response = await fetch(`${this.API_BASE}/sync-user-posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          syncAll: false
        }),
      });

      if (!response.ok) {
        console.warn(`Posts sync request failed: ${response.status}`);
        return { triggered: false, status: 'failed' };
      }

      const result = await response.json();
      console.log("✅ Posts sync triggered successfully:", result);
      
      return { 
        triggered: true, 
        status: result.results?.[0]?.status || 'initiated'
      };
      
    } catch (error) {
      console.error("❌ Failed to trigger posts sync:", error);
      return { triggered: false, status: 'error' };
    }
  }

  /**
   * Get posts sync status for current user
   */
  async getPostsSyncStatus(): Promise<{
    status: string;
    lastSync?: string;
    postsCount?: number;
  }> {
    const user = this.getCurrentUser();
    if (!user) {
      return { status: 'not_authenticated' };
    }

    try {
      const response = await fetch(`${this.API_BASE}/get-user-sync-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        return { status: 'unknown' };
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get sync status:", error);
      return { status: 'error' };
    }
  }

  /**
   * Manually trigger posts sync
   */
  async manualPostsSync(): Promise<boolean> {
    const user = this.getCurrentUser();
    if (!user) return false;

    const result = await this.triggerPostsSync(user.id);
    return result.triggered;
  }

  /**
   * Sign out user
   */
  signOut(): void {
    localStorage.removeItem("linkedin_basic_token");
    localStorage.removeItem("linkedin_dma_token");
    localStorage.removeItem("user");
    
    // Redirect to login
    window.location.href = "/";
  }

  /**
   * Start LinkedIn OAuth flow
   */
  async startOAuthFlow(flowType: 'basic' | 'dma' = 'basic'): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE}/linkedin-oauth-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowType }),
      });

      if (!response.ok) {
        throw new Error(`OAuth start failed: ${response.status}`);
      }

      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Failed to start OAuth flow:", error);
      throw error;
    }
  }
}

export const authService = new AuthService();