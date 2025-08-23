import React from 'react';

// Define a default state for filters to ensure the component never crashes
const defaultFilters = {
  timeFilter: '7d',
  postType: 'all',
  sortBy: 'engagement',
};

// FIX: Add the "export" keyword here to create a named export.
// This will match the `import { FilterControls } from ...` in PostPulse.tsx.
export const FilterControls = ({ filters = defaultFilters, setFilters }) => {
  // Now, even if `filters` is passed as undefined, it will use `defaultFilters`
  // and this destructuring will be safe.
  const { timeFilter, postType, sortBy } = filters;

  const handleTimeFilterChange = (e) => {
    setFilters({ ...filters, timeFilter: e.target.value });
  };

  const handlePostTypeChange = (e) => {
    setFilters({ ...filters, postType: e.target.value });
  };

  const handleSortByChange = (e) => {
    setFilters({ ...filters, sortBy: e.target.value });
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg flex items-center space-x-4">
      <div className="flex-1">
        <label htmlFor="timeFilter" className="block text-sm font-medium text-gray-400">Timeframe</label>
        <select
          id="timeFilter"
          value={timeFilter}
          onChange={handleTimeFilterChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-gray-700 text-white"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>
      <div className="flex-1">
        <label htmlFor="postType" className="block text-sm font-medium text-gray-400">Post Type</label>
        <select
          id="postType"
          value={postType}
          onChange={handlePostTypeChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-gray-700 text-white"
        >
          <option value="all">All</option>
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="document">Document</option>
        </select>
      </div>
      <div className="flex-1">
        <label htmlFor="sortBy" className="block text-sm font-medium text-gray-400">Sort By</label>
        <select
          id="sortBy"
          value={sortBy}
          onChange={handleSortByChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-gray-700 text-white"
        >
          <option value="engagement">Engagement</option>
          <option value="likes">Likes</option>
          <option value="comments">Comments</option>
          <option value="views">Views</option>
          <option value="recent">Most Recent</option>
        </select>
      </div>
    </div>
  );
};

// By adding `export` to the component declaration above, a separate `export default` is no longer needed.
// This file will now correctly provide the named export that PostPulse.tsx is expecting.