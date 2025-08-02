import { motion } from 'framer-motion';
import { DivideIcon as LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

interface NavItemProps {
  id: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  href: string;
}

export const NavItem = ({ id, label, icon: Icon, collapsed, href }: NavItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === href;

  return (
    <Link to={href}>
      <motion.div
      className={clsx(
        "w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative",
        isActive 
          ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg" 
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
      <Icon size={20} className="flex-shrink-0" />
      
      {!collapsed && (
        <motion.span
          className="ml-3 font-medium"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {label}
        </motion.span>
      )}
      
      {collapsed && (
        <motion.div
          className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 0, x: 0 }}
          whileHover={{ opacity: 1, x: 0 }}
        >
          {label}
        </motion.div>
      )}
      
      {isActive && (
        <motion.div
          className="absolute right-2 w-2 h-2 bg-white rounded-full"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
      </motion.div>
    </Link>
  );
};