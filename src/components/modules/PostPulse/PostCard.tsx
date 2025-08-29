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
    media_url: post.media_url || null,
    document_url: post.document_url || null,
    linkedin_url: post.linkedin_url || null
  };

  const validCreatedAt = typeof safePost.createdAt === 'number' && !isNaN(safePost.createdAt) 
    ? safePost.createdAt 
    : Date.now();

  const repurposeStatus = getRepurposeStatus(validCreatedAt);
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
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${repurposeStatus.color}`}>
          {repurposeStatus.label}
        </span>
      </div>

      <div className="mb-4">
        <p className="text-gray-800 leading-relaxed">
          {truncateText(safePost.content)}
        </p>
      </div>

      {(safePost.media_url || safePost.document_url) && (
        <div className="mb-4 p-2 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-600 font-medium">
            📎 {safePost.media_url ? 'Media attached' : 'Document attached'}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 py-2 border-t border-gray-100">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 text-gray-600">
            <Heart size={16} />
            <span className="text-sm">{safePost.likes}</span>
          </div>
          <div className="flex items-center space-x-1 text-gray-600">
            <MessageCircle size={16} />
            <span className="text-sm">{safePost.comments}</span>
          </div>
          <div className="flex items-center space-x-1 text-gray-600">
            <Share2 size={16} />
            <span className="text-sm">{safePost.shares}</span>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 font-medium">
          {safePost.likes + safePost.comments + safePost.shares} total
        </div>
      </div>

      {repurposeStatus.status === 'ready' && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRepurpose}
          className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center space-x-2 hover:from-blue-600 hover:to-cyan-600 transition-all duration-300"
        >
          <RefreshCw size={16} />
          <span>Repurpose Post</span>
        </motion.button>
      )}
      
      {repurposeStatus.status === 'close' && (
        <div className="w-full bg-yellow-50 text-yellow-700 px-4 py-2 rounded-lg font-medium text-center text-sm border border-yellow-200">
          Almost ready to repurpose (in {Math.max(0, 45 - daysAgo)} days)
        </div>
      )}
      
      {repurposeStatus.status === 'too-soon' && (
        <div className="w-full bg-red-50 text-red-700 px-4 py-2 rounded-lg font-medium text-center text-sm border border-red-200">
          Too recent to repurpose ({Math.max(0, 42 - daysAgo)} days left)
        </div>
      )}
    </motion.div>
  );
};