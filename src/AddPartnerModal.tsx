// src/components/AddPartnerModal.tsx
// Modal for searching and inviting new synergy partners

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Send, MapPin, Briefcase, Users } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  linkedinMemberUrn?: string;
  headline?: string;
  industry?: string;
  location?: string;
}

interface AddPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onInviteSent: () => void;
}

export default function AddPartnerModal({ 
  isOpen, 
  onClose, 
  currentUserId, 
  onInviteSent 
}: AddPartnerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [inviteMessages, setInviteMessages] = useState<Record<string, string>>({});

  // Load available users when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAvailableUsers();
    }
  }, [isOpen]);

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(availableUsers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = availableUsers.filter(user =>
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.headline?.toLowerCase().includes(query) ||
        user.industry?.toLowerCase().includes(query) ||
        user.location?.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, availableUsers]);

  /**
   * Load available users from API
   */
  async function loadAvailableUsers() {
    setLoading(true);
    try {
      const response = await fetch('/.netlify/functions/synergy-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search_users',
          userId: currentUserId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to load users: ${response.status}`);
      }

      const data = await response.json();
      setAvailableUsers(data.users || []);
    } catch (error) {
      console.error('Failed to load available users:', error);
      setAvailableUsers([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Send invitation to user
   */
  async function sendInvitation(targetUserId: string) {
    setSending(targetUserId);
    try {
      const response = await fetch('/.netlify/functions/synergy-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_invitation',
          userId: currentUserId,
          targetUserId: targetUserId,
          message: inviteMessages[targetUserId] || ''
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send invitation: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Remove user from available list
        setAvailableUsers(prev => prev.filter(user => user.id !== targetUserId));
        setInviteMessages(prev => {
          const updated = { ...prev };
          delete updated[targetUserId];
          return updated;
        });
        
        onInviteSent();
      }
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      setSending(null);
    }
  }

  /**
   * Update invite message for user
   */
  function updateInviteMessage(userId: string, message: string) {
    setInviteMessages(prev => ({
      ...prev,
      [userId]: message
    }));
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Add Synergy Partner</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Find and invite users to become your synergy partners
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, headline, industry, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto max-h-[50vh]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-500">Loading users...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchQuery ? 'No users found matching your search' : 'No available users to invite'}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    {searchQuery ? 'Try adjusting your search terms' : 'All DMA-active users are already your partners or have pending invitations'}
                  </p>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {filteredUsers.map((user) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start space-x-4">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.name}
                              className="h-12 w-12 rounded-full"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center text-white font-medium text-lg">
                              {user.name?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">
                                {user.name || 'Unnamed User'}
                              </h3>
                              <p className="text-sm text-gray-500">{user.email}</p>
                              
                              {user.headline && (
                                <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                  {user.headline}
                                </p>
                              )}
                              
                              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                {user.industry && (
                                  <div className="flex items-center">
                                    <Briefcase className="h-3 w-3 mr-1" />
                                    {user.industry}
                                  </div>
                                )}
                                {user.location && (
                                  <div className="flex items-center">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {user.location}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Invite Message */}
                          <div className="mt-3">
                            <textarea
                              placeholder="Add a personal message (optional)..."
                              value={inviteMessages[user.id] || ''}
                              onChange={(e) => updateInviteMessage(user.id, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                              rows={2}
                              maxLength={200}
                            />
                          </div>

                          {/* Invite Button */}
                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={() => sendInvitation(user.id)}
                              disabled={sending === user.id}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {sending === user.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              ) : (
                                <Send className="h-4 w-4 mr-2" />
                              )}
                              {sending === user.id ? 'Sending...' : 'Send Invitation'}
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
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>
                  {loading ? 'Loading...' : `${filteredUsers.length} users available`}
                </span>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}