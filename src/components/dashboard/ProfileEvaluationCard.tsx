import { motion } from 'framer-motion';
import { Info, TrendingUp, TrendingDown, Minus, Award, Target } from 'lucide-react';
import { Card } from '../ui/Card';
import { ProfileScore, MetricAnalysis } from '../../hooks/useDashboardData';
import { useAppStore } from '../../stores/appStore';

interface ProfileEvaluationCardProps {
  scores: ProfileScore;
  overallScore: number;
  analysis: Record<string, MetricAnalysis>;
}

export const ProfileEvaluationCard = ({ 
  scores, 
  overallScore, 
  analysis 
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
    if (score === null || score === undefined) return 'Not Available';
    if (score >= 8) return 'Excellent';
    if (score >= 5) return 'Good';
    return 'Needs Work';
  };

  const formatAnalysisTooltip = (metricKey: string, metricAnalysis: MetricAnalysis) => {
    if (!metricAnalysis) return "No analysis data available";
    
    let tooltip = `Score: ${metricAnalysis.score}/10\n\n`;
    
    if (metricAnalysis.recommendations.length > 0) {
      tooltip += "Recommendations:\n";
      metricAnalysis.recommendations.forEach(rec => {
        tooltip += `• ${rec}\n`;
      });
    }
    
    if (metricAnalysis.aiInsight) {
      tooltip += `\nAI Insight: ${metricAnalysis.aiInsight}`;
    }
    
    return tooltip;
  };

  const scoreItems = [
    { key: 'profileCompleteness', label: 'Profile Completeness', score: scores.profileCompleteness },
    { key: 'postingActivity', label: 'Posting Activity', score: scores.postingActivity },
    { key: 'engagementQuality', label: 'Engagement Quality', score: scores.engagementQuality },
    { key: 'contentImpact', label: 'Content Impact', score: scores.contentImpact },
    { key: 'contentDiversity', label: 'Content Diversity', score: scores.contentDiversity },
    { key: 'postingConsistency', label: 'Posting Consistency', score: scores.postingConsistency },
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
                    {formatAnalysisTooltip(item.key, analysis[item.key])}
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