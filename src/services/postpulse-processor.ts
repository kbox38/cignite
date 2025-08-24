import { getCachedPostPulseData, setCachedPostPulseData } from './postpulse-cache';
import { PostPulseData } from '../types/linkedin';
import { useAuthStore } from '../stores/authStore';

export const processPostPulseData = (posts: PostPulseData[], filters: { timeFilter: string; postType: string; sortBy: string; }) => {
  const { timeFilter, postType, sortBy } = filters;

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let filteredPosts = posts.filter(post => {
    if (!post || typeof post.createdAt !== 'number') return false;
    
    if (timeFilter === '7d' && post.createdAt < sevenDaysAgo) return false;
    if (timeFilter === '30d' && post.createdAt < thirtyDaysAgo) return false;
    
    if (postType !== 'all') {
      if (postType === 'text' && (post.media_url || post.document_url)) return false;
      if (postType === 'image' && !post.media_url) return false;
      if (postType === 'video' && !post.media_url) return false; 
      if (postType === 'document' && !post.document_url) return false;
    }
    return true;
  });

  filteredPosts.sort((a, b) => {
    if (sortBy === 'recent') return b.createdAt - a.createdAt;
    if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
    if (sortBy === 'comments') return (b.comments || 0) - (a.comments || 0);
    if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
    // Default to engagement
    const engagementA = (a.likes || 0) + (a.comments || 0);
    const engagementB = (b.likes || 0) + (b.comments || 0);
    return engagementB - engagementA;
  });

  return filteredPosts;
};

export const getPostPulseData = async (forceRefresh = false) => {
  // Get auth data from the auth store
  const { dmaToken, profile } = useAuthStore.getState();
  
  if (!dmaToken) {
    throw new Error("LinkedIn DMA token not found. Please reconnect your account.");
  }
  
  if (!profile?.id) {
    throw new Error("User profile not found. Please reconnect your account.");
  }
  
  const user_id = profile.id;

  if (!forceRefresh) {
    const cachedData = getCachedPostPulseData(user_id);
    if (cachedData) {
      console.log('Serving Post Pulse data from cache');
      return { posts: cachedData.posts, isCached: true, timestamp: cachedData.timestamp };
    }
  }

  console.log('Fetching fresh Post Pulse data');
  const response = await fetch(`/.netlify/functions/postpulse-data?forceRefresh=${forceRefresh}`, {
    headers: {
      'Authorization': `Bearer ${dmaToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Failed to fetch Post Pulse data. Status: ${response.status}`);
  }

  const data = await response.json();
  setCachedPostPulseData(user_id, data.posts);
  return { posts: data.posts, isCached: false, timestamp: new Date().toISOString() };
};