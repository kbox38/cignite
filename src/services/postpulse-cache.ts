import { PostPulseData } from '../types/linkedin';

const CACHE_KEY_PREFIX = 'postPulseData_';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// FIX: Add the "export" keyword here.
export const getCachedPostPulseData = (userId: string): { posts: PostPulseData[], timestamp: string } | null => {
    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
    const cachedItem = localStorage.getItem(cacheKey);

    if (!cachedItem) {
        return null;
    }

    try {
        const { posts, timestamp } = JSON.parse(cachedItem);
        const cacheAge = Date.now() - new Date(timestamp).getTime();

        if (cacheAge > CACHE_DURATION) {
            localStorage.removeItem(cacheKey);
            return null;
        }

        return { posts, timestamp };
    } catch (error) {
        console.error('Error parsing cached Post Pulse data:', error);
        localStorage.removeItem(cacheKey);
        return null;
    }
};

// FIX: Add the "export" keyword here as well to prevent the next build error.
export const setCachedPostPulseData = (userId: string, posts: PostPulseData[]) => {
    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
    const dataToCache = {
        posts,
        timestamp: new Date().toISOString(),
    };

    try {
        localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
    } catch (error) {
        console.error('Error setting cached Post Pulse data:', error);
    }
};