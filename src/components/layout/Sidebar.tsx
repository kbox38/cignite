import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  PenTool, 
  Calendar, 
  BarChart3, 
  Lightbulb, 
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { NavItem } from './NavItem';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'synergy', label: 'Synergy', icon: Users, href: '/synergy' },
  { id: 'postpulse', label: 'PostPulse', icon: FileText, href: '/postpulse' },
  { id: 'postgen', label: 'PostGen', icon: PenTool, href: '/postgen' },
  { id: 'scheduler', label: 'Scheduler', icon: Calendar, href: '/scheduler' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { id: 'creation', label: 'Creation Engine', icon: Lightbulb, href: '/creation-engine' },
  { id: 'algo', label: 'The Algo', icon: TrendingUp, href: '/algo' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

export const Sidebar = () => {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();

  return (
    <motion.div
      className={`h-full shadow-2xl transition-all duration-300 relative ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      } ${
        'bg-white border-r border-gray-200 text-gray-900'
      }`}
      initial={{ x: -100 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!sidebarCollapsed && (
            <motion.h1 
              className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              LinkedinGrowth
            </motion.h1>
          )}
          <motion.button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </motion.button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2 flex-1">
        {menuItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <NavItem
              id={item.id}
              label={item.label}
              icon={item.icon}
              collapsed={sidebarCollapsed}
              href={item.href}
            />
          </motion.div>
        ))}
      </nav>

      {/* Footer */}
      {!sidebarCollapsed && (
        <motion.div 
          className="p-4 border-t border-gray-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-xs text-gray-500">
            v1.0.0 - Beta
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};