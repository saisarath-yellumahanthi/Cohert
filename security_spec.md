# Cohert Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Closed Circle Cap & Membership Gate**: Maximum 5 members allowed (`memberCount <= 5`). All content collections (`posts`, `chats`, `bookmarks`, `notifications`) require the caller to be a verified authenticated member with an active profile at `/profiles/{uid}` or be the circle admin (`isAdmin()`).
2. **PII Isolation (`userPrivate`)**: Email addresses are strictly isolated inside `/userPrivate/{userId}`. Only `request.auth.uid == userId` or `isAdmin()` can read `/userPrivate/{userId}`.
3. **Master Gate Relational Integrity**:
   - Subcollections `/posts/{postId}/likes/{likeId}` and `/posts/{postId}/comments/{commentId}` require the parent post `/posts/{postId}` to exist and belong to `circleId == 'cohert'`.
   - Subcollection `/chats/{chatId}/messages/{messageId}` requires the parent `/chats/{chatId}` to exist and include `request.auth.uid` in `participantIds`.
4. **Anti-Update-Gap & Strict Key Validation**: Every `create` and `update` invokes `isValid[Entity](incoming())`, enforcing `hasAll`, `hasOnly`, string `.size()` bounds, regex ID patterns (`^[a-zA-Z0-9_\-]+$`), immutable `authorId`/`creatorId`/`createdAt`, and server timestamps (`request.time`).
5. **Query Enforcer (`allow list`)**: No blanket `isSignedIn()` reads. Every `allow list` checks `resource.data` fields (`circleId == 'cohert'`, `userId == request.auth.uid`, or `recipientId == request.auth.uid`).

## 2. The "Dirty Dozen" Payloads
1. **Payload 1 (Shadow Field Injection on Profile)**: `{ userId: "u1", circleId: "cohert", ..., isAdmin: true }` -> Rejected by `hasOnly()`.
2. **Payload 2 (Identity Spoofing on Post Create)**: `authorId: "victim_uid"` when `request.auth.uid == "attacker_uid"` -> Rejected by `incoming().authorId == request.auth.uid`.
3. **Payload 3 (Unverified Email Admin Spoof)**: `request.auth.token.email == "saisarathpandu@gmail.com"` with `email_verified: false` -> Rejected by `isVerified()`.
4. **Payload 4 (PII Leak via `userPrivate` Get)**: Authenticated member `u2` attempting `get(/userPrivate/u1)` -> Rejected by `request.auth.uid == userId || isAdmin()`.
5. **Payload 5 (ID Poisoning / 2KB Document ID)**: `postId` of 1500 characters or special chars `$@#` -> Rejected by `isValidId(postId)`.
6. **Payload 6 (Denial of Wallet String Overflow)**: Post `content` with 10,000 characters -> Rejected by `data.content.size() <= 2000`.
7. **Payload 7 (Unbounded Skills Array)**: Profile `skills` array with 25 elements -> Rejected by `data.skills.size() <= 10`.
8. **Payload 8 (Client Timestamp Forgery)**: Post `createdAt` set to past/future timestamp instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
9. **Payload 9 (Immortal Field Mutation)**: Updating `authorId` or `createdAt` on an existing `/posts/{postId}` -> Rejected by `incoming().authorId == existing().authorId && incoming().createdAt == existing().createdAt`.
10. **Payload 10 (Orphaned Comment Creation)**: Creating `/posts/non_existent_post/comments/c1` -> Rejected by `exists(/databases/$(database)/documents/posts/$(postId))`.
11. **Payload 11 (Unauthorized Chat Message Read/Write)**: Member `u3` not in `chat.participantIds` reading or sending a message in `/chats/{chatId}/messages` -> Rejected by parent `get()` participant check.
12. **Payload 12 (Circle Capacity Overflow)**: Updating `/circleConfig/cohert` with `memberCount: 6` -> Rejected by `data.memberCount <= 5`.
