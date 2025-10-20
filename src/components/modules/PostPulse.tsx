// src/components/modules/PostPulse.tsx
// Enhanced with all-time posts support

import React from 'react';
import { usePostPulseData } from '../../hooks/usePostPulseData';
import { PostCard } from './PostPulse/PostCard';
import { Pagination } from '../ui/Pagination';
import { LoadingSpinner } from '../ui/LoadingSpinner';

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

// Enhanced Filter Controls with All-Time Toggle
const FilterControls: React.FC<{
  filters: { postType: string; sortBy: string };
  setFilters: (filters: { postType: string; sortBy: string }) => void;
  cacheStatus: any;
  refreshData: () => void;
  clearCache: () => void;
  totalPosts: number;
  dateRange?: any;
}> = ({ 
  filters, 
  setFilters, 
  cacheStatus, 
  refreshData, 
  clearCache, 
  totalPosts,
  dateRange 
}) => {
  return (
    <div className="space-y-4">
      {/* Main Controls Row */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white/50 backdrop-blur-sm rounded-lg border border-gray-200">
        {/* Post Type Filter */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-2">
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
          <label className="text-sm font-medium text-gray-700 mb-2">
            Sort By
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="recent">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="likes">Most Liked</option>
            <option value="comments">Most Commented</option>
            <option value="views">Most Viewed</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col justify-end">
          <div className="flex space-x-2">
            <button
              onClick={refreshData}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              🔄 Refresh
            </button>
            <button
              onClick={clearCache}
              className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              🗑️ Clear Cache
            </button>
          </div>
        </div>
      </div>

      {/* Stats and Info Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white/30 backdrop-blur-sm rounded-lg border border-gray-200">
        {/* Post Count */}
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {totalPosts.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">
            Recent Posts (90 days)
          </div>
        </div>

        {/* Date Range */}
        {dateRange && (
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-600">
              {dateRange.spanDays} days
            </div>
            <div className="text-sm text-gray-600">
              {new Date(dateRange.oldest).toLocaleDateString()} - {new Date(dateRange.newest).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Cache Status */}
        <div className="text-center">
          <div className={`text-lg font-semibold ${
            cacheStatus.isCached ? 'text-green-600' : 'text-orange-600'
          }`}>
            {cacheStatus.isCached ? '📦 Cached' : '🔄 Live'}
          </div>
          <div className="text-sm text-gray-600">
            {cacheStatus.timestamp 
              ? new Date(cacheStatus.timestamp).toLocaleTimeString()
              : 'No cache'
            }
          </div>
        </div>
      </div>

      {/* Repurpose Mode Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="text-blue-600 text-xl">🔄</div>
          <div>
            <h4 className="font-semibold text-blue-800 mb-1">Repurpose Mode Active</h4>
            <p className="text-sm text-blue-700">
              Posts are sorted oldest-first to help you identify content ready for repurposing. 
              Posts older than 30 days can be safely repurposed for fresh engagement.
            </p>
          </div>
        </div>
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
    refreshData,
    clearCache,
    totalPosts,
    dateRange
  } = usePostPulseData();

  // Handle loading state
  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">
              Loading your recent posts...
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
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">PostPulse</h1>
            <span className="text-2xl">🔄</span>
          </div>
          <p className="text-gray-600">
            Manage and repurpose your recent LinkedIn posts with AI-powered insights
          </p>
        </div>

        {/* Enhanced Filter Controls */}
        <FilterControls
          filters={filters}
          setFilters={setFilters}
          cacheStatus={cacheStatus}
          refreshData={refreshData}
          clearCache={clearCache}
          totalPosts={totalPosts}
          dateRange={dateRange}
        />

        {/* Posts Grid */}
        {posts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center min-h-96 mt-6">
            <div className="text-center p-8 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="text-yellow-600 mb-4 text-4xl">📝</div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                No Posts Found
              </h3>
              <p className="text-sm text-yellow-700 mb-4">
                We couldn't find any recent posts in the last 90 days. Try refreshing the data or check your LinkedIn posting activity.
              </p>
              <div className="space-y-2">
                <button
                  onClick={refreshData}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Refresh Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer with mode info */}
        <div className="mt-12 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <strong>Current Mode:</strong> Recent Posts (90 days)
            </div>
            <div>
              <strong>Data Source:</strong> LinkedIn DMA API
            </div>
            <div>
              <strong>Last Updated:</strong> {cacheStatus.timestamp 
                ? new Date(cacheStatus.timestamp).toLocaleString()
                : 'Just now'
              }
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <strong>Repurpose Features:</strong> Oldest-first sorting • 30-day repurpose eligibility • 
            Smart content recommendations • Engagement insights
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
};

export default PostPulse;