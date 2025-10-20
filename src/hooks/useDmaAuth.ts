import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useDmaAuth = () => {
  const { dmaToken, userId, setUserId } = useAuthStore();

  useEffect(() => {
    // Only fetch userId if we have DMA token but no userId
    if (dmaToken && !userId) {
      fetchUserIdFromToken();
    }
  }, [dmaToken, userId]);

  const fetchUserIdFromToken = async () => {
    try {
      console.log('useDmaAuth: Fetching userId from DMA token...');
      
      const response = await fetch('/.netlify/functions/user-registration', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dmaToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.userId) {
          console.log('useDmaAuth: Setting userId:', data.userId);
          setUserId(data.userId);
        } else {
          console.warn('useDmaAuth: No userId in response');
        }
      } else {
        console.error('useDmaAuth: Failed to get userId:', response.status);
      }
    } catch (error) {
      console.error('useDmaAuth: Error fetching userId:', error);
    }
  };

  return { userId, fetchUserIdFromToken };
};
