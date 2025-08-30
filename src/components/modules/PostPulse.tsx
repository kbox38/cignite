// src/components/modules/PostPulse.tsx
import React from 'react';
import { usePostPulseData } from '../../hooks/usePostPulseData';
import { PostCard } from './PostPulse/PostCard';
import { FilterControls } from './PostPulse/FilterControls';
import { Pagination } from '../ui/Pagination';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { CacheStatusIndicator } from '../ui/CacheStatusIndicator';

// Error boundary component
const ErrorBoundary: React.FC<{ children: React.ReactNode; error?: string }> = ({ children, error }) => {
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <div className="text-red-600 mb-2 text-2xl">⚠️</div>
          <div className="text-red-800 font-semibold mb-2">Error Loading Posts</div>
          <div className="text-sm text-red-700 mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

// Updated Filter Controls component (without time filter)
const UpdatedFilterControls: React.FC<{
  filters: { postType: string; sortBy: string };
  setFilters: (filters: { postType: string; sortBy: string }) => void;
}> = ({ filters, setFilters }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-white/50 backdrop-blur-sm rounded-lg border border-gray-200">
      {/* Post Type Filter */}
      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 mb-1">
          Post Type
        </label>
        <select
          value={filters.postType}
          onChange={(e) => setFilters({ ...filters, postType: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">All Posts</option>
          <option value="text">Text Only</option>
          <option value="image">With Images</option>
          <option value="video">With Videos</option>
        </select>
      </div>

      {/* Sort By Filter */}
      <div className="flex flex-col">
        <label className="text-sm font-medium text-gray-700 mb-1">
          Sort By
        </label>
        <select
          value={filters.sortBy}
          onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="oldest">Oldest First</option>
          <option value="recent">Newest First</option>
          <option value="likes">Most Liked</option>
          <option value="comments">Most Commented</option>
          <option value="views">Most Viewed</option>
        </select>
      </div>
    </div>
  );
};

// Main PostPulse component
export const PostPulse: React.FC = () => {
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
  } = usePostPulseData();

  // Handle loading state
  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading your recent posts...</p>
            <p className="mt-2 text-sm text-gray-500">
              Fetching your 90 most recent LinkedIn posts
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ErrorBoundary error={error}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Post Pulse
            </h1>
            <p className="text-gray-600 mt-2">
              Your 90 most recent LinkedIn posts - manage and repurpose them
            </p>
            {posts && posts.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Showing posts {((currentPage - 1) * 12) + 1} to {Math.min(currentPage * 12, posts.length)} 
                {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
              </p>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {cacheStatus && <CacheStatusIndicator status={cacheStatus} />}
            <button 
              onClick={refreshData} 
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Data
            </button>
          </div>
        </div>
        
        {/* Filter Controls - Updated without time filter */}
        <UpdatedFilterControls filters={filters} setFilters={setFilters} />

        {/* Posts Grid or Empty State */}
        {posts && posts.length > 0 ? (
          <>
            {/* Posts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No Recent Posts Found
            </h3>
            <p className="text-gray-500 mb-4">
              We couldn't find any recent LinkedIn posts in your account.
            </p>
            <div className="space-y-2 text-sm text-gray-400">
              <p>• Make sure you have DMA permissions enabled</p>
              <p>• Try posting some content on LinkedIn first</p>
              <p>• Check that your LinkedIn account is properly connected</p>
            </div>
            <button
              onClick={refreshData}
              className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Posts
            </button>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
};