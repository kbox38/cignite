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
  repurposeStatus: {
    status: "too_soon" | "close" | "ready";
    label: string;
    color: string;
    canRepost: boolean;
    daysUntilReady?: number;
  };
  likes: number;
  comments: number;
  shares: number;
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

      const response = await fetch(`/.netlify/functions/postpulse-data-v2?${params}`, {
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
      
      return {
        posts: result.posts,
        isLoading: false,
        error: null,
        pagination: result.pagination,
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

// V2 hook for new PostPulse functionality
export const usePostPulseDataV2 = (
  options: PostPulseDataOptions
): PostPulseDataResponse => {
  return usePostPulseData(options);
};