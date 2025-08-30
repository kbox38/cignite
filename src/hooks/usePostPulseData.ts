// src/hooks/usePostPulseData.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { getPostPulseData, processPostPulseData } from '../services/postpulse-processor';
import { PostData, CacheStatus } from '../types/linkedin';

export const usePostPulseData = () => {
  const [allPosts, setAllPosts] = useState<PostData[]>([]);
  const [processedPosts, setProcessedPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // FIX: Remove timeFilter since we only want the 90 most recent posts
  const [filters, setFilters] = useState({
    postType: 'all',
    sortBy: 'oldest', // FIX: Default to oldest first as requested
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    isCached: false,
    timestamp: null,
  });

  const POSTS_PER_PAGE = 12; // Show 12 posts per page

  // FIX: Enhanced fetchData with proper error handling
  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    if (forceRefresh) {
      console.log('usePostPulseData: Force refresh - clearing cache');
      const { profile } = useAuthStore.getState();
      if (profile?.sub) {
        localStorage.removeItem(`postPulseData_${profile.sub}`);
      }
    }
    
    try {
      console.log('usePostPulseData: Starting data fetch...');
      const data = await getPostPulseData(forceRefresh);
      
      if (data && Array.isArray(data.posts)) {
        console.log(`usePostPulseData: Received ${data.posts.length} posts`);
        
        if (data.posts.length > 0) {
          console.log('usePostPulseData: Sample posts received:', data.posts.slice(0, 3).map(post => ({
            id: post.id?.substring(0, 20),
            createdAt: post.createdAt,
            date: post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Invalid',
            daysOld: post.createdAt ? Math.floor((Date.now() - post.createdAt) / (1000 * 60 * 60 * 24)) : 'N/A',
            hasContent: !!post.content
          })));
        }
        
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
      
      // Don't clear existing posts on error
      if (allPosts.length === 0) {
        setAllPosts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [allPosts.length]);

  // Initialize data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Process posts when data or filters change
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

  // Safe pagination calculations
  const totalPages = Math.max(1, Math.ceil((processedPosts?.length || 0) / POSTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * POSTS_PER_PAGE;
  const endIndex = startIndex + POSTS_PER_PAGE;
  const paginatedPosts = Array.isArray(processedPosts) 
    ? processedPosts.slice(startIndex, endIndex)
    : [];

  // Safe refresh function
  const refreshData = useCallback(() => {
    console.log('usePostPulseData: Manual refresh triggered');
    fetchData(true);
  }, [fetchData]);

  // Safe setFilters wrapper
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