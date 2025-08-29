import React from 'react';
import { Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface CacheStatus {
  isCached: boolean;
  timestamp: string | null;
}

interface CacheStatusIndicatorProps {
  status: CacheStatus;
}

export const CacheStatusIndicator: React.FC<CacheStatusIndicatorProps> = ({ status }) => {
  if (!status) {
    return null;
  }

  const { isCached, timestamp } = status;

  // Calculate cache age if we have a timestamp
  const getCacheAge = () => {
    if (!timestamp) return null;
    
    try {
      const cacheTime = new Date(timestamp).getTime();
      const now = Date.now();
      const ageInMinutes = Math.floor((now - cacheTime) / (1000 * 60));
      const ageInHours = Math.floor(ageInMinutes / 60);
      
      if (ageInMinutes < 60) {
        return `${ageInMinutes}m ago`;
      } else if (ageInHours < 24) {
        return `${ageInHours}h ago`;
      } else {
        const ageInDays = Math.floor(ageInHours / 24);
        return `${ageInDays}d ago`;
      }
    } catch (error) {
      return 'Unknown';
    }
  };

  const cacheAge = getCacheAge();
  const ageInMinutes = timestamp ? Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60)) : 0;

  // Determine status color and icon
  const getStatusConfig = () => {
    if (!isCached) {
      return {
        color: 'text-blue-600 bg-blue-50 border-blue-200',
        icon: RefreshCw,
        label: 'Live Data',
        description: 'Freshly fetched'
      };
    }

    if (ageInMinutes < 60) {
      return {
        color: 'text-green-600 bg-green-50 border-green-200',
        icon: CheckCircle,
        label: 'Fresh Cache',
        description: cacheAge || 'Recently cached'
      };
    } else if (ageInMinutes < 360) { // 6 hours
      return {
        color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
        icon: Clock,
        label: 'Cached Data',
        description: cacheAge || 'Cached data'
      };
    } else {
      return {
        color: 'text-orange-600 bg-orange-50 border-orange-200',
        icon: AlertCircle,
        label: 'Stale Cache',
        description: cacheAge || 'Old cached data'
      };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border text-sm ${config.color}`}>
      <IconComponent size={14} />
      <div className="flex flex-col">
        <span className="font-medium text-xs">{config.label}</span>
        <span className="text-xs opacity-75">{config.description}</span>
      </div>
    </div>
  );
};