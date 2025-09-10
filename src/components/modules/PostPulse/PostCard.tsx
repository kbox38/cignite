import React from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Calendar, RefreshCw } from 'lucide-react';
import { getRepurposeStatus, repurposePost } from '../../../services/postpulse-processor';
import { PostData } from '../../../types/linkedin';

interface PostCardProps {
  post: PostData;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  if (!post || typeof post !== 'object') {
    return (
      <div className="bg-gray-100 rounded-xl p-6 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Invalid post data</p>
      </div>
    );
  }

  const safePost = {
    id: post.id || `post-${Math.random().toString(36).substr(2, 9)}`,
    content: post.content || post.text || 'No content available',
    createdAt: post.createdAt || post.timestamp || Date.now(),
    likes: parseInt(String(post.likes || 0), 10) || 0,
    comments: parseInt(String(post.comments || 0), 10) || 0,
    shares: parseInt(String(post.shares || 0), 10) || 0,
    impressions: parseInt(String(post.impressions || post.views || 0), 10) || 0,
    media_url: post.media_url || post.mediaUrl || null, // Support both field names
    document_url: post.document_url || null,
    linkedin_url: post.linkedin_url || null,
    mediaType: post.mediaType || 'unknown' // Add media type support
  };

  const validCreatedAt = typeof safePost.createdAt === 'number' && !isNaN(safePost.createdAt) 
    ? safePost.createdAt 
    : Date.now();

  const repurposeStatus = getRepurposeStatus({
    ...post,
    createdAt: validCreatedAt
  });
  
  const postDate = new Date(validCreatedAt).toLocaleDateString();
  const daysAgo = Math.floor((Date.now() - validCreatedAt) / (1000 * 60 * 60 * 24));

  const handleRepurpose = () => {
    try {
      repurposePost({
        ...post,
        content: safePost.content,
        createdAt: validCreatedAt
      });
    } catch (error) {
      console.error('Error repurposing post:', error);
    }
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (!text || typeof text !== 'string') return 'No content available';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-2">
          <Calendar size={16} className="text-gray-500" />
          <span className="text-sm text-gray-600">{postDate}</span>
          <span className="text-xs text-gray-400">({daysAgo} days ago)</span>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          repurposeStatus.canRepurpose 
            ? 'bg-green-100 text-green-700' 
            : 'bg-yellow-100 text-yellow-700'
        }`}>
          {repurposeStatus.message}
        </span>
      </div>

      {/* ADD MEDIA DISPLAY HERE - BETWEEN DATE AND CONTENT */}
      {safePost.media_url && safePost.mediaType === 'image' && (
        <div className="mb-4">
          <img 
            src={safePost.media_url} 
            alt="Post media" 
            className="w-full h-48 object-cover rounded-lg border border-gray-200"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            onLoad={() => {
              // Image loaded successfully
            }}
          />
        </div>
      )}

      <div className="mb-4">
        <p className="text-gray-800 leading-relaxed">
          {truncateText(safePost.content)}
        </p>
      </div>

      {(safePost.media_url || safePost.document_url) && (
        <div className="mb-4 p-2 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-600 font-medium">
            📎 {safePost.media_url ? 'Contains media' : 'Contains document'}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <Heart size={16} className="text-red-500" />
            <span className="text-sm text-gray-600">{safePost.likes}</span>
          </div>
          <div className="flex items-center space-x-1">
            <MessageCircle size={16} className="text-blue-500" />
            <span className="text-sm text-gray-600">{safePost.comments}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Share2 size={16} className="text-green-500" />
            <span className="text-sm text-gray-600">{safePost.shares}</span>
          </div>
          <div className="text-sm text-gray-500">
            {safePost.impressions > 0 && `${safePost.impressions} total`}
          </div>
        </div>

        <button
          onClick={handleRepurpose}
          disabled={!repurposeStatus.canRepurpose}
          className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            repurposeStatus.canRepurpose
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <RefreshCw size={12} />
          <span>Repurpose</span>
        </button>
      </div>
    </motion.div>
  );
};