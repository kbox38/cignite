import { useState, useEffect, useCallback } from 'react';
import { getPostPulseData, processPostPulseData } from '../services/postpulse-processor';
import { PostPulseData, CacheStatus } from '../types/linkedin';

export const usePostPulseData = () => {
  const [allPosts, setAllPosts] = useState<PostPulseData[]>([]);
  const [processedPosts, setProcessedPosts] = useState<PostPulseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    timeFilter: '7d',
    postType: 'all',
    sortBy: 'engagement',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    isCached: false,
    timestamp: null,
  });

  const POSTS_PER_PAGE = 9;

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPostPulseData(forceRefresh);
      setAllPosts(data.posts);
      setCacheStatus({
        isCached: data.isCached,
        timestamp: data.timestamp,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const processed = processPostPulseData(allPosts, filters);
    setProcessedPosts(processed);
    setCurrentPage(1); // Reset to first page on filter change
  }, [allPosts, filters]);

  const totalPages = Math.ceil(processedPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = processedPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  const refreshData = () => {
    fetchData(true);
  };

  const returnState = {
    posts: paginatedPosts,
    loading,
    error,
    filters,
    setFilters,
    currentPage,
    totalPages,
    setCurrentPage,
    cacheStatus,
    refreshData,
  };

  // --- DIAGNOSTIC LOG ---
  console.log('usePostPulseData hook is returning:', returnState);

  return returnState;
};