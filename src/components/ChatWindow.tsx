import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Send,
  Users,
  X,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { compressImageFile, db, handleFirestoreError } from '../firebase';
import { ChatMessage, ChatRoom, OperationType, UserProfile } from '../types';
import {
  extractTimestampMs,
  formatPresenceStatus,
  formatRelativeTime,
  getInitials,
  sanitizeString,
} from '../utils/validation';

interface ChatWindowProps {
  chat: ChatRoom;
  currentUserProfile: UserProfile;
  circleMembers?: UserProfile[];
  onBackMobile: () => void;
  isPreviewMode?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chat,
  currentUserProfile,
  circleMembers = [],
  onBackMobile,
  isPreviewMode = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const typingTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (isPreviewMode || !chat.id) return;
    const msgQuery = query(
      collection(db, 'chats', chat.id, 'messages'),
      where('chatId', '==', chat.id)
    );
    const unsub = onSnapshot(
      msgQuery,
      (snap) => {
        const loaded: ChatMessage[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ChatMessage, 'id'>),
          }))
          .sort((a, b) => extractTimestampMs(a.createdAt) - extractTimestampMs(b.createdAt));
        setMessages(loaded);

        // Mark unread incoming messages as seen
        for (const msg of loaded) {
          if (msg.senderId !== currentUserProfile.userId && msg.status === 'sent') {
            updateDoc(doc(db, 'chats', chat.id, 'messages', msg.id), {
              status: 'seen',
              updatedAt: serverTimestamp(),
            }).catch(() => {
              // ignore race condition
            });
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `chats/${chat.id}/messages`);
      }
    );
    return () => unsub();
  }, [chat.id, currentUserProfile.userId, isPreviewMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const broadcastTyping = (isTypingNow: boolean) => {
    if (isPreviewMode || !chat.id) return;
    updateDoc(doc(db, 'chats', chat.id), {
      typingUserId: isTypingNow ? currentUserProfile.userId : '',
      typingUserName: isTypingNow
        ? sanitizeString(currentUserProfile.name || 'Friend', 80)
        : '',
      updatedAt: serverTimestamp(),
    }).catch(() => {
      // ignore transient typing errors
    });
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (isPreviewMode) return;
    broadcastTyping(val.trim().length > 0);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      broadcastTyping(false);
    }, 2500);
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 800, 0.75);
      setImageUrl(compressed);
    } catch {
      // ignore invalid file
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedText = sanitizeString(text, 1000);
    if ((!cleanedText && !imageUrl) || sending) return;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (isPreviewMode) {
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          chatId: chat.id,
          senderId: currentUserProfile.userId,
          senderName: currentUserProfile.name || 'You',
          senderAvatar: currentUserProfile.avatarUrl || '',
          text: cleanedText,
          imageUrl: imageUrl || '',
          status: 'sent',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);
      setText('');
      setImageUrl('');
      return;
    }

    setSending(true);
    try {
      await setDoc(doc(db, 'chats', chat.id, 'messages', msgId), {
        chatId: chat.id,
        senderId: currentUserProfile.userId,
        senderName: sanitizeString(currentUserProfile.name || 'Friend', 80),
        senderAvatar: currentUserProfile.avatarUrl || '',
        text: cleanedText,
        imageUrl: imageUrl || '',
        status: 'sent',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', chat.id), {
        lastMessageText: cleanedText || 'Shared an image',
        lastMessageSenderId: currentUserProfile.userId,
        typingUserId: '',
        typingUserName: '',
        updatedAt: serverTimestamp(),
      });

      // Notify other participants
      for (const participantId of chat.participantIds) {
        if (participantId !== currentUserProfile.userId) {
          const notifId = `msg_${msgId}_${participantId}`;
          await setDoc(doc(db, 'notifications', notifId), {
            recipientId: participantId,
            actorId: currentUserProfile.userId,
            actorName: sanitizeString(currentUserProfile.name || 'Friend', 80),
            actorAvatar: currentUserProfile.avatarUrl || '',
            type: 'message',
            targetId: chat.id,
            message: `sent a message in "${sanitizeString(displayChatName, 40)}": "${sanitizeString(cleanedText || 'Photo', 60)}"`,
            read: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      setText('');
      setImageUrl('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `chats/${chat.id}/messages/${msgId}`);
    } finally {
      setSending(false);
    }
  };

  const isSomeoneElseTyping =
    chat.typingUserId && chat.typingUserId !== currentUserProfile.userId;

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] dark:bg-[#121212]">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#DBDBDB] dark:border-[#262626]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackMobile}
            aria-label="Back to chat list"
            className="md:hidden min-w-[40px] min-h-[40px] -ml-2 flex items-center justify-center rounded-xl text-[#262626] dark:text-[#F5F5F5]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative shrink-0">
            <div className="p-[2px] rounded-full bg-cohert-gradient">
              <div className="w-9 h-9 rounded-full bg-[#FFFFFF] dark:bg-[#121212] overflow-hidden flex items-center justify-center text-xs font-semibold">
                {chat.chatType === 'group' ? (
                  <Users className="w-4 h-4 text-[#833AB4] dark:text-[#FCB045]" />
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
                className={`w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#121212] absolute -bottom-0.5 -right-0.5 ${
                  peerPresence.isOnline ? 'bg-emerald-500' : 'bg-[#A8A8A8]'
                }`}
              />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-semibold font-heading text-[#262626] dark:text-[#F5F5F5] truncate">
              {displayChatName}
            </h3>
            <p className="text-[11px] text-[#737373] dark:text-[#A8A8A8]">
              {isSomeoneElseTyping ? (
                <span className="text-[#833AB4] dark:text-[#FCB045] font-medium">
                  {chat.typingUserName || 'Friend'} is typing...
                </span>
              ) : chat.chatType === 'direct' && peerPresence ? (
                <span
                  className={
                    peerPresence.isOnline
                      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                      : ''
                  }
                >
                  {peerPresence.statusText}
                </span>
              ) : (
                `${chat.participantIds.length} member${chat.participantIds.length === 1 ? '' : 's'} in room`
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs text-[#737373] dark:text-[#A8A8A8]">
            <p>No messages in &ldquo;{displayChatName}&rdquo; yet. Send a message or share a photo below.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserProfile.userId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                {!isMine && (
                  <span className="text-[11px] font-medium text-[#737373] dark:text-[#A8A8A8] mb-1 px-1">
                    {msg.senderName}
                  </span>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-2xs ${
                    isMine
                      ? 'bg-cohert-gradient text-white rounded-br-xs'
                      : 'bg-[#EFEFEF] dark:bg-[#262626] text-[#262626] dark:text-[#F5F5F5] rounded-bl-xs'
                  }`}
                >
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden">
                      <img
                        src={msg.imageUrl}
                        alt="Shared in chat"
                        referrerPolicy="no-referrer"
                        className="max-h-60 w-auto object-cover rounded-xl"
                      />
                    </div>
                  )}
                  {msg.text && <p className="whitespace-pre-line break-words">{msg.text}</p>}
                </div>

                <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-[#737373] dark:text-[#A8A8A8]">
                  <span>{formatRelativeTime(msg.createdAt)}</span>
                  {isMine && (
                    <>
                      <span aria-hidden="true">·</span>
                      {msg.status === 'seen' ? (
                        <span className="inline-flex items-center gap-0.5 text-[#833AB4] dark:text-[#FCB045] font-medium">
                          <CheckCheck className="w-3 h-3" />
                          Seen
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5">
                          <Check className="w-3 h-3" />
                          Sent
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview before send */}
      {imageUrl && (
        <div className="px-4 py-2 border-t border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={imageUrl} alt="Attachment preview" className="h-12 w-12 object-cover rounded-lg" />
            <span className="text-xs text-[#737373]">Image ready to send</span>
          </div>
          <button
            type="button"
            onClick={() => setImageUrl('')}
            aria-label="Remove attached image"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#737373] hover:text-red-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Composer */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-[#DBDBDB] dark:border-[#262626] flex items-center gap-2"
      >
        <label
          htmlFor="chat-image-input"
          aria-label="Share image in chat"
          className="min-w-[44px] min-h-[44px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] flex items-center justify-center text-[#262626] dark:text-[#F5F5F5] cursor-pointer hover:opacity-80"
        >
          <ImageIcon className="w-5 h-5" />
        </label>
        <input
          id="chat-image-input"
          type="file"
          accept="image/*"
          onChange={handleImagePick}
          className="hidden"
        />

        <input
          type="text"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          maxLength={1000}
          placeholder="Message..."
          aria-label="Message text"
          className="flex-1 min-h-[44px] px-4 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
        />

        <button
          type="submit"
          disabled={(!text.trim() && !imageUrl) || sending}
          aria-label="Send message"
          className="min-w-[44px] min-h-[44px] px-4 rounded-xl bg-cohert-gradient text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition-transform active:scale-95"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
};
