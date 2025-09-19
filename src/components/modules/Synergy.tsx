// src/components/Synergy.tsx
// Fixed to use the correct auth store for userId

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
  Eye
} from 'lucide-react';
import { usePostsSync } from '../../hooks/usePostsSync';
import AddPartnerModal from '../../AddPartnerModal';
import NotificationsPanel from '../../NotificationsPanel';
import { useAuthStore } from '../../stores/authStore'; // FIXED: Use correct auth store

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

  // FIXED: Get current user ID from correct auth store
  const { userId: currentUserId } = useAuthStore();

  // Posts sync hook
  const {
    syncStatus,
    isLoading: syncLoading,
    error: syncError,
    refreshStatus,
    triggerManualSync,
    formatLastSync,
    getSyncStatusColor,
    getSyncStatusIcon,
    getSyncStatusText
  } = usePostsSync();

  // Load data on component mount
  useEffect(() => {
    console.log('Synergy: currentUserId from auth store:', currentUserId);
    if (currentUserId) {
      loadPartners();
      loadNotificationCount();
    }
  }, [currentUserId]);

  /**
   * Load synergy partners for current user
   */
  async function loadPartners() {
    if (!currentUserId) {
      console.warn('Synergy: No currentUserId available');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Loading partners for user:', currentUserId);
      
      const response = await fetch(
        `/.netlify/functions/synergy-partners?userId=${currentUserId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to load partners: ${response.status} ${response.statusText} - ${errorData.error || ''}`);
      }

      const data = await response.json();
      console.log('Partners loaded:', data);
      
      setPartners(data.partners || []);
    } catch (error) {
      console.error('Failed to load partners:', error);
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
      const response = await fetch(
        `/.netlify/functions/synergy-invitations?userId=${currentUserId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setNotificationCount(data.receivedCount || 0);
      }
    } catch (error) {
      console.error('Failed to load notification count:', error);
    }
  }

  /**
   * Load posts for a specific partner
   */
  async function loadPartnerPosts(partnerId: string) {
    if (postsLoading[partnerId] || !currentUserId) return;
    
    setPostsLoading(prev => ({ ...prev, [partnerId]: true }));
    
    try {
      console.log(`Loading posts for partner: ${partnerId}`);
      
      const response = await fetch('/.netlify/functions/synergy-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          partnerUserId: partnerId,
          currentUserId: currentUserId 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load posts: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Posts loaded for partner ${partnerId}:`, data);
      
      setPartnerPosts(prev => ({
        ...prev,
        [partnerId]: data.posts || []
      }));
    } catch (error) {
      console.error(`Failed to load posts for partner ${partnerId}:`, error);
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
    console.log('Selecting partner:', partnerId);
    setSelectedPartner(partnerId);
    loadPartnerPosts(partnerId);
  }

  /**
   * Handle manual posts sync
   */
  async function handleManualSync() {
    console.log('Triggering manual posts sync');
    const success = await triggerManualSync();
    
    if (success) {
      // Reload partner posts after sync completes
      setTimeout(() => {
        if (selectedPartner) {
          loadPartnerPosts(selectedPartner);
        }
      }, 5000);
    }
  }

  /**
   * Handle invitation sent callback
   */
  function handleInvitationSent() {
    console.log('Invitation sent successfully');
    setShowAddPartnerModal(false);
    // Show success message or toast here if needed
  }

  /**
   * Handle invitation response callback
   */
  function handleInvitationHandled() {
    console.log('Invitation handled, refreshing data');
    loadPartners(); // Refresh partners list
    loadNotificationCount(); // Refresh notification count
    setShowNotifications(false);
  }

  /**
   * Format post date for display
   */
  function formatPostDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        </div>
      </div>

      {/* Error Messages */}
      {(error || syncError) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800 text-sm">
              {error || syncError}
            </span>
          </div>
        </motion.div>
      )}

      {/* Debug Info */}
      <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded">
        Debug: Using userId from auth store: {currentUserId}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partners List Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Partners Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Partners ({partners.length})
                </h3>
                <button 
                  onClick={() => setShowAddPartnerModal(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Partner
                </button>
              </div>
            </div>
            
            {/* Partners List */}
            <div className="p-4">
              {partners.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm mb-2">No partners yet</p>
                  <p className="text-gray-400 text-xs mb-4">
                    Add partners to start collaborating and sharing insights
                  </p>
                  <button
                    onClick={() => setShowAddPartnerModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Find Partners
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {partners.map((partner) => (
                    <motion.div
                      key={partner.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedPartner === partner.id
                          ? 'bg-blue-50 border-2 border-blue-200 shadow-sm'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100 hover:shadow-sm'
                      }`}
                      onClick={() => selectPartner(partner.id)}
                    >
                      <div className="flex items-center space-x-3">
                        {/* Partner Avatar */}
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
                  ? `${partners.find(p => p.id === selectedPartner)?.name}'s Latest Posts`
                  : 'Select a Partner'
                }
              </h3>
              {selectedPartner && (
                <p className="text-sm text-gray-500 mt-1">
                  Latest 5 posts • Updated automatically every 24 hours
                </p>
              )}
            </div>
            
            {/* Posts Content */}
            <div className="p-4">
              {!selectedPartner ? (
                // No Partner Selected
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg mb-2">Select a partner to view their latest posts</p>
                  <p className="text-gray-400 text-sm">
                    See what your synergy partners are sharing on LinkedIn
                  </p>
                </div>
              ) : postsLoading[selectedPartner] ? (
                // Loading Posts
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-500">Loading posts...</span>
                </div>
              ) : !partnerPosts[selectedPartner] || partnerPosts[selectedPartner]?.length === 0 ? (
                // No Posts Found
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📝</div>
                  <p className="text-gray-500 text-lg mb-2">No posts found</p>
                  <p className="text-gray-400 text-sm">
                    This partner hasn't posted recently or their posts haven't synced yet
                  </p>
                  <button
                    onClick={handleManualSync}
                    disabled={syncLoading}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncLoading ? 'animate-spin' : ''}`} />
                    {syncLoading ? 'Syncing...' : 'Refresh Posts'}
                  </button>
                </div>
              ) : (
                // Posts List
                <div className="space-y-4">
                  {partnerPosts[selectedPartner]?.map((post, index) => (
                    <motion.div
                      key={post.postUrn}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
                    >
                      {/* Post Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Clock className="h-4 w-4" />
                          <span>{formatPostDate(post.createdAtMs)}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                            {post.mediaType || 'TEXT'}
                          </span>
                          {post.visibility && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                              {post.visibility}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Post Content */}
                      <div className="mb-4">
                        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap">
                          {post.textPreview}
                        </p>
                      </div>

                      {/* Post Hashtags */}
                      {post.hashtags && post.hashtags.length > 0 && (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-1">
                            {post.hashtags.slice(0, 5).map((hashtag, idx) => (
                              <span 
                                key={idx}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {hashtag}
                              </span>
                            ))}
                            {post.hashtags.length > 5 && (
                              <span className="text-xs text-gray-500">
                                +{post.hashtags.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Engagement Metrics */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {post.likesCount !== undefined && (
                            <div className="flex items-center space-x-1">
                              <Heart className="h-3 w-3" />
                              <span>{formatNumber(post.likesCount)}</span>
                            </div>
                          )}
                          {post.commentsCount !== undefined && (
                            <div className="flex items-center space-x-1">
                              <MessageSquare className="h-3 w-3" />
                              <span>{formatNumber(post.commentsCount)}</span>
                            </div>
                          )}
                          {post.sharesCount !== undefined && (
                            <div className="flex items-center space-x-1">
                              <Share className="h-3 w-3" />
                              <span>{formatNumber(post.sharesCount)}</span>
                            </div>
                          )}
                          {post.impressions !== undefined && (
                            <div className="flex items-center space-x-1">
                              <Eye className="h-3 w-3" />
                              <span>{formatNumber(post.impressions)}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Engagement Rate */}
                        {post.engagementRate !== undefined && post.engagementRate > 0 && (
                          <div className="text-xs font-medium text-green-600">
                            {(post.engagementRate * 100).toFixed(1)}% engagement
                          </div>
                        )}
                      </div>

                      {/* Performance Indicator */}
                      {post.performanceTier && post.performanceTier !== 'UNKNOWN' && (
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            post.performanceTier === 'HIGH' 
                              ? 'bg-green-100 text-green-800'
                              : post.performanceTier === 'MEDIUM'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
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

      {/* Modals */}
      {currentUserId && (
        <>
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
        </>
      )}
    </div>
  );
}