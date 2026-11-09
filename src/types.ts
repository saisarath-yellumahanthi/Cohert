export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type TopicId = 'studies' | 'hackathons' | 'internships' | 'job_training' | 'ideas';

export type PostType = 'standard' | 'idea' | 'opportunity' | 'resource';

export type NavTab = 'home' | 'search' | 'chat' | 'notifications' | 'profile' | 'admin';

export interface TopicChannel {
  id: TopicId;
  label: string;
  emoji: string;
  description: string;
}

export interface CircleConfig {
  circleId: 'cohert';
  inviteCode: string;
  memberCount: number;
  maxMembers: number;
  adminId: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserProfile {
  userId: string;
  circleId: 'cohert';
  name: string;
  avatarUrl: string;
  branch: string;
  year: string;
  skills: string[];
  bio: string;
  profileCompleted: boolean;
  onboardingCompleted: boolean;
  onlineStatus: 'online' | 'offline';
  lastActiveAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserPrivateInfo {
  userId: string;
  circleId: 'cohert';
  email: string;
  createdAt: unknown;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorBranch: string;
  circleId: 'cohert';
  topic: TopicId;
  postType: PostType;
  title: string;
  content: string;
  imageUrl: string;
  externalLink: string;
  deadlineDate: string;
  lookingForTeammates: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt: unknown;
}

export interface Bookmark {
  id: string;
  userId: string;
  postId: string;
  createdAt: unknown;
}

export interface ChatRoom {
  id: string;
  circleId: 'cohert';
  chatType: 'direct' | 'group';
  name: string;
  creatorId: string;
  participantIds: string[];
  lastMessageText: string;
  lastMessageSenderId: string;
  typingUserId: string;
  typingUserName: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  imageUrl: string;
  status: 'sent' | 'seen';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatar: string;
  type: 'like' | 'comment' | 'message' | 'teammate_request';
  targetId: string;
  message: string;
  read: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}
