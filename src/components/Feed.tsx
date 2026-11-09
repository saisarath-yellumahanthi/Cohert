import React from 'react';
import { Compass, PlusCircle } from 'lucide-react';
import { Post, TopicId, UserProfile } from '../types';
import { TOPIC_CHANNELS } from '../utils/validation';
import { PostCard } from './PostCard';
import { StoryRing } from './StoryRing';

interface FeedProps {
  posts: Post[];
  loading: boolean;
  selectedTopic: TopicId | 'all';
  onSelectTopic: (topic: TopicId | 'all') => void;
  currentUserProfile: UserProfile;
  isAdmin: boolean;
  bookmarkedPostIds: Set<string>;
  onToggleBookmark: (postId: string, currentlyBookmarked: boolean) => Promise<void>;
  onOpenCreatePost: () => void;
  isPreviewMode?: boolean;
}

export const Feed: React.FC<FeedProps> = ({
  posts,
  loading,
  selectedTopic,
  onSelectTopic,
  currentUserProfile,
  isAdmin,
  bookmarkedPostIds,
  onToggleBookmark,
  onOpenCreatePost,
  isPreviewMode = false,
}) => {
  const topicCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const post of posts) {
      counts[post.topic] = (counts[post.topic] || 0) + 1;
    }
    return counts;
  }, [posts]);

  const filteredPosts = React.useMemo(() => {
    if (selectedTopic === 'all') return posts;
    return posts.filter((p) => p.topic === selectedTopic);
  }, [posts, selectedTopic]);

  const activeTopicObj =
    selectedTopic !== 'all' ? TOPIC_CHANNELS.find((t) => t.id === selectedTopic) : null;

  return (
    <div className="w-full max-w-[600px] mx-auto">
      <StoryRing
        selectedTopic={selectedTopic}
        onSelectTopic={onSelectTopic}
        topicCounts={topicCounts}
      />

      {activeTopicObj && (
        <div className="flex items-center justify-between px-4 py-2.5 mb-4 rounded-xl bg-[#FAFAFA] dark:bg-[#121212] border border-[#DBDBDB] dark:border-[#262626]">
          <div className="text-xs text-[#262626] dark:text-[#F5F5F5]">
            <span className="font-semibold">
              {activeTopicObj.emoji} {activeTopicObj.label}
            </span>
            <span className="mx-1.5 text-[#737373]" aria-hidden="true">
              ·
            </span>
            <span className="text-[#737373] dark:text-[#A8A8A8]">
              {activeTopicObj.description}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectTopic('all')}
            className="text-xs font-medium text-[#833AB4] dark:text-[#FCB045] hover:underline whitespace-nowrap ml-3"
          >
            Show all
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-5" aria-label="Loading posts">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-4 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#EFEFEF] dark:bg-[#262626]" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-32 rounded bg-[#EFEFEF] dark:bg-[#262626]" />
                  <div className="h-2.5 w-24 rounded bg-[#EFEFEF] dark:bg-[#262626]" />
                </div>
              </div>
              <div className="h-48 w-full rounded-xl bg-[#EFEFEF] dark:bg-[#262626]" />
              <div className="space-y-2">
                <div className="h-3 w-3/4 rounded bg-[#EFEFEF] dark:bg-[#262626]" />
                <div className="h-3 w-1/2 rounded bg-[#EFEFEF] dark:bg-[#262626]" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] px-6 py-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-cohert-gradient p-[2px] mx-auto">
            <div className="w-full h-full rounded-full bg-[#FFFFFF] dark:bg-[#121212] flex items-center justify-center">
              <Compass className="w-6 h-6 text-[#833AB4] dark:text-[#FCB045]" />
            </div>
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h2 className="text-base font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
              No posts yet. Be the first to share something with Cohert.
            </h2>
            <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
              Share study resources, hackathon opportunities, internship leads, or project ideas with your circle.
            </p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={onOpenCreatePost}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-cohert-gradient text-white text-sm font-medium shadow-sm transition-transform active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create first post</span>
            </button>
          </div>
        </div>
      ) : (
        <div>
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserProfile={currentUserProfile}
              isAdmin={isAdmin}
              isBookmarked={bookmarkedPostIds.has(post.id)}
              onToggleBookmark={onToggleBookmark}
              isPreviewMode={isPreviewMode}
            />
          ))}
        </div>
      )}
    </div>
  );
};
