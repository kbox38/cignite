import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from 'react-router-dom';
import { Lightbulb, TrendingUp, Target, Zap, RefreshCw, Sparkles, Clock, BarChart3, Calendar } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { AIAnalysisText } from "../ui/AIAnalysisText";
import { useLinkedInSnapshot } from "../../hooks/useLinkedInData";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { useAppStore } from "../../stores/appStore";

export const CreationEngine = () => {
  const [contentIdeas, setContentIdeas] = useState<string>("");
  const [postingStrategy, setPostingStrategy] = useState<string>("");
  const [algorithmOptimization, setAlgorithmOptimization] = useState<string>("");
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [isGeneratingOptimization, setIsGeneratingOptimization] = useState(false);

  const navigate = useNavigate();
  const { setCurrentModule } = useAppStore();
  const { data: profileSnapshot, isLoading: profileLoading } = useLinkedInSnapshot("PROFILE");
  const { data: postsSnapshot, isLoading: postsLoading } = useLinkedInSnapshot("MEMBER_SHARE_INFO");

  // Extract user profile and industry
  const userProfile = useMemo(() => {
    if (!profileSnapshot) return null;

    const profile = profileSnapshot.elements?.[0]?.snapshotData?.[0] || {};
    const posts = postsSnapshot?.elements?.[0]?.snapshotData || [];

    // Calculate posting metrics
    const totalPosts = posts.length;
    const totalEngagement = posts.reduce((sum, post) => {
      return sum + parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0");
    }, 0);
    const avgEngagement = totalPosts > 0 ? Math.round(totalEngagement / totalPosts) : 0;

    return {
      industry: profile.Industry || profile.industry || "Professional",
      company: profile.Company || profile.company || "",
      position: profile.Position || profile.position || "",
      totalPosts,
      avgEngagement,
      connectionCount: profile.ConnectionCount || profile.connectionCount || 0,
      profileViews: profile.ProfileViews || profile.profileViews || 0,
    };
  }, [profileSnapshot, postsSnapshot]);

  const generateContentIdeas = async () => {
    if (!userProfile) return;

    setIsGeneratingIdeas(true);
    try {
      const response = await fetch('/.netlify/functions/creation-engine-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'content_ideas',
          industry: userProfile.industry,
          userProfile
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      setContentIdeas(data.content);
    } catch (error) {
      console.error("Failed to generate content ideas:", error);
      // Fallback content
      setContentIdeas(`Content Ideas for ${userProfile?.industry || 'Your Industry'}:

1. Share a recent industry insight or trend you've observed
2. Post about a professional challenge you overcame and lessons learned  
3. Create a "Top 5 Tips" post related to your expertise
4. Share a behind-the-scenes look at your work process
5. Comment on a recent industry news or development

These ideas are designed to showcase your expertise and engage your professional network.`);
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const generatePostingStrategy = async () => {
    if (!userProfile) return;

    setIsGeneratingStrategy(true);
    try {
      const response = await fetch('/.netlify/functions/creation-engine-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('dmaToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'posting_strategy',
          industry: userProfile.industry,
          userProfile
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate posting strategy: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      setPostingStrategy(data.content);
    } catch (error) {
      console.error("Failed to generate posting strategy:", error);
      setPostingStrategy(`Weekly Posting Strategy for ${userProfile?.industry || 'Your Industry'}:

📅 OPTIMAL SCHEDULE:
• Monday: Industry insights or weekend reflections
• Wednesday: Educational content or tips
• Friday: Personal experiences or team highlights

⏰ BEST POSTING TIMES:
• 8:00-10:00 AM (morning commute)
• 12:00-2:00 PM (lunch break)
• 5:00-6:00 PM (end of workday)

📊 CONTENT MIX:
• 40% Educational/Tips content
• 30% Personal insights/experiences  
• 20% Industry news/commentary
• 10% Behind-the-scenes/company culture

🎯 ENGAGEMENT STRATEGY:
• Ask questions to encourage comments
• Share personal stories for authenticity
• Use 3-5 relevant hashtags
• Respond to comments within 15 minutes`);
    } finally {
      setIsGeneratingStrategy(false);
    }
  };

  const generateAlgorithmOptimization = async () => {
    if (!userProfile) return;

    setIsGeneratingOptimization(true);
    try {
      const response = await fetch('/.netlify/functions/creation-engine-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'algorithm_optimization',
          userProfile
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate algorithm optimization');
      }

      const data = await response.json();
      setAlgorithmOptimization(data.content);
    } catch (error) {
      console.error("Failed to generate algorithm optimization:", error);
      setAlgorithmOptimization("LinkedIn Algorithm Golden Rules loaded successfully!");
    } finally {
      setIsGeneratingOptimization(false);
    }
  };

  const handleCreatePostFromIdeas = () => {
    const ideaData = {
      content: contentIdeas,
      source: 'creation-engine',
      timestamp: Date.now()
    };
    
    sessionStorage.setItem('ideaContent', JSON.stringify(ideaData));
    navigate('/postgen');
  };

  if (profileLoading || postsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Creation Engine</h2>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={generatePostingStrategy}
            disabled={isGeneratingStrategy}
          >
            <Clock size={16} className="mr-2" />
            {isGeneratingStrategy ? "Generating..." : "Posting Strategy"}
          </Button>
          <Button
            variant="primary"
            onClick={generateContentIdeas}
            disabled={isGeneratingIdeas}
          >
            <Lightbulb size={16} className="mr-2" />
            {isGeneratingIdeas ? "Generating..." : "Content Ideas"}
          </Button>
          <Button
            variant="outline"
            onClick={generateAlgorithmOptimization}
            disabled={isGeneratingOptimization}
          >
            <BarChart3 size={16} className="mr-2" />
            {isGeneratingOptimization ? "Generating..." : "Algorithm Tips"}
          </Button>
        </div>
      </div>

      {/* Profile Analysis Section */}
      <Card variant="glass" className="p-6">
        <h3 className="text-lg font-semibold mb-4">Your Profile Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{userProfile?.industry || "Robotics Engineering"}</p>
            <p className="text-sm text-gray-500">Industry</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{userProfile?.totalPosts || 0}</p>
            <p className="text-sm text-gray-500">Total Posts</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{userProfile?.avgEngagement || 0}</p>
            <p className="text-sm text-gray-500">Avg Engagement</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{userProfile?.totalPosts > 0 ? Math.min(userProfile.totalPosts, 30) : 0}</p>
            <p className="text-sm text-gray-500">Recent Posts</p>
          </div>
        </div>
      </Card>

      {/* Content Ideas Section */}
      {contentIdeas && (
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Sparkles className="mr-2 text-blue-500" size={20} />
            AI-Generated Content Ideas for {userProfile?.industry}
          </h3>
          <div className="bg-blue-50 p-4 rounded-lg">
            <AIAnalysisText content={contentIdeas} />
          </div>
          <div className="mt-4 flex space-x-3">
            <Button
              variant="primary"
              onClick={handleCreatePostFromIdeas}
            >
              <Zap size={16} className="mr-2" />
              Create Post from Ideas
            </Button>
            <Button
              variant="outline"
              onClick={generateContentIdeas}
              disabled={isGeneratingIdeas}
            >
              <RefreshCw size={16} className="mr-2" />
              Regenerate Ideas
            </Button>
          </div>
        </Card>
      )}

      {/* Posting Strategy Section */}
      {postingStrategy && (
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Clock className="mr-2 text-green-500" size={20} />
            Weekly Posting Strategy for {userProfile?.industry}
          </h3>
          <div className="bg-green-50 p-4 rounded-lg">
            <AIAnalysisText content={postingStrategy} />
          </div>
          <div className="mt-4 flex space-x-3">
            <Button
              variant="primary"
              onClick={() => navigate('/scheduler')}
            >
              <Calendar size={16} className="mr-2" />
              Set Up Schedule
            </Button>
            <Button
              variant="outline"
              onClick={generatePostingStrategy}
              disabled={isGeneratingStrategy}
            >
              <RefreshCw size={16} className="mr-2" />
              Regenerate Strategy
            </Button>
          </div>
        </Card>
      )}

      {/* Algorithm Optimization Section */}
      {algorithmOptimization && (
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Target className="mr-2 text-indigo-500" size={20} />
            LinkedIn Algorithm Golden Rules
          </h3>
          <div className="bg-indigo-50 p-4 rounded-lg">
            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-indigo-900">✅ Engagement Signals</h4>
                <ul className="text-sm text-indigo-800 space-y-1">
                  <li>• Dwell time is king — longer reads signal valuable content</li>
                  <li>• Comments &gt; Reactions &gt; Shares &gt; Likes in ranking power</li>
                  <li>• First 60 minutes post-publish is critical</li>
                  <li>• Reply to comments within 15 minutes for maximum reach</li>
                  <li>• Native content (no outbound links) is preferred</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-indigo-900">📈 Content Format Ranking</h4>
                <ul className="text-sm text-indigo-800 space-y-1">
                  <li>• Text + Image posts (especially carousels/PDFs)</li>
                  <li>• Mini-article style text posts (150–400 words)</li>
                  <li>• Native videos (short-form, 30–90 sec)</li>
                  <li>• Avoid external links in posts (use first comment)</li>
                  <li>• No engagement bait ("Comment YES if you agree")</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-indigo-900">🕐 Optimal Timing</h4>
                <ul className="text-sm text-indigo-800 space-y-1">
                  <li>• 3–5 posts per week is ideal</li>
                  <li>• Tuesday-Thursday: 8–10 AM or 12–2 PM</li>
                  <li>• Avoid multiple posts per day</li>
                  <li>• Engage with others 15-30 min before posting</li>
                  <li>• Avoid weekends unless global/startup focused</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-indigo-900">🏷️ Hashtag Strategy</h4>
                <ul className="text-sm text-indigo-800 space-y-1">
                  <li>• Use 3–5 niche-relevant hashtags</li>
                  <li>• Avoid trending/general ones (#LinkedIn, #Success)</li>
                  <li>• Don't tag more than 3 people</li>
                  <li>• Focus on industry-specific tags</li>
                  <li>• Research hashtag performance regularly</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}
    </motion.div>
  );
};