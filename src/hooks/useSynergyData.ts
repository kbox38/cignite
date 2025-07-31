import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { synergyService, SynergyPartner, PartnerPost, CrossComment } from '../services/synergy';
import { useAuthStore } from '../stores/authStore';

// Partners hooks
export const useSynergyPartners = () => {
  const { dmaToken } = useAuthStore();
  
  return useQuery({
    queryKey: ['synergy-partners'],
    queryFn: () => synergyService.getPartners(dmaToken!),
    enabled: !!dmaToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useAddPartner = () => {
  const { dmaToken } = useAuthStore();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (partnerId: string) => synergyService.addPartner(dmaToken!, partnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synergy-partners'] });
    },
  });
};

export const useRemovePartner = () => {
  const { dmaToken } = useAuthStore();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (partnerId: string) => synergyService.removePartner(dmaToken!, partnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synergy-partners'] });
    },
  });
};

// Posts hooks
export const usePartnerPosts = (partnerId: string | null, limit: number = 5) => {
  const { dmaToken } = useAuthStore();
  
  return useQuery({
    queryKey: ['synergy-posts', partnerId, limit],
    queryFn: () => synergyService.getPartnerPosts(dmaToken!, partnerId!, limit),
    enabled: !!dmaToken && !!partnerId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
};

// Comments hooks
export const useCrossComment = (authorUserId: string | null, postUrn: string | null) => {
  const { dmaToken } = useAuthStore();
  
  return useQuery({
    queryKey: ['synergy-comment', authorUserId, postUrn],
    queryFn: () => synergyService.getCommentByAuthorOnPost(dmaToken!, authorUserId!, postUrn!),
    enabled: !!dmaToken && !!authorUserId && !!postUrn,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
};

// Comment suggestions hooks
export const useSuggestComment = () => {
  const { dmaToken } = useAuthStore();
  
  return useMutation({
    mutationFn: ({
      fromUserId,
      toUserId,
      postUrn,
      postPreview,
      tone = 'supportive'
    }: {
      fromUserId: string;
      toUserId: string;
      postUrn: string;
      postPreview?: string;
      tone?: string;
    }) => synergyService.suggestComment(dmaToken!, fromUserId, toUserId, postUrn, postPreview, tone),
  });
};

// Batch hooks for multiple partners
export const useMultiplePartnerPosts = (partnerIds: string[], limit: number = 5) => {
  const { dmaToken } = useAuthStore();
  
  return useQuery({
    queryKey: ['synergy-multiple-posts', partnerIds, limit],
    queryFn: async () => {
      const results = await Promise.all(
        partnerIds.map(partnerId => 
          synergyService.getPartnerPosts(dmaToken!, partnerId, limit)
        )
      );
      
      return partnerIds.reduce((acc, partnerId, index) => {
        acc[partnerId] = results[index];
        return acc;
      }, {} as Record<string, PartnerPost[]>);
    },
    enabled: !!dmaToken && partnerIds.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
};

// Cross-comments for multiple posts
export const useMultipleCrossComments = (
  queries: Array<{ authorUserId: string; postUrn: string }>
) => {
  const { dmaToken } = useAuthStore();
  
  return useQuery({
    queryKey: ['synergy-multiple-comments', queries],
    queryFn: async () => {
      const results = await Promise.all(
        queries.map(({ authorUserId, postUrn }) => 
          synergyService.getCommentByAuthorOnPost(dmaToken!, authorUserId, postUrn)
        )
      );
      
      return queries.reduce((acc, query, index) => {
        const key = `${query.authorUserId}:${query.postUrn}`;
        acc[key] = results[index];
        return acc;
      }, {} as Record<string, CrossComment | null>);
    },
    enabled: !!dmaToken && queries.length > 0,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
};

// Analytics hooks
export const useSynergyAnalytics = (partnerId: string | null) => {
  const { dmaToken } = useAuthStore();
  
  return useQuery({
    queryKey: ['synergy-analytics', partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      
      // Fetch posts and comments for analytics
      const [posts, comments] = await Promise.all([
        synergyService.getPartnerPosts(dmaToken!, partnerId, 20),
        // In a real implementation, you'd have a separate endpoint for analytics
        Promise.resolve([])
      ]);
      
      // Calculate metrics
      const last28Days = Date.now() - (28 * 24 * 60 * 60 * 1000);
      const recentPosts = posts.filter(post => post.createdAtMs >= last28Days);
      
      return {
        totalPosts: posts.length,
        recentPosts: recentPosts.length,
        avgPostLength: posts.reduce((sum, post) => sum + post.textPreview.length, 0) / posts.length,
        mediaPostsRatio: posts.filter(post => post.mediaType !== 'NONE').length / posts.length,
        lastPostDate: posts.length > 0 ? Math.max(...posts.map(p => p.createdAtMs)) : null,
      };
    },
    enabled: !!dmaToken && !!partnerId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};