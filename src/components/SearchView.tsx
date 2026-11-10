import React, { useState } from 'react';
import { Compass, PlusCircle, Search, Users } from 'lucide-react';
import { Post, TopicId, UserProfile } from '../types';
import { formatPresenceStatus, getInitials, TOPIC_CHANNELS } from '../utils/validation';
import { PostCard } from './PostCard';

interface SearchViewProps {
  posts: Post[];
  circleMembers: UserProfile[];
  currentUserProfile: UserProfile;
  isAdmin: boolean;
  bookmarkedPostIds: Set<string>;
  onToggleBookmark: (postId: string, currentlyBookmarked: boolean) => Promise<void>;
  onOpenCreatePost: () => void;
  isPreviewMode?: boolean;
}

export const SearchView: React.FC<SearchViewProps> = ({
  posts,
  circleMembers,
  currentUserProfile,
  isAdmin,
  bookmarkedPostIds,
  onToggleBookmark,
  onOpenCreatePost,
  isPreviewMode = false,
}) => {
  const [queryText, setQueryText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<TopicId | 'all'>('all');

  const q = queryText.trim().toLowerCase();

  const matchingMembers = circleMembers.filter((m) => {
    if (!q) return true;
    const inName = (m.name || '').toLowerCase().includes(q);
    const inBranch = (m.branch || '').toLowerCase().includes(q);
    const inSkills = m.skills.some((s) => s.toLowerCase().includes(q));
    return inName || inBranch || inSkills;
  });

  const matchingPosts = posts.filter((p) => {
    if (selectedTopic !== 'all' && p.topic !== selectedTopic) return false;
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.authorName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full max-w-[600px] mx-auto space-y-5">
      {/* Search Bar */}
      <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search posts, hackathons, study notes, or member skills..."
            aria-label="Search Cohert"
            className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
          />
        </div>

        {/* Topic Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedTopic('all')}
            className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-medium whitespace-nowrap border transition-colors ${
              selectedTopic === 'all'
                ? 'bg-cohert-gradient text-white border-transparent'
                : 'border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#737373]'
            }`}
          >
            All Topics
          </button>
          {TOPIC_CHANNELS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => setSelectedTopic(ch.id)}
              className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-medium whitespace-nowrap border transition-colors ${
                selectedTopic === ch.id
                  ? 'bg-cohert-gradient text-white border-transparent'
                  : 'border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]'
              }`}
            >
              {ch.emoji} {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Circle Members Section */}
      <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#262626] dark:text-[#F5F5F5]">
          <Users className="w-4 h-4 text-[#833AB4] dark:text-[#FCB045]" />
          <span>Circle Members ({matchingMembers.length} / 5)</span>
        </div>

        {matchingMembers.length === 0 ? (
          <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
            No circle members match &ldquo;{queryText}&rdquo;.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {matchingMembers.map((member) => {
              const presence = formatPresenceStatus(member);
              return (
                <div
                  key={member.userId}
                  className="p-3 rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] flex items-center gap-3"
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#FFFFFF] dark:bg-[#121212] border border-[#DBDBDB] dark:border-[#262626] overflow-hidden flex items-center justify-center text-xs font-semibold shrink-0">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(member.name)
                      )}
                    </div>
                    <span
                      className={`w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#121212] absolute -bottom-0.5 -right-0.5 ${
                        presence.isOnline ? 'bg-emerald-500' : 'bg-[#A8A8A8]'
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#262626] dark:text-[#F5F5F5] truncate">
                      {member.name || 'Circle Member'}
                    </p>
                    <p className="text-[11px] text-[#737373] dark:text-[#A8A8A8] truncate">
                      {presence.statusText}
                      {member.branch ? ` · ${member.branch}` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Matching Posts */}
      {matchingPosts.length === 0 ? (
        <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] px-6 py-10 text-center space-y-3">
          <Compass className="w-6 h-6 text-[#833AB4] dark:text-[#FCB045] mx-auto" />
          <p className="text-sm font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
            {posts.length === 0
              ? 'No posts yet. Be the first to share something with Cohert.'
              : 'No posts match your search.'}
          </p>
          <button
            type="button"
            onClick={onOpenCreatePost}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] rounded-xl bg-cohert-gradient text-white text-xs font-semibold"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create first post</span>
          </button>
        </div>
      ) : (
        <div>
          {matchingPosts.map((post) => (
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
