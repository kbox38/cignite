import { PostData } from '../types/linkedin';

const CACHE_KEY_PREFIX = 'postPulseData_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // FIX: 24 hours as documented

export const getCachedPostPulseData = (userId: string): { posts: PostData[], timestamp: string } | null => {
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

export const setCachedPostPulseData = (userId: string, posts: PostData[]) => {
    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
    const dataToCache = {
        posts,
        timestamp: new Date().toISOString(),
        version: '1.0', // FIX: Add version for cache validation
        totalCount: posts.length
    };

    try {
        localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
    } catch (error) {
        console.error('Error setting cached Post Pulse data:', error);
        // Handle storage quota exceeded
        if (error.name === 'QuotaExceededError') {
            console.warn('LocalStorage quota exceeded, clearing old cache');
            clearOldCache();
            try {
                localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
            } catch (retryError) {
                console.error('Failed to cache even after cleanup:', retryError);
            }
        }
    }
};

// FIX: Add cache cleanup functionality
const clearOldCache = () => {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_KEY_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
};