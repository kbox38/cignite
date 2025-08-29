import React from 'react';
import { usePostPulseData } from '../../hooks/usePostPulseData';
import { PostCard } from './PostPulse/PostCard';
import { FilterControls } from './PostPulse/FilterControls';
import { Pagination } from '../ui/Pagination';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { CacheStatusIndicator } from '../ui/CacheStatusIndicator';

// FIX: Proper error boundary component
const ErrorBoundary: React.FC<{ children: React.ReactNode; error?: string }> = ({ children, error }) => {
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <div className="text-red-600 mb-2">⚠️ Error Loading Posts</div>
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

// FIX: Safe component with proper error handling and null checks
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

  // FIX: Handle loading state properly
  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading your posts...</p>
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
            <p className="text-gray-600 mt-2">Manage and repurpose your historical posts</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {cacheStatus && <CacheStatusIndicator status={cacheStatus} />}
            <button 
              onClick={refreshData} 
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        </div>
        
        {/* Filter Controls */}
        {setFilters && <FilterControls filters={filters} setFilters={setFilters} />}

        {/* Posts Grid */}
        {posts && posts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {posts.map((post, index) => (
                <PostCard 
                  key={post?.id || `post-${index}`} 
                  post={post} 
                />
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
          /* Empty State */
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-gray-600 mb-2">📝 No Posts Found</div>
              <div className="text-sm text-gray-700 mb-4">
                {error ? 'There was an error loading your posts.' : 'You don\'t have any posts in the selected time period.'}
              </div>
              <div className="space-y-2">
                <button
                  onClick={refreshData}
                  className="block mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Refresh Posts
                </button>
                <p className="text-xs text-gray-500">
                  Make sure you have DMA permissions enabled and have posted on LinkedIn recently.
                </p>
              </div>
            </div>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
};