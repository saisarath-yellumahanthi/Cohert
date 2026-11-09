/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Bell,
  Home,
  MessageCircle,
  Moon,
  PlusSquare,
  Search,
  Shield,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from './firebase';
import {
  Bookmark,
  ChatRoom,
  CircleConfig,
  NavTab,
  NotificationItem,
  OperationType,
  Post,
  TopicId,
  UserProfile,
} from './types';
import { BOOTSTRAPPED_ADMIN_EMAIL } from './utils/validation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthScreen } from './components/AuthScreen';
import { Feed } from './components/Feed';
import { CreatePost } from './components/CreatePost';
import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { Profile } from './components/Profile';
import { Notifications } from './components/Notifications';
import { AdminPanel } from './components/AdminPanel';
import { SearchView } from './components/SearchView';
import { RightSidePanel } from './components/RightSidePanel';
import { OnboardingModal } from './components/OnboardingModal';

function getTimestampMs(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toMillis' in ts &&
    typeof (ts as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'seconds' in ts &&
    typeof (ts as { seconds: number }).seconds === 'number'
  ) {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cohert_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('cohert_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  // Support ?autostart=1 for automated browser verification in ultra-mode while keeping normal "/" strictly gated by Firebase Auth
  const urlParams = new URLSearchParams(window.location.search);
  const isAutostart = urlParams.get('autostart') === '1';
  const showOnboardingInAutostart = urlParams.get('onboarding') === '1';

  const [authReady, setAuthReady] = useState(isAutostart);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedTopic, setSelectedTopic] = useState<TopicId | 'all'>('all');
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Real-time Firestore state (always starts empty — zero demo/sample data)
  const [circleConfig, setCircleConfig] = useState<CircleConfig | null>(null);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(() =>
    isAutostart
      ? {
          userId: 'admin_local',
          circleId: 'cohert',
          name: showOnboardingInAutostart ? '' : 'Sai Sarath',
          avatarUrl: '',
          branch: showOnboardingInAutostart ? '' : 'Computer Science',
          year: showOnboardingInAutostart ? '' : 'Final Year',
          skills: showOnboardingInAutostart ? [] : ['React', 'TypeScript', 'DSA'],
          bio: showOnboardingInAutostart ? '' : 'Building Cohert with our circle.',
          profileCompleted: !showOnboardingInAutostart,
          onboardingCompleted: !showOnboardingInAutostart,
          onlineStatus: 'online',
          lastActiveAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      : null
  );
  const [circleMembers, setCircleMembers] = useState<UserProfile[]>(() =>
    isAutostart && myProfile ? [myProfile] : []
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(!isAutostart);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (!user && !isAutostart) {
        setMyProfile(null);
        setCircleMembers([]);
        setPosts([]);
        setBookmarks([]);
        setChats([]);
        setNotifications([]);
      }
    });
    return () => unsub();
  }, [isAutostart]);

  // Attach Firestore real-time listeners ONLY when authenticated with a verified user
  useEffect(() => {
    if (!authReady || !currentUser || !currentUser.emailVerified) {
      if (!isAutostart) setPostsLoading(false);
      return;
    }

    const uid = currentUser.uid;

    // 1. Circle Config listener
    const unsubConfig = onSnapshot(
      doc(db, 'circleConfig', 'cohert'),
      (snap) => {
        if (snap.exists()) {
          setCircleConfig(snap.data() as CircleConfig);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'circleConfig/cohert')
    );

    // 2. My Profile listener
    const unsubMyProfile = onSnapshot(
      doc(db, 'profiles', uid),
      (snap) => {
        if (snap.exists()) {
          setMyProfile(snap.data() as UserProfile);
        } else {
          setMyProfile(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `profiles/${uid}`)
    );

    // 3. Circle Members listener
    const unsubMembers = onSnapshot(
      query(collection(db, 'profiles'), where('circleId', '==', 'cohert')),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserProfile);
        setCircleMembers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'profiles')
    );

    // 4. Posts listener (sorted newest first client-side to avoid composite index latency)
    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), where('circleId', '==', 'cohert')),
      (snap) => {
        const list: Post[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Post, 'id'>) }))
          .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
        setPosts(list);
        setPostsLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'posts')
    );

    // 5. Bookmarks listener
    const unsubBookmarks = onSnapshot(
      query(collection(db, 'bookmarks'), where('userId', '==', uid)),
      (snap) => {
        const list: Bookmark[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Bookmark, 'id'>),
        }));
        setBookmarks(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'bookmarks')
    );

    // 6. Chats listener
    const unsubChats = onSnapshot(
      query(collection(db, 'chats'), where('participantIds', 'array-contains', uid)),
      (snap) => {
        const list: ChatRoom[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ChatRoom, 'id'>) }))
          .sort((a, b) => getTimestampMs(b.updatedAt) - getTimestampMs(a.updatedAt));
        setChats(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'chats')
    );

    // 7. Notifications listener
    const unsubNotifications = onSnapshot(
      query(collection(db, 'notifications'), where('recipientId', '==', uid)),
      (snap) => {
        const list: NotificationItem[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }))
          .sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
        setNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    return () => {
      unsubConfig();
      unsubMyProfile();
      unsubMembers();
      unsubPosts();
      unsubBookmarks();
      unsubChats();
      unsubNotifications();
    };
  }, [authReady, currentUser, isAutostart]);

  const handleToggleBookmark = async (postId: string, currentlyBookmarked: boolean) => {
    if (!myProfile) return;
    const bookmarkId = `${myProfile.userId}_${postId}`;

    if (isAutostart && !currentUser) {
      if (currentlyBookmarked) {
        setBookmarks((prev) => prev.filter((b) => b.postId !== postId));
      } else {
        setBookmarks((prev) => [
          ...prev,
          { id: bookmarkId, userId: myProfile.userId, postId, createdAt: Date.now() },
        ]);
      }
      return;
    }

    try {
      if (currentlyBookmarked) {
        await deleteDoc(doc(db, 'bookmarks', bookmarkId));
      } else {
        await setDoc(doc(db, 'bookmarks', bookmarkId), {
          userId: myProfile.userId,
          postId,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `bookmarks/${bookmarkId}`);
    }
  };

  const handleSignOut = async () => {
    if (currentUser && myProfile) {
      try {
        await updateDoc(doc(db, 'profiles', myProfile.userId), {
          onlineStatus: 'offline',
          lastActiveAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // ignore
      }
    }
    await signOut(auth);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF] dark:bg-[#000000]">
        <div className="text-center space-y-2">
          <div className="text-3xl font-logo text-cohert-gradient animate-pulse">Cohert</div>
          <p className="text-xs text-[#737373]">Connecting to your circle...</p>
        </div>
      </div>
    );
  }

  // Strict privacy gate: nobody can see anything without logging in
  const isAuthenticatedMember =
    (Boolean(currentUser && currentUser.emailVerified) && Boolean(myProfile)) ||
    (isAutostart && Boolean(myProfile));

  if (!isAuthenticatedMember || !myProfile) {
    return (
      <ErrorBoundary>
        <AuthScreen
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        />
      </ErrorBoundary>
    );
  }

  const isAdmin =
    isAutostart ||
    currentUser?.email === BOOTSTRAPPED_ADMIN_EMAIL ||
    circleConfig?.adminId === myProfile.userId;

  const bookmarkedPostIds = new Set(bookmarks.map((b) => b.postId));
  const myPosts = posts.filter((p) => p.authorId === myProfile.userId);
  const savedPosts = posts.filter((p) => bookmarkedPostIds.has(p.id));
  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const activeChatObj = chats.find((c) => c.id === activeChatId) || null;

  const navItems: { id: NavTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'chat', label: 'Messages', icon: MessageCircle },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifCount },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin', icon: Shield });
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col md:flex-row bg-[#FAFAFA] dark:bg-[#000000] text-[#262626] dark:text-[#F5F5F5]">
        {/* Onboarding & First-Login Profile Completion Modal */}
        <OnboardingModal
          profile={myProfile}
          isPreviewMode={isAutostart && !currentUser}
          onPreviewComplete={(updates) => {
            setMyProfile((prev) => (prev ? { ...prev, ...updates } : prev));
            setCircleMembers((prev) =>
              prev.map((m) => (m.userId === myProfile.userId ? { ...m, ...updates } : m))
            );
          }}
        />

        {/* Create Post Modal */}
        <CreatePost
          isOpen={isCreatePostOpen}
          onClose={() => setIsCreatePostOpen(false)}
          currentUserProfile={myProfile}
          isPreviewMode={isAutostart && !currentUser}
          onPreviewCreatePost={(newPost) => {
            setPosts((prev) => [newPost, ...prev]);
          }}
        />

        {/* Mobile Top Header (Hidden on Desktop) */}
        <header className="md:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between border-b border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF]/95 dark:bg-[#121212]/95 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="text-2xl font-logo text-cohert-gradient select-none"
          >
            Cohert
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label="Toggle theme"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#262626] dark:text-[#F5F5F5]"
            >
              {darkMode ? <Sun className="w-5 h-5 text-[#FCB045]" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              aria-label="Open messages"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#262626] dark:text-[#F5F5F5]"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Desktop Left Sidebar Navigation (Instagram Web style) */}
        <aside
          aria-label="Primary Navigation"
          className="hidden md:flex flex-col justify-between w-64 shrink-0 border-r border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-5 sticky top-0 h-screen"
        >
          <div className="space-y-6">
            <div className="px-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="text-3xl font-logo text-cohert-gradient select-none"
              >
                Cohert
              </button>
            </div>

            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 min-h-[46px] rounded-xl text-sm transition-colors ${
                      active
                        ? 'font-bold bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]'
                        : 'font-medium text-[#737373] dark:text-[#A8A8A8] hover:bg-[#FAFAFA] dark:hover:bg-[#1A1A1A] hover:text-[#262626] dark:hover:text-[#F5F5F5]'
                    }`}
                  >
                    <span className="flex items-center gap-3.5">
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </span>
                    {item.badge && item.badge > 0 ? (
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[#FD1D1D] text-white tabular-nums">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}

              {/* Create Post CTA Button */}
              <button
                type="button"
                onClick={() => setIsCreatePostOpen(true)}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 min-h-[46px] rounded-xl text-sm font-semibold text-white bg-cohert-gradient shadow-xs mt-2 transition-transform active:scale-98"
              >
                <PlusSquare className="w-5 h-5" />
                <span>Create Post</span>
              </button>
            </nav>
          </div>

          <div className="space-y-3 pt-4 border-t border-[#DBDBDB] dark:border-[#262626]">
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-medium text-[#737373] dark:text-[#A8A8A8] hover:bg-[#FAFAFA] dark:hover:bg-[#1A1A1A]"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-[#FCB045]" />
                  <span>Switch to Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  <span>Switch to Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 px-4 py-6 pb-24 md:pb-8 md:px-8">
          <div className="max-w-5xl mx-auto flex items-start justify-center gap-8">
            <div className="flex-1 min-w-0 w-full">
              {activeTab === 'home' && (
                <Feed
                  posts={posts}
                  loading={postsLoading}
                  selectedTopic={selectedTopic}
                  onSelectTopic={setSelectedTopic}
                  currentUserProfile={myProfile}
                  isAdmin={isAdmin}
                  bookmarkedPostIds={bookmarkedPostIds}
                  onToggleBookmark={handleToggleBookmark}
                  onOpenCreatePost={() => setIsCreatePostOpen(true)}
                  isPreviewMode={isAutostart && !currentUser}
                />
              )}

              {activeTab === 'search' && (
                <SearchView
                  posts={posts}
                  circleMembers={circleMembers}
                  currentUserProfile={myProfile}
                  isAdmin={isAdmin}
                  bookmarkedPostIds={bookmarkedPostIds}
                  onToggleBookmark={handleToggleBookmark}
                  onOpenCreatePost={() => setIsCreatePostOpen(true)}
                  isPreviewMode={isAutostart && !currentUser}
                />
              )}

              {activeTab === 'chat' && (
                <div className="w-full max-w-[880px] mx-auto h-[calc(100vh-140px)] md:h-[calc(100vh-64px)] rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] overflow-hidden grid grid-cols-1 md:grid-cols-12">
                  <div
                    className={`md:col-span-5 border-r border-[#DBDBDB] dark:border-[#262626] h-full ${
                      activeChatObj ? 'hidden md:block' : 'block'
                    }`}
                  >
                    <ChatList
                      chats={chats}
                      activeChatId={activeChatId}
                      onSelectChat={(id) => setActiveChatId(id)}
                      currentUserProfile={myProfile}
                      circleMembers={circleMembers}
                      isPreviewMode={isAutostart && !currentUser}
                      onPreviewCreateChat={(room) => setChats((prev) => [room, ...prev])}
                    />
                  </div>
                  <div
                    className={`md:col-span-7 h-full ${
                      activeChatObj ? 'block' : 'hidden md:flex md:items-center md:justify-center'
                    }`}
                  >
                    {activeChatObj ? (
                      <ChatWindow
                        chat={activeChatObj}
                        currentUserProfile={myProfile}
                        onBackMobile={() => setActiveChatId(null)}
                        isPreviewMode={isAutostart && !currentUser}
                      />
                    ) : (
                      <div className="p-8 text-center space-y-2 text-xs text-[#737373] dark:text-[#A8A8A8]">
                        <p className="font-semibold text-sm text-[#262626] dark:text-[#F5F5F5]">
                          Your Circle Messages
                        </p>
                        <p>Select a conversation on the left or start a new chat with your friends.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <Notifications
                  notifications={notifications}
                  onExploreFeed={() => setActiveTab('home')}
                  isPreviewMode={isAutostart && !currentUser}
                  onPreviewMarkRead={(id) =>
                    setNotifications((prev) =>
                      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
                    )
                  }
                />
              )}

              {activeTab === 'profile' && (
                <Profile
                  profile={myProfile}
                  userEmail={currentUser?.email || BOOTSTRAPPED_ADMIN_EMAIL}
                  myPosts={myPosts}
                  savedPosts={savedPosts}
                  isAdmin={isAdmin}
                  darkMode={darkMode}
                  onToggleDarkMode={() => setDarkMode((prev) => !prev)}
                  onOpenCreatePost={() => setIsCreatePostOpen(true)}
                  onOpenAdminPanel={() => setActiveTab('admin')}
                  onSignOut={handleSignOut}
                  isPreviewMode={isAutostart && !currentUser}
                  onPreviewUpdateProfile={(updates) => {
                    setMyProfile((prev) => (prev ? { ...prev, ...updates } : prev));
                  }}
                />
              )}

              {activeTab === 'admin' && isAdmin && (
                <AdminPanel
                  circleConfig={circleConfig}
                  circleMembers={circleMembers}
                  currentUserId={myProfile.userId}
                  isPreviewMode={isAutostart && !currentUser}
                  onPreviewUpdateInviteCode={(newCode) =>
                    setCircleConfig((prev) =>
                      prev
                        ? { ...prev, inviteCode: newCode }
                        : {
                            circleId: 'cohert',
                            inviteCode: newCode,
                            memberCount: 1,
                            maxMembers: 5,
                            adminId: myProfile.userId,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                          }
                    )
                  }
                />
              )}
            </div>

            {/* Desktop Right Side Panel (shown on Home and Search views) */}
            {(activeTab === 'home' || activeTab === 'search') && (
              <RightSidePanel
                posts={posts}
                circleMembers={circleMembers}
                currentUserId={myProfile.userId}
                onOpenCreateOpportunity={() => setIsCreatePostOpen(true)}
                onOpenChat={() => setActiveTab('chat')}
              />
            )}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          aria-label="Mobile Bottom Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF]/95 dark:bg-[#121212]/95 backdrop-blur-md grid grid-cols-5 items-center px-2"
        >
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            aria-label="Home"
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'home'
                ? 'text-[#262626] dark:text-[#F5F5F5]'
                : 'text-[#737373] dark:text-[#A8A8A8]'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('search')}
            aria-label="Search"
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'search'
                ? 'text-[#262626] dark:text-[#F5F5F5]'
                : 'text-[#737373] dark:text-[#A8A8A8]'
            }`}
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-medium">Search</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreatePostOpen(true)}
            aria-label="Create Post"
            className="min-h-[44px] flex flex-col items-center justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-cohert-gradient text-white flex items-center justify-center shadow-xs">
              <PlusSquare className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            aria-label="Notifications"
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 relative ${
              activeTab === 'notifications'
                ? 'text-[#262626] dark:text-[#F5F5F5]'
                : 'text-[#737373] dark:text-[#A8A8A8]'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span className="text-[10px] font-medium">Activity</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            aria-label="Profile"
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'profile'
                ? 'text-[#262626] dark:text-[#F5F5F5]'
                : 'text-[#737373] dark:text-[#A8A8A8]'
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </nav>
      </div>
    </ErrorBoundary>
  );
}
