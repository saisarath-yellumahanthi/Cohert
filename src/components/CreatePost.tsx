import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { compressImageFile, db, handleFirestoreError } from '../firebase';
import { OperationType, Post, PostType, TopicId, UserProfile } from '../types';
import { sanitizeString, TOPIC_CHANNELS } from '../utils/validation';

interface CreatePostProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile;
  isPreviewMode?: boolean;
  onPreviewCreatePost?: (post: Post) => void;
}

export const CreatePost: React.FC<CreatePostProps> = ({
  isOpen,
  onClose,
  currentUserProfile,
  isPreviewMode = false,
  onPreviewCreatePost,
}) => {
  const [postType, setPostType] = useState<PostType>('standard');
  const [topic, setTopic] = useState<TopicId>('studies');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [lookingForTeammates, setLookingForTeammates] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setErrorMsg('');
    try {
      const compressed = await compressImageFile(file, 960, 0.78);
      setImageUrl(compressed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not process image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanedTitle = sanitizeString(title, 140);
    const cleanedContent = sanitizeString(content, 2000);
    const cleanedLink = sanitizeString(externalLink, 500);
    const cleanedDeadline = sanitizeString(deadlineDate, 40);

    if (!cleanedContent) {
      setErrorMsg('Please enter a description or note for your post.');
      return;
    }

    if ((postType === 'idea' || postType === 'opportunity' || postType === 'resource') && !cleanedTitle) {
      setErrorMsg(`Please enter a title for your ${postType} post.`);
      return;
    }

    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const authorBranchSummary = [currentUserProfile.branch, currentUserProfile.year]
      .filter(Boolean)
      .join(' · ');

    if (isPreviewMode && onPreviewCreatePost) {
      onPreviewCreatePost({
        id: postId,
        authorId: currentUserProfile.userId,
        authorName: sanitizeString(currentUserProfile.name || 'Member', 80),
        authorAvatar: currentUserProfile.avatarUrl || '',
        authorBranch: sanitizeString(authorBranchSummary, 80),
        circleId: 'cohert',
        topic,
        postType,
        title: cleanedTitle,
        content: cleanedContent,
        imageUrl: imageUrl || '',
        externalLink: cleanedLink,
        deadlineDate: postType === 'opportunity' ? cleanedDeadline : '',
        lookingForTeammates: postType === 'opportunity' ? lookingForTeammates : false,
        likesCount: 0,
        commentsCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      await setDoc(doc(db, 'posts', postId), {
        authorId: currentUserProfile.userId,
        authorName: sanitizeString(currentUserProfile.name || 'Member', 80),
        authorAvatar: currentUserProfile.avatarUrl || '',
        authorBranch: sanitizeString(authorBranchSummary, 80),
        circleId: 'cohert',
        topic,
        postType,
        title: cleanedTitle,
        content: cleanedContent,
        imageUrl: imageUrl || '',
        externalLink: cleanedLink,
        deadlineDate: postType === 'opportunity' ? cleanedDeadline : '',
        lookingForTeammates: postType === 'opportunity' ? lookingForTeammates : false,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTitle('');
      setContent('');
      setExternalLink('');
      setDeadlineDate('');
      setLookingForTeammates(false);
      setImageUrl('');
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `posts/${postId}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DBDBDB] dark:border-[#262626]">
          <h2 id="create-post-title" className="text-base font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
            Share with Cohert
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#737373] hover:text-[#262626] dark:hover:text-[#F5F5F5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Post Type Selector */}
          <div>
            <label className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-2">
              Post Format
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'standard' as PostType, label: 'Update', icon: FileText },
                { id: 'idea' as PostType, label: 'Idea', icon: Lightbulb },
                { id: 'opportunity' as PostType, label: 'Opportunity', icon: Trophy },
                { id: 'resource' as PostType, label: 'Resource', icon: BookOpen },
              ].map((item) => {
                const Icon = item.icon;
                const active = postType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPostType(item.id);
                      if (item.id === 'idea') setTopic('ideas');
                      if (item.id === 'opportunity' && topic === 'studies') setTopic('hackathons');
                      if (item.id === 'resource') setTopic('studies');
                    }}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${
                      active
                        ? 'border-transparent bg-cohert-gradient text-white shadow-xs'
                        : 'border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topic Tag Selector */}
          <div>
            <label className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-2">
              Topic Channel (Required)
            </label>
            <div className="flex flex-wrap gap-2">
              {TOPIC_CHANNELS.map((ch) => {
                const active = topic === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setTopic(ch.id)}
                    className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
                      active
                        ? 'border-[#833AB4] bg-[#833AB4]/10 dark:bg-[#FCB045]/15 text-[#262626] dark:text-[#F5F5F5] font-semibold'
                        : 'border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#737373] dark:text-[#A8A8A8]'
                    }`}
                  >
                    {ch.emoji} {ch.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title Field (for Idea, Opportunity, Resource, or optional on Standard) */}
          <div>
            <label
              htmlFor="post-title-input"
              className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1.5"
            >
              {postType === 'opportunity'
                ? 'Hackathon / Internship Name *'
                : postType === 'idea'
                ? 'Idea Title *'
                : postType === 'resource'
                ? 'Study Resource Title *'
                : 'Title (Optional)'}
            </label>
            <input
              id="post-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder={
                postType === 'opportunity'
                  ? 'e.g., Google STEP Internship / ETHGlobal Hackathon'
                  : postType === 'idea'
                  ? 'e.g., Peer Mock Interview Scheduler'
                  : 'Give your post a headline...'
              }
              className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
            />
          </div>

          {/* Opportunity-Specific Fields */}
          {postType === 'opportunity' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626]">
              <div>
                <label
                  htmlFor="post-deadline-input"
                  className="flex items-center gap-1.5 text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Application Deadline</span>
                </label>
                <input
                  id="post-deadline-input"
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-1.5 text-xs rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] text-[#262626] dark:text-[#F5F5F5]"
                />
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => setLookingForTeammates((prev) => !prev)}
                  aria-pressed={lookingForTeammates}
                  className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-2 transition-colors ${
                    lookingForTeammates
                      ? 'border-[#FD1D1D] bg-[#FD1D1D]/10 text-[#FD1D1D] font-semibold'
                      : 'border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] text-[#737373] dark:text-[#A8A8A8]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Looking for teammates: {lookingForTeammates ? 'Yes' : 'No'}</span>
                </button>
              </div>
            </div>
          )}

          {/* External Link for Opportunity or Resource */}
          {(postType === 'opportunity' || postType === 'resource') && (
            <div>
              <label
                htmlFor="post-link-input"
                className="flex items-center gap-1.5 text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Link URL</span>
              </label>
              <input
                id="post-link-input"
                type="url"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                maxLength={500}
                placeholder="https://..."
                className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
              />
            </div>
          )}

          {/* Content / Description */}
          <div>
            <label
              htmlFor="post-content-input"
              className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1.5"
            >
              Description / Notes *
            </label>
            <textarea
              id="post-content-input"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              placeholder="Write details, key takeaways, or what skills you need for your team..."
              className="w-full p-3.5 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
            />
          </div>

          {/* Image Upload */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="post-image-upload"
                className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[42px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-xs font-medium text-[#262626] dark:text-[#F5F5F5] cursor-pointer hover:opacity-90"
              >
                <ImageIcon className="w-4 h-4 text-[#833AB4] dark:text-[#FCB045]" />
                <span>{uploadingImage ? 'Processing image...' : imageUrl ? 'Change Image' : 'Attach Image'}</span>
              </label>
              <input
                id="post-image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove image
                </button>
              )}
            </div>

            {imageUrl && (
              <div className="mt-2 rounded-xl overflow-hidden border border-[#DBDBDB] dark:border-[#262626] max-h-44 flex items-center justify-center bg-[#FAFAFA] dark:bg-[#1A1A1A]">
                <img src={imageUrl} alt="Upload preview" className="max-h-44 object-contain" />
              </div>
            )}
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs text-red-500 font-medium">
              {errorMsg}
            </p>
          )}

          {/* Submit */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[44px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] text-xs font-medium text-[#737373] dark:text-[#A8A8A8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingImage}
              className="px-6 py-2.5 min-h-[44px] rounded-xl bg-cohert-gradient text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition-transform active:scale-95"
            >
              {submitting ? 'Sharing...' : 'Share Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
