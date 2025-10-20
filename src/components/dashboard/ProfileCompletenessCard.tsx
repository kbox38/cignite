import { motion } from 'framer-motion';
import { User, CheckCircle, AlertCircle, Target, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { useLinkedInSnapshot } from '../../hooks/useLinkedInData';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface ProfileBreakdown {
  basicInfo: number;
  headline: number;
  summary: number;
  experience: number;
  skills: number;
}

interface ProfileCompletenessData {
  score: number;
  breakdown: ProfileBreakdown;
  recommendations: string[];
}

export const ProfileCompletenessCard = () => {
  const { data: profileSnapshot, isLoading, error } = useLinkedInSnapshot('PROFILE');
  const { data: skillsSnapshot } = useLinkedInSnapshot('SKILLS');
  const { data: positionsSnapshot } = useLinkedInSnapshot('POSITIONS');
  const { data: educationSnapshot } = useLinkedInSnapshot('EDUCATION');

  const calculateProfileCompleteness = (): ProfileCompletenessData => {
    if (!profileSnapshot?.elements?.[0]?.snapshotData) {
      return {
        score: 0,
        breakdown: { basicInfo: 0, headline: 0, summary: 0, experience: 0, skills: 0 },
        recommendations: ['Complete your LinkedIn profile to improve visibility']
      };
    }

    const profileData = profileSnapshot.elements[0].snapshotData;
    const skillsData = skillsSnapshot?.elements?.[0]?.snapshotData || [];
    const positionsData = positionsSnapshot?.elements?.[0]?.snapshotData || [];
    const educationData = educationSnapshot?.elements?.[0]?.snapshotData || [];
    
    // Find the main profile object
    const profile = profileData.find(item => 
      item['First Name'] || item['Last Name'] || item['Headline'] || item['Summary']
    ) || profileData[0] || {};

    const breakdown: ProfileBreakdown = {
      basicInfo: 0,
      headline: 0,
      summary: 0,
      experience: 0,
      skills: 0
    };

    // Basic Info (20 points)
    if (profile['First Name'] && profile['Last Name']) breakdown.basicInfo += 8;
    if (profile['Industry'] && profile['Industry'].trim()) breakdown.basicInfo += 6;
    if (profile['Location'] && profile['Location'].trim()) breakdown.basicInfo += 6;

    // Professional Headline (20 points)
    if (profile['Headline'] && profile['Headline'].trim()) {
      const headlineLength = profile['Headline'].length;
      if (headlineLength > 80) breakdown.headline = 20;
      else if (headlineLength > 50) breakdown.headline = 15;
      else if (headlineLength > 20) breakdown.headline = 10;
      else breakdown.headline = 5;
    }

    // Summary/About Section (20 points)
    if (profile['Summary'] && profile['Summary'].trim()) {
      const summaryLength = profile['Summary'].length;
      if (summaryLength > 300) breakdown.summary = 20;
      else if (summaryLength > 150) breakdown.summary = 15;
      else if (summaryLength > 50) breakdown.summary = 10;
      else breakdown.summary = 5;
    }

    // Experience (20 points) - Use POSITIONS domain data
    if (positionsData.length > 0) {
      breakdown.experience += 10; // Has positions
      if (positionsData.length >= 2) breakdown.experience += 5; // Multiple positions
      if (positionsData.some(pos => pos['Current'] === 'true' || pos['Is Current'] === 'true')) {
        breakdown.experience += 5; // Has current position
      }
    }

    // Skills (20 points) - Use SKILLS domain data
    if (skillsData.length > 0) {
      if (skillsData.length >= 10) breakdown.skills = 20;
      else if (skillsData.length >= 5) breakdown.skills = 15;
      else if (skillsData.length >= 3) breakdown.skills = 10;
      else breakdown.skills = 5;
    }

    const totalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    // Generate recommendations
    const recommendations = [];
    if (breakdown.basicInfo < 15) recommendations.push('Complete your basic profile information (name, location, industry)');
    if (breakdown.headline < 15) recommendations.push('Improve your headline with specific skills and value proposition');
    if (breakdown.summary < 15) recommendations.push('Add a compelling summary that tells your professional story');
    if (breakdown.experience < 15) recommendations.push(`Add more work experience (currently ${positionsData.length} positions)`);
    if (breakdown.skills < 15) recommendations.push(`Add more skills to your profile (currently ${skillsData.length} skills)`);

    if (recommendations.length === 0) {
      recommendations.push('Excellent profile! Your LinkedIn presence is well-optimized');
    }

    return {
      score: Math.min(totalScore, 100),
      breakdown,
      recommendations
    };
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100 border-green-200';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'from-green-500 to-green-600';
    if (score >= 50) return 'from-yellow-500 to-yellow-600';
    return 'from-red-500 to-red-600';
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
          <AlertCircle size={20} />
          <span>Error loading profile data</span>
        </div>
      </Card>
    );
  }

  const completenessData = calculateProfileCompleteness();

  return (
    <Card variant="glass" className="p-6 bg-gradient-to-br from-white to-blue-50 border-2 border-blue-100">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl">
          <User size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Profile Completeness</h3>
          <p className="text-gray-600">LinkedIn profile optimization score</p>
        </div>
      </div>

      {/* Score Display */}
      <div className="text-center mb-6">
        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-4 ${getScoreColor(completenessData.score)}`}>
          <span className="text-2xl font-bold">{completenessData.score}%</span>
        </div>
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full bg-gradient-to-r ${getProgressColor(completenessData.score)} transition-all duration-1000`}
              style={{ width: `${completenessData.score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-3 mb-6">
        {Object.entries(completenessData.breakdown).map(([key, score], index) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between"
          >
            <span className="text-sm font-medium text-gray-700 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            <div className="flex items-center space-x-2">
              <div className="w-16 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full bg-gradient-to-r ${getProgressColor((score/20)*100)} transition-all duration-500`}
                  style={{ width: `${(score/20)*100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-gray-900 w-12">{score}/20</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="space-y-2">
        <h4 className="font-semibold text-gray-900 flex items-center">
          <Target size={16} className="mr-2 text-blue-600" />
          Recommendations
        </h4>
        {completenessData.recommendations.map((rec, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start space-x-2 text-sm text-gray-700"
          >
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
            <span>{rec}</span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};