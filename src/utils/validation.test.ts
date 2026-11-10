import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDeadlineCountdown,
  formatPresenceStatus,
  formatRelativeTime,
  getDirectChatId,
  getInitials,
  sanitizeString,
  validateCircleCapacity,
  validateInviteCode,
  validateInviteCodeFormat
} from './validation';

test('formatDeadlineCountdown computes days/hours/minutes and urgency states accurately', () => {
  const baseNow = Date.parse('2026-11-09T00:00:00Z');
  const fiveDaysThreeHoursTwentyMin = '2026-11-14T03:20:00Z';
  const countdown = formatDeadlineCountdown(fiveDaysThreeHoursTwentyMin, baseNow);
  assert.ok(countdown);
  assert.equal(countdown.label, '5d 3h 20m left');
  assert.equal(countdown.daysLeft, 5);
  assert.equal(countdown.isUrgent, false);
  assert.equal(countdown.isPast, false);

  const under24Hours = '2026-11-09T03:20:00Z';
  const hoursCountdown = formatDeadlineCountdown(under24Hours, baseNow);
  assert.ok(hoursCountdown);
  assert.equal(hoursCountdown.label, '3h 20m left');
  assert.equal(hoursCountdown.isUrgent, true);

  const under1Hour = '2026-11-09T00:20:00Z';
  const minsCountdown = formatDeadlineCountdown(under1Hour, baseNow);
  assert.ok(minsCountdown);
  assert.equal(minsCountdown.label, '20m left');
  assert.equal(minsCountdown.isUrgent, true);

  const pastDate = '2026-11-01T00:00:00Z';
  const past = formatDeadlineCountdown(pastDate, baseNow);
  assert.ok(past);
  assert.equal(past.label, 'Deadline over');
  assert.equal(past.isPast, true);
});

test('getDirectChatId generates identical sorted deterministic chat IDs regardless of sender/receiver order', () => {
  const idA = getDirectChatId('user_zeta', 'user_alpha');
  const idB = getDirectChatId('user_alpha', 'user_zeta');
  assert.equal(idA, 'dm_user_alpha_user_zeta');
  assert.equal(idA, idB);
});

test('formatPresenceStatus returns Active now or Last seen X min ago', () => {
  const now = 1700000000000;
  assert.deepEqual(
    formatPresenceStatus({ onlineStatus: 'online', isOnline: true, lastActiveAt: now - 30000 }, now),
    { isOnline: true, statusText: 'Active now' }
  );
  assert.deepEqual(
    formatPresenceStatus({ onlineStatus: 'offline', isOnline: false, lastActiveAt: now - 12 * 60 * 1000 }, now),
    { isOnline: false, statusText: 'Last seen 12 min ago' }
  );
});

test('validateCircleCapacity strictly blocks 6th account with private space message', () => {
  assert.deepEqual(validateCircleCapacity(0), { allowed: true, message: 'Spot available.' });
  assert.deepEqual(validateCircleCapacity(4), { allowed: true, message: 'Spot available.' });
  assert.deepEqual(validateCircleCapacity(5), {
    allowed: false,
    message: 'Cohert is full. This space is private.'
  });
});

test('validateInviteCode checks format and exact code match', () => {
  assert.equal(validateInviteCodeFormat('COHERT2026'), true);
  assert.equal(validateInviteCodeFormat('ab'), false);
  assert.equal(validateInviteCodeFormat('bad code!'), false);
  assert.equal(validateInviteCode('COHERT2026', 'COHERT2026'), true);
  assert.equal(validateInviteCode('cohert2026', 'COHERT2026'), false);
});

test('sanitizeString and getInitials handle edge cases cleanly', () => {
  assert.equal(sanitizeString('  hello world  ', 5), 'hello');
  assert.equal(getInitials('Sai Sarath'), 'SS');
  assert.equal(getInitials('Cohert'), 'CO');
  assert.equal(getInitials(''), 'C');
});

test('formatRelativeTime formats timestamps accurately', () => {
  const now = 1700000000000;
  assert.equal(formatRelativeTime(now - 15000, now), 'Just now');
  assert.equal(formatRelativeTime(now - 5 * 60 * 1000, now), '5m ago');
  assert.equal(formatRelativeTime(now - 3 * 3600 * 1000, now), '3h ago');
  assert.equal(formatRelativeTime(now - 2 * 86400 * 1000, now), '2d ago');
});
