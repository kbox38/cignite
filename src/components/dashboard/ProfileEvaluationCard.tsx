import { motion } from 'framer-motion';
import { Info, TrendingUp, TrendingDown, Minus, Award, Target } from 'lucide-react';
import { Card } from '../ui/Card';
import { ProfileScore, Methodology } from '../../hooks/useDashboardData';
import { useAppStore } from '../../stores/appStore';

interface ProfileEvaluationCardProps {
  scores: ProfileScore;
  overallScore: number;
  explanations: Methodology;
}

export const ProfileEvaluationCard = ({ 
  scores, 
  overallScore, 
  explanations 
}: ProfileEvaluationCardProps) => {
  const { setCurrentModule } = useAppStore();

  const getScoreColor = (score: number) => {
    if (score === null) return 'text-gray-500 bg-gray-100 border-gray-200';
    if (score >= 8) return 'text-green-600 bg-green-100 border-green-200';
    if (score >= 5) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getScoreIcon = (score: number) => {
    if (score === null) return <Minus size={16} />;
    if (score >= 8) return <TrendingUp size={16} />;
    if (score >= 5) return <Minus size={16} />;
    return <TrendingDown size={16} />;
  };

  const getScoreLabel = (score: number) => {
    if (score === null) return 'Not Available';
    if (score >= 8) return 'Excellent';
    if (score >= 5) return 'Good';
    return 'Needs Work';
  };

  const formatMethodologyTooltip = (methodology: any) => {
    if (!methodology) return "No calculation data available";
    
    // Convert technical formulas to user-friendly explanations
    const userFriendlyExplanations = {
      profileCompleteness: "Based on how complete your LinkedIn profile is - includes your photo, headline, summary, work experience, and skills.",
      postingActivity: "Measures how often you post on LinkedIn in the last 28 days. More posts = higher score.",
      engagementQuality: "Looks at how many likes and comments your posts get on average. Higher engagement = better score.",
      networkGrowth: "Tracks your networking activity - sending connection requests and growing your network in the last 28 days.",
      audienceRelevance: "Analyzes if your connections are in relevant industries and locations for your professional goals.",
      contentDiversity: "Measures how varied your content is - mixing text posts, images, videos, and articles gets a higher score.",
      engagementRate: "Compares your total engagement (likes + comments) to the number of posts you make.",
      mutualInteractions: "Counts meaningful conversations - when you and others comment back and forth on posts.",
      profileVisibility: "Measures how often people view your profile and find you in LinkedIn searches.",
      professionalBrand: "Based on recommendations and endorsements you've received from your network."
    };
    
    // Find the metric key from the methodology
    const metricKey = Object.keys(userFriendlyExplanations).find(key => 
      methodology.formula?.toLowerCase().includes(key.toLowerCase()) ||
      methodology.note?.toLowerCase().includes(key.toLowerCase())
    );
    
    let tooltip = userFriendlyExplanations[metricKey] || "This metric helps measure your LinkedIn performance.";
    
    // Add simple calculation if inputs are available
    if (methodology.inputs && Object.keys(methodology.inputs).length > 0) {
      tooltip += "\n\nYour numbers:";
      Object.entries(methodology.inputs).forEach(([key, value]) => {
        if (key !== 'note' && key !== 'error' && typeof value !== 'object') {
          const friendlyKey = key.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^\w/, c => c.toUpperCase());
          tooltip += `\n• ${friendlyKey}: ${value}`;
        }
      });
    }
    
    if (methodology.note) {
      tooltip += `\n\n${methodology.note}`;
    }
    
    return tooltip;
  };

  const scoreItems = [
    { key: 'profileCompleteness', label: 'Profile Completeness', score: scores.profileCompleteness },
    { key: 'postingActivity', label: 'Posting Activity', score: scores.postingActivity },
    { key: 'engagementQuality', label: 'Engagement Quality', score: scores.engagementQuality },
    { key: 'networkGrowth', label: 'Network Growth', score: scores.networkGrowth },
    { key: 'audienceRelevance', label: 'Audience Relevance', score: scores.audienceRelevance },
    { key: 'contentDiversity', label: 'Content Diversity', score: scores.contentDiversity },
    { key: 'engagementRate', label: 'Engagement Rate', score: scores.engagementRate },
    { key: 'mutualInteractions', label: 'Mutual Interactions', score: scores.mutualInteractions },
    { key: 'profileVisibility', label: 'Profile Visibility', score: scores.profileVisibility },
    { key: 'professionalBrand', label: 'Professional Brand', score: scores.professionalBrand },
  ];

  return (
    <Card 
      variant="glass" 
      className="p-8 cursor-pointer hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-blue-50 border-2 border-blue-100"
      onClick={() => setCurrentModule('analytics')}
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl">
            <Award size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Profile Evaluation</h3>
            <p className="text-gray-600">LinkedIn performance analysis</p>
          </div>
        </div>
        <div className="text-center">
          <div className={`text-4xl font-bold mb-1 ${
            overallScore >= 8 ? 'text-green-600' : 
            overallScore >= 5 ? 'text-yellow-600' : 
            'text-red-600'
          }`}>
            {overallScore}/10
          </div>
          <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
            overallScore >= 8 ? 'bg-green-100 text-green-800' : 
            overallScore >= 5 ? 'bg-yellow-100 text-yellow-800' : 
            'bg-red-100 text-red-800'
          }`}>
            {getScoreLabel(overallScore)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {scoreItems.map((item, index) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative"
          >
            <div className={`flex items-center justify-between p-4 rounded-xl border-2 hover:shadow-lg transition-all duration-300 bg-white ${getScoreColor(item.score)}`}>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${
                  item.score >= 8 ? 'from-green-400 to-green-500' :
                  item.score >= 5 ? 'from-yellow-400 to-yellow-500' :
                  'from-red-400 to-red-500'
                }`}>
                  {getScoreIcon(item.score)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{item.label}</p>
                  <p className="text-sm text-gray-600">{getScoreLabel(item.score)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xl font-bold ${getScoreColor(item.score).split(' ')[0]}`}>
                  {item.score}
                </span>
                <div className="relative">
                  <Info size={16} className="text-gray-400 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 w-80 p-4 bg-gray-900 text-white text-sm rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-xl">
                    {formatMethodologyTooltip(explanations[item.key])}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
        <div className="flex items-center space-x-3">
          <Target size={20} className="text-blue-600" />
          <div>
            <p className="font-semibold text-blue-900">Ready to improve your scores?</p>
            <p className="text-sm text-blue-700">Click to view detailed analytics and get personalized recommendations.</p>
          </div>
        </div>
      </div>
    </Card>
  );
};