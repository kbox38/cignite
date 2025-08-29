import React from 'react';
import { Filter, Clock, TrendingUp } from 'lucide-react';

// Define a default state for filters to ensure the component never crashes
const defaultFilters = {
  timeFilter: '90d',
  postType: 'all',
  sortBy: 'oldest', // FIX: Default to oldest first
};

interface FilterControlsProps {
  filters: typeof defaultFilters;
  setFilters: (filters: typeof defaultFilters) => void;
}

// FIX: Add proper TypeScript interface and enhanced filtering
export const FilterControls: React.FC<FilterControlsProps> = ({ 
  filters = defaultFilters, 
  setFilters 
}) => {
  const handleFilterChange = (key: keyof typeof defaultFilters, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl p-4 mb-6">
      <div className="flex items-center space-x-2 mb-4">
        <Filter size={20} className="text-gray-600" />
        <h3 className="font-semibold text-gray-800">Filter Posts</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Time Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Clock size={16} className="inline mr-1" />
            Time Period
          </label>
          <select
            value={filters.timeFilter}
            onChange={(e) => handleFilterChange('timeFilter', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days (All Posts)</option>
          </select>
        </div>

        {/* Post Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Post Type
          </label>
          <select
            value={filters.postType}
            onChange={(e) => handleFilterChange('postType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="all">All Posts</option>
            <option value="text">Text Only</option>
            <option value="image">With Images</option>
            <option value="video">With Videos</option>
            <option value="document">With Documents</option>
          </select>
        </div>

        {/* Sort Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <TrendingUp size={16} className="inline mr-1" />
            Sort By
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="oldest">Oldest First (Repurpose Order)</option>
            <option value="recent">Most Recent</option>
            <option value="engagement">Most Engagement</option>
            <option value="likes">Most Likes</option>
            <option value="comments">Most Comments</option>
            <option value="views">Most Views</option>
          </select>
        </div>
      </div>

      {/* Quick Status Filters */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilters({ ...filters, timeFilter: '90d', sortBy: 'oldest' })}
            className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200 transition-colors"
          >
            🟢 Ready to Repurpose
          </button>
          <button
            onClick={() => setFilters({ ...filters, timeFilter: '90d', sortBy: 'engagement' })}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 transition-colors"
          >
            ⚡ High Engagement
          </button>
          <button
            onClick={() => setFilters({ ...filters, timeFilter: '7d', sortBy: 'recent' })}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200 transition-colors"
          >
            🕐 Recent Posts
          </button>
        </div>
      </div>
    </div>
  );
};