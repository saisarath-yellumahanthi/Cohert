import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  Paperclip,
  Send,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { compressImageFile, db, handleFirestoreError } from '../firebase';
import {
  FileAttachment,
  OperationType,
  Post,
  PostType,
  TopicId,
  UserProfile,
} from '../types';
import {
  ALLOWED_FILE_INPUT_ACCEPT,
  formatFileSize,
  sanitizeString,
  TOPIC_CHANNELS,
  validateAttachmentFile,
} from '../utils/validation';
import { uploadFilesToStorage } from '../utils/mediaUpload';

interface CreatePostProps {
  isOpen?: boolean;
  onClose?: () => void;
  currentUserProfile: UserProfile;
  onPostCreated?: (newPost?: Post) => void;
  onPreviewCreatePost?: (newPost: Post) => void;
  onCancel?: () => void;
  isPreviewMode?: boolean;
}

export const CreatePost: React.FC<CreatePostProps> = ({
  isOpen = true,
  onClose,
  currentUserProfile,
  onPostCreated,
  onPreviewCreatePost,
  onCancel,
  isPreviewMode = false,
}) => {
  const [postType, setPostType] = useState<PostType>('standard');
  const [topic, setTopic] = useState<TopicId>('studies');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [lookingForTeammates, setLookingForTeammates] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [cancelUploadFn, setCancelUploadFn] = useState<(() => void) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setError(null);
    if (onClose) onClose();
    if (onCancel) onCancel();
  };

  const resetForm = () => {
    setPostType('standard');
    setTopic('studies');
    setTitle('');
    setContent('');
    setExternalLink('');
    setDeadlineDate('');
    setLookingForTeammates(false);
    setImageUrl('');
    setPendingFiles([]);
    setUploadProgress(null);
    setError(null);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setError(null);
      const compressed = await compressImageFile(file, 1080, 0.78);
      setImageUrl(compressed);
    } catch {
      setError('Could not process image. Try a smaller JPG or PNG photo.');
    }
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const selected: File[] = Array.from(fileList);
    e.target.value = '';
    setError(null);

    const validToAdd: File[] = [];
    for (const file of selected) {
      const check = validateAttachmentFile({
        name: file.name,
        size: file.size,
        type: file.type,
      });
      if (!check.valid) {
        setError(check.error || 'Unsupported file.');
        return;
      }
      validToAdd.push(file);
    }

    setPendingFiles((prev) => {
      const combined = [...prev, ...validToAdd];
      if (combined.length > 10) {
        setError('You can attach up to 10 files per post.');
        return combined.slice(0, 10);
      }
      return combined;
    });
  };

  const handleRemovePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCancelUpload = () => {
    if (cancelUploadFn) {
      cancelUploadFn();
      setCancelUploadFn(null);
    }
    setUploadProgress(null);
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanedContent = sanitizeString(content, 2000);
    const cleanedTitle = sanitizeString(title, 140);
    const cleanedLink = sanitizeString(externalLink, 500);

    if (!cleanedContent) {
      setError('Please write a description or note for your post.');
      return;
    }

    if (postType !== 'standard' && !cleanedTitle) {
      setError('Please add a title for this post type.');
      return;
    }

    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setSubmitting(true);
    try {
      let uploadedAttachments: FileAttachment[] = [];
      if (pendingFiles.length > 0) {
        setUploadProgress(1);
        uploadedAttachments = await uploadFilesToStorage({
          basePath: `posts/${postId}/files`,
          files: pendingFiles,
          uploaderId: currentUserProfile.userId,
          uploaderName: sanitizeString(currentUserProfile.name || 'Friend', 80),
          isPreviewMode,
          onProgress: (pct) => setUploadProgress(pct),
          onTaskReady: (cancelFn) => setCancelUploadFn(() => cancelFn),
        });
      }

      if (isPreviewMode) {
        const previewPost: Post = {
          id: postId,
          authorId: currentUserProfile.userId,
          authorName: currentUserProfile.name || 'Friend',
          authorAvatar: currentUserProfile.avatarUrl || '',
          authorBranch: `${currentUserProfile.branch} · ${currentUserProfile.year}`,
          circleId: 'cohert',
          topic,
          postType,
          title: cleanedTitle,
          content: cleanedContent,
          imageUrl: imageUrl || '',
          ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
          externalLink: cleanedLink,
          deadlineDate: postType === 'opportunity' ? deadlineDate : '',
          lookingForTeammates: postType === 'opportunity' ? lookingForTeammates : false,
          likesCount: 0,
          commentsCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        onPreviewCreatePost?.(previewPost);
        onPostCreated?.(previewPost);
        resetForm();
        handleCloseModal();
        return;
      }

      const postData: Record<string, any> = {
        authorId: currentUserProfile.userId,
        authorName: sanitizeString(currentUserProfile.name || 'Friend', 80),
        authorAvatar: currentUserProfile.avatarUrl || '',
        authorBranch: sanitizeString(
          `${currentUserProfile.branch || ''} ${currentUserProfile.year ? `· ${currentUserProfile.year}` : ''}`.trim(),
          80
        ),
        circleId: 'cohert',
        topic,
        postType,
        title: cleanedTitle,
        content: cleanedContent,
        imageUrl: imageUrl || '',
        externalLink: cleanedLink,
        deadlineDate: postType === 'opportunity' ? sanitizeString(deadlineDate, 40) : '',
        lookingForTeammates: postType === 'opportunity' ? Boolean(lookingForTeammates) : false,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (uploadedAttachments.length > 0) {
        postData.attachments = uploadedAttachments;
      }

      await setDoc(doc(db, 'posts', postId), postData);
      resetForm();
      onPostCreated?.();
      handleCloseModal();
    } catch (err: any) {
      if (err?.message === 'UPLOAD_CANCELLED') {
        setError('File upload cancelled.');
      } else if (err?.message && !err?.code) {
        setError(err.message);
      } else {
        handleFirestoreError(err, OperationType.CREATE, `posts/${postId}`);
        setError('Could not publish post. Please check your connection.');
      }
    } finally {
      setCancelUploadFn(null);
      setUploadProgress(null);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-5 my-8 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#DBDBDB] dark:border-[#262626]">
          <div>
            <h2 className="text-lg font-bold font-heading text-[#262626] dark:text-[#F5F5F5]">
              Share with Cohert
            </h2>
            <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
              Visible only to your 5-member private circle
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="Close create post"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#737373] hover:text-[#262626] dark:hover:text-[#F5F5F5] hover:bg-[#FAFAFA] dark:hover:bg-[#1A1A1A]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Post Type Selector */}
          <div>
            <label className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-2">
              Post Format
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'standard', label: 'Update', icon: Sparkles },
                { id: 'idea', label: 'Idea', icon: Lightbulb },
                { id: 'opportunity', label: 'Opportunity', icon: Trophy },
                { id: 'resource', label: 'Resource', icon: Link2 },
              ].map((item) => {
                const Icon = item.icon;
                const active = postType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPostType(item.id as PostType);
                      if (item.id === 'idea') setTopic('ideas');
                      if (item.id === 'opportunity' && topic === 'studies') setTopic('hackathons');
                    }}
                    className={`flex items-center justify-center gap-2 min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      active
                        ? 'border-[#833AB4] bg-[#833AB4]/10 text-[#262626] dark:text-[#F5F5F5] font-semibold'
                        : 'border-[#DBDBDB] dark:border-[#262626] text-[#737373] dark:text-[#A8A8A8] hover:text-[#262626] dark:hover:text-[#F5F5F5]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topic Channel Selector */}
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
                    className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-medium border transition-all ${
                      active
                        ? 'border-[#FD1D1D] bg-[#FD1D1D]/10 text-[#262626] dark:text-[#F5F5F5] font-semibold'
                        : 'border-[#DBDBDB] dark:border-[#262626] text-[#737373] dark:text-[#A8A8A8]'
                    }`}
                  >
                    {ch.emoji} {ch.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title (shown for Idea / Opportunity / Resource or optional for Standard) */}
          <div>
            <label
              htmlFor="post-title-input"
              className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1"
            >
              {postType === 'opportunity'
                ? 'Hackathon / Internship Name *'
                : postType === 'idea'
                ? 'Idea Title *'
                : postType === 'resource'
                ? 'Resource Title *'
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
                  ? 'e.g., Smart India Hackathon 2026 / Google STEP'
                  : postType === 'idea'
                  ? 'e.g., AI Mock Interviewer for Placement Prep'
                  : 'Headline...'
              }
              className="w-full min-h-[42px] px-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
            />
          </div>

          {/* Opportunity-specific fields: Deadline + Teammate toggle */}
          {postType === 'opportunity' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626]">
              <div>
                <label
                  htmlFor="post-deadline-input"
                  className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1"
                >
                  Application / Submission Deadline
                </label>
                <input
                  id="post-deadline-input"
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] text-[#262626] dark:text-[#F5F5F5]"
                />
              </div>

              <div className="flex items-center pt-4">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={lookingForTeammates}
                    onChange={(e) => setLookingForTeammates(e.target.checked)}
                    className="w-4 h-4 accent-[#FD1D1D] rounded"
                  />
                  <span className="text-xs font-medium text-[#262626] dark:text-[#F5F5F5]">
                    Looking for teammates
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* External link for Opportunity or Resource */}
          {(postType === 'opportunity' || postType === 'resource') && (
            <div>
              <label
                htmlFor="post-link-input"
                className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1"
              >
                {postType === 'resource' ? 'Study Material / Note Link' : 'Registration / Info Link'}
              </label>
              <input
                id="post-link-input"
                type="url"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                placeholder="https://..."
                className="w-full min-h-[42px] px-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
              />
            </div>
          )}

          {/* Main Description */}
          <div>
            <label
              htmlFor="post-content-textarea"
              className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1"
            >
              Description / Notes *
            </label>
            <textarea
              id="post-content-textarea"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              placeholder="Share details, stack requirements, study notes, or thoughts with the group..."
              className="w-full p-3.5 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
            />
          </div>

          {/* Image Upload & File Attachments Row */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <label
                htmlFor="post-image-upload"
                className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-xs font-medium text-[#262626] dark:text-[#F5F5F5] cursor-pointer hover:opacity-80"
              >
                <ImageIcon className="w-4 h-4 text-[#833AB4]" />
                <span>{imageUrl ? 'Change Photo' : 'Add Photo'}</span>
              </label>
              <input
                id="post-image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove Photo
                </button>
              )}

              <label
                htmlFor="post-file-upload"
                className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-xs font-medium text-[#262626] dark:text-[#F5F5F5] cursor-pointer hover:opacity-80"
              >
                <Paperclip className="w-4 h-4 text-[#E1306C]" />
                <span>Attach Files</span>
              </label>
              <input
                id="post-file-upload"
                type="file"
                multiple
                accept={ALLOWED_FILE_INPUT_ACCEPT}
                onChange={handleFilesChange}
                className="hidden"
              />
            </div>

            {imageUrl && (
              <div className="rounded-xl overflow-hidden border border-[#DBDBDB] dark:border-[#262626] max-h-60">
                <img src={imageUrl} alt="Upload preview" className="w-full h-48 object-cover" />
              </div>
            )}

            {/* Attached Files Queue */}
            {pendingFiles.length > 0 && (
              <div className="p-3 rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#A8A8A8]">
                  <span>
                    {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''} ready to upload
                    (max 15 MB each)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles([])}
                    className="text-[#FD1D1D] font-medium hover:underline"
                  >
                    Clear all
                  </button>
                </div>
                <div className="space-y-1.5">
                  {pendingFiles.map((file, idx) => (
                    <div
                      key={`${file.name}_${idx}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#121212] border border-[#DBDBDB] dark:border-[#262626] text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-[#E1306C] shrink-0" />
                        <span className="truncate font-medium text-[#262626] dark:text-[#F5F5F5]">
                          {file.name}
                        </span>
                        <span className="text-[11px] text-[#737373] shrink-0">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePendingFile(idx)}
                        aria-label={`Remove ${file.name}`}
                        className="text-[#737373] hover:text-red-500 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress Bar & Cancel Option */}
            {uploadProgress !== null && (
              <div className="p-3 rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#262626] dark:text-[#F5F5F5]">
                    Uploading attachments... {uploadProgress}%
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="text-xs font-semibold text-[#FD1D1D] hover:underline"
                  >
                    Cancel upload
                  </button>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#DBDBDB] dark:bg-[#262626] overflow-hidden">
                  <div
                    className="h-full bg-cohert-gradient transition-all duration-200"
                    style={{ width: `${Math.max(5, uploadProgress)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-500 font-medium">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-[#DBDBDB] dark:border-[#262626] text-xs font-medium text-[#737373] dark:text-[#A8A8A8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-cohert-gradient text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-transform active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Publishing...' : 'Publish to Cohert'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
