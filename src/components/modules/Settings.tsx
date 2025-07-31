import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Palette, Download, Trash2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../stores/authStore';

export const Settings = () => {
  const { profile, logout } = useAuthStore();
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    synergy: true,
    analytics: true
  });

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const exportData = () => {
    // In real app, would generate and download user data
    console.log('Exporting user data...');
  };

  const deleteAccount = () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // In real app, would delete user account
      logout();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold">Settings</h2>

      {/* Profile Settings */}
      <Card variant="glass" className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <User className="mr-2" size={20} />
          Profile Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            {profile?.picture && (
              <img
                src={profile.picture}
                alt="Profile"
                className="w-16 h-16 rounded-full"
              />
            )}
            <div>
              <p className="font-medium">{profile?.name || 'User'}</p>
              <p className="text-sm text-gray-600">{profile?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                type="text"
                value={profile?.given_name || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input
                type="text"
                value={profile?.family_name || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                readOnly
              />
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Profile information is synced from your LinkedIn account
          </p>
        </div>
      </Card>

      {/* Notifications */}
      <Card variant="glass" className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Bell className="mr-2" size={20} />
          Notifications
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-gray-600">Receive updates via email</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.email}
                onChange={(e) => handleNotificationChange('email', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-gray-600">Receive browser notifications</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.push}
                onChange={(e) => handleNotificationChange('push', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Synergy Alerts</p>
              <p className="text-sm text-gray-600">Notifications for partner activities</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.synergy}
                onChange={(e) => handleNotificationChange('synergy', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Analytics Reports</p>
              <p className="text-sm text-gray-600">Weekly performance summaries</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications.analytics}
                onChange={(e) => handleNotificationChange('analytics', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </Card>

      {/* Privacy & Security */}
      <Card variant="glass" className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Shield className="mr-2" size={20} />
          Privacy & Security
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Data Collection</p>
              <p className="text-sm text-gray-600">We only collect necessary LinkedIn data</p>
            </div>
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">API Permissions</p>
              <p className="text-sm text-gray-600">Manage LinkedIn API access</p>
            </div>
            <Button variant="outline" size="sm">
              Review
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Export Data</p>
              <p className="text-sm text-gray-600">Download your data</p>
            </div>
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download size={16} className="mr-1" />
              Export
            </Button>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card variant="glass" className="p-6 border-red-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center text-red-600">
          <Trash2 className="mr-2" size={20} />
          Danger Zone
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-gray-600">Permanently delete your account and all data</p>
            </div>
            <Button variant="outline" size="sm" onClick={deleteAccount} className="text-red-600 border-red-300 hover:bg-red-50">
              Delete Account
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};