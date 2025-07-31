import { useState, useEffect, useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';

export interface PostPulsePost {
  id: string;
  urn: string;
  title: string;
  text: string;
  url: string;
  timestamp: number;
  thumbnail: string | null;
  mediaType: string;
  mediaAssetId: string | null;
  source: "changelog" | "historical";
  daysSincePosted: number;
  canRepost: boolean;
}

export interface PostPulseDataOptions {
  timeFilter: "7d" | "30d" | "90d";
  searchTerm: string;
  page: number;
  pageSize?: number;
}

export interface PostPulseDataResponse {
  posts: PostPulsePost[];
  isLoading: boolean;
  error: Error | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalPosts: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  metadata: {
    fetchTimeMs: number;
    timeFilter: string;
    dataSource: string;
  };
  lastUpdated: string;
}

export const usePostPulseData = (
  options: PostPulseDataOptions
): PostPulseDataResponse => {
  const { timeFilter, searchTerm, page, pageSize = 12 } = options;
  const { dmaToken } = useAuthStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ['postpulse-data', timeFilter, searchTerm, page, pageSize],
    queryFn: async (): Promise<PostPulseDataResponse> => {
      const params = new URLSearchParams({
        timeFilter,
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (searchTerm) {
        params.append('searchTerm', searchTerm);
      }

      const response = await fetch(`/.netlify/functions/postpulse-data?${params}`, {
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PostPulse API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Filter posts by search term on frontend for better UX
      let filteredPosts = result.posts || [];
      if (searchTerm) {
        filteredPosts = filteredPosts.filter(post => 
          post.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          post.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      // Recalculate pagination for filtered results
      const totalFiltered = filteredPosts.length;
      const totalPages = Math.ceil(totalFiltered / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedPosts = filteredPosts.slice(startIndex, endIndex);
      
      return {
        posts: paginatedPosts,
        isLoading: false,
        error: null,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts: totalFiltered,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        metadata: result.metadata || {
          fetchTimeMs: 0,
          timeFilter,
          dataSource: "api",
        },
        lastUpdated: result.lastUpdated || new Date().toISOString(),
      };
    },
    enabled: !!dmaToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });

  return data || {
    posts: [],
    isLoading,
    error,
    pagination: {
      currentPage: page,
      totalPages: 0,
      totalPosts: 0,
      hasNextPage: false,
      hasPrevPage: false,
    },
    metadata: {
      fetchTimeMs: 0,
      timeFilter,
      dataSource: "loading",
    },
    lastUpdated: new Date().toISOString(),
  };
}