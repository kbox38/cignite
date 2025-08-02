import { motion } from 'framer-motion';
import { Sun, Moon, Bell, User, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../ui/Button';
import { useLinkedInProfile } from '../../hooks/useLinkedInData';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export const Header = () => {
  const { darkMode, setDarkMode } = useAppStore();
  const { profile, logout, setTokens, setProfile } = useAuthStore();
  const { data: linkedInProfile } = useLinkedInProfile();
  const [showNotifications, setShowNotifications] = useState(false);

  const displayProfile = linkedInProfile || profile;

  // Fetch pending invitations for notification badge
  const { data: notificationsData } = useQuery({
    queryKey: ['pending-invitations'],
    queryFn: async () => {
      const response = await fetch('/.netlify/functions/synergy-partners-v2', {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().dmaToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) return { pendingInvitations: [] };
      
      const data = await response.json();
      return data;
    },
    enabled: !!useAuthStore.getState().dmaToken,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });

  const pendingCount = notificationsData?.pendingInvitations?.length || 0;
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
          <motion.button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
            onClick={() => setShowNotifications(!showNotifications)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Bell size={20} />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </motion.button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute top-16 right-6 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowNotifications(false)}>
                    <X size={16} />
                  </Button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {pendingCount === 0 ? (
                  <div className="p-6 text-center">
                    <Bell size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500 text-sm">No new notifications</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {notificationsData?.pendingInvitations?.map((invitation) => (
                      <div key={invitation.id} className="p-3 hover:bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <img
                            src={invitation.fromUserAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(invitation.fromUserName)}&background=0ea5e9&color=fff`}
                            alt={invitation.fromUserName}
                            className="w-8 h-8 rounded-full"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              Partnership invitation from {invitation.fromUserName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(invitation.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

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