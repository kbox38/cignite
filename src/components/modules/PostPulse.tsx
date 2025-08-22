import React, { useState, useEffect, useMemo } from 'react';
import { usePostPulseData } from '../../hooks/usePostPulseData';
import { PostCard } from './PostPulse/PostCard';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Pagination } from '../ui/Pagination';
import { FilterControls } from './PostPulse/FilterControls';
import { Post } from '../../types/linkedin';

export const PostPulse: React.FC = () => {
  const { posts, isLoading, error } = usePostPulseData();
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 9;

  useEffect(() => {
    if (posts) {
      setFilteredPosts(posts);
    }
  }, [posts]);

  const handleFilterChange = (filtered: Post[]) => {
    setFilteredPosts(filtered);
    setCurrentPage(1);
  };

  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * postsPerPage;
    return filteredPosts.slice(startIndex, startIndex + postsPerPage);
  }, [filteredPosts, currentPage]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error loading posts: {error.message}</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-4">PostPulse</h1>
      <p className="mb-6 text-gray-600">Analyze and repurpose your historical LinkedIn posts.</p>
      
      <FilterControls allPosts={posts || []} onFilterChange={handleFilterChange} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={filteredPosts.length}
        itemsPerPage={postsPerPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};