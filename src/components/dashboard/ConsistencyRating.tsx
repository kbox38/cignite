import { motion } from 'framer-motion';
import { Award, TrendingUp, Calendar, Target } from 'lucide-react';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useLinkedInSnapshot } from '../../hooks/useLinkedInData';

interface ConsistencyData {
  score: number;
  grade: string;
  streak: number;
  variance: number;
  weeksMeetingTarget: number;
  totalWeeks: number;
}

export const ConsistencyRating = () => {
  const { data: postsSnapshot, isLoading, error } = useLinkedInSnapshot('MEMBER_SHARE_INFO');

  const calculateConsistency = (): ConsistencyData => {
    if (!postsSnapshot?.elements?.[0]?.snapshotData) {
      return {
        score: 0,
        grade: 'D',
        streak: 0,
        variance: 0,
        weeksMeetingTarget: 0,
        totalWeeks: 0
      };
    }

    const posts = postsSnapshot.elements[0].snapshotData;
    const now = new Date();
    const TARGET_POSTS_PER_WEEK = 7;
    
    // Create weekly buckets for the past 52 weeks
    const weeklyPostCounts: number[] = [];
    
    for (let i = 51; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      
      const postsInWeek = posts.filter((post: any) => {
        const postDate = new Date(post.Date || post.date);
        return postDate >= weekStart && postDate <= weekEnd;
      }).length;

      weeklyPostCounts.push(postsInWeek);
    }

    // Calculate variance from target
    const variance = weeklyPostCounts.reduce((sum, count) => {
      return sum + Math.pow(count - TARGET_POSTS_PER_WEEK, 2);
    }, 0) / weeklyPostCounts.length;

    // Calculate consistency score (100 - normalized variance)
    const normalizedVariance = Math.min(variance / (TARGET_POSTS_PER_WEEK * TARGET_POSTS_PER_WEEK), 1);
    const consistencyScore = Math.max(0, 100 - (normalizedVariance * 100));

    // Calculate longest streak of weeks meeting target
    let currentStreak = 0;
    let longestStreak = 0;
    
    weeklyPostCounts.forEach(count => {
      if (count >= TARGET_POSTS_PER_WEEK) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    // Calculate grade
    let grade = 'D';
    if (consistencyScore >= 90) grade = 'A+';
    else if (consistencyScore >= 80) grade = 'A';
    else if (consistencyScore >= 70) grade = 'B';
    else if (consistencyScore >= 60) grade = 'C';

    const weeksMeetingTarget = weeklyPostCounts.filter(count => count >= TARGET_POSTS_PER_WEEK).length;

    return {
      score: Math.round(consistencyScore),
      grade,
      streak: longestStreak,
      variance: Math.round(variance * 10) / 10,
      weeksMeetingTarget,
      totalWeeks: weeklyPostCounts.length
    };
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'B':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'C':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default:
        return 'text-red-600 bg-red-100 border-red-200';
    }
  };

  const getCircleColor = (score: number) => {
    if (score >= 80) return 'stroke-green-500';
    if (score >= 60) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  if (isLoading) {
    return (
      <Card variant="glass" className="p-6">
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner size="lg" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="glass" className="p-6">
        <div className="flex items-center space-x-3 text-red-600">
          <Award size={20} />
          <span>Error loading consistency data</span>
        </div>
      </Card>
    );
  }

  const consistencyData = calculateConsistency();
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDasharray = `${(consistencyData.score / 100) * circumference} ${circumference}`;

  return (
    <Card variant="glass" className="p-6 bg-gradient-to-br from-white to-purple-50 border-2 border-purple-100">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
          <Award size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Posting Consistency</h3>
          <p className="text-gray-600">12-month consistency analysis</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {/* Consistency Circle */}
        <div className="relative">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke="#E5E7EB"
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
              className={`transition-all duration-1000 ${getCircleColor(consistencyData.score)}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${getGradeColor(consistencyData.grade)}`}>
              {consistencyData.grade}
            </div>
            <div className="text-sm text-gray-600">{consistencyData.score}%</div>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex-1 ml-6 space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200"
          >
            <div className="flex items-center space-x-2">
              <TrendingUp size={16} className="text-purple-600" />
              <span className="font-medium text-gray-900">Longest Streak</span>
            </div>
            <span className="text-lg font-bold text-purple-600">{consistencyData.streak} weeks</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200"
          >
            <div className="flex items-center space-x-2">
              <Target size={16} className="text-purple-600" />
              <span className="font-medium text-gray-900">Target Weeks</span>
            </div>
            <span className="text-lg font-bold text-purple-600">
              {consistencyData.weeksMeetingTarget}/{consistencyData.totalWeeks}
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200"
          >
            <div className="flex items-center space-x-2">
              <Calendar size={16} className="text-purple-600" />
              <span className="font-medium text-gray-900">Variance</span>
            </div>
            <span className="text-lg font-bold text-purple-600">{consistencyData.variance}</span>
          </motion.div>
        </div>
      </div>

      {/* Grade Explanation */}
      <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
        <h4 className="font-semibold text-purple-900 mb-2">Consistency Grade Breakdown</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-purple-700">A+ (90-100%):</span>
            <span className="text-green-600 font-medium">Excellent</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-700">A (80-89%):</span>
            <span className="text-green-600 font-medium">Very Good</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-700">B (70-79%):</span>
            <span className="text-blue-600 font-medium">Good</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-700">C (60-69%):</span>
            <span className="text-yellow-600 font-medium">Fair</span>
          </div>
        </div>
        <p className="text-xs text-purple-600 mt-2">
          Based on weekly posting variance from 7-post target over 52 weeks
        </p>
      </div>
    </Card>
  );
};