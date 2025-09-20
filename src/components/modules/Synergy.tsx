// src/components/modules/Synergy.tsx
// Enhanced implementation with fixed dates and post detail modal

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  ExternalLink,
  X,
  Calendar,
  TrendingUp,
  Sparkles,
  Copy,
  Send
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import AddPartnerModal from '../../AddPartnerModal';
import NotificationsPanel from '../../NotificationsPanel';
import { synergyService } from '@/services/synergy';

// Enhanced interfaces
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
  fullText?: string; // Full post content for modal
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

interface AICommentSuggestion {
  text: string;
  type: 'engaging' | 'professional' | 'supportive';
  reasoning: string;
}

interface PostDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: PartnerPost | null;
  partnerName: string;
  onCommentSuggestionGenerated?: (suggestions: AICommentSuggestion[]) => void;
}

// Post Detail Modal Component
const PostDetailModal: React.FC<PostDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  post, 
  partnerName,
  onCommentSuggestionGenerated 
}) => {
  const [commentSuggestions, setCommentSuggestions] = useState<AICommentSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [copiedSuggestion, setCopiedSuggestion] = useState<number | null>(null);
  const { dmaToken } = useAuthStore();

  // Generate AI comment suggestions when modal opens
  useEffect(() => {
    if (isOpen && post && dmaToken) {
      generateCommentSuggestions();
    }
  }, [isOpen, post, dmaToken]);

  const generateCommentSuggestions = async () => {
    if (!post || !dmaToken) return;

    setLoadingSuggestions(true);
    try {
      const response = await fetch('/.netlify/functions/openai-comment-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dmaToken}`
        },
        body: JSON.stringify({
          postContent: post.fullText || post.textPreview,
          postContext: {
            authorName: partnerName,
            mediaType: post.mediaType,
            hashtags: post.hashtags,
            engagementMetrics: {
              likes: post.likesCount,
              comments: post.commentsCount,
              shares: post.sharesCount
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API response ${response.status}`);
      }

      const data = await response.json();
      setCommentSuggestions(data.suggestions || []);
      onCommentSuggestionGenerated?.(data.suggestions || []);
    } catch (error) {
      console.error('Failed to generate comment suggestions:', error);
      // Fallback suggestions
      setCommentSuggestions([
        {
          text: "Great insights! Thanks for sharing this perspective.",
          type: 'professional',
          reasoning: 'Professional acknowledgment that works for most business content'
        },
        {
          text: "This resonates with my experience too. What's been your biggest takeaway?",
          type: 'engaging',
          reasoning: 'Engaging question that invites further discussion'
        }
      ]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSuggestion(index);
      setTimeout(() => setCopiedSuggestion(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatPostDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays === 0) {
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (!isOpen || !post) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                {partnerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{partnerName}'s Post</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>{formatPostDate(post.createdAtMs)}</span>
                  {post.linkedinPostId && (
                    <>
                      <span>•</span>
                      <a
                        href={`https://www.linkedin.com/feed/update/${post.linkedinPostId}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>View on LinkedIn</span>
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="flex flex-col lg:flex-row h-full max-h-[calc(90vh-80px)]">
            {/* Post Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {/* Post Text */}
              <div className="mb-6">
                <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                  {post.fullText || post.textPreview || 'No text content available'}
                </p>
                
                {/* Show if text was truncated */}
                {post.fullText && post.textPreview && post.fullText !== post.textPreview && (
                  <div className="mt-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded">
                    ✨ Full content shown (was truncated in preview)
                  </div>
                )}
              </div>

              {/* Hashtags */}
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Hashtags</h4>
                  <div className="flex flex-wrap gap-2">
                    {post.hashtags.map((hashtag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                      >
                        #{hashtag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Media Info */}
              {post.mediaType && post.mediaType !== 'TEXT' && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl">
                      {post.mediaType === 'IMAGE' && '🖼️'}
                      {post.mediaType === 'VIDEO' && '🎥'}
                      {post.mediaType === 'ARTICLE' && '📄'}
                      {post.mediaType === 'URN_REFERENCE' && '🔗'}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {post.mediaType} Content
                    </span>
                  </div>
                </div>
              )}

              {/* Engagement Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 text-red-500 mb-1">
                    <Heart className="h-4 w-4" />
                    <span className="text-sm font-medium">{formatNumber(post.likesCount)}</span>
                  </div>
                  <span className="text-xs text-gray-500">Likes</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 text-blue-500 mb-1">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm font-medium">{formatNumber(post.commentsCount)}</span>
                  </div>
                  <span className="text-xs text-gray-500">Comments</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 text-green-500 mb-1">
                    <Share className="h-4 w-4" />
                    <span className="text-sm font-medium">{formatNumber(post.sharesCount)}</span>
                  </div>
                  <span className="text-xs text-gray-500">Shares</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 text-purple-500 mb-1">
                    <Eye className="h-4 w-4" />
                    <span className="text-sm font-medium">{formatNumber(post.impressions)}</span>
                  </div>
                  <span className="text-xs text-gray-500">Views</span>
                </div>
              </div>
            </div>

            {/* AI Comment Suggestions */}
            <div className="lg:w-80 border-l border-gray-200 bg-gray-50">
              <div className="p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <h4 className="text-lg font-semibold text-gray-900">AI Comment Suggestions</h4>
                </div>

                {loadingSuggestions ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Generating smart comments...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {commentSuggestions.map((suggestion, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            suggestion.type === 'engaging' 
                              ? 'bg-blue-100 text-blue-800'
                              : suggestion.type === 'professional'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {suggestion.type}
                          </span>
                          <button
                            onClick={() => copyToClipboard(suggestion.text, index)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedSuggestion === index ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                        
                        <p className="text-gray-900 text-sm mb-2">
                          "{suggestion.text}"
                        </p>
                        
                        <p className="text-xs text-gray-500">
                          {suggestion.reasoning}
                        </p>
                        
                        <div className="mt-3 flex space-x-2">
                          <button
                            onClick={() => copyToClipboard(suggestion.text, index)}
                            className="flex-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                          >
                            Copy
                          </button>
                          {post.linkedinPostId && (
                            <a
                              href={`https://www.linkedin.com/feed/update/${post.linkedinPostId}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors text-center"
                            >
                              Comment
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Regenerate Button */}
                <button
                  onClick={generateCommentSuggestions}
                  disabled={loadingSuggestions}
                  className="w-full mt-4 px-4 py-2 bg-purple-100 hover:bg-purple-200 disabled:opacity-50 text-purple-700 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingSuggestions ? 'animate-spin' : ''}`} />
                  <span>Regenerate Suggestions</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Main Synergy Component
const Synergy: React.FC = () => {
  const { dmaToken, userId } = useAuthStore();
  const [partners, setPartners] = useState<SynergyPartner[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [partnerPosts, setPartnerPosts] = useState<Record<string, PartnerPost[]>>({});
  const [postsLoading, setPostsLoading] = useState<Record<string, boolean>>({});
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [globalSyncStatus, setGlobalSyncStatus] = useState<any>({});
  const [debugMode, setDebugMode] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PartnerPost | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);

  const currentUserId = userId || '';

  // Load initial data
  useEffect(() => {
    if (dmaToken && currentUserId) {
      loadPartners();
      loadNotificationCount();
    }
  }, [dmaToken, currentUserId]);

  // Enhanced formatPostDate function with proper timestamp handling
  const formatPostDate = (timestamp: number): string => {
    if (!timestamp || isNaN(timestamp)) {
      return 'Unknown date';
    }

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays === 0) {
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const loadPartners = async () => {
    try {
      const response = await fetch('/.netlify/functions/synergy-partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dmaToken}`
        },
        body: JSON.stringify({
          action: 'get_partners',
          userId: currentUserId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to load partners: ${response.status}`);
      }

      const data = await response.json();
      setPartners(data.partners || []);
    } catch (error) {
      console.error('Failed to load partners:', error);
      setPartners([]);
    }
  };

  const loadPartnerPosts = async (partnerId: string) => {
  if (!dmaToken || !currentUserId) {
    console.log('❌ Missing DMA token or current user ID');
    return;
  }

  setPostsLoading(prev => ({ ...prev, [partnerId]: true }));
  
  try {
    console.log('🔄 Loading partner posts:', {
      partnerId,
      currentUserId,
      direction: 'theirs' // We want to see THEIR posts
    });

    // FIXED: Now correctly passes currentUserId and uses 'theirs' direction
    const posts = await synergyService.getPartnerPosts(
      dmaToken,
      partnerId,     // Partner's ID (whose posts we want to see)
      currentUserId, // Current user's ID (who is viewing)
      10,           // Limit
      'theirs'      // Direction: show partner's posts TO current user
    );

    console.log('✅ Partner posts loaded:', {
      partnerId,
      postsCount: posts.length,
      direction: 'theirs'
    });

    setPartnerPosts(prev => ({ 
      ...prev, 
      [partnerId]: posts
    }));
  } catch (error) {
    console.error('❌ Failed to load partner posts:', error);
    setPartnerPosts(prev => ({ 
      ...prev, 
      [partnerId]: [] 
    }));
  } finally {
    setPostsLoading(prev => ({ ...prev, [partnerId]: false }));
  }
};

  const loadNotificationCount = async () => {
    try {
      const response = await fetch('/.netlify/functions/synergy-partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dmaToken}`
        },
        body: JSON.stringify({
          action: 'get_notifications_count',
          userId: currentUserId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setNotificationCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to load notification count:', error);
    }
  };

  const handlePartnerSelect = (partnerId: string) => {
    setSelectedPartner(partnerId);
    loadPartnerPosts(partnerId);
  };

  const handlePostClick = (post: PartnerPost) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const handleInvitationSent = () => {
    setShowAddPartnerModal(false);
    loadPartners();
  };

  const handleInvitationHandled = () => {
    loadPartners();
    loadNotificationCount();
    setShowNotifications(false);
  };

  if (!dmaToken) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">DMA Access Required</h3>
        <p className="text-gray-500">
          Please complete DMA authentication to access Synergy features
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Synergy Partners</h1>
          <p className="text-gray-500 mt-1">Manage your strategic LinkedIn partnerships</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setDebugMode(!debugMode)}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            {debugMode ? 'Hide Debug' : 'Debug'}
          </button>
          
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowAddPartnerModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Partner</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partners List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Your Partners</h3>
              <p className="text-sm text-gray-500 mt-1">
                {partners.length} active partnerships
              </p>
            </div>
            
            <div className="p-4">
              {partners.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No partners yet</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Add your first synergy partner to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {partners.map((partner) => (
                    <motion.div
                      key={partner.id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedPartner === partner.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      onClick={() => handlePartnerSelect(partner.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {partner.avatarUrl ? (
                            <img
                              src={partner.avatarUrl}
                              alt={partner.name}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                              {partner.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {partner.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {partner.email}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {partner.dmaActive ? (
                            <CheckCircle className="h-4 w-4 text-green-500" title="DMA Active" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-500" title="DMA Pending" />
                          )}
                        </div>
                      </div>
                      
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
                  ? 'Recent posts from your synergy partner - click to view details and get AI comment suggestions'
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
                  <p className="text-gray-500">No posts found</p>
                  <p className="text-gray-400 text-sm mt-1">
                    This partner hasn't shared any posts recently
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {partnerPosts[selectedPartner]?.map((post, index) => (
                    <motion.div
                      key={post.postUrn}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => handlePostClick(post)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      {/* Post Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          {partners.find(p => p.id === selectedPartner)?.avatarUrl ? (
                            <img
                              src={partners.find(p => p.id === selectedPartner)?.avatarUrl}
                              alt="Partner"
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold">
                              {partners.find(p => p.id === selectedPartner)?.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {partners.find(p => p.id === selectedPartner)?.name || 'Partner'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatPostDate(post.createdAtMs)}
                            </p>
                          </div>
                        </div>
                        
                        {/* External link and click hint */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            Click for AI suggestions
                          </span>
                          {post.linkedinPostId && (
                            <a
                              href={`https://www.linkedin.com/feed/update/${post.linkedinPostId}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="View on LinkedIn"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Post Content Preview */}
                      <div className="mb-4">
                        <p className="text-gray-900 text-sm leading-relaxed line-clamp-3">
                          {post.textPreview || 'No text content available'}
                        </p>
                        
                        {/* Media Type Indicator */}
                        {post.mediaType && post.mediaType !== 'TEXT' && (
                          <div className="mt-2 flex items-center space-x-2">
                            <span className="text-sm">
                              {post.mediaType === 'IMAGE' && '🖼️ Image'}
                              {post.mediaType === 'VIDEO' && '🎥 Video'}
                              {post.mediaType === 'ARTICLE' && '📄 Article'}
                              {post.mediaType === 'URN_REFERENCE' && '🔗 Link'}
                            </span>
                          </div>
                        )}
                        
                        {/* Hashtags Preview */}
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
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      {debugMode && (
        <div className="mt-6 p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-green-300 font-bold">🐛 SYNERGY DEBUG PANEL</h3>
            <button
              onClick={() => console.log('Current State:', {
                selectedPartner,
                currentUserId,
                globalSyncStatus,
                partnersCount: partners.length,
                postsLoading,
                selectedPartnerPosts: selectedPartner ? partnerPosts[selectedPartner]?.length : 0
              })}
              className="px-2 py-1 bg-green-700 text-white rounded text-xs hover:bg-green-600"
            >
              Log State to Console
            </button>
          </div>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div>
              <div className="text-green-300 font-bold">Current State:</div>
              <pre className="text-xs">
                {JSON.stringify({
                  selectedPartner,
                  currentUserId,
                  partnersCount: partners.length,
                  postsLoading,
                  selectedPartnerPosts: selectedPartner ? partnerPosts[selectedPartner]?.length : 0,
                  debugTimestamp: new Date().toISOString()
                }, null, 2)}
              </pre>
            </div>
            
            {selectedPartner && partnerPosts[selectedPartner] && (
              <div>
                <div className="text-green-300 font-bold">Selected Partner Posts Sample:</div>
                <pre className="text-xs">
                  {JSON.stringify(partnerPosts[selectedPartner]?.slice(0, 2), null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

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

      <PostDetailModal
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        post={selectedPost}
        partnerName={selectedPartner ? partners.find(p => p.id === selectedPartner)?.name || 'Partner' : 'Partner'}
        onCommentSuggestionGenerated={(suggestions) => {
          console.log('AI Comment Suggestions Generated:', suggestions);
        }}
      />
    </div>
  );
};

export default Synergy;