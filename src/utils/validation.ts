import { TopicChannel, TopicId, PostType } from '../types';

export const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const MAX_CIRCLE_MEMBERS = 5;
export const BOOTSTRAPPED_ADMIN_EMAIL = 'saisarathpandu@gmail.com';

export const TOPIC_CHANNELS: TopicChannel[] = [
  {
    id: 'studies',
    label: 'Studies',
    emoji: '📚',
    description: 'Notes, exam prep, coursework & study groups'
  },
  {
    id: 'hackathons',
    label: 'Hackathons',
    emoji: '🏆',
    description: 'Hackathon alerts, pitches & team formation'
  },
  {
    id: 'internships',
    label: 'Internships',
    emoji: '💼',
    description: 'Open roles, referrals & application deadlines'
  },
  {
    id: 'job_training',
    label: 'Job Training',
    emoji: '🎯',
    description: 'DSA, system design, mock interviews & placement prep'
  },
  {
    id: 'ideas',
    label: 'Ideas',
    emoji: '💡',
    description: 'Side projects, startup concepts & brainstorms'
  }
];

export const VALID_TOPICS: TopicId[] = ['studies', 'hackathons', 'internships', 'job_training', 'ideas'];
export const VALID_POST_TYPES: PostType[] = ['standard', 'idea', 'opportunity', 'resource'];

export function validateIdPattern(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

export function validateInviteCodeFormat(code: string): boolean {
  return typeof code === 'string' && code.length >= 4 && code.length <= 32 && ID_REGEX.test(code);
}

export function validateInviteCode(inputCode: string, expectedCode: string): boolean {
  const normalizedInput = inputCode.trim();
  const normalizedExpected = expectedCode.trim();
  if (!validateInviteCodeFormat(normalizedInput) || !validateInviteCodeFormat(normalizedExpected)) {
    return false;
  }
  return normalizedInput === normalizedExpected;
}

export function validateCircleCapacity(currentMemberCount: number): { allowed: boolean; message: string } {
  if (typeof currentMemberCount !== 'number' || currentMemberCount < 0) {
    return { allowed: false, message: 'Invalid member count.' };
  }
  if (currentMemberCount >= MAX_CIRCLE_MEMBERS) {
    return { allowed: false, message: 'Cohert is full. This space is private.' };
  }
  return { allowed: true, message: 'Spot available.' };
}

export function canReadPrivateUserInfo(params: {
  targetUserId: string;
  callerUid: string;
  callerEmail: string;
  emailVerified: boolean;
  isAdminRecordPresent: boolean;
}): boolean {
  if (!params.emailVerified || !validateIdPattern(params.targetUserId) || !validateIdPattern(params.callerUid)) {
    return false;
  }
  if (params.callerUid === params.targetUserId) {
    return true;
  }
  if (params.callerEmail === BOOTSTRAPPED_ADMIN_EMAIL || params.isAdminRecordPresent) {
    return true;
  }
  return false;
}

const ALLOWED_PROFILE_KEYS = new Set([
  'userId',
  'circleId',
  'name',
  'avatarUrl',
  'branch',
  'year',
  'skills',
  'bio',
  'profileCompleted',
  'onboardingCompleted',
  'onlineStatus',
  'isOnline',
  'lastActiveAt',
  'lastSeen',
  'createdAt',
  'updatedAt'
]);

const REQUIRED_PROFILE_CORE_KEYS = [
  'userId',
  'circleId',
  'name',
  'avatarUrl',
  'branch',
  'year',
  'skills',
  'bio',
  'profileCompleted',
  'onboardingCompleted',
  'onlineStatus'
];

export function validateUserProfilePayload(
  payload: Record<string, unknown>,
  callerUid: string
): boolean {
  const keys = Object.keys(payload);
  for (const k of keys) {
    if (!ALLOWED_PROFILE_KEYS.has(k)) {
      return false;
    }
  }
  for (const req of REQUIRED_PROFILE_CORE_KEYS) {
    if (!(req in payload)) {
      return false;
    }
  }
  if (payload.userId !== callerUid || !validateIdPattern(String(payload.userId))) {
    return false;
  }
  if (payload.circleId !== 'cohert') {
    return false;
  }
  if (typeof payload.name !== 'string' || payload.name.length > 80) {
    return false;
  }
  if (typeof payload.avatarUrl !== 'string' || payload.avatarUrl.length > 500000) {
    return false;
  }
  if (typeof payload.branch !== 'string' || payload.branch.length > 80) {
    return false;
  }
  if (typeof payload.year !== 'string' || payload.year.length > 40) {
    return false;
  }
  if (!Array.isArray(payload.skills) || payload.skills.length > 10) {
    return false;
  }
  for (const skill of payload.skills) {
    if (typeof skill !== 'string' || skill.length === 0 || skill.length > 40) {
      return false;
    }
  }
  if (typeof payload.bio !== 'string' || payload.bio.length > 300) {
    return false;
  }
  if (typeof payload.profileCompleted !== 'boolean' || typeof payload.onboardingCompleted !== 'boolean') {
    return false;
  }
  if (payload.onlineStatus !== 'online' && payload.onlineStatus !== 'offline') {
    return false;
  }
  return true;
}

const ALLOWED_POST_KEYS = new Set([
  'authorId',
  'authorName',
  'authorAvatar',
  'authorBranch',
  'circleId',
  'topic',
  'postType',
  'title',
  'content',
  'imageUrl',
  'externalLink',
  'deadlineDate',
  'lookingForTeammates',
  'attachments',
  'likesCount',
  'commentsCount',
  'createdAt',
  'updatedAt'
]);

const REQUIRED_POST_CORE_KEYS = [
  'authorId',
  'authorName',
  'authorAvatar',
  'authorBranch',
  'circleId',
  'topic',
  'postType',
  'title',
  'content',
  'imageUrl',
  'externalLink',
  'deadlineDate',
  'lookingForTeammates',
  'likesCount',
  'commentsCount'
];

export function validatePostPayload(
  payload: Record<string, unknown>,
  callerUid: string
): boolean {
  const keys = Object.keys(payload);
  for (const k of keys) {
    if (!ALLOWED_POST_KEYS.has(k)) {
      return false;
    }
  }
  for (const req of REQUIRED_POST_CORE_KEYS) {
    if (!(req in payload)) {
      return false;
    }
  }
  if (payload.authorId !== callerUid || !validateIdPattern(String(payload.authorId))) {
    return false;
  }
  if (typeof payload.authorName !== 'string' || payload.authorName.length < 1 || payload.authorName.length > 80) {
    return false;
  }
  if (typeof payload.authorAvatar !== 'string' || payload.authorAvatar.length > 500000) {
    return false;
  }
  if (typeof payload.authorBranch !== 'string' || payload.authorBranch.length > 80) {
    return false;
  }
  if (payload.circleId !== 'cohert') {
    return false;
  }
  if (!VALID_TOPICS.includes(payload.topic as TopicId)) {
    return false;
  }
  if (!VALID_POST_TYPES.includes(payload.postType as PostType)) {
    return false;
  }
  if (typeof payload.title !== 'string' || payload.title.length > 140) {
    return false;
  }
  if (typeof payload.content !== 'string' || payload.content.length < 1 || payload.content.length > 2000) {
    return false;
  }
  if (typeof payload.imageUrl !== 'string' || payload.imageUrl.length > 500000) {
    return false;
  }
  if (typeof payload.externalLink !== 'string' || payload.externalLink.length > 500) {
    return false;
  }
  if (typeof payload.deadlineDate !== 'string' || payload.deadlineDate.length > 40) {
    return false;
  }
  if (typeof payload.lookingForTeammates !== 'boolean') {
    return false;
  }
  if (typeof payload.likesCount !== 'number' || payload.likesCount < 0) {
    return false;
  }
  if (typeof payload.commentsCount !== 'number' || payload.commentsCount < 0) {
    return false;
  }
  return true;
}

export function sanitizeString(input: string, maxLength: number): string {
  return (input || '').trim().slice(0, maxLength);
}

export function getDirectChatId(uid1: string, uid2: string): string {
  const sorted = [String(uid1 || '').trim(), String(uid2 || '').trim()].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
}

export function formatDeadlineCountdown(deadlineDateStr: string, nowMs: number = Date.now()): {
  label: string;
  isUrgent: boolean;
  isPast: boolean;
  daysLeft: number;
  diffMs: number;
} | null {
  if (!deadlineDateStr || !deadlineDateStr.trim()) {
    return null;
  }
  const trimmed = deadlineDateStr.trim();
  // If user selected a date-only string (YYYY-MM-DD), treat the deadline as the end of that day (23:59:59)
  const normalizedDateStr = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T23:59:59`
    : trimmed;
  const targetMs = Date.parse(normalizedDateStr);
  if (Number.isNaN(targetMs)) {
    return null;
  }
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    return {
      label: 'Deadline over',
      isUrgent: false,
      isPast: true,
      daysLeft: -1,
      diffMs
    };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  let label: string;
  if (days >= 1) {
    label = `${days}d ${hours}h ${minutes}m left`;
  } else if (hours >= 1) {
    label = `${hours}h ${minutes}m left`;
  } else {
    const mins = Math.max(1, minutes);
    label = `${mins}m left`;
  }

  return {
    label,
    isUrgent: days < 3,
    isPast: false,
    daysLeft: days,
    diffMs
  };
}

export function extractTimestampMs(timestamp: unknown): number {
  if (!timestamp) return 0;
  if (
    typeof timestamp === 'object' &&
    timestamp !== null &&
    'toMillis' in timestamp &&
    typeof (timestamp as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (timestamp as { toMillis: () => number }).toMillis();
  }
  if (
    typeof timestamp === 'object' &&
    timestamp !== null &&
    'seconds' in timestamp &&
    typeof (timestamp as { seconds: number }).seconds === 'number'
  ) {
    return (timestamp as { seconds: number }).seconds * 1000;
  }
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function formatPresenceStatus(
  profile: {
    onlineStatus?: 'online' | 'offline' | string;
    isOnline?: boolean;
    lastActiveAt?: unknown;
    lastSeen?: unknown;
  },
  nowMs: number = Date.now()
): { isOnline: boolean; statusText: string } {
  const lastSeenMs = extractTimestampMs(profile.lastSeen ?? profile.lastActiveAt);
  const explicitlyOnline =
    typeof profile.isOnline === 'boolean'
      ? profile.isOnline
      : profile.onlineStatus === 'online';
  // Consider active if marked online and heartbeat is within the last 3 minutes (or timestamp just written)
  const isFresh = lastSeenMs === 0 || nowMs - lastSeenMs <= 3 * 60 * 1000;
  const activeNow = explicitlyOnline && isFresh;

  if (activeNow) {
    return { isOnline: true, statusText: 'Active now' };
  }

  if (!lastSeenMs) {
    return { isOnline: false, statusText: 'Last seen recently' };
  }

  const diffMin = Math.max(1, Math.floor((nowMs - lastSeenMs) / (1000 * 60)));
  if (diffMin < 60) {
    return { isOnline: false, statusText: `Last seen ${diffMin} min ago` };
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return { isOnline: false, statusText: `Last seen ${diffHr}h ago` };
  }
  const diffDays = Math.floor(diffHr / 24);
  return { isOnline: false, statusText: `Last seen ${diffDays}d ago` };
}

export function formatRelativeTime(timestamp: unknown, nowMs: number = Date.now()): string {
  const ms = extractTimestampMs(timestamp);
  if (!ms || Number.isNaN(ms)) return 'Just now';

  const diffSec = Math.max(0, Math.floor((nowMs - ms) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getInitials(name: string): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'C';
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_AUDIO_DURATION_SECONDS = 300; // 5 minutes

export const BLOCKED_EXECUTABLE_EXTENSIONS = new Set([
  'exe',
  'bat',
  'sh',
  'apk',
  'js',
  'msi',
  'cmd',
  'com',
  'scr',
  'vbs',
  'ps1',
  'jar',
  'dmg',
  'app',
  'bin',
  'cjs',
  'mjs'
]);

export const ALLOWED_FILE_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'zip',
  'csv',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg'
]);

export const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']);

export const ALLOWED_FILE_INPUT_ACCEPT =
  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.csv,image/*';

export function getFileExtension(fileName: string): string {
  const cleaned = (fileName || '').trim().toLowerCase();
  const lastDot = cleaned.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === cleaned.length - 1) return '';
  return cleaned.slice(lastDot + 1);
}

export function isImageAttachment(fileName: string, mimeType?: string): boolean {
  const ext = getFileExtension(fileName);
  if (IMAGE_EXTENSIONS.has(ext)) return true;
  if (mimeType && mimeType.toLowerCase().startsWith('image/')) return true;
  return false;
}

export function validateAttachmentFile(file: {
  name: string;
  size: number;
  type?: string;
}): {
  valid: boolean;
  error?: string;
  extension: string;
  isImage: boolean;
  isPdf: boolean;
} {
  const ext = getFileExtension(file.name);
  if (!ext) {
    return {
      valid: false,
      error: `File "${file.name}" does not have a valid file extension.`,
      extension: '',
      isImage: false,
      isPdf: false
    };
  }

  if (BLOCKED_EXECUTABLE_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Executable and script files (.${ext}) are blocked for security.`,
      extension: ext,
      isImage: false,
      isPdf: false
    };
  }

  if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Unsupported file type (.${ext}). Allowed: PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, ZIP, CSV, and images.`,
      extension: ext,
      isImage: false,
      isPdf: false
    };
  }

  if (typeof file.size !== 'number' || file.size <= 0) {
    return {
      valid: false,
      error: `File "${file.name}" is empty or unreadable.`,
      extension: ext,
      isImage: IMAGE_EXTENSIONS.has(ext),
      isPdf: ext === 'pdf'
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds the 15 MB size limit (${formatFileSize(file.size)}).`,
      extension: ext,
      isImage: IMAGE_EXTENSIONS.has(ext),
      isPdf: ext === 'pdf'
    };
  }

  return {
    valid: true,
    extension: ext,
    isImage: IMAGE_EXTENSIONS.has(ext),
    isPdf: ext === 'pdf'
  };
}

export function formatFileSize(bytes: number): string {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function formatAudioDuration(seconds: number): string {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds < 0) return '0:00';
  const clamped = Math.min(MAX_AUDIO_DURATION_SECONDS, Math.max(0, Math.floor(seconds)));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getNextPlaybackSpeed(current: 1 | 1.5 | 2): 1 | 1.5 | 2 {
  if (current === 1) return 1.5;
  if (current === 1.5) return 2;
  return 1;
}
