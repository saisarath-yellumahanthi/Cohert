import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  Paperclip,
  Send,
  Trash2,
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
import { ChatMessage, ChatRoom, FileAttachment, OperationType, UserProfile } from '../types';
import {
  ALLOWED_FILE_INPUT_ACCEPT,
  extractTimestampMs,
  formatAudioDuration,
  formatFileSize,
  formatPresenceStatus,
  formatRelativeTime,
  getInitials,
  MAX_AUDIO_DURATION_SECONDS,
  sanitizeString,
  validateAttachmentFile,
} from '../utils/validation';
import {
  getSupportedAudioMimeType,
  uploadAudioToStorage,
  uploadFilesToStorage,
} from '../utils/mediaUpload';
import { AudioMessagePlayer } from './AudioMessagePlayer';
import { FileAttachmentCard } from './FileAttachmentCard';

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
  const [activeTab, setActiveTab] = useState<'messages' | 'files'>('messages');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const discardRecordingRef = useRef<boolean>(false);
  const cancelUploadRef = useRef<(() => void) | null>(null);

  const typingTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Cleanup active mic stream on unmount or chat switch
  useEffect(() => {
    setActiveTab('messages');
    setMediaError(null);
    setPendingFiles([]);
    return () => {
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [chat.id]);

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
    if (activeTab === 'messages') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, activeTab]);

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
    e.target.value = '';
    if (!file) return;
    setMediaError(null);
    const check = validateAttachmentFile({ name: file.name, size: file.size, type: file.type });
    if (!check.valid) {
      setMediaError(check.error || 'Invalid file attachment.');
      return;
    }
    try {
      const compressed = await compressImageFile(file, 800, 0.75);
      setImageUrl(compressed);
    } catch {
      setMediaError('Could not process the selected image.');
    }
  };

  const handleFilesPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const selected: File[] = Array.from(fileList);
    e.target.value = '';
    setMediaError(null);

    const validToAdd: File[] = [];
    for (const f of selected) {
      const check = validateAttachmentFile({ name: f.name, size: f.size, type: f.type });
      if (!check.valid) {
        setMediaError(check.error || 'Unsupported file.');
        return;
      }
      validToAdd.push(f);
    }

    setPendingFiles((prev) => {
      const combined = [...prev, ...validToAdd];
      if (combined.length > 10) {
        setMediaError('You can attach up to 10 files per message.');
        return combined.slice(0, 10);
      }
      return combined;
    });
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCancelActiveUpload = () => {
    if (cancelUploadRef.current) {
      cancelUploadRef.current();
      cancelUploadRef.current = null;
    }
    setUploadProgress(null);
    setSending(false);
  };

  const stopRecordingCleanup = () => {
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const sendRecordedAudioBlob = async (
    blob: Blob,
    durationSec: number,
    mimeType: string,
    extension: string
  ) => {
    if (blob.size === 0) {
      setMediaError('Recorded audio was empty. Please try recording again.');
      return;
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setSending(true);
    setUploadProgress(1);
    setMediaError(null);

    try {
      const audioDownloadUrl = await uploadAudioToStorage({
        chatId: chat.id,
        senderId: currentUserProfile.userId,
        blob,
        mimeType,
        extension,
        isPreviewMode,
        onProgress: (pct) => setUploadProgress(pct),
        onTaskReady: (cancelFn) => {
          cancelUploadRef.current = cancelFn;
        },
      });

      const safeDuration = Math.max(1, Math.min(MAX_AUDIO_DURATION_SECONDS, Math.round(durationSec)));

      if (isPreviewMode) {
        setMessages((prev) => [
          ...prev,
          {
            id: msgId,
            chatId: chat.id,
            senderId: currentUserProfile.userId,
            senderName: currentUserProfile.name || 'You',
            senderAvatar: currentUserProfile.avatarUrl || '',
            text: '',
            imageUrl: '',
            audioUrl: audioDownloadUrl,
            audioDuration: safeDuration,
            audioMimeType: mimeType || 'audio/webm',
            status: 'sent',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ]);
        return;
      }

      await setDoc(doc(db, 'chats', chat.id, 'messages', msgId), {
        chatId: chat.id,
        senderId: currentUserProfile.userId,
        senderName: sanitizeString(currentUserProfile.name || 'Friend', 80),
        senderAvatar: currentUserProfile.avatarUrl || '',
        text: '',
        imageUrl: '',
        audioUrl: audioDownloadUrl,
        audioDuration: safeDuration,
        audioMimeType: sanitizeString(mimeType || 'audio/webm', 80),
        status: 'sent',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const previewLabel = `🎤 Voice message (${formatAudioDuration(safeDuration)})`;
      await updateDoc(doc(db, 'chats', chat.id), {
        lastMessageText: previewLabel,
        lastMessageSenderId: currentUserProfile.userId,
        typingUserId: '',
        typingUserName: '',
        updatedAt: serverTimestamp(),
      });

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
            message: `sent a voice message in "${sanitizeString(displayChatName, 40)}"`,
            read: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (err: any) {
      if (err?.message === 'UPLOAD_CANCELLED') {
        setMediaError('Voice message upload cancelled.');
      } else {
        setMediaError(err?.message || 'Failed to upload voice message. Please try again.');
      }
    } finally {
      cancelUploadRef.current = null;
      setUploadProgress(null);
      setSending(false);
    }
  };

  const handleStartOrSendRecording = async () => {
    setMediaError(null);

    // If currently recording, tapping again stops & sends the audio message
    if (isRecording) {
      discardRecordingRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setMediaError('Audio recording is not supported in this browser or requires HTTPS.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      discardRecordingRef.current = false;

      const { mimeType, extension } = getSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recordingStartTimeRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const elapsedSec = Math.max(
          1,
          Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
        );
        const shouldDiscard = discardRecordingRef.current;
        const effectiveMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: effectiveMime });
        audioChunksRef.current = [];
        stopRecordingCleanup();

        if (!shouldDiscard) {
          void sendRecordedAudioBlob(blob, elapsedSec, effectiveMime, extension);
        }
      };

      recorder.start(250);

      recordingIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingSeconds(elapsed);
        if (elapsed >= MAX_AUDIO_DURATION_SECONDS) {
          // Automatically finish & send at 5 minutes max
          discardRecordingRef.current = false;
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 500);
    } catch (err: any) {
      stopRecordingCleanup();
      if (
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.name === 'SecurityError'
      ) {
        setMediaError(
          'Microphone permission denied. Please allow microphone access in your browser settings to record audio messages.'
        );
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setMediaError('No microphone detected on this device.');
      } else {
        setMediaError('Unable to access microphone. Please check your device settings.');
      }
    }
  };

  const handleCancelRecording = () => {
    discardRecordingRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      stopRecordingCleanup();
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedText = sanitizeString(text, 1000);
    if ((!cleanedText && !imageUrl && pendingFiles.length === 0) || sending) return;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setSending(true);
    setMediaError(null);

    try {
      let uploadedAttachments: FileAttachment[] = [];
      if (pendingFiles.length > 0) {
        setUploadProgress(1);
        uploadedAttachments = await uploadFilesToStorage({
          basePath: `chats/${chat.id}/files/${msgId}`,
          files: pendingFiles,
          uploaderId: currentUserProfile.userId,
          uploaderName: sanitizeString(currentUserProfile.name || 'Friend', 80),
          isPreviewMode,
          onProgress: (pct) => setUploadProgress(pct),
          onTaskReady: (cancelFn) => {
            cancelUploadRef.current = cancelFn;
          },
        });
      }

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
            ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
            status: 'sent',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ]);
        setText('');
        setImageUrl('');
        setPendingFiles([]);
        return;
      }

      const payload: Record<string, any> = {
        chatId: chat.id,
        senderId: currentUserProfile.userId,
        senderName: sanitizeString(currentUserProfile.name || 'Friend', 80),
        senderAvatar: currentUserProfile.avatarUrl || '',
        text: cleanedText,
        imageUrl: imageUrl || '',
        status: 'sent',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (uploadedAttachments.length > 0) {
        payload.attachments = uploadedAttachments;
      }

      await setDoc(doc(db, 'chats', chat.id, 'messages', msgId), payload);

      const fallbackPreview =
        uploadedAttachments.length > 0
          ? `📎 Shared ${uploadedAttachments.length} file${uploadedAttachments.length > 1 ? 's' : ''}`
          : 'Shared an image';

      await updateDoc(doc(db, 'chats', chat.id), {
        lastMessageText: cleanedText || fallbackPreview,
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
            message: `sent a message in "${sanitizeString(displayChatName, 40)}": "${sanitizeString(
              cleanedText || fallbackPreview,
              60
            )}"`,
            read: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      setText('');
      setImageUrl('');
      setPendingFiles([]);
    } catch (err: any) {
      if (err?.message === 'UPLOAD_CANCELLED') {
        setMediaError('File upload cancelled.');
      } else if (err?.message && !err?.code) {
        setMediaError(err.message);
      } else {
        handleFirestoreError(err, OperationType.WRITE, `chats/${chat.id}/messages/${msgId}`);
      }
    } finally {
      cancelUploadRef.current = null;
      setUploadProgress(null);
      setSending(false);
    }
  };

  const isSomeoneElseTyping =
    chat.typingUserId && chat.typingUserId !== currentUserProfile.userId;

  // Gather all shared files & audio messages in this conversation for the "Shared Files" tab
  const sharedItems = messages.flatMap((msg) => {
    const list: Array<
      | {
          kind: 'file';
          id: string;
          messageId: string;
          senderName: string;
          createdAt: unknown;
          attachment: FileAttachment;
        }
      | {
          kind: 'audio';
          id: string;
          messageId: string;
          senderName: string;
          createdAt: unknown;
          audioUrl: string;
          audioDuration?: number;
        }
    > = [];

    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach((att) => {
        list.push({
          kind: 'file',
          id: `${msg.id}_${att.id}`,
          messageId: msg.id,
          senderName: msg.senderName,
          createdAt: msg.createdAt,
          attachment: att,
        });
      });
    }

    if (msg.audioUrl) {
      list.push({
        kind: 'audio',
        id: `${msg.id}_audio`,
        messageId: msg.id,
        senderName: msg.senderName,
        createdAt: msg.createdAt,
        audioUrl: msg.audioUrl,
        audioDuration: msg.audioDuration,
      });
    }

    return list;
  });

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] dark:bg-[#121212]">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#DBDBDB] dark:border-[#262626] gap-2">
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

        {/* Messages / Shared Files Tab Switcher */}
        <div className="flex items-center gap-1 bg-[#FAFAFA] dark:bg-[#1A1A1A] p-1 rounded-xl border border-[#DBDBDB] dark:border-[#262626] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeTab === 'messages'
                ? 'bg-cohert-gradient text-white shadow-2xs'
                : 'text-[#737373] dark:text-[#A8A8A8] hover:text-[#262626] dark:hover:text-[#F5F5F5]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeTab === 'files'
                ? 'bg-cohert-gradient text-white shadow-2xs'
                : 'text-[#737373] dark:text-[#A8A8A8] hover:text-[#262626] dark:hover:text-[#F5F5F5]'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Shared Files</span>
            {sharedItems.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'files'
                    ? 'bg-white/25 text-white'
                    : 'bg-[#EFEFEF] dark:bg-[#262626] text-[#262626] dark:text-[#F5F5F5]'
                }`}
              >
                {sharedItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area: Either Messages or Shared Files Tab */}
      {activeTab === 'files' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sharedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs text-[#737373] dark:text-[#A8A8A8]">
              <FolderOpen className="w-8 h-8 mb-2 text-[#8E8E8E] opacity-60" />
              <p className="font-medium text-[#262626] dark:text-[#F5F5F5] mb-1">
                No shared files or voice notes yet
              </p>
              <p>
                Files (PDF, DOC, PPT, XLS, ZIP, CSV, TXT, images) and voice messages shared in this
                chat will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sharedItems
                .slice()
                .reverse()
                .map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#737373] dark:text-[#A8A8A8]">
                      <span className="font-semibold text-[#262626] dark:text-[#F5F5F5]">
                        {item.senderName}
                      </span>
                      <span>{formatRelativeTime(item.createdAt, nowMs)}</span>
                    </div>
                    {item.kind === 'file' ? (
                      <FileAttachmentCard attachment={item.attachment} isMine={false} compact />
                    ) : (
                      <div className="px-3 py-2 rounded-xl bg-[#EFEFEF] dark:bg-[#262626]">
                        <AudioMessagePlayer
                          audioUrl={item.audioUrl}
                          duration={item.audioDuration}
                          isMine={false}
                        />
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs text-[#737373] dark:text-[#A8A8A8]">
              <p>
                No messages in &ldquo;{displayChatName}&rdquo; yet. Send a message, voice note, or
                file below.
              </p>
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
                    className={`max-w-[82%] sm:max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-2xs space-y-2 ${
                      isMine
                        ? 'bg-cohert-gradient text-white rounded-br-xs'
                        : 'bg-[#EFEFEF] dark:bg-[#262626] text-[#262626] dark:text-[#F5F5F5] rounded-bl-xs'
                    }`}
                  >
                    {msg.imageUrl && (
                      <div className="rounded-xl overflow-hidden">
                        <img
                          src={msg.imageUrl}
                          alt="Shared in chat"
                          referrerPolicy="no-referrer"
                          className="max-h-60 w-auto object-cover rounded-xl"
                        />
                      </div>
                    )}

                    {msg.audioUrl && (
                      <AudioMessagePlayer
                        audioUrl={msg.audioUrl}
                        duration={msg.audioDuration}
                        isMine={isMine}
                      />
                    )}

                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="space-y-2">
                        {msg.attachments.map((att) => (
                          <FileAttachmentCard key={att.id} attachment={att} isMine={isMine} />
                        ))}
                      </div>
                    )}

                    {msg.text && <p className="whitespace-pre-line break-words">{msg.text}</p>}
                  </div>

                  <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-[#737373] dark:text-[#A8A8A8]">
                    <span>{formatRelativeTime(msg.createdAt, nowMs)}</span>
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
      )}

      {/* Error Banner for Mic Permission / File Validation / Upload Errors */}
      {mediaError && (
        <div
          role="alert"
          className="px-4 py-2.5 border-t border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="break-words">{mediaError}</span>
          </div>
          <button
            type="button"
            onClick={() => setMediaError(null)}
            aria-label="Dismiss error"
            className="p-1 rounded-lg hover:bg-red-500/10 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload Progress Bar with Cancel Option */}
      {uploadProgress !== null && (
        <div className="px-4 py-2.5 border-t border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[#262626] dark:text-[#F5F5F5]">
              Uploading media... {uploadProgress}%
            </span>
            <button
              type="button"
              onClick={handleCancelActiveUpload}
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

      {/* Pending File Attachments Queue before send */}
      {pendingFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] space-y-1.5 max-h-36 overflow-y-auto">
          <div className="flex items-center justify-between text-[11px] text-[#737373] dark:text-[#A8A8A8]">
            <span>
              {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''} attached (max 15 MB each)
            </span>
            <button
              type="button"
              onClick={() => setPendingFiles([])}
              className="text-[#FD1D1D] font-medium hover:underline"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-1">
            {pendingFiles.map((file, idx) => (
              <div
                key={`${file.name}_${idx}`}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#121212] border border-[#DBDBDB] dark:border-[#262626] text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-[#E1306C] shrink-0" />
                  <span className="truncate font-medium text-[#262626] dark:text-[#F5F5F5]">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-[#737373] shrink-0">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePendingFile(idx)}
                  aria-label={`Remove ${file.name}`}
                  className="text-[#737373] hover:text-red-500 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Composer (or Active Audio Recording Bar) */}
      {isRecording ? (
        <div className="p-3 border-t border-[#DBDBDB] dark:border-[#262626] flex items-center justify-between gap-2 bg-[#FAFAFA] dark:bg-[#1A1A1A]">
          <button
            type="button"
            onClick={handleCancelRecording}
            aria-label="Cancel voice recording"
            className="min-h-[44px] px-3 rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] text-xs font-semibold text-[#FD1D1D] flex items-center gap-1.5 hover:opacity-80"
          >
            <Trash2 className="w-4 h-4" />
            <span>Cancel</span>
          </button>

          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#121212] border border-[#DBDBDB] dark:border-[#262626] flex-1 justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FD1D1D] animate-pulse" />
            <span className="text-xs font-semibold tabular-nums text-[#262626] dark:text-[#F5F5F5]">
              Recording {formatAudioDuration(recordingSeconds)} / 5:00
            </span>
          </div>

          <button
            type="button"
            onClick={handleStartOrSendRecording}
            aria-label="Tap again to send voice message"
            className="min-h-[44px] px-4 rounded-xl bg-cohert-gradient text-white text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>Send Audio</span>
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-[#DBDBDB] dark:border-[#262626] flex items-center gap-2"
        >
          <label
            htmlFor="chat-image-input"
            aria-label="Share image in chat"
            title="Share photo"
            className="min-w-[42px] min-h-[44px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] flex items-center justify-center text-[#262626] dark:text-[#F5F5F5] cursor-pointer hover:opacity-80"
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

          <label
            htmlFor="chat-file-input"
            aria-label="Attach files in chat"
            title="Attach files (PDF, DOC, PPT, XLS, TXT, ZIP, CSV, Images up to 15 MB)"
            className="min-w-[42px] min-h-[44px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] flex items-center justify-center text-[#262626] dark:text-[#F5F5F5] cursor-pointer hover:opacity-80"
          >
            <Paperclip className="w-5 h-5" />
          </label>
          <input
            id="chat-file-input"
            type="file"
            multiple
            accept={ALLOWED_FILE_INPUT_ACCEPT}
            onChange={handleFilesPick}
            className="hidden"
          />

          <button
            type="button"
            onClick={handleStartOrSendRecording}
            disabled={sending}
            aria-label="Record voice message"
            title="Record voice message (up to 5 min)"
            className="min-w-[42px] min-h-[44px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] flex items-center justify-center text-[#262626] dark:text-[#F5F5F5] hover:opacity-80 disabled:opacity-40"
          >
            <Mic className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            maxLength={1000}
            placeholder="Message..."
            aria-label="Message text"
            className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
          />

          <button
            type="submit"
            disabled={(!text.trim() && !imageUrl && pendingFiles.length === 0) || sending}
            aria-label="Send message"
            className="min-w-[44px] min-h-[44px] px-4 rounded-xl bg-cohert-gradient text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition-transform active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      )}
    </div>
  );
};
