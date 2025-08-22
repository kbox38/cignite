import React from 'react';
import { Post } from '../../../types/linkedin';
import { Card } from '../../ui/Card';

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  // Placeholder for a single post card
  return (
    <Card>
      <div className="p-4">
        <h3 className="font-bold mb-2">Post Placeholder</h3>
        <p className="text-sm text-gray-600 truncate">{post.text}</p>
      </div>
    </Card>
  );
};