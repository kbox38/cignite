import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Plus,
  Image,
  Send,
  Save,
  Edit3,
  Trash2,
  ArrowRight,
  FileText,
  Upload,
  X,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useAppStore } from "../../stores/appStore";

interface ScheduledPost {
  id: string;
  content: string;
  scheduledTime?: string;
  media?: {
    name: string;
    type: string;
    size: number;
  } | null;
  status: "scheduled" | "posted" | "draft";
  createdAt: number;
  updatedAt: number;
}

interface PostGenData {
  content: string;
  media?: {
    name: string;
    type: string;
    size: number;
  } | null;
  source: "scheduler";
  timestamp: number;
}

const STORAGE_KEY = "scheduler_posts";
const POSTGEN_STORAGE_KEY = "postgen_data";

export const Scheduler = () => {
  const { setCurrentModule } = useAppStore();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [newPost, setNewPost] = useState({
    content: "",
    scheduledTime: "",
    media: null as File | null,
  });

  // Load posts from localStorage on component mount
  useEffect(() => {
    loadPosts();
  }, []);

  // Check for scheduled post data from PostGen
  useEffect(() => {
    const scheduledPostData = sessionStorage.getItem("scheduledPost");
    if (scheduledPostData) {
      try {
        const data = JSON.parse(scheduledPostData);
        console.log("Loading scheduled post from PostGen:", data);

        setNewPost({
          content: data.content,
          scheduledTime: "",
          media: null,
        });

        setIsComposing(true);
        sessionStorage.removeItem("scheduledPost");
      } catch (error) {
        console.error("Error parsing scheduled post data:", error);
      }
    }
  }, []);

  const loadPosts = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedPosts = JSON.parse(stored);
        console.log("Loaded posts from storage:", parsedPosts);
        setPosts(parsedPosts);
      }
    } catch (error) {
      console.error("Error loading posts:", error);
    }
  };

  const savePosts = (updatedPosts: ScheduledPost[]) => {
    try {
      console.log("Saving posts:", updatedPosts);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPosts));
      setPosts(updatedPosts);
    } catch (error) {
      console.error("Error saving posts:", error);
    }
  };

  const handleSchedulePost = () => {
    if (!newPost.content) return;

    console.log("Creating new post with media:", newPost.media);

    const post: ScheduledPost = {
      id: Date.now().toString(),
      content: newPost.content,
      scheduledTime: newPost.scheduledTime || undefined,
      media: newPost.media
        ? {
            name: newPost.media.name,
            type: newPost.media.type,
            size: newPost.media.size,
          }
        : null,
      status: newPost.scheduledTime ? "scheduled" : "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    console.log("Created post:", post);

    const updatedPosts = [...posts, post];
    savePosts(updatedPosts);
    resetForm();
  };

  const handleSaveDraft = () => {
    if (!newPost.content) return;

    console.log("Creating draft with media:", newPost.media);

    const post: ScheduledPost = {
      id: Date.now().toString(),
      content: newPost.content,
      scheduledTime: undefined,
      media: newPost.media
        ? {
            name: newPost.media.name,
            type: newPost.media.type,
            size: newPost.media.size,
          }
        : null,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    console.log("Created draft:", post);

    const updatedPosts = [...posts, post];
    savePosts(updatedPosts);
    resetForm();
  };

  const handleEditPost = (post: ScheduledPost) => {
    console.log("Editing post:", post);
    setEditingPost(post);
    setNewPost({
      content: post.content,
      scheduledTime: post.scheduledTime || "",
      media: null, // We don't load the file back, just show the info
    });
    setIsComposing(true);
  };

  const handleUpdatePost = () => {
    if (!editingPost || !newPost.content) return;

    console.log("Updating post with media:", newPost.media);

    const updatedPost: ScheduledPost = {
      ...editingPost,
      content: newPost.content,
      scheduledTime: newPost.scheduledTime || undefined,
      media: newPost.media
        ? {
            name: newPost.media.name,
            type: newPost.media.type,
            size: newPost.media.size,
          }
        : editingPost.media, // Keep existing media if no new media
      status: newPost.scheduledTime ? "scheduled" : "draft",
      updatedAt: Date.now(),
    };

    console.log("Updated post:", updatedPost);

    const updatedPosts = posts.map((p) =>
      p.id === editingPost.id ? updatedPost : p
    );
    savePosts(updatedPosts);
    resetForm();
  };

  const handleDeletePost = (postId: string) => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      const updatedPosts = posts.filter((p) => p.id !== postId);
      savePosts(updatedPosts);
    }
  };

  const handlePushToPostGen = (post: ScheduledPost) => {
    console.log("Pushing to PostGen:", post);

    const postGenData: PostGenData = {
      content: post.content,
      media: post.media,
      source: "scheduler",
      timestamp: Date.now(),
    };

    sessionStorage.setItem(POSTGEN_STORAGE_KEY, JSON.stringify(postGenData));
    setCurrentModule("postgen");
    window.history.pushState({}, "", "/?module=postgen");
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("Media uploaded:", file);
      setNewPost({ ...newPost, media: file });
    }
  };

  const handleRemoveMedia = () => {
    console.log("Removing media");
    setNewPost({ ...newPost, media: null });
  };

  const resetForm = () => {
    setNewPost({ content: "", scheduledTime: "", media: null });
    setIsComposing(false);
    setEditingPost(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "posted":
        return "bg-green-100 text-green-800 border-green-200";
      case "draft":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const sortedPosts = [...posts].sort((a, b) => {
    const statusOrder = { scheduled: 0, draft: 1, posted: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];

    if (statusDiff !== 0) return statusDiff;

    if (a.scheduledTime && b.scheduledTime) {
      return (
        new Date(a.scheduledTime).getTime() -
        new Date(b.scheduledTime).getTime()
      );
    }

    return b.createdAt - a.createdAt;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Post Scheduler</h2>
        <Button variant="primary" onClick={() => setIsComposing(true)}>
          <Plus size={16} className="mr-2" />
          New Post
        </Button>
      </div>

      {/* Compose/Edit Post Modal */}
      {isComposing && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        >
          <Card
            variant="glass"
            className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingPost ? "Edit Post" : "Compose New Post"}
              </h3>
              <Button variant="ghost" onClick={resetForm}>
                <X size={20} />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Post Content
                </label>
                <textarea
                  value={newPost.content}
                  onChange={(e) =>
                    setNewPost({ ...newPost, content: e.target.value })
                  }
                  placeholder="What's on your mind?"
                  className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-sm text-gray-500 mt-1">
                  {newPost.content.length}/3000 characters
                </p>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Calendar size={16} className="text-gray-500" />
                  <input
                    type="datetime-local"
                    value={newPost.scheduledTime}
                    onChange={(e) =>
                      setNewPost({ ...newPost, scheduledTime: e.target.value })
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaUpload}
                    className="hidden"
                    id="media-upload"
                  />
                  <label
                    htmlFor="media-upload"
                    className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <Upload size={16} />
                    <span className="text-sm">Add Media</span>
                  </label>
                </div>
              </div>

              {/* Media Display */}
              {newPost.media && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Image size={16} className="text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">
                          {newPost.media.name}
                        </p>
                        <p className="text-xs text-blue-600">
                          {newPost.media.type} •{" "}
                          {formatFileSize(newPost.media.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveMedia}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              )}

              {/* Show existing media when editing */}
              {editingPost && editingPost.media && !newPost.media && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Image size={16} className="text-gray-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Current: {editingPost.media.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {editingPost.media.type} •{" "}
                        {formatFileSize(editingPost.media.size)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
                {!editingPost && (
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={!newPost.content}
                  >
                    <Save size={16} className="mr-2" />
                    Save Draft
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={editingPost ? handleUpdatePost : handleSchedulePost}
                  disabled={
                    !newPost.content || (!editingPost && !newPost.scheduledTime)
                  }
                >
                  {editingPost ? (
                    <>
                      <Save size={16} className="mr-2" />
                      Update Post
                    </>
                  ) : (
                    <>
                      <Send size={16} className="mr-2" />
                      Schedule Post
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Posts List */}
      <div className="space-y-6">
        {sortedPosts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card variant="glass" className="p-6 hover:shadow-lg transition-all duration-200 border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Header Section */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 ${getStatusColor(post.status)}`}>
                        {post.status === "draft" ? "Draft" : 
                         post.status === "scheduled" ? "Scheduled" : "Posted"}
                      </span>
                      
                      {post.scheduledTime && (
                        <div className="flex items-center space-x-1.5 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md">
                          <Clock size={14} className="text-gray-500" />
                          <span className="font-medium">{formatDateTime(post.scheduledTime)}</span>
                        </div>
                      )}
                      
                      {post.status === "draft" && (
                        <div className="flex items-center space-x-1.5 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-md">
                          <FileText size={14} className="text-gray-500" />
                          <span className="font-medium">Draft</span>
                        </div>
                      )}
                    </div>
                    
                    {post.media && (
                      <div className="flex items-center space-x-1.5 text-sm text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-md border border-blue-200">
                        <Image size={14} />
                        <span className="font-medium">Media attached</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Content Section */}
                  <div className="mb-4">
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-base">
                      {post.content.split('\n')[0]}
                      {post.content.includes('\n') && (
                        <span className="text-gray-500 text-sm">...</span>
                      )}
                    </p>
                  </div>
                  
                  {/* Media Section */}
                  {post.media && (
                    <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Image size={18} className="text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-blue-900 truncate">{post.media.name}</p>
                          <p className="text-xs text-blue-700 mt-0.5">
                            {post.media.type} • {formatFileSize(post.media.size)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Footer Section */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>Created: {new Date(post.createdAt).toLocaleDateString()}</span>
                      {post.updatedAt !== post.createdAt && (
                        <>
                          <span>•</span>
                          <span>Updated: {new Date(post.updatedAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col space-y-2 ml-6 min-w-[140px]">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePushToPostGen(post)}
                    className="w-full bg-white hover:bg-blue-50 border-blue-200 text-blue-700 hover:text-blue-800"
                  >
                    <ArrowRight size={14} className="mr-1.5" />
                    Push to PostGen
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditPost(post)}
                    className="w-full bg-white hover:bg-gray-50"
                  >
                    <Edit3 size={14} className="mr-1.5" />
                    Edit
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePost(post.id)}
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={14} className="mr-1.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12">
          <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 mb-2">No posts yet</p>
          <p className="text-sm text-gray-400">
            Create your first post to get started with scheduling
          </p>
        </div>
      )}
    </motion.div>
  );
};
