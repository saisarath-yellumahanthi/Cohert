import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  Calendar,
  ExternalLink,
  Heart,
  Lightbulb,
  Link2,
  MessageCircle,
  Send,
  Trash2,
  Trophy,
  UserPlus,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { OperationType, Post, PostComment, UserProfile } from '../types';
import {
  extractTimestampMs,
  formatDeadlineCountdown,
  formatRelativeTime,
  getInitials,
  sanitizeString,
  TOPIC_CHANNELS,
} from '../utils/validation';

interface PostCardProps {
  post: Post;
  currentUserProfile: UserProfile;
  isAdmin: boolean;
  isBookmarked: boolean;
  onToggleBookmark: (postId: string, currentlyBookmarked: boolean) => Promise<void>;
  isPreviewMode?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserProfile,
  isAdmin,
  isBookmarked,
  onToggleBookmark,
  isPreviewMode = false,
}) => {
  const [likedByMe, setLikedByMe] = useState(false);
  const [heartAnim, setHeartAnim] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [teammateRequested, setTeammateRequested] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Tick every 30 seconds so deadline countdowns and comment timestamps update every minute
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const topicInfo = TOPIC_CHANNELS.find((t) => t.id === post.topic);
  const countdown = post.deadlineDate ? formatDeadlineCountdown(post.deadlineDate, nowMs) : null;
  const canDelete = post.authorId === currentUserProfile.userId || isAdmin;

  // Listen to whether current user liked this post
  useEffect(() => {
    if (isPreviewMode || !post.id || !currentUserProfile.userId) return;
    const likeRef = doc(db, 'posts', post.id, 'likes', currentUserProfile.userId);
    const unsub = onSnapshot(
      likeRef,
      (snap) => {
        setLikedByMe(snap.exists());
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `posts/${post.id}/likes/${currentUserProfile.userId}`);
      }
    );
    return () => unsub();
  }, [post.id, currentUserProfile.userId, isPreviewMode]);

  // Listen to all comments on this post in real time for all members
  useEffect(() => {
    if (isPreviewMode || !post.id) return;
    const commentsQuery = query(
      collection(db, 'posts', post.id, 'comments'),
      where('postId', '==', post.id)
    );
    const unsub = onSnapshot(
      commentsQuery,
      (snap) => {
        const items: PostComment[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PostComment, 'id'>),
          }))
          .sort((a, b) => extractTimestampMs(a.createdAt) - extractTimestampMs(b.createdAt));
        setComments(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `posts/${post.id}/comments`);
      }
    );
    return () => unsub();
  }, [post.id, isPreviewMode]);

  const handleToggleLike = async () => {
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 240);

    if (isPreviewMode) {
      setLikedByMe((prev) => !prev);
      return;
    }

    const likeDocRef = doc(db, 'posts', post.id, 'likes', currentUserProfile.userId);
    const postDocRef = doc(db, 'posts', post.id);
    const batch = writeBatch(db);

    try {
      if (likedByMe) {
        batch.delete(likeDocRef);
        batch.update(postDocRef, {
          likesCount: Math.max(0, post.likesCount - 1),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } else {
        batch.set(likeDocRef, {
          postId: post.id,
          userId: currentUserProfile.userId,
          createdAt: serverTimestamp(),
        });
        batch.update(postDocRef, {
          likesCount: post.likesCount + 1,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();

        // Send notification to post author if not liking own post
        if (post.authorId !== currentUserProfile.userId) {
          const notifId = `like_${post.id}_${currentUserProfile.userId}_${Date.now()}`;
          await setDoc(doc(db, 'notifications', notifId), {
            recipientId: post.authorId,
            actorId: currentUserProfile.userId,
            actorName: sanitizeString(currentUserProfile.name || 'Friend', 80),
            actorAvatar: currentUserProfile.avatarUrl || '',
            type: 'like',
            targetId: post.id,
            message: `liked your ${post.postType} post${post.title ? ` "${sanitizeString(post.title, 40)}"` : ''}.`,
            read: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posts/${post.id}/likes`);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeString(commentText, 500);
    if (!cleaned || submittingComment) return;

    if (isPreviewMode) {
      setComments((prev) => [
        ...prev,
        {
          id: `c_${Date.now()}`,
          postId: post.id,
          authorId: currentUserProfile.userId,
          authorName: currentUserProfile.name || 'You',
          authorAvatar: currentUserProfile.avatarUrl || '',
          text: cleaned,
          createdAt: Date.now(),
        },
      ]);
      setCommentText('');
      return;
    }

    setSubmittingComment(true);
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const commentRef = doc(db, 'posts', post.id, 'comments', commentId);
    const postRef = doc(db, 'posts', post.id);
    const batch = writeBatch(db);

    try {
      batch.set(commentRef, {
        postId: post.id,
        authorId: currentUserProfile.userId,
        authorName: sanitizeString(currentUserProfile.name || 'Friend', 80),
        authorAvatar: currentUserProfile.avatarUrl || '',
        text: cleaned,
        createdAt: serverTimestamp(),
      });
      batch.update(postRef, {
        commentsCount: post.commentsCount + 1,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setCommentText('');

      if (post.authorId !== currentUserProfile.userId) {
        const notifId = `comm_${commentId}`;
        await setDoc(doc(db, 'notifications', notifId), {
          recipientId: post.authorId,
          actorId: currentUserProfile.userId,
          actorName: sanitizeString(currentUserProfile.name || 'Friend', 80),
          actorAvatar: currentUserProfile.avatarUrl || '',
          type: 'comment',
          targetId: post.id,
          message: `commented: "${sanitizeString(cleaned, 60)}"`,
          read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posts/${post.id}/comments`);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleRequestTeammate = async () => {
    if (teammateRequested || post.authorId === currentUserProfile.userId) return;
    setTeammateRequested(true);
    if (isPreviewMode) return;

    const notifId = `team_${post.id}_${currentUserProfile.userId}`;
    try {
      await setDoc(doc(db, 'notifications', notifId), {
        recipientId: post.authorId,
        actorId: currentUserProfile.userId,
        actorName: sanitizeString(currentUserProfile.name || 'Friend', 80),
        actorAvatar: currentUserProfile.avatarUrl || '',
        type: 'teammate_request',
        targetId: post.id,
        message: `wants to team up for "${sanitizeString(post.title || 'your opportunity', 60)}"!`,
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `notifications/${notifId}`);
    }
  };

  const handleDeletePost = async () => {
    if (isPreviewMode) return;
    try {
      await deleteDoc(doc(db, 'posts', post.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${post.id}`);
    }
  };

  return (
    <article className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] overflow-hidden mb-5 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-[2px] rounded-full bg-cohert-gradient shrink-0">
            <div className="w-9 h-9 rounded-full bg-[#FFFFFF] dark:bg-[#121212] p-[1.5px] overflow-hidden flex items-center justify-center">
              {post.authorAvatar ? (
                <img
                  src={post.authorAvatar}
                  alt={post.authorName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-[#262626] dark:text-[#F5F5F5]">
                  {getInitials(post.authorName)}
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#262626] dark:text-[#F5F5F5] truncate">
              <span className="truncate">{post.authorName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#737373] dark:text-[#A8A8A8]">
              {post.authorBranch && (
                <>
                  <span className="truncate">{post.authorBranch}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              {topicInfo && (
                <span>
                  {topicInfo.emoji} {topicInfo.label}
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTime(post.createdAt)}</span>
            </div>
          </div>
        </div>

        {canDelete && (
          <button
            type="button"
            onClick={handleDeletePost}
            aria-label={`Delete post by ${post.authorName}`}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#737373] hover:text-red-500 hover:bg-[#FAFAFA] dark:hover:bg-[#1A1A1A] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Special Post Header Banner (Idea / Opportunity / Resource) */}
      {(post.postType !== 'standard' || post.title || countdown) && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#737373] dark:text-[#A8A8A8]">
            <div className="flex items-center gap-1.5 font-medium text-[#262626] dark:text-[#F5F5F5]">
              {post.postType === 'idea' && <Lightbulb className="w-4 h-4 text-[#FCB045]" />}
              {post.postType === 'opportunity' && <Trophy className="w-4 h-4 text-[#FD1D1D]" />}
              {post.postType === 'resource' && <Link2 className="w-4 h-4 text-[#833AB4]" />}
              <span className="capitalize">{post.postType}</span>
              {post.lookingForTeammates && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#FD1D1D] font-semibold">Looking for teammates</span>
                </>
              )}
            </div>

            {countdown && (
              <div
                className={`flex items-center gap-1 text-xs font-medium tabular-nums ${
                  countdown.isPast
                    ? 'text-[#737373] dark:text-[#A8A8A8]'
                    : countdown.isUrgent
                    ? 'text-[#FD1D1D] font-semibold'
                    : 'text-[#833AB4] dark:text-[#FCB045]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{countdown.label}</span>
              </div>
            )}
          </div>

          {post.title && (
            <h3 className="text-base font-semibold font-heading text-[#262626] dark:text-[#F5F5F5] leading-snug">
              {post.title}
            </h3>
          )}
        </div>
      )}

      {/* Optional Post Image */}
      {post.imageUrl && !imageBroken && (
        <div className="w-full bg-[#FAFAFA] dark:bg-[#1A1A1A] border-y border-[#DBDBDB] dark:border-[#262626] max-h-[520px] overflow-hidden flex items-center justify-center">
          <img
            src={post.imageUrl}
            alt={post.title || `Post by ${post.authorName}`}
            referrerPolicy="no-referrer"
            onError={() => setImageBroken(true)}
            className="w-full h-auto max-h-[520px] object-cover"
          />
        </div>
      )}

      {/* Post Body & External Link */}
      <div className="px-4 pt-3 pb-2 space-y-3">
        <p className="text-sm text-[#262626] dark:text-[#F5F5F5] whitespace-pre-line leading-relaxed">
          <span className="font-semibold mr-1.5">{post.authorName}</span>{' '}
          {post.content}
        </p>

        {post.externalLink && (
          <a
            href={post.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-medium text-[#833AB4] dark:text-[#FCB045] hover:underline break-all"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span>{post.externalLink}</span>
          </a>
        )}

        {post.postType === 'opportunity' &&
          post.lookingForTeammates &&
          post.authorId !== currentUserProfile.userId && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleRequestTeammate}
                disabled={teammateRequested}
                className={`inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl text-xs font-medium transition-all ${
                  teammateRequested
                    ? 'bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#737373] border border-[#DBDBDB] dark:border-[#262626]'
                    : 'bg-cohert-gradient text-white shadow-sm active:scale-95'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{teammateRequested ? 'Teammate Request Sent' : 'Request to Join Team'}</span>
              </button>
            </div>
          )}
      </div>

      {/* Action Bar (Like, Comment, Bookmark) */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleLike}
            aria-label={likedByMe ? 'Unlike post' : 'Like post'}
            className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] text-sm font-medium text-[#262626] dark:text-[#F5F5F5] hover:opacity-80 transition-opacity"
          >
            <Heart
              className={`w-6 h-6 transition-transform ${heartAnim ? 'animate-heart-pop' : ''} ${
                likedByMe ? 'fill-[#FD1D1D] text-[#FD1D1D]' : ''
              }`}
            />
            <span className="tabular-nums">{post.likesCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowComments((prev) => !prev)}
            aria-label="Toggle comments"
            className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] text-sm font-medium text-[#262626] dark:text-[#F5F5F5] hover:opacity-80 transition-opacity"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="tabular-nums">{Math.max(post.commentsCount || 0, comments.length)}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onToggleBookmark(post.id, isBookmarked)}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Save post'}
          className="min-h-[44px] min-w-[44px] flex items-center justify-end text-[#262626] dark:text-[#F5F5F5] hover:opacity-80 transition-opacity"
        >
          <Bookmark
            className={`w-6 h-6 ${
              isBookmarked ? 'fill-[#262626] dark:fill-[#F5F5F5]' : ''
            }`}
          />
        </button>
      </div>

      {/* Comments Section (always displays existing comments in real time + input when toggled) */}
      {(showComments || comments.length > 0) && (
        <div className="border-t border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] px-4 py-3 space-y-3">
          {comments.length === 0 ? (
            <p className="text-xs text-[#737373] dark:text-[#A8A8A8] py-1">
              No comments yet. Start the conversation with your circle.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {comments.map((c) => (
                <div key={c.id} className="text-xs leading-relaxed flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#FFFFFF] dark:bg-[#121212] border border-[#DBDBDB] dark:border-[#262626] overflow-hidden flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
                      {c.authorAvatar ? (
                        <img
                          src={c.authorAvatar}
                          alt={c.authorName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(c.authorName)
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-[#262626] dark:text-[#F5F5F5] mr-1.5">
                        {c.authorName}
                      </span>
                      <span className="text-[#262626] dark:text-[#F5F5F5]">{c.text}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#737373] dark:text-[#A8A8A8] shrink-0">
                    {formatRelativeTime(c.createdAt, nowMs)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              maxLength={500}
              aria-label="Add a comment"
              className="flex-1 min-h-[40px] px-3 py-2 text-xs rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || submittingComment}
              aria-label="Post comment"
              className="min-h-[40px] px-3.5 rounded-xl bg-cohert-gradient text-white text-xs font-medium disabled:opacity-40 flex items-center gap-1 transition-transform active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Post</span>
            </button>
          </form>
        </div>
      )}
    </article>
  );
};
