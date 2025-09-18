// src/components/ui/Card.tsx - Fixed z-index for cards to stay below dropdown
import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'outline' | 'gradient';
  hover?: boolean;
  onClick?: () => void;
  animated?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  hover = false,
  onClick,
  animated = false
}) => {
  const baseClasses = 'rounded-lg transition-all duration-200 z-card'; // FIXED: Added z-card class

  const variantClasses = {
    default: 'bg-white border border-gray-200 shadow-sm',
    glass: 'bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-lg',
    outline: 'bg-transparent border-2 border-gray-200 shadow-none',
    gradient: 'bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-md'
  };

  const hoverClasses = hover 
    ? 'hover:shadow-lg hover:border-gray-300 hover:-translate-y-1 cursor-pointer' 
    : '';

  const combinedClasses = clsx(
    baseClasses,
    variantClasses[variant],
    hoverClasses,
    className
  );

  if (animated) {
    return (
      <motion.div
        className={combinedClasses}
        onClick={onClick}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={hover ? { scale: 1.02 } : undefined}
        style={{ zIndex: 1 }} // FIXED: Ensure cards stay below dropdown
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div 
      className={combinedClasses} 
      onClick={onClick}
      style={{ zIndex: 1 }} // FIXED: Ensure cards stay below dropdown
    >
      {children}
    </div>
  );
};