import React, { useState } from 'react';
import { MessageSquarePlus, MessagesSquare, Users, X } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { ChatRoom, OperationType, UserProfile } from '../types';
import { formatRelativeTime, getInitials, sanitizeString } from '../utils/validation';

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
  const [chatType, setChatType] = useState<'direct' | 'group'>('group');
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

    const participants = Array.from(
      new Set([currentUserProfile.userId, ...selectedMemberIds])
    ).slice(0, 5);

    let computedName = sanitizeString(groupName, 80);
    if (chatType === 'direct') {
      const targetFriend = otherMembers.find((m) => m.userId === selectedMemberIds[0]);
      computedName = targetFriend ? targetFriend.name || 'Direct Chat' : computedName || 'Direct Chat';
    }
    if (!computedName) {
      setErrorMsg('Please enter a name for the chat (e.g., Hackathon Team).');
      return;
    }

    const chatId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (isPreviewMode && onPreviewCreateChat) {
      const room: ChatRoom = {
        id: chatId,
        circleId: 'cohert',
        chatType,
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
        chatType,
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
                <div className="p-[2px] rounded-full bg-cohert-gradient shrink-0">
                  <div className="w-11 h-11 rounded-full bg-[#FFFFFF] dark:bg-[#121212] flex items-center justify-center text-xs font-semibold text-[#262626] dark:text-[#F5F5F5]">
                    {chat.chatType === 'group' ? (
                      <Users className="w-5 h-5 text-[#833AB4] dark:text-[#FCB045]" />
                    ) : (
                      getInitials(chat.name)
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#262626] dark:text-[#F5F5F5] truncate">
                      {chat.name}
                    </span>
                    <span className="text-[11px] text-[#737373] dark:text-[#A8A8A8] shrink-0">
                      {formatRelativeTime(chat.updatedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[#737373] dark:text-[#A8A8A8] truncate mt-0.5">
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
                  onClick={() => setChatType('group')}
                  className={`py-2.5 min-h-[42px] rounded-xl text-xs font-medium border transition-colors ${
                    chatType === 'group'
                      ? 'bg-cohert-gradient text-white border-transparent'
                      : 'border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]'
                  }`}
                >
                  Group Chat
                </button>
                <button
                  type="button"
                  onClick={() => setChatType('direct')}
                  className={`py-2.5 min-h-[42px] rounded-xl text-xs font-medium border transition-colors ${
                    chatType === 'direct'
                      ? 'bg-cohert-gradient text-white border-transparent'
                      : 'border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]'
                  }`}
                >
                  Direct (1-on-1)
                </button>
              </div>

              <div>
                <label
                  htmlFor="chat-name-input"
                  className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1.5"
                >
                  {chatType === 'group' ? 'Group Name *' : 'Conversation Title'}
                </label>
                <input
                  id="chat-name-input"
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={80}
                  placeholder={
                    chatType === 'group' ? 'e.g., Hackathon Team / DSA Study Room' : 'e.g., Study Sync'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-2">
                  Circle Members ({otherMembers.length} joined so far)
                </p>
                {otherMembers.length === 0 ? (
                  <p className="text-xs text-[#737373] dark:text-[#A8A8A8] p-3 rounded-xl bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626]">
                    Your friends haven&apos;t joined with the invite code yet. You can create the room now and they can join once signed up.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {otherMembers.map((friend) => {
                      const checked = selectedMemberIds.includes(friend.userId);
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
                          <span>{friend.name || 'Friend'}</span>
                          <span className="text-[#737373]">{checked ? 'Selected' : 'Select'}</span>
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
                  {creating ? 'Creating...' : 'Create Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
