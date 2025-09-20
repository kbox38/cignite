// src/components/modules/Synergy.tsx
// Complete fixed implementation with comprehensive debugging

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Plus, 
  RefreshCw, 
  Bell, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  MessageSquare,
  Heart,
  Share,
  Eye,
  User,
  ExternalLink
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import AddPartnerModal from '../../AddPartnerModal';
import NotificationsPanel from '../../NotificationsPanel';

interface SynergyPartner {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  linkedinMemberUrn?: string;
  linkedinDmaMemberUrn?: string;
  dmaActive: boolean;
  lastPostsSync?: string;
  postsSyncStatus?: string;
  partnershipId: string;
  partnershipCreatedAt: string;
}

interface PartnerPost {
  postUrn: string;
  linkedinPostId?: string;
  createdAtMs: number;
  textPreview: string;
  mediaType: string;
  mediaUrls?: string[];
  hashtags?: string[];
  mentions?: string[];
  visibility?: string;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  impressions?: number;
  clicks?: number;
  savesCount?: number;
  engagementRate?: number;
  reachScore?: number;
  algorithmScore?: number;
  sentimentScore?: number;
  repurposeEligible?: boolean;
  repurposeDate?: string;
  performanceTier?: string;
  rawData?: any;
  fetchedAt?: string;
}

export default function Synergy() {
  // State management
  const [partners, setPartners] = useState<SynergyPartner[]>([]);
  const [partnerPosts, setPartnerPosts] = useState<Record<string, PartnerPost[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState<Record<string, boolean>>({});
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // Enhanced state for debugging and sync status
  const [globalSyncStatus, setGlobalSyncStatus] = useState<{
    status: string;
    lastSync: string | null;
    postsCount: number;
  }>({
    status: 'unknown',
    lastSync: null,
    postsCount: 0
  });
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Get current user ID from auth store
  const { userId: currentUserId } = useAuthStore();

  // Load data on component mount
  useEffect(() => {
    console.log('🚀 Synergy: Component mounted, currentUserId:', currentUserId);
    if (currentUserId) {
      loadPartners();
      loadNotificationCount();
      loadUserSyncStatus();
    }
  }, [currentUserId]);

  /**
   * Load synergy partners for current user
   */
  async function loadPartners() {
    if (!currentUserId) {
      console.warn('⚠️ Synergy: No currentUserId available');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📥 Loading partners for user:', currentUserId);
      
      const response = await fetch(
        `/.netlify/functions/synergy-partners?userId=${currentUserId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📡 Partners response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to load partners: ${response.status} ${response.statusText} - ${errorData.error || ''}`);
      }

      const data = await response.json();
      console.log('✅ Partners loaded:', {
        count: data.partners?.length || 0,
        partners: data.partners
      });
      
      setPartners(data.partners || []);
    } catch (error) {
      console.error('❌ Failed to load partners:', error);
      setError(error instanceof Error ? error.message : 'Failed to load partners');
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Load notification count for pending invitations
   */
  async function loadNotificationCount() {
    if (!currentUserId) return;
    
    try {
      console.log('🔔 Loading notification count...');
      
      const response = await fetch(
        `/.netlify/functions/synergy-invitations?userId=${currentUserId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const count = data.receivedCount || 0;
        console.log('✅ Notification count loaded:', count);
        setNotificationCount(count);
      }
    } catch (error) {
      console.error('❌ Failed to load notification count:', error);
    }
  }

  /**
   * FIXED: Load posts for a specific partner with enhanced debugging
   */
  async function loadPartnerPosts(partnerId: string) {
    if (postsLoading[partnerId] || !currentUserId) {
      console.log('🚫 Skipping loadPartnerPosts:', { 
        postsLoading: postsLoading[partnerId], 
        currentUserId: !!currentUserId,
        partnerId 
      });
      return;
    }
    
    console.log('🔄 SYNERGY DEBUG: Starting loadPartnerPosts');
    console.log('📊 Debug Info:', {
      partnerId,
      currentUserId,
      timestamp: new Date().toISOString(),
      loadingState: postsLoading
    });
    
    setPostsLoading(prev => ({ ...prev, [partnerId]: true }));
    
    try {
      console.log(`🔍 Loading posts for partner: ${partnerId}`);
      
      // FIXED: Use GET method with query parameters
      const url = `/.netlify/functions/synergy-posts?partnerUserId=${encodeURIComponent(partnerId)}&limit=5&currentUserId=${encodeURIComponent(currentUserId)}`;
      console.log('🌐 Request URL:', url);
      
      const response = await fetch(url, {
        method: 'GET', // CHANGED FROM POST TO GET
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUserId}`
        }
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`Failed to load posts: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Posts loaded for partner ${partnerId}:`, {
        postsCount: data.posts?.length || 0,
        source: data.source,
        fetchedAt: data.fetchedAt,
        partnerSyncStatus: data.partnerSyncStatus,
        debugInfo: data.debugInfo
      });
      
      // Store debug info if available
      if (data.debugInfo || data.partnerSyncStatus) {
        setDebugInfo(prev => ({
          ...prev,
          [partnerId]: {
            syncStatus: data.partnerSyncStatus,
            debugInfo: data.debugInfo,
            lastFetch: new Date().toISOString()
          }
        }));
      }
      
      // Update partner posts state
      setPartnerPosts(prev => ({
        ...prev,
        [partnerId]: data.posts || []
      }));
      
    } catch (error) {
      console.error(`❌ Failed to load posts for partner ${partnerId}:`, error);
      setPartnerPosts(prev => ({
        ...prev,
        [partnerId]: []
      }));
    } finally {
      setPostsLoading(prev => ({ ...prev, [partnerId]: false }));
    }
  }

  /**
   * Select partner and load their posts
   */
  function selectPartner(partnerId: string) {
    console.log('👥 Selecting partner:', partnerId);
    setSelectedPartner(partnerId);
    loadPartnerPosts(partnerId);
  }

  /**
   * Enhanced manual sync with comprehensive debugging
   */
  async function handleManualSync() {
  const { dmaToken } = useAuthStore.getState(); // Get current user's token
  
  if (!dmaToken) {
    console.error('❌ No DMA token available');
    return;
  }

  try {
    setSyncLoading(true);
    
    const userToSync = selectedPartner || currentUserId;
    
    console.log(`🚀 Triggering sync for user: ${userToSync}`);
    
    // FIXED: Pass the user's DMA token in Authorization header
    const response = await fetch('/.netlify/functions/sync-user-posts', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dmaToken}` // Pass user's token
      },
      body: JSON.stringify({
        userId: userToSync,
        syncAll: false
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Manual sync completed:', result);
      // Handle success...
    } else {
      console.error('❌ Manual sync failed:', response.status);
      // Handle error...
    }
  } catch (error) {
    console.error('❌ Manual sync error:', error);
  } finally {
    setSyncLoading(false);
  }
}

  /**
   * Debug function to get comprehensive sync status
   */
  async function getDebugInfo(partnerId?: string) {
    const userToCheck = partnerId || currentUserId;
    if (!userToCheck) return;

    try {
      console.log('🐛 Getting debug info for:', userToCheck);
      
      const response = await fetch('/.netlify/functions/manual-sync-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userToCheck,
          operation: 'debug'
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🐛 Debug info received:', result);
        
        setDebugInfo(prev => ({
          ...prev,
          [userToCheck]: result.debugInfo
        }));
        
        return result.debugInfo;
      }
    } catch (error) {
      console.error('❌ Error getting debug info:', error);
    }
  }

  /**
   * Load current user's sync status
   */
  async function loadUserSyncStatus() {
    if (!currentUserId) return;
    
    try {
      console.log('📊 Loading user sync status...');
      
      const response = await fetch('/.netlify/functions/get-user-sync-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUserId })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ User sync status loaded:', data);
        
        setGlobalSyncStatus({
          status: data.status,
          lastSync: data.lastSync,
          postsCount: data.postsCount
        });
      } else {
        console.warn('⚠️ Failed to load user sync status:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading user sync status:', error);
    }
  }

  /**
   * Enhanced function to get sync status with debugging
   */
  function getSyncStatusText(): string {
    console.log('🔍 SYNC STATUS DEBUG:', {
      globalSyncStatus,
      selectedPartner,
      partnerPosts: selectedPartner ? partnerPosts[selectedPartner] : null,
      timestamp: new Date().toISOString()
    });

    // If we have a selected partner, check their specific status
    if (selectedPartner) {
      const partnerPostsData = partnerPosts[selectedPartner];
      const hasPartnerPosts = partnerPostsData && partnerPostsData.length > 0;
      
      console.log('👥 Partner Status Check:', {
        selectedPartner,
        hasPartnerPosts,
        postsCount: partnerPostsData?.length || 0
      });

      if (hasPartnerPosts) {
        return `✅ Partner posts loaded (${partnerPostsData.length})`;
      }
      
      if (postsLoading[selectedPartner]) {
        return '🔄 Loading partner posts...';
      }
      
      return '❓ Partner posts not available';
    }

    // Global sync status
    switch (globalSyncStatus.status) {
      case 'completed':
        return `✅ Sync completed (${globalSyncStatus.postsCount} posts)`;
      case 'syncing':
        return '🔄 Syncing posts...';
      case 'failed':
        return '❌ Sync failed';
      case 'pending':
        return '⏳ Sync pending';
      default:
        return '❓ Status unknown';
    }
  }

  /**
   * Enhanced function to get sync status color
   */
  function getSyncStatusColor(): string {
    if (selectedPartner) {
      const partnerPostsData = partnerPosts[selectedPartner];
      const hasPartnerPosts = partnerPostsData && partnerPostsData.length > 0;
      
      if (hasPartnerPosts) return 'text-green-600';
      if (postsLoading[selectedPartner]) return 'text-blue-600';
      return 'text-gray-500';
    }

    switch (globalSyncStatus.status) {
      case 'completed':
        return 'text-green-600';
      case 'syncing':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-500';
    }
  }

  /**
   * Enhanced function to format last sync time
   */
  function formatLastSync(): string {
    console.log('📅 FORMAT LAST SYNC DEBUG:', {
      globalSyncStatus,
      selectedPartner,
      partners: partners.find(p => p.id === selectedPartner)
    });

    if (selectedPartner) {
      const partner = partners.find(p => p.id === selectedPartner);
      if (partner?.lastPostsSync) {
        const syncDate = new Date(partner.lastPostsSync);
        const now = new Date();
        const diffHours = Math.round((now.getTime() - syncDate.getTime()) / (1000 * 60 * 60));
        
        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        
        const diffDays = Math.round(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return syncDate.toLocaleDateString();
      }
      return 'Never';
    }

    if (globalSyncStatus.lastSync) {
      const syncDate = new Date(globalSyncStatus.lastSync);
      const now = new Date();
      const diffHours = Math.round((now.getTime() - syncDate.getTime()) / (1000 * 60 * 60));
      
      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      
      const diffDays = Math.round(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return syncDate.toLocaleDateString();
    }

    return 'Never';
  }

  /**
   * Handle invitation sent callback
   */
  function handleInvitationSent() {
    console.log('✉️ Invitation sent successfully');
    setShowAddPartnerModal(false);
  }

  /**
   * Handle invitation response callback
   */
  function handleInvitationHandled() {
    console.log('📨 Invitation handled, refreshing data');
    loadPartners();
    loadNotificationCount();
    setShowNotifications(false);
  }

  /**
   * Format post date for display
   */
  function formatPostDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleDateString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}

  /**
   * Format engagement metrics
   */
  function formatNumber(num: number | undefined): string {
    if (num === undefined) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  // Debug panel component
  const renderDebugPanel = () => {
    if (!debugMode) return null;

    return (
      <div className="mt-6 p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-green-300 font-bold">🐛 SYNERGY DEBUG PANEL</h3>
          <button
            onClick={() => getDebugInfo(selectedPartner)}
            className="px-2 py-1 bg-green-700 text-white rounded text-xs hover:bg-green-600"
          >
            Refresh Debug Info
          </button>
        </div>
        
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div>
            <div className="text-green-300 font-bold">Current State:</div>
            <pre className="text-xs">
              {JSON.stringify({
                selectedPartner,
                currentUserId,
                globalSyncStatus,
                partnersCount: partners.length,
                postsLoading,
                selectedPartnerPosts: selectedPartner ? partnerPosts[selectedPartner]?.length : 0
              }, null, 2)}
            </pre>
          </div>
          
          {debugInfo && (
            <div>
              <div className="text-green-300 font-bold">Debug Info:</div>
              <pre className="text-xs">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-500">Loading synergy partners...</span>
      </div>
    );
  }

  // Authentication check
  if (!currentUserId) {
    return (
      <div className="text-center py-12">
        <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">Please log in to access synergy features</p>
        <p className="text-gray-400 text-sm mt-2">
          Synergy allows you to collaborate with other LinkedIn professionals
        </p>
        <div className="mt-4 text-xs text-gray-400">
          Debug: currentUserId = {String(currentUserId)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Synergy Partners</h1>
            <p className="text-gray-600">Collaborate and engage with your network</p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center space-x-4">
          {/* Debug Toggle */}
          <button
            onClick={() => setDebugMode(!debugMode)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              debugMode 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
            title="Toggle debug mode"
          >
            🐛 Debug
          </button>

          {/* Notifications Button */}
          <button
            onClick={() => setShowNotifications(true)}
            className="relative inline-flex items-center p-2 border border-gray-300 rounded-full shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <Bell className="h-5 w-5 text-gray-600" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>

          {/* Posts Sync Status */}
          <div className="text-right">
            <div className={`text-sm font-medium ${getSyncStatusColor()}`}>
              {getSyncStatusText()}
            </div>
            <div className="text-xs text-gray-500">
              Last sync: {formatLastSync()}
            </div>
          </div>
          
          {/* Manual Sync Button */}
          <button
            onClick={handleManualSync}
            disabled={syncLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncLoading ? 'animate-spin' : ''}`} />
            {syncLoading ? 'Syncing...' : 'Sync Posts'}
          </button>
          
          {/* Add Partner Button */}
          <button
            onClick={() => setShowAddPartnerModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Partner
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partners List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Your Partners</h3>
              <p className="text-sm text-gray-500 mt-1">
                {partners.length} active partnership{partners.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="p-4">
              {partners.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No synergy partners yet</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Add partners to start collaborating
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {partners.map((partner) => (
                    <motion.div
                      key={partner.id}
                      onClick={() => selectPartner(partner.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedPartner === partner.id
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center space-x-3">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          {partner.avatarUrl ? (
                            <img
                              src={partner.avatarUrl}
                              alt={partner.name}
                              className="h-10 w-10 rounded-full border-2 border-white shadow-sm"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center text-white font-medium text-sm shadow-sm">
                              {partner.name?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        
                        {/* Partner Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {partner.name || 'Unnamed Partner'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {partner.email}
                          </p>
                        </div>
                        
                        {/* Status Indicator */}
                        <div className="flex-shrink-0">
                          {partner.dmaActive ? (
                            <CheckCircle className="h-4 w-4 text-green-500" title="DMA Active" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-500" title="DMA Pending" />
                          )}
                        </div>
                      </div>
                      
                      {/* Partner Sync Status */}
                      {partner.lastPostsSync && (
                        <div className="mt-2 text-xs text-gray-400">
                          <Clock className="h-3 w-3 inline mr-1" />
                          Posts synced: {new Date(partner.lastPostsSync).toLocaleDateString()}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Partner Posts Content */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Posts Header */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedPartner 
                  ? `${partners.find(p => p.id === selectedPartner)?.name || 'Partner'}'s Posts`
                  : 'Partner Posts'
                }
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {selectedPartner
                  ? 'Recent posts from your synergy partner'
                  : 'Select a partner to view their posts'
                }
              </p>
            </div>
            
            {/* Posts Content */}
            <div className="p-4">
              {!selectedPartner ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a partner to view their posts</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Choose from your synergy partners on the left
                  </p>
                </div>
              ) : postsLoading[selectedPartner] ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading partner posts...</p>
                </div>
              ) : partnerPosts[selectedPartner]?.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No posts available</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Partner posts will appear here once synced
                  </p>
                  <button
                    onClick={handleManualSync}
                    disabled={syncLoading}
                    className="mt-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncLoading ? 'animate-spin' : ''}`} />
                    {syncLoading ? 'Syncing...' : 'Sync Partner Posts'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {partnerPosts[selectedPartner]?.map((post, index) => (
                    <motion.div
                      key={post.postUrn || index}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      {/* Post Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {partners.find(p => p.id === selectedPartner)?.avatarUrl ? (
                              <img
                                src={partners.find(p => p.id === selectedPartner)?.avatarUrl}
                                alt={partners.find(p => p.id === selectedPartner)?.name}
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center text-white font-medium text-xs">
                                {partners.find(p => p.id === selectedPartner)?.name?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {partners.find(p => p.id === selectedPartner)?.name || 'Partner'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatPostDate(post.createdAtMs)}
                            </p>
                          </div>
                        </div>
                        
                        {/* External link */}
                        <div className="flex items-center space-x-2">

                          {post.linkedinPostId && (
                            <a
                              href={`https://www.linkedin.com/feed/update/${post.linkedinPostId}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="View on LinkedIn"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Post Content */}
                      <div className="mb-4">
                        <p className="text-gray-900 text-sm leading-relaxed">
                          {post.textPreview || 'No text content available'}
                        </p>
                        
                        {/* Hashtags */}
                        {post.hashtags && post.hashtags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {post.hashtags.slice(0, 3).map((hashtag, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                #{hashtag}
                              </span>
                            ))}
                            {post.hashtags.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{post.hashtags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Performance Tier */}
                      {post.performanceTier && post.performanceTier !== 'UNKNOWN' && (
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            post.performanceTier === 'HIGH' 
                              ? 'bg-green-100 text-green-800'
                              : post.performanceTier === 'MEDIUM'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {post.performanceTier} Performance
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      {renderDebugPanel()}

      {/* Modals */}
      <AddPartnerModal
        isOpen={showAddPartnerModal}
        onClose={() => setShowAddPartnerModal(false)}
        currentUserId={currentUserId}
        onInviteSent={handleInvitationSent}
      />

      <NotificationsPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        currentUserId={currentUserId}
        onInvitationHandled={handleInvitationHandled}
      />
    </div>
  );
}