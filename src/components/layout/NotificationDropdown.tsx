import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, User } from 'lucide-react';
import { Button } from '../ui/Button';

interface NotificationProps {
  pendingCount: number;
  notificationsData?: {
    pendingInvitations?: Array<{
      id: string;
      fromUser?: {
        name?: string;
        avatarUrl?: string;
        industry?: string;
      };
    }>;
  };
}

export const NotificationDropdown: React.FC<NotificationProps> = ({
  pendingCount,
  notificationsData
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Handle escape key to close dropdown
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showNotifications]);

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <motion.button
        ref={buttonRef}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        onClick={toggleNotifications}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={`Notifications ${pendingCount > 0 ? `(${pendingCount} pending)` : ''}`}
        aria-expanded={showNotifications}
        aria-haspopup="true"
      >
        <Bell size={20} className="text-gray-700" />
        {pendingCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold shadow-lg"
          >
            {pendingCount > 99 ? '99+' : pendingCount}
          </motion.span>
        )}
      </motion.button>

      {/* Notification Dropdown */}
      <AnimatePresence>
        {showNotifications && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-20 z-backdrop md:hidden"
              onClick={() => setShowNotifications(false)}
            />

            {/* Dropdown Container */}
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute top-full right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-2xl border border-gray-200 z-dropdown overflow-hidden"
              role="dialog"
              aria-label="Notifications"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center">
                    <Bell size={18} className="mr-2 text-blue-600" />
                    Notifications
                    {pendingCount > 0 && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                        {pendingCount}
                      </span>
                    )}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNotifications(false)}
                    className="p-1 hover:bg-gray-200 rounded-md transition-colors"
                    aria-label="Close notifications"
                  >
                    <X size={16} />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="max-h-96 overflow-y-auto">
                {pendingCount === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 text-center"
                  >
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <Bell size={24} className="text-gray-400" />
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2">All caught up!</h4>
                    <p className="text-gray-500 text-sm">No new notifications at the moment.</p>
                  </motion.div>
                ) : (
                  <div className="p-2">
                    {notificationsData?.pendingInvitations?.map((invitation, index) => (
                      <motion.div
                        key={invitation.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer group border-l-4 border-l-blue-500 mb-2 last:mb-0"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="relative flex-shrink-0">
                            <img
                              src={
                                invitation.fromUser?.avatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  invitation.fromUser?.name || 'User'
                                )}&background=0ea5e9&color=fff&size=32`
                              }
                              alt={invitation.fromUser?.name || 'User'}
                              className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  invitation.fromUser?.name || 'User'
                                )}&background=0ea5e9&color=fff&size=32`;
                              }}
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                              <User size={8} className="text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                              Partnership invitation from{' '}
                              <span className="font-semibold">
                                {invitation.fromUser?.name || 'LinkedIn User'}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {invitation.fromUser?.industry || 'Professional Services'}
                            </p>
                            <div className="flex items-center mt-2 space-x-2">
                              <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors">
                                View
                              </button>
                              <button className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-md hover:bg-gray-200 transition-colors">
                                Later
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {pendingCount > 0 && (
                <div className="p-3 border-t border-gray-200 bg-gray-50">
                  <button className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-1 rounded-md hover:bg-blue-50 transition-colors">
                    View All Notifications
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Usage example in Header component
export const HeaderWithNotifications = () => {
  // Mock data for demo
  const mockNotifications = {
    pendingInvitations: [
      {
        id: '1',
        fromUser: {
          name: 'Sarah Johnson',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b950?w=32&h=32&fit=crop&crop=face',
          industry: 'Marketing & Advertising'
        }
      },
      {
        id: '2',
        fromUser: {
          name: 'Michael Chen',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face',
          industry: 'Software Development'
        }
      }
    ]
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        
        <div className="flex items-center space-x-4">
          {/* Notifications Component */}
          <NotificationDropdown
            pendingCount={mockNotifications.pendingInvitations.length}
            notificationsData={mockNotifications}
          />
          
          {/* Other header items */}
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
        </div>
      </div>
    </header>
  );
};