import React from 'react';
import { usePostPulseData } from '../../hooks/usePostPulseData';
import { PostCard } from './PostPulse/PostCard';
import { FilterControls } from './PostPulse/FilterControls';
import { Pagination } from '../ui/Pagination';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { CacheStatusIndicator } from '../ui/CacheStatusIndicator';

const PostPulse = () => {
  const data = usePostPulseData();

  // --- DIAGNOSTIC LOG ---
  console.log('PostPulse component received:', data);
  
  const {
    posts,
    loading,
    error,
    filters,
    setFilters,
    currentPage,
    totalPages,
    setCurrentPage,
    cacheStatus,
    refreshData
  } = data || {}; // Adding a fallback just in case data itself is the issue.

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Post Pulse</h1>
        <div className="flex items-center space-x-4">
          <CacheStatusIndicator status={cacheStatus} />
          <button onClick={refreshData} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Refresh Data</button>
        </div>
      </div>
      
      <FilterControls filters={filters} setFilters={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {posts && posts.map(post => (
          <PostCard key={(post as any).id} post={post} />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};

export default PostPulse;