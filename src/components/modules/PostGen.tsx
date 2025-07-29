import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wand2,
  Copy,
  Calendar,
  RefreshCw,
  Upload,
  Send,
  Clock,
  Edit3,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { generateContent } from "../../services/openai";
import { createLinkedInPost } from "../../services/linkedin";
import { useAuthStore } from "../../stores/authStore";
import { useAppStore } from "../../stores/appStore";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

interface GeneratedPost {
  content: string;
  timestamp: number;
}

interface IdeaData {
  title: string;
  description: string;
  category: string;
  timestamp: number;
}

// Constants for better maintainability
const SESSION_STORAGE_KEYS = {
  REPURPOSE_POST: "repurposePost",
  IDEA_CONTENT: "ideaContent",
  SCHEDULED_POST: "scheduledPost",
  POSTGEN_DATA: "postgen_data",
} as const;

const AUTO_GENERATE_DELAY = 1000;
const NOTIFICATION_DURATION = 5000;

export const PostGen = () => {
  const location = useLocation();
  const { accessToken } = useAuthStore();
  const { setCurrentModule } = useAppStore();
  const [activeTab, setActiveTab] = useState<"create" | "rewrite">("create");

  // Create New Post Section
  const [postTopic, setPostTopic] = useState("");
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(
    null
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Rewrite Section
  const [originalPost, setOriginalPost] = useState("");
  const [rewrittenPost, setRewrittenPost] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), NOTIFICATION_DURATION);
  };

  // Check if we came from PostPulse with a post to rewrite
  useEffect(() => {
    // Check for repurposed post from PostPulse
    const repurposeData = sessionStorage.getItem(
      SESSION_STORAGE_KEYS.REPURPOSE_POST
    );
    if (repurposeData) {
      try {
        const { text, originalDate, engagement } = JSON.parse(repurposeData);
        setActiveTab("rewrite");
        setOriginalPost(text);
        // Clear the data after using it
        sessionStorage.removeItem(SESSION_STORAGE_KEYS.REPURPOSE_POST);
      } catch (error) {
        console.error("Error parsing repurpose data:", error);
      }
    }

    // Check for idea content from CreationEngine
    const ideaData = sessionStorage.getItem(SESSION_STORAGE_KEYS.IDEA_CONTENT);
    if (ideaData) {
      try {
        const { title, description, category } = JSON.parse(ideaData);
        setActiveTab("create");
        const topicText = `${title}\n\n${description}\n\nCategory: ${category}`;
        setPostTopic(topicText);
        // Clear the data after using it
        sessionStorage.removeItem(SESSION_STORAGE_KEYS.IDEA_CONTENT);
      } catch (error) {
        console.error("Error parsing idea data:", error);
      }
    }

    // Check for post data from Scheduler
    const schedulerData = sessionStorage.getItem(
      SESSION_STORAGE_KEYS.POSTGEN_DATA
    );
    if (schedulerData) {
      try {
        const { content, media, source } = JSON.parse(schedulerData);
        if (source === "scheduler") {
          setActiveTab("rewrite");
          setOriginalPost(content);
          // If there's media, we could handle it here
          if (media) {
            // Handle media here in the future
          }
          // Clear the data after using it
          sessionStorage.removeItem(SESSION_STORAGE_KEYS.POSTGEN_DATA);
        }
      } catch (error) {
        console.error("Error parsing scheduler data:", error);
      }
    }

    // Check URL parameters for tab and rewrite content
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get("tab");
    const postToRewrite = urlParams.get("rewrite");

    if (tabParam === "rewrite") {
      setActiveTab("rewrite");
    }

    if (postToRewrite) {
      setActiveTab("rewrite");
      setOriginalPost(decodeURIComponent(postToRewrite));
    }
  }, [location]);

  // Auto-generate post when idea content is loaded
  useEffect(() => {
    if (postTopic && postTopic.includes("Category:") && !generatedPost) {
      const timeoutId = setTimeout(() => {
        handleGeneratePost();
      }, AUTO_GENERATE_DELAY);

      return () => clearTimeout(timeoutId);
    }
  }, [postTopic, generatedPost]);

  // Auto-rewrite post when content comes from scheduler
  useEffect(() => {
    if (originalPost && activeTab === "rewrite" && !rewrittenPost) {
      // Check if this came from scheduler
      const schedulerData = sessionStorage.getItem(
        SESSION_STORAGE_KEYS.POSTGEN_DATA
      );
      if (schedulerData) {
        try {
          const { source } = JSON.parse(schedulerData);
          if (source === "scheduler") {
            const timeoutId = setTimeout(() => {
              handleRewritePost();
            }, AUTO_GENERATE_DELAY);

            return () => clearTimeout(timeoutId);
          }
        } catch (error) {
          console.error("Error checking scheduler source:", error);
        }
      }
    }
  }, [originalPost, activeTab, rewrittenPost]);

  const handleGeneratePost = async () => {
    if (!postTopic.trim()) return;

    setIsGenerating(true);

    try {
      const prompt = `Create a professional LinkedIn post about: ${postTopic}. Make it engaging, authentic, and valuable to the professional community. Include relevant hashtags.`;
      const content = await generateContent(prompt);

      setGeneratedPost({
        content,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Failed to generate post:", error);
      // Fallback content
      setGeneratedPost({
        content: `Here's my take on ${postTopic}:\n\nThis topic is incredibly relevant in today's professional landscape. From my experience, the key is to approach it with both strategic thinking and authentic execution.\n\nWhat's your perspective on this? I'd love to hear your thoughts in the comments.\n\n#LinkedIn #Professional #Growth`,
        timestamp: Date.now(),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRewritePost = async () => {
    if (!originalPost.trim()) return;

    setIsRewriting(true);

    try {
      const prompt = `Rewrite this LinkedIn post to make it more engaging and professional while keeping the core message. Original post: "${originalPost}"`;
      const content = await generateContent(prompt);
      setRewrittenPost(content);
    } catch (error) {
      console.error("Failed to rewrite post:", error);
      setRewrittenPost(
        `Here's a fresh take on your original post:\n\n${originalPost}\n\n[This would be rewritten with AI to be more engaging while maintaining your core message]`
      );
    } finally {
      setIsRewriting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handlePostNow = async () => {
    if (!generatedPost?.content && !rewrittenPost.trim()) return;
    if (!accessToken) {
      showNotification("error", "Please authenticate with LinkedIn first");
      return;
    }

    const contentToPost = generatedPost?.content || rewrittenPost;
    setIsPosting(true);

    try {
      await createLinkedInPost(
        accessToken,
        contentToPost,
        uploadedFile || undefined
      );
      showNotification("success", "Post successfully published to LinkedIn!");


      // Clear generated/rewritten post and file after posting
      setGeneratedPost(null);
      setRewrittenPost("");
      setUploadedFile(null);
    } catch (error) {
      console.error("Failed to post to LinkedIn:", error);
      showNotification(
        "error",
        `Failed to post: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedulePost = () => {
    if (!generatedPost?.content && !rewrittenPost.trim()) return;

    const contentToSchedule = generatedPost?.content || rewrittenPost;

    // Store the post data in sessionStorage for Scheduler to access
    const scheduledPostData = {
      content: contentToSchedule,
      media: uploadedFile
        ? {
            name: uploadedFile.name,
            type: uploadedFile.type,
            size: uploadedFile.size,
          }
        : null,
      source: activeTab === "create" ? "generated" : "rewritten",
      timestamp: Date.now(),
    };

    sessionStorage.setItem(
      SESSION_STORAGE_KEYS.SCHEDULED_POST,
      JSON.stringify(scheduledPostData)
    );

    // Navigate to Scheduler module
    setCurrentModule("scheduler");

    // Update URL to show the module change
    window.history.pushState({}, "", "/?module=scheduler");

    showNotification(
      "success",
      "Post moved to Scheduler! Set a time to schedule it."
    );

    // Clear the current post data
    setGeneratedPost(null);
    setRewrittenPost("");
    setUploadedFile(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clearAll = () => {
    setPostTopic("");
    setGeneratedPost(null);
    setUploadedFile(null);
    setOriginalPost("");
    setRewrittenPost("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`p-4 rounded-lg border ${
            notification.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {notification.type === "success" ? (
                <svg
                  className="h-5 w-5 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setNotification(null)}
                className="inline-flex text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">PostGen</h2>
        <Button variant="outline" onClick={clearAll}>
          <RefreshCw size={16} className="mr-2" />
          Clear All
        </Button>
      </div>

      {/* Tab Navigation */}
      <Card variant="glass" className="p-6">
        <div className="flex space-x-4 mb-6">
          <Button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "create"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Wand2 size={16} className="inline mr-2" />
            Create New Post
          </Button>
          <Button
            onClick={() => setActiveTab("rewrite")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "rewrite"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Edit3 size={16} className="inline mr-2" />
            Rewrite Post
          </Button>
        </div>

        {/* Create New Post Section */}
        {activeTab === "create" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                What do you want to post about?
              </label>
              <textarea
                value={postTopic}
                onChange={(e) => setPostTopic(e.target.value)}
                placeholder="Describe your post topic, key message, or what you want to share with your network..."
                className="w-full h-24 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm text-gray-500">
                  {postTopic.length}/500 characters
                </p>
                <Button
                  variant="primary"
                  onClick={handleGeneratePost}
                  disabled={!postTopic.trim() || isGenerating}
                >
                  <Wand2 size={16} className="mr-2" />
                  {isGenerating ? "Generating..." : "Generate Post"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Rewrite Post Section */}
        {activeTab === "rewrite" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Original Post
              </label>
              <textarea
                value={originalPost}
                onChange={(e) => setOriginalPost(e.target.value)}
                placeholder="Paste your previous post here to rewrite it..."
                className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm text-gray-500">
                  {originalPost.length}/2000 characters
                </p>
                <Button
                  variant="primary"
                  onClick={handleRewritePost}
                  disabled={!originalPost.trim() || isRewriting}
                >
                  <Edit3 size={16} className="mr-2" />
                  {isRewriting ? "Rewriting..." : "Rewrite My Post"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Generated Content Display */}
      {(generatedPost || rewrittenPost) && (
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            {activeTab === "create" ? "Generated Post" : "Rewritten Post"}
          </h3>
          <div className="p-4 bg-gray-50 rounded-lg mb-4">
            <p className="whitespace-pre-line text-gray-700">
              {activeTab === "create" ? generatedPost?.content : rewrittenPost}
            </p>
          </div>

          {/* File Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Add Media (Optional)
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
                id="media-upload"
              />
              <label
                htmlFor="media-upload"
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <Upload size={16} />
                <span className="text-sm">Upload Media</span>
              </label>
              {uploadedFile && (
                <span className="text-sm text-green-600">
                  ✓ {uploadedFile.name}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="primary"
              onClick={handlePostNow}
              disabled={isPosting}
              className="flex-1"
            >
              <Send size={16} className="mr-2" />
              {isPosting ? "Posting..." : "Post Now"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSchedulePost}
              disabled={isPosting}
              className="flex-1"
            >
              <Clock size={16} className="mr-2" />
              {isPosting ? "Posting..." : "Schedule Later"}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                copyToClipboard(
                  activeTab === "create"
                    ? generatedPost?.content || ""
                    : rewrittenPost
                )
              }
              disabled={isPosting}
            >
              <Copy size={16} />
            </Button>
          </div>
        </Card>
      )}
    </motion.div>
  );
};
