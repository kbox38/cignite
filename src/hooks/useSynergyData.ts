import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { synergyService, SynergyPartner, PartnerPost } from '../services/synergy';
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

// User search hook
export const useSynergyUserSearch = (searchTerm: string, limit: number = 10) => {
  const { dmaToken, userId } = useAuthStore();
  
  return useQuery({
    queryKey: ['synergy-user-search', userId, searchTerm, limit],
    queryFn: () => synergyService.searchUsers(dmaToken!, userId!, searchTerm, limit),
    enabled: !!dmaToken && !!userId && !!searchTerm.trim(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
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
export const usePartnerPosts = (partnerUserId: string | null, limit: number = 5) => {
  const { dmaToken } = useAuthStore();
  
  return useQuery({
    queryKey: ['synergy-posts', partnerUserId, limit],
    queryFn: () => synergyService.getPartnerPosts(dmaToken!, partnerUserId!, limit),
    enabled: !!dmaToken && !!partnerUserId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
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
export const useMultiplePartnerPosts = (partnerUserIds: string[], limit: number = 5) => {
  const { dmaToken } = useAuthStore();
  
  return useQuery({
    queryKey: ['synergy-multiple-posts', partnerUserIds, limit],
    queryFn: async () => {
      const results = await Promise.all(
        partnerUserIds.map(partnerUserId => 
          synergyService.getPartnerPosts(dmaToken!, partnerUserId, limit)
        )
      );
      
      return partnerUserIds.reduce((acc, partnerUserId, index) => {
        acc[partnerUserId] = results[index];
        return acc;
      }, {} as Record<string, PartnerPost[]>);
    },
    enabled: !!dmaToken && partnerUserIds.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
};



// Analytics hooks
export const useSynergyAnalytics = (partnerUserId: string | null) => {
  const { dmaToken } = useAuthStore();
  
  return useQuery({
    queryKey: ['synergy-analytics', partnerUserId],
    queryFn: async () => {
      if (!partnerUserId) return null;
      
      // Fetch posts for analytics
      const posts = await synergyService.getPartnerPosts(dmaToken!, partnerUserId, 20);
      
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
    enabled: !!dmaToken && !!partnerUserId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};