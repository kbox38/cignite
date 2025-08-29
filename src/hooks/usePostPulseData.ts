import { useState, useEffect, useCallback } from 'react';
import { getPostPulseData, processPostPulseData } from '../services/postpulse-processor';
import { PostData, CacheStatus } from '../types/linkedin';

export const usePostPulseData = () => {
  const [allPosts, setAllPosts] = useState<PostData[]>([]);
  const [processedPosts, setProcessedPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    timeFilter: '90d', // FIX: Default to 90 days to show all posts
    postType: 'all',
    sortBy: 'oldest', // FIX: Default to oldest first
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    isCached: false,
    timestamp: null,
  });

  const POSTS_PER_PAGE = 9;

  // FIX: Enhanced fetchData with better error handling
  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('usePostPulseData: Starting data fetch...');
      const data = await getPostPulseData(forceRefresh);
      
      // FIX: Validate data structure
      if (data && Array.isArray(data.posts)) {
        console.log(`usePostPulseData: Received ${data.posts.length} posts`);
        setAllPosts(data.posts);
        setCacheStatus({
          isCached: data.isCached || false,
          timestamp: data.timestamp || new Date().toISOString(),
        });
      } else {
        console.warn('usePostPulseData: Invalid data structure received:', data);
        setAllPosts([]);
        setCacheStatus({
          isCached: false,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('usePostPulseData: Error fetching data:', errorMessage);
      setError(errorMessage);
      
      // FIX: Don't clear existing posts on error, just show error message
      if (allPosts.length === 0) {
        setAllPosts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [allPosts.length]);

  // FIX: Initialize data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // FIX: Process posts with error handling
  useEffect(() => {
    try {
      if (Array.isArray(allPosts) && allPosts.length > 0) {
        console.log(`usePostPulseData: Processing ${allPosts.length} posts with filters:`, filters);
        const processed = processPostPulseData(allPosts, filters);
        setProcessedPosts(Array.isArray(processed) ? processed : []);
        setCurrentPage(1); // Reset to first page on filter change
      } else {
        setProcessedPosts([]);
      }
    } catch (processingError) {
      console.error('usePostPulseData: Error processing posts:', processingError);
      setProcessedPosts([]);
      setError('Error processing posts data');
    }
  }, [allPosts, filters]);

  // FIX: Safe pagination calculations
  const totalPages = Math.max(1, Math.ceil((processedPosts?.length || 0) / POSTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * POSTS_PER_PAGE;
  const endIndex = startIndex + POSTS_PER_PAGE;
  const paginatedPosts = Array.isArray(processedPosts) 
    ? processedPosts.slice(startIndex, endIndex)
    : [];

  // FIX: Safe refresh function
  const refreshData = useCallback(() => {
    console.log('usePostPulseData: Manual refresh triggered');
    fetchData(true);
  }, [fetchData]);

  // FIX: Safe setFilters wrapper
  const safeSetFilters = useCallback((newFilters: typeof filters) => {
    console.log('usePostPulseData: Updating filters:', newFilters);
    setFilters(newFilters);
  }, []);

  return {
    posts: paginatedPosts,
    loading,
    error,
    filters,
    setFilters: safeSetFilters,
    currentPage: safePage,
    totalPages,
    setCurrentPage,
    cacheStatus,
    refreshData,
  };
};