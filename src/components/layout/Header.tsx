import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../ui/Button';
import { useLinkedInProfile } from '../../hooks/useLinkedInData';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NotificationDropdown } from './NotificationDropdown';

export const Header = () => {
  const { darkMode, setDarkMode } = useAppStore();
  const { profile, logout, setTokens, setProfile } = useAuthStore();
  const { data: linkedInProfile } = useLinkedInProfile();


  const displayProfile = linkedInProfile || profile;

  // Fetch pending invitations for notification badge
  const { data: notificationsData } = useQuery({
    queryKey: ['pending-invitations'],
    queryFn: async () => {
      const response = await fetch('/.netlify/functions/synergy-partners', {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().dmaToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) return { pendingInvitations: [] };
      
      const data = await response.json();
      
      // Ensure we always return a valid structure
      return {
        pendingInvitations: Array.isArray(data?.pendingInvitations) ? data.pendingInvitations : [],
        partners: Array.isArray(data?.partners) ? data.partners : []
      };
    },
    enabled: !!useAuthStore.getState().dmaToken,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const pendingCount = Array.isArray(notificationsData?.pendingInvitations) ? notificationsData.pendingInvitations.length : 0;
  const handleLogout = () => {
    // Clear all auth data
    setTokens(null, null);
    setProfile(null);
    logout();
    // Force page reload to ensure clean state
    window.location.href = '/';
  };

  return (
    <motion.header
      className="bg-white/80 backdrop-blur-xl border-b border-gray-200 px-6 py-4 text-gray-900"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <motion.h2
            className="text-2xl font-bold text-gray-800"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            Welcome back, {displayProfile?.given_name || 'User'}!
          </motion.h2>
        </div>

        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <NotificationDropdown
            pendingCount={pendingCount}
            notificationsData={notificationsData}
          />
          {/* Profile */}
          <div className="flex items-center space-x-3">
            {displayProfile?.picture ? (
              <img
                src={displayProfile.picture}
                alt="Profile"
                className="w-8 h-8 rounded-full ring-2 ring-blue-500"
              />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </motion.header>
  );
};