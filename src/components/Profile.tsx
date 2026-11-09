import React, { useState } from 'react';
import {
  Bookmark,
  Camera,
  Edit3,
  Grid,
  LogOut,
  Moon,
  PlusCircle,
  Shield,
  Sun,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { compressImageFile, db, handleFirestoreError } from '../firebase';
import { OperationType, Post, UserProfile } from '../types';
import { getInitials, sanitizeString, TOPIC_CHANNELS } from '../utils/validation';

interface ProfileProps {
  profile: UserProfile;
  userEmail: string;
  myPosts: Post[];
  savedPosts: Post[];
  isAdmin: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenCreatePost: () => void;
  onOpenAdminPanel: () => void;
  onSignOut: () => void;
  isPreviewMode?: boolean;
  onPreviewUpdateProfile?: (updated: Partial<UserProfile>) => void;
}

export const Profile: React.FC<ProfileProps> = ({
  profile,
  userEmail,
  myPosts,
  savedPosts,
  isAdmin,
  darkMode,
  onToggleDarkMode,
  onOpenCreatePost,
  onOpenAdminPanel,
  onSignOut,
  isPreviewMode = false,
  onPreviewUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [branch, setBranch] = useState(profile.branch);
  const [year, setYear] = useState(profile.year);
  const [skillsInput, setSkillsInput] = useState(profile.skills.join(', '));
  const [bio, setBio] = useState(profile.bio);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [saving, setSaving] = useState(false);

  const openEditModal = () => {
    setName(profile.name);
    setBranch(profile.branch);
    setYear(profile.year);
    setSkillsInput(profile.skills.join(', '));
    setBio(profile.bio);
    setAvatarUrl(profile.avatarUrl);
    setEditing(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 400, 0.8);
      setAvatarUrl(compressed);
    } catch {
      // ignore invalid file
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSkills = skillsInput
      .split(',')
      .map((s) => sanitizeString(s, 40))
      .filter(Boolean)
      .slice(0, 10);

    const updates = {
      name: sanitizeString(name, 80),
      avatarUrl: avatarUrl || '',
      branch: sanitizeString(branch, 80),
      year: sanitizeString(year, 40),
      skills: parsedSkills,
      bio: sanitizeString(bio, 300),
      profileCompleted: true,
    };

    if (isPreviewMode && onPreviewUpdateProfile) {
      onPreviewUpdateProfile(updates);
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'profiles', profile.userId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      setEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `profiles/${profile.userId}`);
    } finally {
      setSaving(false);
    }
  };

  const displayedPosts = activeTab === 'posts' ? myPosts : savedPosts;

  return (
    <div className="w-full max-w-[720px] mx-auto space-y-6">
      {/* Profile Header Card */}
      <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with Story Gradient Ring */}
          <div className="p-[3px] rounded-full bg-cohert-gradient shrink-0">
            <div className="w-24 h-24 rounded-full bg-[#FFFFFF] dark:bg-[#121212] p-[2px] overflow-hidden flex items-center justify-center">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name || 'Profile avatar'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold font-heading text-[#262626] dark:text-[#F5F5F5]">
                  {getInitials(profile.name)}
                </span>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 text-center sm:text-left space-y-3 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold font-heading text-[#262626] dark:text-[#F5F5F5]">
                  {profile.name || 'Complete your profile'}
                </h1>
                <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
                  {[profile.branch, profile.year].filter(Boolean).join(' · ') ||
                    'Add your branch & graduation year'}
                </p>
              </div>

              <div className="flex items-center justify-center sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={openEditModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-xs font-medium text-[#262626] dark:text-[#F5F5F5] hover:opacity-90"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={onOpenAdminPanel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-cohert-gradient text-white text-xs font-medium shadow-2xs"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </button>
                )}
              </div>
            </div>

            {/* Counts */}
            <div className="flex items-center justify-center sm:justify-start gap-6 text-xs">
              <div>
                <span className="font-bold tabular-nums text-[#262626] dark:text-[#F5F5F5]">
                  {myPosts.length}
                </span>{' '}
                <span className="text-[#737373] dark:text-[#A8A8A8]">posts</span>
              </div>
              <div>
                <span className="font-bold tabular-nums text-[#262626] dark:text-[#F5F5F5]">
                  {savedPosts.length}
                </span>{' '}
                <span className="text-[#737373] dark:text-[#A8A8A8]">saved</span>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-sm text-[#262626] dark:text-[#F5F5F5] leading-relaxed">
                {profile.bio}
              </p>
            )}

            {/* Skills Chips */}
            {profile.skills.length > 0 && (
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 rounded-lg bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626] text-xs font-medium text-[#262626] dark:text-[#F5F5F5]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: My Posts Grid vs Saved */}
      <div className="border-t border-[#DBDBDB] dark:border-[#262626]">
        <div className="flex items-center justify-center gap-10">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 py-3.5 min-h-[44px] text-xs font-semibold border-t-2 -mt-[1px] transition-colors ${
              activeTab === 'posts'
                ? 'border-[#262626] dark:border-[#F5F5F5] text-[#262626] dark:text-[#F5F5F5]'
                : 'border-transparent text-[#737373] dark:text-[#A8A8A8]'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Posts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 py-3.5 min-h-[44px] text-xs font-semibold border-t-2 -mt-[1px] transition-colors ${
              activeTab === 'saved'
                ? 'border-[#262626] dark:border-[#F5F5F5] text-[#262626] dark:text-[#F5F5F5]'
                : 'border-transparent text-[#737373] dark:text-[#A8A8A8]'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Saved</span>
          </button>
        </div>

        {/* 3-Column Instagram Grid or Empty State */}
        {displayedPosts.length === 0 ? (
          <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-10 text-center space-y-4 mt-2">
            <div className="w-12 h-12 rounded-full bg-cohert-gradient p-[2px] mx-auto">
              <div className="w-full h-full rounded-full bg-[#FFFFFF] dark:bg-[#121212] flex items-center justify-center">
                {activeTab === 'posts' ? (
                  <Grid className="w-5 h-5 text-[#833AB4] dark:text-[#FCB045]" />
                ) : (
                  <Bookmark className="w-5 h-5 text-[#833AB4] dark:text-[#FCB045]" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
                {activeTab === 'posts'
                  ? 'Your posts will appear here.'
                  : 'No saved posts yet.'}
              </h3>
              <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
                {activeTab === 'posts'
                  ? 'Share an idea, hackathon opportunity, or study note with your friends.'
                  : 'Bookmark study resources or opportunities from the feed to revisit them here.'}
              </p>
            </div>
            {activeTab === 'posts' && (
              <button
                type="button"
                onClick={onOpenCreatePost}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-cohert-gradient text-white text-xs font-semibold shadow-sm transition-transform active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create first post</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-2">
            {displayedPosts.map((post) => {
              const topicObj = TOPIC_CHANNELS.find((t) => t.id === post.topic);
              return (
                <div
                  key={post.id}
                  className="aspect-square rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] overflow-hidden relative group flex flex-col justify-between p-3"
                >
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.title || post.content}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : null}
                  <div
                    className={`relative z-10 flex items-center justify-between text-[11px] font-medium ${
                      post.imageUrl ? 'text-white drop-shadow-xs' : 'text-[#737373] dark:text-[#A8A8A8]'
                    }`}
                  >
                    <span>{topicObj?.emoji}</span>
                    <span className="capitalize">{post.postType}</span>
                  </div>
                  <div
                    className={`relative z-10 ${
                      post.imageUrl
                        ? 'bg-black/60 backdrop-blur-2xs p-2 rounded-lg text-white'
                        : 'text-[#262626] dark:text-[#F5F5F5]'
                    }`}
                  >
                    {post.title && (
                      <p className="text-xs font-semibold line-clamp-1 mb-0.5">{post.title}</p>
                    )}
                    <p className="text-[11px] line-clamp-2 opacity-90">{post.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings & Preferences Card */}
      <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-5 space-y-4">
        <h2 className="text-sm font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
          Settings & Preferences
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-xs">
            <p className="font-medium text-[#262626] dark:text-[#F5F5F5]">Appearance</p>
            <p className="text-[#737373] dark:text-[#A8A8A8]">
              Signed in as {userEmail || 'circle member'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-xs font-medium text-[#262626] dark:text-[#F5F5F5]"
            >
              {darkMode ? <Sun className="w-4 h-4 text-[#FCB045]" /> : <Moon className="w-4 h-4" />}
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] text-xs font-medium text-red-500 hover:bg-red-500/5"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-[#DBDBDB] dark:border-[#262626] flex items-center justify-between text-xs text-[#737373] dark:text-[#A8A8A8]">
          <span>Private space for our circle only.</span>
          <span>Cohert · Max 5 Members</span>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 id="edit-profile-title" className="text-base font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
                Edit Your Profile
              </h3>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close edit profile modal"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#737373]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626] overflow-hidden flex items-center justify-center shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold">{getInitials(name)}</span>
                  )}
                </div>
                <label
                  htmlFor="profile-avatar-upload"
                  className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-xs font-medium cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#833AB4] dark:text-[#FCB045]" />
                  <span>Upload Photo</span>
                </label>
                <input
                  id="profile-avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>

              <div>
                <label htmlFor="edit-name" className="block text-xs font-medium text-[#737373] mb-1">
                  Full Name *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-branch" className="block text-xs font-medium text-[#737373] mb-1">
                    Branch / Major
                  </label>
                  <input
                    id="edit-branch"
                    type="text"
                    maxLength={80}
                    placeholder="e.g., CSE / ECE"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]"
                  />
                </div>
                <div>
                  <label htmlFor="edit-year" className="block text-xs font-medium text-[#737373] mb-1">
                    Year / Batch
                  </label>
                  <input
                    id="edit-year"
                    type="text"
                    maxLength={40}
                    placeholder="e.g., 3rd Year / 2027"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-skills" className="block text-xs font-medium text-[#737373] mb-1">
                  Skills (comma-separated, max 10)
                </label>
                <input
                  id="edit-skills"
                  type="text"
                  placeholder="React, Python, System Design, Machine Learning"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]"
                />
              </div>

              <div>
                <label htmlFor="edit-bio" className="block text-xs font-medium text-[#737373] mb-1">
                  Short Bio
                </label>
                <textarea
                  id="edit-bio"
                  rows={3}
                  maxLength={300}
                  placeholder="What are you learning or building right now?"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-3 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 min-h-[42px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] text-xs font-medium text-[#737373]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 min-h-[42px] rounded-xl bg-cohert-gradient text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
