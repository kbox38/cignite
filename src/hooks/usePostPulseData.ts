// src/hooks/usePostPulseData.ts
// Enhanced with all-time posts support

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { PostData } from '../types/linkedin';
import { getPostPulseData, processPostPulseData, clearPostPulseCache, PostPulseFilters } from '../services/postpulse-processor';

interface UsePostPulseDataResult {
  posts: PostData[];
  loading: boolean;
  error: string | null;
  filters: PostPulseFilters;
  setFilters: (filters: PostPulseFilters) => void;
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  cacheStatus: {
    isCached: boolean;
    timestamp: string | null;
    isAllTime: boolean;
  };
  refreshData: () => Promise<void>;
  clearCache: () => void;
  showAllTime: boolean;
  setShowAllTime: (show: boolean) => void;
  totalPosts: number;
  dateRange?: {
    newest: string;
    oldest: string;
    spanDays: number;
  };
}

const POSTS_PER_PAGE = 24;

export const usePostPulseData = (): UsePostPulseDataResult => {
  const { dmaToken } = useAuthStore();
  
  // State management
  const [allPosts, setAllPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllTime, setShowAllTime] = useState(false);
  const [cacheStatus, setCacheStatus] = useState({
    isCached: false,
    timestamp: null as string | null,
    isAllTime: false
  });
  const [dateRange, setDateRange] = useState<{
    newest: string;
    oldest: string;
    spanDays: number;
  } | undefined>(undefined);

  // Filters
  const [filters, setFilters] = useState<PostPulseFilters>({
    postType: 'all',
    sortBy: 'recent',
    searchQuery: '',
    showAllTime: false
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Load posts data
  const loadPosts = useCallback(async (forceRefresh = false, useAllTime = showAllTime) => {
    if (!dmaToken) {
      setError('No DMA token available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`🔄 Loading ${useAllTime ? 'ALL-TIME' : 'RECENT'} posts...`);
      
      const startTime = Date.now();
      const result = await getPostPulseData(dmaToken, useAllTime);
      const loadTime = Date.now() - startTime;
      
      console.log(`✅ Loaded ${result.posts.length} posts in ${loadTime}ms`);
      
      setAllPosts(result.posts);
      setCacheStatus({
        isCached: result.isCached,
        timestamp: result.timestamp,
        isAllTime: result.isAllTime || false
      });
      
      // Set date range if available
      if (result.posts.length > 0) {
        const timestamps = result.posts.map(p => p.createdAt).filter(t => t > 0);
        if (timestamps.length > 0) {
          const newest = Math.max(...timestamps);
          const oldest = Math.min(...timestamps);
          setDateRange({
            newest: new Date(newest).toISOString(),
            oldest: new Date(oldest).toISOString(),
            spanDays: Math.round((newest - oldest) / (1000 * 60 * 60 * 24))
          });
        }
      }
      
      setCurrentPage(1); // Reset to first page when data changes
      
    } catch (err) {
      console.error('❌ Error loading posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [dmaToken, showAllTime]);

  // Initial load
  useEffect(() => {
    loadPosts(false, showAllTime);
  }, [loadPosts, showAllTime]);

  // Update filters when showAllTime changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, showAllTime }));
  }, [showAllTime]);

  // Refresh function
  const refreshData = useCallback(async () => {
    await loadPosts(true, showAllTime);
  }, [loadPosts, showAllTime]);

  // Clear cache function
  const clearCache = useCallback(() => {
    const user_id = dmaToken ? getUserIdFromToken(dmaToken) : undefined;
    clearPostPulseCache(user_id);
    setCacheStatus({
      isCached: false,
      timestamp: null,
      isAllTime: false
    });
    loadPosts(true, showAllTime); // Force reload from API
  }, [dmaToken, loadPosts, showAllTime]);

  // Handle showAllTime toggle
  const handleSetShowAllTime = useCallback((show: boolean) => {
    setShowAllTime(show);
    setCurrentPage(1); // Reset pagination
  }, []);

  // Process and filter posts
  const filteredPosts = useMemo(() => {
    if (allPosts.length === 0) return [];
    return processPostPulseData(allPosts, filters);
  }, [allPosts, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    return filteredPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);
  }, [filteredPosts, currentPage]);

  // Auto-reset page if out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  return {
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
    clearCache,
    showAllTime,
    setShowAllTime: handleSetShowAllTime,
    totalPosts: filteredPosts.length,
    dateRange
  };
};

// Helper function to extract user ID from token
const getUserIdFromToken = (token: string): string => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || 'unknown';
  } catch {
    return 'fallback_user';
  }
};