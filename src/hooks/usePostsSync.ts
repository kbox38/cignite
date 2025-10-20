// src/hooks/usePostsSync.ts
// React hook for managing posts sync status and operations

import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth';

export interface PostsSyncStatus {
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'unknown';
  lastSync?: string;
  postsCount?: number;
  latestPostDate?: string;
  timestamp?: string;
}

export interface PostsSyncState {
  syncStatus: PostsSyncStatus;
  isLoading: boolean;
  error?: string;
  refreshStatus: () => Promise<void>;
  triggerManualSync: () => Promise<boolean>;
  formatLastSync: () => string;
  getSyncStatusColor: () => string;
  getSyncStatusIcon: () => string;
  getSyncStatusText: () => string;
}

export function usePostsSync(): PostsSyncState {
  const [syncStatus, setSyncStatus] = useState<PostsSyncStatus>({
    status: 'unknown',
    postsCount: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  /**
   * Refresh sync status from API
   */
  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const status = await authService.getPostsSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get sync status';
      setError(errorMessage);
      console.error('Failed to refresh sync status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Trigger manual sync
   */
  const triggerManualSync = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(undefined);

    try {
      const success = await authService.manualPostsSync();
      
      if (success) {
        // Update status to syncing immediately
        setSyncStatus(prev => ({ ...prev, status: 'syncing' }));
        
        // Poll for completion
        setTimeout(() => {
          refreshStatus();
        }, 2000);
      }

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to trigger sync';
      setError(errorMessage);
      console.error('Failed to trigger manual sync:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  /**
   * Format last sync time for display
   */
  const formatLastSync = useCallback((): string => {
    if (!syncStatus.lastSync) return 'Never';

    const lastSync = new Date(syncStatus.lastSync);
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return lastSync.toLocaleDateString();
  }, [syncStatus.lastSync]);

  /**
   * Get status color for UI
   */
  const getSyncStatusColor = useCallback((): string => {
    switch (syncStatus.status) {
      case 'completed':
        return 'text-green-600';
      case 'syncing':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-500';
    }
  }, [syncStatus.status]);

  /**
   * Get status icon for UI
   */
  const getSyncStatusIcon = useCallback((): string => {
    switch (syncStatus.status) {
      case 'completed':
        return '✅';
      case 'syncing':
        return '🔄';
      case 'failed':
        return '❌';
      case 'pending':
        return '⏳';
      default:
        return '❓';
    }
  }, [syncStatus.status]);

  /**
   * Get human-readable status text
   */
  const getSyncStatusText = useCallback((): string => {
    switch (syncStatus.status) {
      case 'completed':
        return `✅ Synced (${syncStatus.postsCount || 0} posts)`;
      case 'syncing':
        return '🔄 Syncing posts...';
      case 'failed':
        return '❌ Sync failed';
      case 'pending':
        return '⏳ Sync pending';
      default:
        return '❓ Status unknown';
    }
  }, [syncStatus.status, syncStatus.postsCount]);

  // Load initial status
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Auto-refresh if syncing
  useEffect(() => {
    if (syncStatus.status === 'syncing') {
      const interval = setInterval(() => {
        refreshStatus();
      }, 3000); // Check every 3 seconds

      return () => clearInterval(interval);
    }
  }, [syncStatus.status, refreshStatus]);

  return {
    syncStatus,
    isLoading,
    error,
    refreshStatus,
    triggerManualSync,
    formatLastSync,
    getSyncStatusColor,
    getSyncStatusIcon,
    getSyncStatusText
  };
}