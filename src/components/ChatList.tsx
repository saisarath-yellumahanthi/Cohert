import React, { useEffect, useState } from 'react';
import { MessageSquarePlus, MessagesSquare, Users, X } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { ChatRoom, OperationType, UserProfile } from '../types';
import {
  formatPresenceStatus,
  formatRelativeTime,
  getDirectChatId,
  getInitials,
  sanitizeString,
} from '../utils/validation';

interface ChatListProps {
  chats: ChatRoom[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  currentUserProfile: UserProfile;
  circleMembers: UserProfile[];
  isPreviewMode?: boolean;
  onPreviewCreateChat?: (chat: ChatRoom) => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  currentUserProfile,
  circleMembers,
  isPreviewMode = false,
  onPreviewCreateChat,
}) => {
  const [showNewModal, setShowNewModal] = useState(false);
  const [chatType, setChatType] = useState<'direct' | 'group'>('direct');
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const otherMembers = circleMembers.filter((m) => m.userId !== currentUserProfile.userId);

  const toggleMemberSelection = (uid: string) => {
    if (chatType === 'direct') {
      setSelectedMemberIds([uid]);
    } else {
      setSelectedMemberIds((prev) =>
        prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
      );
    }
  };

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (chatType === 'direct') {
      const targetUid = selectedMemberIds[0];
      if (!targetUid) {
        setErrorMsg('Please select a friend to start a 1-on-1 chat.');
        return;
      }

      const deterministicChatId = getDirectChatId(currentUserProfile.userId, targetUid);
      const existingDirectChat = chats.find(
        (c) =>
          c.id === deterministicChatId ||
          (c.chatType === 'direct' &&
            c.participantIds.length === 2 &&
            c.participantIds.includes(currentUserProfile.userId) &&
            c.participantIds.includes(targetUid))
      );

      if (existingDirectChat) {
        setShowNewModal(false);
        setGroupName('');
        setSelectedMemberIds([]);
        onSelectChat(existingDirectChat.id);
        return;
      }

      const targetFriend = otherMembers.find((m) => m.userId === targetUid);
      const computedDirectName = sanitizeString(
        targetFriend?.name || groupName || 'Direct Chat',
        80
      );
      const sortedParticipants = [currentUserProfile.userId, targetUid].sort();

      if (isPreviewMode && onPreviewCreateChat) {
        const room: ChatRoom = {
          id: deterministicChatId,
          circleId: 'cohert',
          chatType: 'direct',
          name: computedDirectName,
          creatorId: currentUserProfile.userId,
          participantIds: sortedParticipants,
          lastMessageText: '',
          lastMessageSenderId: '',
          typingUserId: '',
          typingUserName: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        onPreviewCreateChat(room);
        setShowNewModal(false);
        setGroupName('');
        setSelectedMemberIds([]);
        onSelectChat(deterministicChatId);
        return;
      }

      setCreating(true);
      try {
        await setDoc(doc(db, 'chats', deterministicChatId), {
          circleId: 'cohert',
          chatType: 'direct',
          name: computedDirectName,
          creatorId: currentUserProfile.userId,
          participantIds: sortedParticipants,
          lastMessageText: '',
          lastMessageSenderId: '',
          typingUserId: '',
          typingUserName: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setShowNewModal(false);
        setGroupName('');
        setSelectedMemberIds([]);
        onSelectChat(deterministicChatId);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `chats/${deterministicChatId}`);
      } finally {
        setCreating(false);
      }
      return;
    }

    // Group Chat creation
    const participants = Array.from(
      new Set([currentUserProfile.userId, ...selectedMemberIds])
    ).slice(0, 5);

    const computedName = sanitizeString(groupName, 80);
    if (!computedName) {
      setErrorMsg('Please enter a name for the group chat (e.g., Hackathon Team).');
      return;
    }

    const chatId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (isPreviewMode && onPreviewCreateChat) {
      const room: ChatRoom = {
        id: chatId,
        circleId: 'cohert',
        chatType: 'group',
        name: computedName,
        creatorId: currentUserProfile.userId,
        participantIds: participants,
        lastMessageText: '',
        lastMessageSenderId: '',
        typingUserId: '',
        typingUserName: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onPreviewCreateChat(room);
      setShowNewModal(false);
      setGroupName('');
      setSelectedMemberIds([]);
      onSelectChat(chatId);
      return;
    }

    setCreating(true);
    try {
      await setDoc(doc(db, 'chats', chatId), {
        circleId: 'cohert',
        chatType: 'group',
        name: computedName,
        creatorId: currentUserProfile.userId,
        participantIds: participants,
        lastMessageText: '',
        lastMessageSenderId: '',
        typingUserId: '',
        typingUserName: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowNewModal(false);
      setGroupName('');
      setSelectedMemberIds([]);
      onSelectChat(chatId);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `chats/${chatId}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#DBDBDB] dark:border-[#262626]">
        <div>
          <h2 className="text-base font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
            Messages
          </h2>
          <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
            Direct & group chats with your circle
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          aria-label="New chat"
          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-cohert-gradient text-white text-xs font-medium shadow-xs transition-transform active:scale-95"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>New</span>
        </button>
      </div>

      {chats.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-cohert-gradient p-[2px]">
            <div className="w-full h-full rounded-full bg-[#FFFFFF] dark:bg-[#121212] flex items-center justify-center">
              <MessagesSquare className="w-6 h-6 text-[#833AB4] dark:text-[#FCB045]" />
            </div>
          </div>
          <div className="space-y-1 max-w-xs">
            <h3 className="text-sm font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
              No chats yet. Say hi to your friends.
            </h3>
            <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
              Start a 1-on-1 message or create a group room like &ldquo;Hackathon Team&rdquo;.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-cohert-gradient text-white text-xs font-semibold shadow-sm transition-transform active:scale-95"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>Start a chat</span>
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-[#DBDBDB] dark:divide-[#262626]">
          {chats.map((chat) => {
            const isSelected = chat.id === activeChatId;
            const isTyping =
              chat.typingUserId && chat.typingUserId !== currentUserProfile.userId;

            const peerId =
              chat.chatType === 'direct'
                ? chat.participantIds.find((id) => id !== currentUserProfile.userId) ||
                  chat.participantIds[0]
                : null;
            const peerProfile = peerId
              ? circleMembers.find((m) => m.userId === peerId)
              : undefined;
            const displayChatName =
              chat.chatType === 'direct' && peerProfile?.name
                ? peerProfile.name
                : chat.name;
            const peerPresence = peerProfile
              ? formatPresenceStatus(peerProfile, nowMs)
              : null;
            const hasUnread = Boolean(
              chat.lastMessageText &&
                chat.lastMessageSenderId &&
                chat.lastMessageSenderId !== currentUserProfile.userId &&
                !isSelected
            );

            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => onSelectChat(chat.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 min-h-[64px] text-left transition-colors ${
                  isSelected
                    ? 'bg-[#FAFAFA] dark:bg-[#1A1A1A]'
                    : 'hover:bg-[#FAFAFA] dark:hover:bg-[#1A1A1A]'
                }`}
              >
                <div className="relative shrink-0">
                  <div className="p-[2px] rounded-full bg-cohert-gradient">
                    <div className="w-11 h-11 rounded-full bg-[#FFFFFF] dark:bg-[#121212] overflow-hidden flex items-center justify-center text-xs font-semibold text-[#262626] dark:text-[#F5F5F5]">
                      {chat.chatType === 'group' ? (
                        <Users className="w-5 h-5 text-[#833AB4] dark:text-[#FCB045]" />
                      ) : peerProfile?.avatarUrl ? (
                        <img
                          src={peerProfile.avatarUrl}
                          alt={displayChatName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(displayChatName)
                      )}
                    </div>
                  </div>
                  {chat.chatType === 'direct' && peerPresence && (
                    <span
                      className={`w-3 h-3 rounded-full border-2 border-white dark:border-[#121212] absolute bottom-0 right-0 ${
                        peerPresence.isOnline ? 'bg-emerald-500' : 'bg-[#A8A8A8]'
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#262626] dark:text-[#F5F5F5] truncate">
                      {displayChatName}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasUnread && (
                        <span
                          aria-label="Unread message"
                          className="w-2 h-2 rounded-full bg-cohert-gradient"
                        />
                      )}
                      <span className="text-[11px] text-[#737373] dark:text-[#A8A8A8]">
                        {formatRelativeTime(chat.updatedAt, nowMs)}
                      </span>
                    </div>
                  </div>
                  <p
                    className={`text-xs truncate mt-0.5 ${
                      hasUnread
                        ? 'font-semibold text-[#262626] dark:text-[#F5F5F5]'
                        : 'text-[#737373] dark:text-[#A8A8A8]'
                    }`}
                  >
                    {isTyping ? (
                      <span className="text-[#833AB4] dark:text-[#FCB045] font-medium">
                        {chat.typingUserName || 'Friend'} is typing...
                      </span>
                    ) : (
                      chat.lastMessageText || 'No messages yet — say hi!'
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* New Chat Modal */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-chat-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 id="new-chat-title" className="text-base font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
                Start a Conversation
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                aria-label="Close new chat modal"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#737373]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChat} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChatType('direct');
                    setSelectedMemberIds((prev) => prev.slice(0, 1));
                  }}
                  className={`py-2.5 min-h-[42px] rounded-xl text-xs font-medium border transition-colors ${
                    chatType === 'direct'
                      ? 'bg-cohert-gradient text-white border-transparent'
                      : 'border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]'
                  }`}
                >
                  Direct (1-on-1)
                </button>
                <button
                  type="button"
                  onClick={() => setChatType('group')}
                  className={`py-2.5 min-h-[42px] rounded-xl text-xs font-medium border transition-colors ${
                    chatType === 'group'
                      ? 'bg-cohert-gradient text-white border-transparent'
                      : 'border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]'
                  }`}
                >
                  Group Chat
                </button>
              </div>

              {chatType === 'group' && (
                <div>
                  <label
                    htmlFor="chat-name-input"
                    className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1.5"
                  >
                    Group Name *
                  </label>
                  <input
                    id="chat-name-input"
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    maxLength={80}
                    placeholder="e.g., Hackathon Team / DSA Study Room"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
                  />
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-2">
                  Circle Members ({otherMembers.length} joined so far)
                </p>
                {otherMembers.length === 0 ? (
                  <p className="text-xs text-[#737373] dark:text-[#A8A8A8] p-3 rounded-xl bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626]">
                    Your friends haven&apos;t joined with the invite code yet. Once a friend joins with the invite code, they will appear here.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {otherMembers.map((friend) => {
                      const checked = selectedMemberIds.includes(friend.userId);
                      const presence = formatPresenceStatus(friend, nowMs);
                      return (
                        <button
                          key={friend.userId}
                          type="button"
                          onClick={() => toggleMemberSelection(friend.userId)}
                          className={`w-full flex items-center justify-between px-3 py-2 min-h-[44px] rounded-xl border text-xs transition-colors ${
                            checked
                              ? 'border-[#833AB4] bg-[#833AB4]/10 font-semibold'
                              : 'border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                presence.isOnline ? 'bg-emerald-500' : 'bg-[#A8A8A8]'
                              }`}
                            />
                            <span>{friend.name || 'Friend'}</span>
                          </span>
                          <span className="text-[#737373]">
                            {checked ? 'Selected' : presence.statusText}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {errorMsg && (
                <p role="alert" className="text-xs text-red-500 font-medium">
                  {errorMsg}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 min-h-[42px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] text-xs font-medium text-[#737373]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 min-h-[42px] rounded-xl bg-cohert-gradient text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {creating ? 'Opening...' : chatType === 'direct' ? 'Open Chat' : 'Create Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
