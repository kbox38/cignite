import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, DivideIcon as LucideIcon } from 'lucide-react';
import { Card } from '../ui/Card';

interface QuickStatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  trend?: 'up' | 'down' | 'stable';
}

export const QuickStatsCard = ({ title, value, change, icon: Icon, color, trend = 'stable' }: QuickStatsCardProps) => {
  const colorClasses = {
    blue: {
      bg: 'from-blue-500 to-blue-600',
      text: 'text-blue-600',
      bgLight: 'bg-blue-50',
      border: 'border-blue-200'
    },
    green: {
      bg: 'from-green-500 to-green-600',
      text: 'text-green-600',
      bgLight: 'bg-green-50',
      border: 'border-green-200'
    },
    purple: {
      bg: 'from-purple-500 to-purple-600',
      text: 'text-purple-600',
      bgLight: 'bg-purple-50',
      border: 'border-purple-200'
    },
    orange: {
      bg: 'from-orange-500 to-orange-600',
      text: 'text-orange-600',
      bgLight: 'bg-orange-50',
      border: 'border-orange-200'
    },
    red: {
      bg: 'from-red-500 to-red-600',
      text: 'text-red-600',
      bgLight: 'bg-red-50',
      border: 'border-red-200'
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={14} className="text-green-500" />;
      case 'down':
        return <TrendingDown size={14} className="text-red-500" />;
      default:
        return <Minus size={14} className="text-gray-500" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -2 }}
    >
      <Card variant="glass" className={`p-6 ${colorClasses[color].bgLight} ${colorClasses[color].border} hover:shadow-lg transition-all duration-300`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900 mb-2">
              {value}
            </p>
            {change && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`flex items-center space-x-1 text-sm ${getTrendColor()}`}
              >
                {getTrendIcon()}
                <span className="font-medium">{change}</span>
              </motion.div>
            )}
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[color].bg} shadow-lg`}>
            <Icon size={24} className="text-white" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
};