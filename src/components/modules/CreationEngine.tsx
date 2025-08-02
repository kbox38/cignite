import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Lightbulb, TrendingUp, Target, Zap, RefreshCw, Sparkles, Clock, BarChart3, Calendar } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import {
  useLinkedInSnapshot
} from "../../hooks/useLinkedInData";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { useAppStore } from "../../stores/appStore";

export const CreationEngine = () => {
  const [contentIdeas, setContentIdeas] = useState<string>("");
  const [postingStrategy, setPostingStrategy] = useState<string>("");
  const [algorithmOptimization, setAlgorithmOptimization] = useState<string>("");
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [isGeneratingOptimization, setIsGeneratingOptimization] = useState(false);

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
    const avgEngagement = totalPosts > 0 ? totalEngagement / totalPosts : 0;

    return {
      industry: profile.Industry || profile.industry || "Professional Services",
      headline: profile.Headline || profile.headline || "",
      location: profile.Location || profile.location || "",
      totalPosts,
      avgEngagement,
      recentPosts: posts.slice(0, 3).map(post => ({
        text: (post.ShareCommentary || "").substring(0, 200),
        mediaType: post.MediaType || "TEXT",
        engagement: parseInt(post.LikesCount || "0") + parseInt(post.CommentsCount || "0")
      }))
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
        throw new Error('Failed to generate content ideas');
      }

      const data = await response.json();
      setContentIdeas(data.content);
    } catch (error) {
      console.error("Failed to generate content ideas:", error);
      setContentIdeas("Failed to generate content ideas. Please check your OpenAI configuration and try again.");
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const generatePostingStrategy = async () => {
    if (!userProfile) return;

    setIsGeneratingStrategy(true);
    try {
      const response = await fetch('/.netlify/functions/creation-engine-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'posting_strategy',
          industry: userProfile.industry,
          userProfile
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate posting strategy');
      }

      const data = await response.json();
      setPostingStrategy(data.content);
    } catch (error) {
      console.error("Failed to generate posting strategy:", error);
      setPostingStrategy("Failed to generate posting strategy. Please check your OpenAI configuration and try again.");
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
      setAlgorithmOptimization("Failed to generate algorithm optimization. Please check your OpenAI configuration and try again.");
    } finally {
      setIsGeneratingOptimization(false);
    }
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
            {isGeneratingOptimization ? "Analyzing..." : "Algorithm Tips"}
          </Button>
        </div>
      </div>

      {/* User Profile Analysis */}
      {userProfile && (
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold mb-4">Your Profile Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{userProfile.industry}</div>
              <div className="text-sm text-gray-500">Industry</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{userProfile.totalPosts}</div>
              <div className="text-sm text-gray-500">Total Posts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{Math.round(userProfile.avgEngagement * 10) / 10}</div>
              <div className="text-sm text-gray-500">Avg Engagement</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{userProfile.recentPosts.length}</div>
              <div className="text-sm text-gray-500">Recent Posts</div>
            </div>
          </div>
        </Card>
      )}

      {/* Content Ideas Section */}
      {contentIdeas && (
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Sparkles className="mr-2 text-blue-500" size={20} />
            AI-Generated Content Ideas for {userProfile?.industry}
          </h3>
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-line text-gray-900 bg-blue-50 p-4 rounded-lg">
              {contentIdeas}
            </div>
          </div>
          <div className="mt-4 flex space-x-3">
            <Button
              variant="primary"
              onClick={() => setCurrentModule("postgen")}
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
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-line text-gray-900 bg-green-50 p-4 rounded-lg">
              {postingStrategy}
            </div>
          </div>
          <div className="mt-4 flex space-x-3">
            <Button
              variant="primary"
              onClick={() => setCurrentModule("scheduler")}
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
            <BarChart3 className="mr-2 text-purple-500" size={20} />
            LinkedIn Algorithm Optimization
          </h3>
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-line text-gray-900 bg-purple-50 p-4 rounded-lg">
              {algorithmOptimization}
            </div>
          </div>
          <div className="mt-4 flex space-x-3">
            <Button
              variant="primary"
              onClick={() => setCurrentModule("algo")}
            >
              <TrendingUp size={16} className="mr-2" />
              View Algorithm Insights
            </Button>
            <Button
              variant="outline"
              onClick={generateAlgorithmOptimization}
              disabled={isGeneratingOptimization}
            >
              <RefreshCw size={16} className="mr-2" />
              Regenerate Tips
            </Button>
          </div>
        </Card>
      )}

      {/* LinkedIn Algorithm Rules */}
      <Card variant="glass" className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Target className="mr-2 text-indigo-500" size={20} />
          LinkedIn Algorithm Golden Rules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </Card>
    </motion.div>
  );
};