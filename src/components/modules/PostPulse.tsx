import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Copy,
  Send,
  RefreshCw,
  Heart,
  MessageCircle,
  Share,
  Clock,
  Zap,
  Calendar,
  AlertCircle,
  Image as ImageIcon,
  ImageOff,
  Video,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { Pagination } from "../ui/Pagination";
import { usePostPulseData, PostPulsePost } from "../../hooks/usePostPulseData";
import { useAppStore } from "../../stores/appStore";

export const PostPulse = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<"7d" | "30d" | "90d">("7d");
  const [currentPage, setCurrentPage] = useState(1);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());
  const { setCurrentModule } = useAppStore();

  // Use the PostPulse data hook
  const {
    posts,
    isLoading,
    error,
    pagination,
    metadata,
  } = usePostPulseData({
    timeFilter,
    searchTerm,
    page: currentPage,
    pageSize: 12,
  });

  const handleImageError = useCallback((postId: string) => {
    setImageLoadErrors(prev => new Set([...prev, postId]));
  }, []);

  const getMediaIcon = (mediaType: string) => {
    switch (mediaType) {
      case "IMAGE":
        return <ImageIcon size={24} className="text-gray-400" />;
      case "VIDEO":
        return <Video size={24} className="text-gray-400" />;
      case "ARTICLE":
        return <FileText size={24} className="text-gray-400" />;
      default:
        return <ImageOff size={24} className="text-gray-400" />;
    }
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPosts((prev) =>
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleRepurpose = (post: PostPulsePost) => {
    // Store the post in sessionStorage for PostGen to access
    sessionStorage.setItem(
      "repurposePost",
      JSON.stringify({
        text: post.title,
        originalDate: new Date(post.timestamp).toISOString(),
        engagement: {
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
        },
        url: post.url,
        mediaType: post.mediaType,
      })
    );

    // Navigate to PostGen rewrite section
    setCurrentModule("postgen");
    window.history.pushState({}, "", "/?module=postgen&tab=rewrite");
  };

  const getPostStatus = (post: PostPulsePost) => {
    if (post.daysSincePosted < 7) {
      return {
        label: "Too Recent",
        color: "bg-red-100 text-red-800",
        icon: Clock,
      };
    } else if (post.daysSincePosted < 30) {
      return {
        label: `${30 - post.daysSincePosted} days left`,
        color: "bg-yellow-100 text-yellow-800",
        icon: Clock,
      };
    } else {
      return {
        label: "Ready to Repost",
        color: "bg-green-100 text-green-800",
        icon: Zap,
      };
    }
  };

  const truncateText = (text: string, maxLength: number = 150): string => {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + "...";
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTimeFilterChange = (filter: "7d" | "30d" | "90d") => {
    setTimeFilter(filter);
    setCurrentPage(1);
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-center h-64"
      >
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading your LinkedIn posts...</p>
          <p className="text-sm text-gray-500">Fetching from changelog and historical data...</p>
        </div>
      </motion.div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center py-12"
      >
        <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Error Loading Posts
        </h3>
        <p className="text-gray-600 mb-4">
          We encountered an error while loading your LinkedIn posts:
        </p>
        <p className="text-sm text-red-600 mb-6">{error.message}</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          <RefreshCw size={16} className="mr-2" />
          Try Again
        </Button>
      </motion.div>
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
        <div>
          <h2 className="text-2xl font-bold">PostPulse</h2>
          <p className="text-gray-600 mt-1">
            Your LinkedIn posts from the last {timeFilter} • {pagination.totalPosts} posts found • Source: {metadata.dataSource} • Total shares: {metadata.totalSharesFound || 'N/A'}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="primary" disabled={selectedPosts.length === 0}>
            <Send size={16} className="mr-2" />
            Push to PostGen ({selectedPosts.length})
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw size={16} className="mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Search and Time Filter */}
      <Card variant="glass" className="p-4">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search
              size={20}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search your posts..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex space-x-2">
            {(["7d", "30d", "90d"] as const).map((period) => (
              <button
                key={period}
                onClick={() => handleTimeFilterChange(period)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timeFilter === period
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                    : "bg-white border border-blue-200 text-blue-600 hover:bg-blue-50"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <Card variant="glass" className="p-8 text-center">
          <div className="text-gray-500">
            <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No posts found</h3>
            <p className="text-sm">
              {pagination.totalPosts === 0
                ? "No posts found in the selected date range. Try adjusting your time filter."
                : "No posts match your search criteria. Try a different search term."}
            </p>
            <div className="mt-6">
              <Button
                variant="primary"
                onClick={() => window.open('https://linkedin.com', '_blank')}
              >
                <ExternalLink size={16} className="mr-2" />
                Go to LinkedIn
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, index) => {
              const status = getPostStatus(post);
              const StatusIcon = status.icon;
              const hasImageError = imageLoadErrors.has(post.id);
              const showThumbnail = post.thumbnail && !hasImageError;

              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="cursor-pointer"
                >
                  <Card
                    variant="glass"
                    className={`p-4 transition-all duration-300 hover:shadow-xl relative ${
                      selectedPosts.includes(post.id)
                        ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "hover:shadow-lg hover:border-gray-300"
                    }`}
                  >
                    {/* Source Indicator */}
                    <div className="absolute top-4 left-4">
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                        {post.source === "member_share_info" ? "LinkedIn Archive" : post.source}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div
                      className={`absolute top-4 right-4 px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${status.color}`}
                    >
                      <StatusIcon size={12} />
                      <span>{status.label}</span>
                    </div>

                    {/* Post Content */}
                    <div className="mt-12 mb-4">
                      <div className="flex gap-3 items-start">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 w-20 h-20">
                          {showThumbnail ? (
                            <div className="w-full h-full bg-gray-100 rounded-md overflow-hidden">
                              <img
                                src={post.thumbnail}
                                alt="Post thumbnail"
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={() => {
                                  console.log(`Thumbnail failed for post ${post.id}:`, post.thumbnail);
                                  console.log("Error details - Post:", {
                                    id: post.id,
                                    thumbnail: post.thumbnail,
                                    mediaType: post.mediaType,
                                    source: post.source
                                  });
                                  handleImageError(post.id);
                                }}
                              />
                            </div>
                          ) : post.mediaType !== "TEXT" ? (
                            <div className="w-full h-full bg-gray-100 rounded-md flex items-center justify-center">
                              {getMediaIcon(post.mediaType)}
                            </div>
                          ) : (
                            <div className="w-full h-full bg-gray-50 rounded-md flex items-center justify-center">
                              <FileText size={20} className="text-gray-300" />
                            </div>
                          )}
                        </div>

                        {/* Post Text */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold line-clamp-2 mb-2">
                            {truncateText(post.title, 100)}
                          </h4>
                          <p className="text-xs text-gray-600 line-clamp-3">
                            {truncateText(post.text, 120)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Post Date */}
                    <p className="text-xs text-gray-500 mb-3">
                      Posted: {new Date(post.timestamp).toLocaleDateString()} •{" "}
                      {post.daysSincePosted} days ago
                    </p>


                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRepurpose(post);
                        }}
                        className="flex-1"
                        disabled={!post.canRepost}
                      >
                        <Zap size={14} className="mr-1" />
                        {post.canRepost ? "Repurpose" : "Too Recent"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(post.title);
                        }}
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePostSelection(post.id);
                        }}
                        className={
                          selectedPosts.includes(post.id) ? "bg-blue-100" : ""
                        }
                      >
                        <Send size={14} />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              className="mt-8"
            />
          )}

          {/* Posts Summary */}
          <div className="text-center text-sm text-gray-500 mt-4">
            Showing {posts.length} of {pagination.totalPosts} posts from the
            last {timeFilter} • Page {pagination.currentPage} of{" "}
            {pagination.totalPages}
            {metadata.dataSource && (
              <span> • Data: {metadata.dataSource}</span>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
};