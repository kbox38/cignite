import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  ExternalLink, 
  MessageCircle, 
  Copy, 
  Users, 
  Clock, 
  Image as ImageIcon,
  Video,
  FileText,
  Link as LinkIcon,
  Sparkles,
  Send,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Wand2
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useAuthStore } from '../../stores/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SynergyPartner {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  linkedinMemberUrn?: string;
  dmaActive: boolean;
  createdAt: string;
}

interface PartnerPost {
  urn: string;
  createdAt: number;
  text: string;
  mediaType: string;
  thumbnail?: string;
  myComment?: {
    text: string;
    createdAt: number;
  } | null;
}

interface PartnerPostsResponse {
  partner: {
    personUrn: string;
    displayName: string;
  };
  posts: PartnerPost[];
}

export const Synergy = () => {
  const { dmaToken } = useAuthStore();
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [suggestingFor, setSuggestingFor] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Mock partners data (in production, fetch from your database)
  const partners: SynergyPartner[] = [
    {
      id: "partner-1",
      name: "Sarah Johnson",
      email: "sarah@example.com",
      avatarUrl: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
      linkedinMemberUrn: "urn:li:person:sarah123",
      dmaActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "partner-2", 
      name: "Michael Chen",
      email: "michael@example.com",
      avatarUrl: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
      linkedinMemberUrn: "urn:li:person:michael456",
      dmaActive: true,
      createdAt: new Date().toISOString()
    }
  ];

  // Fetch partner posts using Snapshot API
  const { data: partnerPostsData, isLoading: postsLoading, error: postsError } = useQuery({
    queryKey: ['synergy-partner-posts-snapshot', selectedPartner],
    queryFn: async (): Promise<PartnerPostsResponse> => {
      if (!selectedPartner) throw new Error('No partner selected');
      
      const partner = partners.find(p => p.id === selectedPartner);
      if (!partner?.linkedinMemberUrn) throw new Error('Partner URN not found');

      const response = await fetch(
        `/.netlify/functions/synergy-partner-posts?partnerPersonUrn=${encodeURIComponent(partner.linkedinMemberUrn)}`,
        {
          headers: {
            'Authorization': `Bearer ${dmaToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    enabled: !!selectedPartner && !!dmaToken,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    retry: 2,
  });

  // Generate comment suggestion
  const suggestCommentMutation = useMutation({
    mutationFn: async ({ post, partnerName }: { post: PartnerPost; partnerName: string }) => {
      const response = await fetch('/.netlify/functions/synergy-suggest-comment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post: {
            urn: post.urn,
            text: post.text,
            mediaType: post.mediaType,
            partnerName: partnerName
          },
          viewerProfile: {
            headline: "Professional LinkedIn User",
            topics: ["LinkedIn Growth", "Professional Development"]
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate suggestion');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setSuggestions(prev => ({
        ...prev,
        [data.urn]: data.suggestion
      }));
      setSuggestingFor(null);
    },
    onError: (error) => {
      console.error('Failed to generate suggestion:', error);
      setSuggestingFor(null);
    }
  });

  const handleSuggestComment = (post: PartnerPost, partnerName: string) => {
    setSuggestingFor(post.urn);
    suggestCommentMutation.mutate({ post, partnerName });
  };

  const handleCopySuggestion = (suggestion: string) => {
    navigator.clipboard.writeText(suggestion);
  };

  const handleRegenerateSuggestion = (post: PartnerPost, partnerName: string) => {
    // Remove existing suggestion and generate new one
    setSuggestions(prev => {
      const newSuggestions = { ...prev };
      delete newSuggestions[post.urn];
      return newSuggestions;
    });
    handleSuggestComment(post, partnerName);
  };

  const getMediaIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'IMAGE': return <ImageIcon size={16} />;
      case 'VIDEO': return <Video size={16} />;
      case 'ARTICLE': return <FileText size={16} />;
      case 'URN_REFERENCE': return <LinkIcon size={16} />;
      default: return null;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const selectedPartnerData = useMemo(() => {
    return partners.find(p => p.id === selectedPartner);
  }, [selectedPartner]);

  if (!dmaToken) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="text-center py-12">
          <AlertCircle size={48} className="mx-auto text-orange-400 mb-4" />
          <h2 className="text-2xl font-bold mb-4">DMA Access Required</h2>
          <p className="text-gray-600 mb-6">
            Synergy features require LinkedIn Data Member Agreement (DMA) access to view partner data.
          </p>
          <Button
            variant="primary"
            onClick={() => (window.location.href = "/")}
          >
            Enable DMA Access
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Synergy Partners</h2>
          <p className="text-gray-600 mt-1">
            Collaborate and engage with your strategic LinkedIn partners using Snapshot data
          </p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={20} className="mr-2" />
          Add Partner
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Partners List */}
        <div className="lg:col-span-1">
          <Card variant="glass" className="p-6 h-full">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Users size={20} className="mr-2" />
              Partners ({partners.length})
            </h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {partners.map((partner, index) => (
                <motion.div
                  key={partner.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedPartner === partner.id
                      ? 'bg-blue-50 border-2 border-blue-200'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                  onClick={() => setSelectedPartner(partner.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <img
                        src={partner.avatarUrl}
                        alt={partner.name}
                        className="w-12 h-12 rounded-full"
                      />
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                        partner.dmaActive ? 'bg-green-500' : 'bg-gray-400'
                      }`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {partner.name}
                      </h4>
                      <p className="text-sm text-gray-500 truncate">
                        {partner.dmaActive ? 'DMA Active' : 'DMA Inactive'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>

        {/* Partner Posts */}
        <div className="lg:col-span-2">
          {selectedPartnerData ? (
            <div className="space-y-6">
              {/* Partner Header */}
              <Card variant="glass" className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <img
                      src={selectedPartnerData.avatarUrl}
                      alt={selectedPartnerData.name}
                      className="w-16 h-16 rounded-full"
                    />
                    <div>
                      <h3 className="text-xl font-bold">{selectedPartnerData.name}</h3>
                      <p className="text-gray-600">{selectedPartnerData.email}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${
                          selectedPartnerData.dmaActive ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                        <span className="text-sm text-gray-500">
                          {selectedPartnerData.dmaActive ? 'DMA Active' : 'DMA Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {partnerPostsData?.posts?.length || 0}
                    </div>
                    <div className="text-sm text-gray-500">
                      Latest Posts
                    </div>
                  </div>
                </div>
              </Card>

              {/* Partner Posts */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Latest Posts (Snapshot Data)</h4>
                
                {postsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Card key={i} variant="glass" className="p-6">
                        <div className="animate-pulse">
                          <div className="h-4 bg-gray-300 rounded w-1/4 mb-4"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-gray-300 rounded"></div>
                            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                          </div>
                          <div className="h-20 bg-gray-300 rounded mt-4"></div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : postsError ? (
                  <Card variant="glass" className="p-6 text-center">
                    <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
                    <p className="text-red-600">Error loading posts: {postsError.message}</p>
                    {postsError.message.includes('partner_not_authorized') && (
                      <div className="mt-4">
                        <Button variant="primary">
                          Request Partner Reconnection
                        </Button>
                      </div>
                    )}
                  </Card>
                ) : partnerPostsData && partnerPostsData.posts.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {partnerPostsData.posts.map((post, index) => (
                      <motion.div
                        key={post.urn}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card variant="glass" className="p-6 hover:shadow-lg transition-all duration-200">
                          {/* Post Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Clock size={14} />
                              <span>{formatDate(post.createdAt)}</span>
                              {post.mediaType !== 'TEXT' && (
                                <>
                                  <span>•</span>
                                  <div className="flex items-center space-x-1">
                                    {getMediaIcon(post.mediaType)}
                                    <span>{post.mediaType}</span>
                                  </div>
                                </>
                              )}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => window.open(`https://linkedin.com/feed/update/${post.urn}`, '_blank')}
                            >
                              <ExternalLink size={14} />
                            </Button>
                          </div>

                          {/* Media Thumbnail */}
                          {post.thumbnail && (
                            <div className="w-full h-32 bg-gray-100 rounded-lg mb-4 overflow-hidden">
                              <img
                                src={post.thumbnail}
                                alt="Post media"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          )}

                          {/* Post Content */}
                          <div className="mb-4">
                            <p className="text-gray-800 leading-relaxed line-clamp-3">
                              {post.text}
                            </p>
                          </div>

                          {/* My Comment Section */}
                          <div className="border-t pt-4">
                            <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                              <MessageCircle size={16} className="mr-2" />
                              Your Engagement
                            </h5>

                            {post.myComment ? (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-start space-x-2">
                                  <CheckCircle size={16} className="text-green-600 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium text-green-800">
                                      Your comment
                                    </p>
                                    <p className="text-sm text-green-700 mt-1">
                                      "{post.myComment.text}"
                                    </p>
                                    <p className="text-xs text-green-600 mt-1">
                                      {formatDate(post.myComment.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : suggestions[post.urn] ? (
                              <div className="space-y-3">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <p className="text-sm font-medium text-blue-800 mb-2">AI Suggestion:</p>
                                  <p className="text-sm text-blue-700 mb-3">"{suggestions[post.urn]}"</p>
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCopySuggestion(suggestions[post.urn])}
                                    >
                                      <Copy size={14} className="mr-1" />
                                      Copy
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(`https://linkedin.com/feed/update/${post.urn}`, '_blank')}
                                    >
                                      <Send size={14} className="mr-1" />
                                      Use on LinkedIn
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRegenerateSuggestion(post, selectedPartnerData.name)}
                                      disabled={suggestingFor === post.urn}
                                    >
                                      <RefreshCw size={14} className="mr-1" />
                                      Regenerate
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                  <p className="text-sm text-gray-600">
                                    No comment found. Generate an AI suggestion to engage with this post.
                                  </p>
                                </div>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSuggestComment(post, selectedPartnerData.name)}
                                  disabled={suggestingFor === post.urn}
                                  className="w-full"
                                >
                                  {suggestingFor === post.urn ? (
                                    <>
                                      <LoadingSpinner size="sm" className="mr-2" />
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles size={16} className="mr-2" />
                                      Suggest Comment with AI
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <Card variant="glass" className="p-8 text-center">
                    <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-2">No recent posts</p>
                    <p className="text-sm text-gray-400">
                      This partner hasn't published posts in their MEMBER_SHARE_INFO snapshot.
                    </p>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <Card variant="glass" className="p-12 text-center h-full flex items-center justify-center">
              <div>
                <Users size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  Select a Partner
                </h3>
                <p className="text-gray-500">
                  Choose a synergy partner from the list to view their latest posts from Snapshot data.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Add Partner Modal */}
      {showAddModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Synergy Partner</h3>
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Partner's LinkedIn URN
                </label>
                <input
                  type="text"
                  placeholder="urn:li:person:ABC123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle size={16} className="text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">DMA Requirement</p>
                    <p>Both you and your partner must have completed LinkedIn DMA consent to share synergy data via Snapshot API.</p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                >
                  <Plus size={16} className="mr-2" />
                  Add Partner
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};