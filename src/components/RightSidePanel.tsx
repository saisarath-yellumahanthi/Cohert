import React, { useEffect, useState } from 'react';
import { CalendarClock, ExternalLink, PlusCircle, Users } from 'lucide-react';
import { Post, UserProfile } from '../types';
import {
  formatDeadlineCountdown,
  formatPresenceStatus,
  getInitials,
  MAX_CIRCLE_MEMBERS,
} from '../utils/validation';

interface RightSidePanelProps {
  posts: Post[];
  circleMembers: UserProfile[];
  currentUserId: string;
  onOpenCreateOpportunity: () => void;
  onOpenChat: () => void;
}

export const RightSidePanel: React.FC<RightSidePanelProps> = ({
  posts,
  circleMembers,
  currentUserId,
  onOpenCreateOpportunity,
  onOpenChat,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const deadlinePosts = React.useMemo(() => {
    return posts
      .filter((p) => p.postType === 'opportunity' && Boolean(p.deadlineDate))
      .map((p) => ({
        post: p,
        countdown: formatDeadlineCountdown(p.deadlineDate, nowMs),
      }))
      .filter((item) => item.countdown && !item.countdown.isPast)
      .sort((a, b) => a.countdown!.diffMs - b.countdown!.diffMs);
  }, [posts, nowMs]);

  const friendsWithPresence = React.useMemo(() => {
    const others = circleMembers.filter((m) => m.userId !== currentUserId);
    const list = others.length > 0 ? others : circleMembers;
    return list
      .map((member) => ({
        friend: member,
        presence: formatPresenceStatus(member, nowMs),
      }))
      .sort((a, b) => Number(b.presence.isOnline) - Number(a.presence.isOnline));
  }, [circleMembers, currentUserId, nowMs]);

  return (
    <aside
      aria-label="Upcoming Deadlines and Friends Online"
      className="hidden lg:flex flex-col w-80 shrink-0 space-y-5"
    >
      {/* Upcoming Deadlines Card */}
      <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#FD1D1D]" />
            <h2 className="text-sm font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
              Upcoming Deadlines
            </h2>
          </div>
          <span className="text-xs text-[#737373] dark:text-[#A8A8A8] tabular-nums">
            {deadlinePosts.length}
          </span>
        </div>

        {deadlinePosts.length === 0 ? (
          <div className="py-5 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626] flex items-center justify-center mx-auto">
              <CalendarClock className="w-4 h-4 text-[#737373]" />
            </div>
            <p className="text-xs font-medium text-[#737373] dark:text-[#A8A8A8]">
              No deadlines added yet.
            </p>
            <button
              type="button"
              onClick={onOpenCreateOpportunity}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-xs font-medium text-[#262626] dark:text-[#F5F5F5] hover:border-[#833AB4] transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#833AB4] dark:text-[#FCB045]" />
              <span>Add Opportunity</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {deadlinePosts.slice(0, 5).map(({ post, countdown }) => (
              <div
                key={post.id}
                className="p-3 rounded-xl bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626] space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-[#262626] dark:text-[#F5F5F5] line-clamp-1">
                    {post.title || 'Opportunity'}
                  </p>
                  {countdown && (
                    <span
                      className={`text-[11px] font-semibold tabular-nums shrink-0 ${
                        countdown.isUrgent
                          ? 'text-[#FD1D1D]'
                          : 'text-[#833AB4] dark:text-[#FCB045]'
                      }`}
                    >
                      {countdown.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#737373] dark:text-[#A8A8A8]">
                  <span>Shared by {post.authorName}</span>
                  {post.externalLink && (
                    <a
                      href={post.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#833AB4] dark:text-[#FCB045] hover:underline"
                    >
                      <span>Apply</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Friends Online Card */}
      <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#833AB4] dark:text-[#FCB045]" />
            <h2 className="text-sm font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
              Friends Online
            </h2>
          </div>
          <span className="text-xs text-[#737373] dark:text-[#A8A8A8] tabular-nums">
            {circleMembers.length} / {MAX_CIRCLE_MEMBERS} joined
          </span>
        </div>

        {friendsWithPresence.length === 0 ? (
          <div className="py-4 text-center space-y-2">
            <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
              No other circle members are active right now.
            </p>
            <button
              type="button"
              onClick={onOpenChat}
              className="text-xs font-medium text-[#833AB4] dark:text-[#FCB045] hover:underline"
            >
              Open Messages
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {friendsWithPresence.map(({ friend, presence }) => (
              <div
                key={friend.userId}
                onClick={onOpenChat}
                className="flex items-center justify-between gap-2 py-1 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626] overflow-hidden flex items-center justify-center text-xs font-semibold shrink-0">
                      {friend.avatarUrl ? (
                        <img
                          src={friend.avatarUrl}
                          alt={friend.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(friend.name)
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
                      {friend.name || 'Friend'}
                    </p>
                    <p className="text-[11px] text-[#737373] dark:text-[#A8A8A8] truncate">
                      {presence.statusText}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-medium shrink-0 ${
                    presence.isOnline
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-[#737373] dark:text-[#A8A8A8]'
                  }`}
                >
                  {presence.isOnline ? 'Active now' : presence.statusText}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Private Circle Footnote */}
      <p className="px-2 text-[11px] text-[#737373] dark:text-[#A8A8A8]">
        Cohert · Private space for our circle only.
      </p>
    </aside>
  );
};
