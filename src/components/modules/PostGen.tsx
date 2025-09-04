import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2,
  Copy,
  Send,
  Upload,
  RefreshCw,
  Clock,
  Edit3,
  Sparkles,
  FileText,
  Image,
  X,
  CheckCircle,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  generateContent,
  generateKevinBoxHooks,
  rewriteKevinBoxPost,
  generateKevinBoxPost,
  summarizeArticleToPost,
} from '../../services/openai';
import { createLinkedInPost } from '../../services/linkedin';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';
import { useLocation } from 'react-router-dom';

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
  REPURPOSE_POST: 'REPURPOSE_POST', // FIX: Match PostPulse key
  IDEA_CONTENT: 'ideaContent',
  SCHEDULED_POST: 'scheduledPost',
  POSTGEN_DATA: 'postgen_data',
} as const;

const AUTO_GENERATE_DELAY = 1000;
const NOTIFICATION_DURATION = 5000;

interface Notification {
  type: 'success' | 'error';
  message: string;
}

export const PostGen = () => {
  const location = useLocation();
  const { accessToken } = useAuthStore();
  const { setCurrentModule } = useAppStore();
  const [activeTab, setActiveTab] = useState<'create' | 'rewrite' | 'summarize'>('create');

  // Create New Post Section
  const [postTopic, setPostTopic] = useState('');
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  // Kevin Box state variables
  const [generatedHooks, setGeneratedHooks] = useState<string[]>([]);
  const [selectedHook, setSelectedHook] = useState<string>('');
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [showHooks, setShowHooks] = useState(false);

  // Rewrite Section
  const [originalPost, setOriginalPost] = useState('');
  const [rewrittenPost, setRewrittenPost] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [repurposeData, setRepurposeData] = useState<any>(null); // FIX: Store repurpose data

  // Summarize Section
  const [articleContent, setArticleContent] = useState('');
  const [summarizedPost, setSummarizedPost] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), NOTIFICATION_DURATION);
  };

  // FIX: Enhanced repurpose data handling + restore original logic
  useEffect(() => {
    // Check for repurposed post from PostPulse
    const repurposeDataRaw = sessionStorage.getItem(SESSION_STORAGE_KEYS.REPURPOSE_POST);
    if (repurposeDataRaw) {
      try {
        const data = JSON.parse(repurposeDataRaw);
        setActiveTab('rewrite');
        setOriginalPost(data.text || '');
        setRepurposeData(data);
        
        // Clear the data after using it
        sessionStorage.removeItem(SESSION_STORAGE_KEYS.REPURPOSE_POST);
        
        console.log('Loaded repurposed post:', data);
        showNotification('success', 'Post loaded from PostPulse for repurposing!');
      } catch (error) {
        console.error('Error parsing repurpose data:', error);
        showNotification('error', 'Failed to load post data');
      }
    }

    // Check for idea content from CreationEngine
    const ideaData = sessionStorage.getItem(SESSION_STORAGE_KEYS.IDEA_CONTENT);
    if (ideaData) {
      try {
        const { content, source, title, description, category } = JSON.parse(ideaData);
        setActiveTab('create');
        
        // Handle new format from Creation Engine
        if (source === 'creation-engine' && content) {
          setPostTopic(content);
          sessionStorage.removeItem(SESSION_STORAGE_KEYS.IDEA_CONTENT);
          console.log('Loaded content ideas from Creation Engine');
        } 
        // Handle legacy format
        else if (title && description) {
          const topicText = `${title}\n\n${description}\n\nCategory: ${category}`;
          setPostTopic(topicText);
          sessionStorage.removeItem(SESSION_STORAGE_KEYS.IDEA_CONTENT);
          console.log('Loaded idea content:', { title, description, category });
        }
        
        showNotification('success', 'Idea loaded from Creation Engine!');
      } catch (error) {
        console.error('Error parsing idea data:', error);
      }
    }

    // Check for post data from Scheduler
    const schedulerData = sessionStorage.getItem(SESSION_STORAGE_KEYS.POSTGEN_DATA);
    if (schedulerData) {
      try {
        const { content, media, source } = JSON.parse(schedulerData);
        if (source === 'scheduler') {
          setActiveTab('rewrite');
          setOriginalPost(content);
          // If there's media, we could handle it here
          if (media) {
            console.log('Media from scheduler:', media);
          }
          // Clear the data after using it
          sessionStorage.removeItem(SESSION_STORAGE_KEYS.POSTGEN_DATA);
          console.log('Loaded post from scheduler:', { content, media });
        }
      } catch (error) {
        console.error('Error parsing scheduler data:', error);
      }
    }

    // Check URL parameters for tab and rewrite content
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    const postToRewrite = urlParams.get('rewrite');
    
    if (tabParam === 'rewrite' || tabParam === 'summarize' || tabParam === 'create') {
      setActiveTab(tabParam);
    }
    
    if (postToRewrite) {
      setActiveTab('rewrite');
      setOriginalPost(decodeURIComponent(postToRewrite));
    }
  }, [location]);

  // RESTORE: Original handler functions
  const handleGeneratePost = async () => {
    if (!postTopic.trim()) {
      showNotification('error', 'Please enter a topic or idea first');
      return;
    }

    setIsGenerating(true);
    try {
      const content = await generateKevinBoxPost(postTopic, selectedHook);
      setGeneratedPost({
        content,
        timestamp: Date.now(),
      });
      showNotification('success', 'Post generated successfully!');
    } catch (error) {
      console.error('Error generating post:', error);
      showNotification('error', 'Failed to generate post. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateHooks = async () => {
    if (!postTopic.trim()) {
      showNotification('error', 'Please enter a topic first');
      return;
    }

    setIsGeneratingHooks(true);
    try {
      const hooks = await generateKevinBoxHooks(postTopic);
      setGeneratedHooks(hooks);
      setShowHooks(true);
      showNotification('success', 'Viral hooks generated successfully!');
    } catch (error) {
      console.error('Error generating hooks:', error);
      showNotification('error', 'Failed to generate hooks. Please try again.');
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  const handleRewritePost = async () => {
    if (!originalPost.trim()) {
      showNotification('error', 'Please enter a post to rewrite');
      return;
    }

    setIsRewriting(true);
    try {
      const rewritten = await rewriteKevinBoxPost(originalPost);
      setRewrittenPost(rewritten);
      showNotification('success', 'Post rewritten successfully!');
    } catch (error) {
      console.error('Error rewriting post:', error);
      showNotification('error', 'Failed to rewrite post. Please try again.');
    } finally {
      setIsRewriting(false);
    }
  };

  const handleSummarizeArticle = async () => {
    if (!articleContent.trim()) {
      showNotification('error', 'Please enter content to summarize');
      return;
    }

    setIsSummarizing(true);
    try {
      const summary = await summarizeArticleToPost(articleContent);
      setSummarizedPost(summary);
      showNotification('success', 'Article summarized successfully!');
    } catch (error) {
      console.error('Error summarizing article:', error);
      showNotification('error', 'Failed to summarize article. Please try again.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type and size
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/mov'];
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (!allowedTypes.includes(file.type)) {
        showNotification('error', 'Please select a valid image or video file');
        return;
      }

      if (file.size > maxSize) {
        showNotification('error', 'File size must be less than 10MB');
        return;
      }

      setUploadedFile(file);
      showNotification('success', `File "${file.name}" uploaded successfully!`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('success', 'Content copied to clipboard!');
    });
  };

  const handlePostToLinkedIn = async () => {
    const content = activeTab === 'create' ? generatedPost?.content :
                   activeTab === 'rewrite' ? rewrittenPost : summarizedPost;

    if (!content) {
      showNotification('error', 'No content to post');
      return;
    }

    if (!accessToken) {
      showNotification('error', 'Please authenticate with LinkedIn first');
      return;
    }

    setIsPosting(true);
    try {
      await createLinkedInPost(content, uploadedFile);
      showNotification('success', 'Post published to LinkedIn successfully!');
      
      // Clear the generated content after posting
      if (activeTab === 'create') {
        setGeneratedPost(null);
        setPostTopic('');
      } else if (activeTab === 'rewrite') {
        setRewrittenPost('');
        setOriginalPost('');
      } else {
        setSummarizedPost('');
        setArticleContent('');
      }
      
      setUploadedFile(null);
    } catch (error) {
      console.error('Error posting to LinkedIn:', error);
      showNotification('error', 'Failed to post to LinkedIn. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
    showNotification('success', 'File removed');
  };

  return (
    <div className="space-y-6">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 right-4 z-toast flex items-center p-4 rounded-lg shadow-lg ${
              notification.type === 'success' 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
            }`}
          >
            {notification.type === 'success' ? 
              <CheckCircle className="mr-2" size={20} /> : 
              <AlertCircle className="mr-2" size={20} />
            }
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            PostGen
          </h1>
          <p className="text-gray-600 mt-2">AI-powered content creation and optimization</p>
        </div>
        
        {/* Repurpose Status */}
        {repurposeData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-50 border border-green-200 rounded-lg p-3 max-w-xs"
          >
            <div className="flex items-center space-x-2">
              <RefreshCw size={16} className="text-green-600" />
              <span className="text-sm font-medium text-green-800">Repurposing Post</span>
            </div>
            <div className="text-xs text-green-600 mt-1">
              <Calendar size={12} className="inline mr-1" />
              Original: {new Date(repurposeData.originalDate).toLocaleDateString()}
            </div>
            <div className="text-xs text-green-600">
              {repurposeData.engagement.likes + repurposeData.engagement.comments + repurposeData.engagement.shares} total engagement
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Content Card */}
      <Card variant="glass" className="p-6">
        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-6">
          <Button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'create'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Wand2 size={16} className="inline mr-2" />
            Create New Post
          </Button>
          <Button
            onClick={() => setActiveTab('rewrite')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'rewrite'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Edit3 size={16} className="inline mr-2" />
            Rewrite Post
          </Button>
          <Button
            onClick={() => setActiveTab('summarize')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'summarize'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Upload size={16} className="inline mr-2" />
            Summarize Article
          </Button>
        </div>

        {/* Create New Post Section */}
        {activeTab === 'create' && (
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
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleGenerateHooks}
                    disabled={!postTopic.trim() || isGeneratingHooks}
                  >
                    <Wand2 size={16} className="mr-2" />
                    {isGeneratingHooks ? 'Generating...' : 'Generate Viral Hooks'}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleGeneratePost}
                    disabled={!postTopic.trim() || isGenerating}
                  >
                    <Wand2 size={16} className="mr-2" />
                    {isGenerating ? 'Generating...' : 'Generate Post'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Hooks Display */}
            {showHooks && generatedHooks.length > 0 && (
              <Card variant="glass" className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold">Choose Your Hook</h4>
                  <button
                    onClick={() => setShowHooks(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Select a hook to use as your post opener, or generate without one.
                </p>
                <div className="space-y-3">
                  {generatedHooks.map((hook, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedHook === hook
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedHook(hook)}
                    >
                      <div className="flex items-start">
                        <span className="text-sm font-medium text-gray-500 mr-3">
                          {index + 1}.
                        </span>
                        <p className="text-sm font-medium text-gray-800 flex-1">
                          {hook}
                        </p>
                        {selectedHook === hook && (
                          <div className="ml-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Rewrite Post Section */}
        {activeTab === 'rewrite' && (
          <div className="space-y-6">
            {repurposeData && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2">
                  <RefreshCw size={16} className="text-blue-600" />
                  <span className="text-sm text-blue-800 font-medium">
                    Post from PostPulse - Ready for repurposing
                  </span>
                </div>
                {repurposeData.media_url && (
                  <div className="flex items-center space-x-2 mt-1">
                    <Image size={14} className="text-blue-600" />
                    <span className="text-xs text-blue-600">
                      Original post contains media - remember to reuse or update it
                    </span>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">
                Original Post
                {repurposeData && (
                  <span className="ml-2 text-xs text-green-600">
                    (Loaded from PostPulse)
                  </span>
                )}
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
                  {isRewriting ? 'Rewriting...' : 'Rewrite My Post'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Summarize Article Section */}
        {activeTab === 'summarize' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Article Content
              </label>
              <textarea
                value={articleContent}
                onChange={(e) => setArticleContent(e.target.value)}
                placeholder="Paste the article content here to summarize and convert to a LinkedIn post..."
                className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm text-gray-500">
                  {articleContent.length}/5000 characters
                </p>
                <Button
                  variant="primary"
                  onClick={handleSummarizeArticle}
                  disabled={!articleContent.trim() || isSummarizing}
                >
                  <Upload size={16} className="mr-2" />
                  {isSummarizing ? 'Summarizing...' : 'Summarize & Convert'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Generated Content Display */}
      {(generatedPost || rewrittenPost || summarizedPost) && (
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            {activeTab === 'create' ? 'Generated Post' : 
             activeTab === 'rewrite' ? 'Rewritten Post' : 'Summarized Post'}
          </h3>
          <div className="p-4 bg-gray-50 rounded-lg mb-4">
            <p className="whitespace-pre-line text-gray-700">
              {activeTab === 'create' ? generatedPost?.content : 
               activeTab === 'rewrite' ? rewrittenPost : summarizedPost}
            </p>
          </div>
          
          {/* File Upload Section */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Add Media (Optional)
            </label>
            {uploadedFile ? (
              <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                <Upload size={16} className="text-green-600 mr-2" />
                <span className="text-sm text-green-800 flex-1">{uploadedFile.name}</span>
                <button
                  onClick={removeUploadedFile}
                  className="text-red-500 hover:text-red-700 ml-2"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="media-upload"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="media-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload size={24} className="text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    Click to upload image or video
                  </span>
                  <span className="text-xs text-gray-400 mt-1">
                    Max 10MB • JPG, PNG, GIF, MP4, MOV
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              onClick={() => copyToClipboard(
                activeTab === 'create' ? generatedPost?.content || '' : 
                activeTab === 'rewrite' ? rewrittenPost : summarizedPost
              )}
              variant="outline"
              className="flex-1"
            >
              <Copy size={16} className="mr-2" />
              Copy to Clipboard
            </Button>
            <Button
              onClick={handlePostToLinkedIn}
              disabled={isPosting || !accessToken}
              className="flex-1"
            >
              {isPosting ? (
                <>
                  <Clock className="animate-spin mr-2" size={16} />
                  Posting...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Post to LinkedIn
                </>
              )}
            </Button>
          </div>
          
          {repurposeData && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                <p><strong>Original engagement:</strong> {repurposeData.engagement.likes} likes, {repurposeData.engagement.comments} comments, {repurposeData.engagement.shares} shares</p>
                <p><strong>Posted:</strong> {new Date(repurposeData.originalDate).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};