// src/components/Synergy.tsx
// Updated Synergy component with posts sync status and controls

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Sync, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { usePostsSync } from '../../hooks/usePostsSync';

interface SynergyPartner {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  linkedinMemberUrn?: string;
  dmaActive: boolean;
  createdAt: string;
  lastPostsSync?: string;
  postsSyncStatus?: string;
}

interface PartnerPost {
  postUrn: string;
  createdAtMs: number;
  textPreview: string;
  mediaType: string;
  likesCount?: number;
  commentsCount?: number;
  engagementRate?: number;
}

export default function Synergy() {
  const [partners, setPartners] = useState<SynergyPartner[]>([]);
  const [partnerPosts, setPartnerPosts] = useState<Record<string, PartnerPost[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState<Record<string, boolean>>({});
  
  // Use posts sync hook
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

  // Load partners on component mount
  useEffect(() => {
    loadPartners();
  }, []);

  /**
   * Load synergy partners
   */
  async function loadPartners() {
    try {
      const response = await fetch('/.netlify/functions/synergy-partners');
      if (!response.ok) throw new Error('Failed to load partners');
      
      const data = await response.json();
      setPartners(data.partners || []);
    } catch (error) {
      console.error('Failed to load partners:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Load posts for a specific partner
   */
  async function loadPartnerPosts(partnerId: string) {
    if (postsLoading[partnerId]) return;
    
    setPostsLoading(prev => ({ ...prev, [partnerId]: true }));
    
    try {
      const response = await fetch('/.netlify/functions/synergy-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerUserId: partnerId })
      });
      
      if (!response.ok) throw new Error('Failed to load posts');
      
      const data = await response.json();
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
   * Handle manual sync trigger
   */
  async function handleManualSync() {
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
   * Select partner and load their posts
   */
  function selectPartner(partnerId: string) {
    setSelectedPartner(partnerId);
    loadPartnerPosts(partnerId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Sync Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Synergy Partners</h1>
            <p className="text-gray-600">Collaborate and engage with your network</p>
          </div>
        </div>
        
        {/* Posts Sync Status */}
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className={`text-sm font-medium ${getSyncStatusColor()}`}>
              {getSyncStatusText()}
            </div>
            <div className="text-xs text-gray-500">
              Last sync: {formatLastSync()}
            </div>
          </div>
          
          <button
            onClick={handleManualSync}
            disabled={syncLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncLoading ? 'animate-spin' : ''}`} />
            {syncLoading ? 'Syncing...' : 'Sync Posts'}
          </button>
        </div>
      </div>

      {/* Sync Error */}
      {syncError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800 text-sm">{syncError}</span>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partners List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Partners</h3>
                <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full text-blue-600 bg-blue-100 hover:bg-blue-200">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Partner
                </button>
              </div>
            </div>
            
            <div className="p-4">
              {partners.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No partners yet</p>
                  <p className="text-gray-400 text-xs">Add partners to start collaborating</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {partners.map((partner) => (
                    <motion.div
                      key={partner.id}
                      whileHover={{ scale: 1.02 }}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedPartner === partner.id
                          ? 'bg-blue-50 border-2 border-blue-200'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                      onClick={() => selectPartner(partner.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {partner.avatarUrl ? (
                            <img
                              src={partner.avatarUrl}
                              alt={partner.name}
                              className="h-10 w-10 rounded-full"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center text-white font-medium">
                              {partner.name?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {partner.name || 'Unnamed Partner'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {partner.email}
                          </p>
                        </div>
                        
                        <div className="flex-shrink-0">
                          {partner.dmaActive ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                      </div>
                      
                      {/* Partner's sync status */}
                      {partner.lastPostsSync && (
                        <div className="mt-2 text-xs text-gray-400">
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

        {/* Partner Posts */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedPartner 
                  ? `${partners.find(p => p.id === selectedPartner)?.name}'s Latest Posts`
                  : 'Select a Partner'
                }
              </h3>
              {selectedPartner && (
                <p className="text-sm text-gray-500 mt-1">
                  Latest 5 posts • Updated automatically
                </p>
              )}
            </div>
            
            <div className="p-4">
              {!selectedPartner ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a partner to view their latest posts</p>
                </div>
              ) : postsLoading[selectedPartner] ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-500">Loading posts...</span>
                </div>
              ) : partnerPosts[selectedPartner]?.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📝</div>
                  <p className="text-gray-500">No posts found</p>
                  <p className="text-gray-400 text-sm mt-2">
                    This partner hasn't posted recently or their posts haven't synced yet
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {partnerPosts[selectedPartner]?.map((post, index) => (
                    <motion.div
                      key={post.postUrn}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="text-sm text-gray-500">
                          {new Date(post.createdAtMs).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                          {post.mediaType}
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-gray-900 text-sm leading-relaxed">
                          {post.textPreview}
                        </p>
                      </div>
                      
                      {/* Engagement metrics */}
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        {post.likesCount !== undefined && (
                          <span>❤️ {post.likesCount}</span>
                        )}
                        {post.commentsCount !== undefined && (
                          <span>💬 {post.commentsCount}</span>
                        )}
                        {post.engagementRate !== undefined && (
                          <span>📈 {(post.engagementRate * 100).toFixed(1)}%</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}