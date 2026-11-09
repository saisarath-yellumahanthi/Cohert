import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDeadlineCountdown,
  formatRelativeTime,
  getInitials,
  sanitizeString,
  validateCircleCapacity,
  validateInviteCode,
  validateInviteCodeFormat
} from './validation';

test('formatDeadlineCountdown computes exact days left and urgency states', () => {
  const baseNow = Date.parse('2026-11-09T00:00:00Z');
  const fiveDaysOut = '2026-11-14T00:00:00Z';
  const countdown = formatDeadlineCountdown(fiveDaysOut, baseNow);
  assert.ok(countdown);
  assert.equal(countdown.label, '5 days left');
  assert.equal(countdown.daysLeft, 5);
  assert.equal(countdown.isUrgent, false);
  assert.equal(countdown.isPast, false);

  const oneDayOut = '2026-11-10T00:00:00Z';
  const urgent = formatDeadlineCountdown(oneDayOut, baseNow);
  assert.ok(urgent);
  assert.equal(urgent.label, '1 day left');
  assert.equal(urgent.isUrgent, true);

  const pastDate = '2026-11-01T00:00:00Z';
  const past = formatDeadlineCountdown(pastDate, baseNow);
  assert.ok(past);
  assert.equal(past.label, 'Deadline passed');
  assert.equal(past.isPast, true);
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
