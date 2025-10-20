import { motion } from 'framer-motion';
import { DivideIcon as LucideIcon } from 'lucide-react';
import { Card } from '../ui/Card';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

export const StatsCard = ({ title, value, change, icon: Icon, color }: StatsCardProps) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600'
  };

  return (
    <Card variant="glass" hover className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {value}
          </p>
          {change && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`text-sm mt-1 ${
                change.startsWith('+') ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {change}
            </motion.p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[color]}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </Card>
  );
};