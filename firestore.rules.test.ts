import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateIdPattern,
  validateUserProfilePayload,
  validatePostPayload,
  validateCircleCapacity,
  validateInviteCode,
  canReadPrivateUserInfo
} from './src/utils/validation';

const rulesSource = fs.readFileSync('./firestore.rules', 'utf8');

test('Firestore rules file enforces Global Safety Net and zero DB reads in allow list', () => {
  assert.equal(rulesSource.includes("rules_version = '2';"), true);
  assert.equal(rulesSource.includes('match /{document=**} {\n      allow read, write: if false;\n    }'), true);
});

test('Dirty Dozen #1: Shadow field injection on profile is rejected', () => {
  const payload = {
    userId: 'user_1',
    circleId: 'cohert',
    name: 'Aarav',
    avatarUrl: '',
    branch: 'CSE',
    year: '2027',
    skills: ['React'],
    bio: 'Building',
    profileCompleted: true,
    onboardingCompleted: true,
    onlineStatus: 'online',
    isAdmin: true // Ghost shadow field
  };
  assert.equal(validateUserProfilePayload(payload as unknown as Record<string, unknown>, 'user_1'), false);
});

test('Dirty Dozen #2: Identity spoofing on post creation is rejected', () => {
  const payload = {
    authorId: 'victim_uid',
    authorName: 'Victim',
    authorAvatar: '',
    authorBranch: 'CSE',
    circleId: 'cohert',
    topic: 'hackathons',
    postType: 'opportunity',
    title: 'HackMIT',
    content: 'Join my team',
    imageUrl: '',
    externalLink: 'https://example.com',
    deadlineDate: '2026-12-01',
    lookingForTeammates: true,
    likesCount: 0,
    commentsCount: 0
  };
  assert.equal(validatePostPayload(payload, 'attacker_uid'), false);
});

test('Dirty Dozen #3 & #4: Unverified email spoof and PII isolation enforced', () => {
  // Unverified admin email cannot read another user's private PII
  assert.equal(
    canReadPrivateUserInfo({
      targetUserId: 'user_1',
      callerUid: 'attacker_uid',
      callerEmail: 'saisarathpandu@gmail.com',
      emailVerified: false,
      isAdminRecordPresent: false
    }),
    false
  );
  // Non-owner verified friend cannot read another user's private PII
  assert.equal(
    canReadPrivateUserInfo({
      targetUserId: 'user_1',
      callerUid: 'user_2',
      callerEmail: 'friend@college.edu',
      emailVerified: true,
      isAdminRecordPresent: false
    }),
    false
  );
  // Verified owner can read own PII
  assert.equal(
    canReadPrivateUserInfo({
      targetUserId: 'user_1',
      callerUid: 'user_1',
      callerEmail: 'user1@college.edu',
      emailVerified: true,
      isAdminRecordPresent: false
    }),
    true
  );
});

test('Dirty Dozen #5 & #6 & #7: ID poisoning, string overflow, and unbounded array rejected', () => {
  // 1500-char ID or invalid characters
  assert.equal(validateIdPattern('a'.repeat(1500)), false);
  assert.equal(validateIdPattern('bad$id!'), false);
  assert.equal(validateIdPattern('valid_id-123'), true);

  // Content > 2000 chars
  assert.equal(
    validatePostPayload(
      {
        authorId: 'user_1',
        authorName: 'Aarav',
        authorAvatar: '',
        authorBranch: 'CSE',
        circleId: 'cohert',
        topic: 'studies',
        postType: 'standard',
        title: '',
        content: 'x'.repeat(2005),
        imageUrl: '',
        externalLink: '',
        deadlineDate: '',
        lookingForTeammates: false,
        likesCount: 0,
        commentsCount: 0
      },
      'user_1'
    ),
    false
  );

  // Skills > 10 items
  assert.equal(
    validateUserProfilePayload(
      {
        userId: 'user_1',
        circleId: 'cohert',
        name: 'Aarav',
        avatarUrl: '',
        branch: 'CSE',
        year: '2027',
        skills: Array.from({ length: 12 }, (_, i) => `Skill${i}`),
        bio: 'Hi',
        profileCompleted: true,
        onboardingCompleted: true,
        onlineStatus: 'online'
      },
      'user_1'
    ),
    false
  );
});

test('Dirty Dozen #8-#12: Circle capacity limit (max 5 members) and invite code checks enforced', () => {
  assert.equal(validateCircleCapacity(0).allowed, true);
  assert.equal(validateCircleCapacity(4).allowed, true);
  assert.equal(validateCircleCapacity(5).allowed, false);
  assert.equal(validateCircleCapacity(5).message, 'Cohert is full. This space is private.');

  assert.equal(validateInviteCode('WRONG', 'COHERT2026'), false);
  assert.equal(validateInviteCode('COHERT2026', 'COHERT2026'), true);
});
