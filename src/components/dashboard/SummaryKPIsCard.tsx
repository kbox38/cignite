import { motion } from 'framer-motion';
import { Users, FileText, Heart, UserPlus, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { SummaryKPIs } from '../../hooks/useDashboardData';

interface SummaryKPIsCardProps {
  kpis: SummaryKPIs;
}

export const SummaryKPIsCard = ({ kpis }: SummaryKPIsCardProps) => {
  const kpiItems = [
    {
      label: 'Total Connections',
      value: kpis.totalConnections.toLocaleString(),
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600'
    },
    {
      label: 'Posts (30 days)',
      value: kpis.postsLast30Days,
      icon: FileText,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-100',
      textColor: 'text-green-600'
    },
    {
      label: 'Engagement Rate',
      value: kpis.engagementRate,
      icon: Heart,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600'
    },
    {
      label: 'New Connections',
      value: kpis.connectionsLast30Days,
      icon: UserPlus,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-600'
    }
  ];

  return (
    <Card variant="glass" className="p-8 bg-gradient-to-br from-white to-gray-50 border-2 border-gray-100 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center space-x-3 mb-8">
        <div className="p-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl">
          <TrendingUp size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Key Metrics</h3>
          <p className="text-gray-600">Your LinkedIn performance at a glance</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {kpiItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="text-center group"
          >
            <motion.div 
              className={`w-16 h-16 ${item.bgColor} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-all duration-300`}
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              <item.icon size={24} className={item.textColor} />
            </motion.div>
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {item.value}
            </div>
            <div className="text-sm font-medium text-gray-600">
              {item.label}
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};