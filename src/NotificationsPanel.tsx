// src/components/NotificationsPanel.tsx
// Panel for showing synergy partner invitations

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X, Users, Clock, MessageSquare } from 'lucide-react';

interface Invitation {
  id: string;
  type: 'received' | 'sent';
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    headline?: string;
    industry?: string;
    location?: string;
  };
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onInvitationHandled: () => void;
}

export default function NotificationsPanel({ 
  isOpen, 
  onClose, 
  currentUserId,
  onInvitationHandled 
}: NotificationsPanelProps) {
  const [invitations, setInvitations] = useState<{
    received: Invitation[];
    sent: Invitation[];
  }>({
    received: [],
    sent: []
  });
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // Load invitations when panel opens
  useEffect(() => {
    if (isOpen) {
      loadInvitations();
    }
  }, [isOpen, currentUserId]);

  /**
   * Load invitations from API
   */
  async function loadInvitations() {
    setLoading(true);
    try {
      const response = await fetch(
        `/.netlify/functions/synergy-invitations?userId=${currentUserId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load invitations: ${response.status}`);
      }

      const data = await response.json();
      setInvitations({
        received: data.received || [],
        sent: data.sent || []
      });
    } catch (error) {
      console.error('Failed to load invitations:', error);
      setInvitations({ received: [], sent: [] });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handle invitation (accept or decline)
   */
  async function handleInvitation(invitationId: string, action: 'accept' | 'decline') {
    setProcessing(invitationId);
    try {
      const response = await fetch('/.netlify/functions/synergy-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          invitationId: invitationId,
          userId: currentUserId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} invitation: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Remove invitation from received list
        setInvitations(prev => ({
          ...prev,
          received: prev.received.filter(inv => inv.id !== invitationId)
        }));
        
        onInvitationHandled();
      }
    } catch (error) {
      console.error(`Failed to ${action} invitation:`, error);
      alert(`Failed to ${action} invitation. Please try again.`);
    } finally {
      setProcessing(null);
    }
  }

  /**
   * Format relative time
   */
  function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  }

  const pendingCount = invitations.received.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-end bg-black bg-opacity-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden mt-16"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Bell className="h-6 w-6 text-blue-600" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
                    {pendingCount > 0 && (
                      <p className="text-sm text-gray-500">
                        {pendingCount} pending invitation{pendingCount !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto max-h-[60vh]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-500">Loading notifications...</span>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Received Invitations */}
                  {invitations.received.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">
                        Partnership Invitations ({invitations.received.length})
                      </h3>
                      <div className="space-y-3">
                        {invitations.received.map((invitation) => (
                          <motion.div
                            key={invitation.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-start space-x-3">
                              {/* Avatar */}
                              <div className="flex-shrink-0">
                                {invitation.user.avatarUrl ? (
                                  <img
                                    src={invitation.user.avatarUrl}
                                    alt={invitation.user.name}
                                    className="h-10 w-10 rounded-full"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center text-white font-medium">
                                    {invitation.user.name?.[0]?.toUpperCase() || '?'}
                                  </div>
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {invitation.user.name || 'Unnamed User'}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {invitation.user.email}
                                    </p>
                                    {invitation.user.headline && (
                                      <p className="text-xs text-gray-600 mt-1">
                                        {invitation.user.headline}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    <Clock className="h-3 w-3 inline mr-1" />
                                    {formatRelativeTime(invitation.createdAt)}
                                  </div>
                                </div>

                                {/* Message */}
                                {invitation.message && (
                                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                                    <MessageSquare className="h-3 w-3 inline mr-1" />
                                    "{invitation.message}"
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="mt-3 flex space-x-2">
                                  <button
                                    onClick={() => handleInvitation(invitation.id, 'accept')}
                                    disabled={processing === invitation.id}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                                  >
                                    {processing === invitation.id ? (
                                      <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
                                    ) : (
                                      <Check className="h-3 w-3 mr-1" />
                                    )}
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => handleInvitation(invitation.id, 'decline')}
                                    disabled={processing === invitation.id}
                                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Decline
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sent Invitations */}
                  {invitations.sent.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-3">
                        Sent Invitations ({invitations.sent.length})
                      </h3>
                      <div className="space-y-3">
                        {invitations.sent.slice(0, 5).map((invitation) => (
                          <div
                            key={invitation.id}
                            className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                {invitation.user.avatarUrl ? (
                                  <img
                                    src={invitation.user.avatarUrl}
                                    alt={invitation.user.name}
                                    className="h-8 w-8 rounded-full"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-gray-400 to-gray-500 flex items-center justify-center text-white text-xs font-medium">
                                    {invitation.user.name?.[0]?.toUpperCase() || '?'}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-gray-900 truncate">
                                    {invitation.user.name}
                                  </p>
                                  <div className="flex items-center space-x-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      invitation.status === 'accepted' 
                                        ? 'bg-green-100 text-green-800'
                                        : invitation.status === 'declined'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {invitation.status}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {formatRelativeTime(invitation.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {invitations.received.length === 0 && invitations.sent.length === 0 && (
                    <div className="text-center py-12">
                      <Bell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No notifications</p>
                      <p className="text-gray-400 text-sm mt-2">
                        You'll see partnership invitations here
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}