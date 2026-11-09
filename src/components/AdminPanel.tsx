import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Shield, Trash2, Users } from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { CircleConfig, OperationType, UserPrivateInfo, UserProfile } from '../types';
import {
  formatRelativeTime,
  getInitials,
  MAX_CIRCLE_MEMBERS,
  sanitizeString,
  validateInviteCodeFormat,
} from '../utils/validation';

interface AdminPanelProps {
  circleConfig: CircleConfig | null;
  circleMembers: UserProfile[];
  currentUserId: string;
  isPreviewMode?: boolean;
  onPreviewUpdateInviteCode?: (newCode: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  circleConfig,
  circleMembers,
  currentUserId,
  isPreviewMode = false,
  onPreviewUpdateInviteCode,
}) => {
  const [inviteCode, setInviteCode] = useState(circleConfig?.inviteCode || 'COHERT2026');
  const [copied, setCopied] = useState(false);
  const [savingCode, setSavingCode] = useState(false);
  const [codeMessage, setCodeMessage] = useState('');
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  useEffect(() => {
    if (circleConfig?.inviteCode) {
      setInviteCode(circleConfig.inviteCode);
    }
  }, [circleConfig?.inviteCode]);

  useEffect(() => {
    if (isPreviewMode) return;
    let active = true;
    async function loadPrivateEmails() {
      const map: Record<string, string> = {};
      try {
        const q = query(collection(db, 'userPrivate'), where('circleId', '==', 'cohert'));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          const data = d.data() as UserPrivateInfo;
          map[data.userId] = data.email;
        });
      } catch {
        // Fallback: fetch individually via getDoc
        for (const member of circleMembers) {
          try {
            const pDoc = await getDoc(doc(db, 'userPrivate', member.userId));
            if (pDoc.exists()) {
              map[member.userId] = (pDoc.data() as UserPrivateInfo).email;
            }
          } catch {
            // ignore
          }
        }
      }
      if (active) setMemberEmails(map);
    }
    loadPrivateEmails();
    return () => {
      active = false;
    };
  }, [circleMembers, isPreviewMode]);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSaveInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeMessage('');
    const cleaned = sanitizeString(inviteCode, 32);
    if (!validateInviteCodeFormat(cleaned)) {
      setCodeMessage('Invite code must be 4–32 letters, numbers, hyphens, or underscores.');
      return;
    }

    if (isPreviewMode && onPreviewUpdateInviteCode) {
      onPreviewUpdateInviteCode(cleaned);
      setCodeMessage('Invite code updated.');
      return;
    }

    setSavingCode(true);
    try {
      await updateDoc(doc(db, 'circleConfig', 'cohert'), {
        inviteCode: cleaned,
        updatedAt: serverTimestamp(),
      });
      setCodeMessage('Invite code updated for new members.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'circleConfig/cohert');
    } finally {
      setSavingCode(false);
    }
  };

  const handleRemoveMember = async (member: UserProfile) => {
    if (member.userId === currentUserId || isPreviewMode) return;
    setRemovingUid(member.userId);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'profiles', member.userId));
      batch.delete(doc(db, 'userPrivate', member.userId));
      if (circleConfig) {
        batch.update(doc(db, 'circleConfig', 'cohert'), {
          memberCount: Math.max(1, circleConfig.memberCount - 1),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `profiles/${member.userId}`);
    } finally {
      setRemovingUid(null);
    }
  };

  const memberCount = circleConfig?.memberCount ?? circleMembers.length;

  return (
    <div className="w-full max-w-[680px] mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-cohert-gradient flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-heading text-[#262626] dark:text-[#F5F5F5]">
                Circle Admin Panel
              </h1>
              <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
                Manage your private 5-member circle and invite code
              </p>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626] text-xs font-semibold tabular-nums">
            {memberCount} / {MAX_CIRCLE_MEMBERS} Members
          </div>
        </div>
      </div>

      {/* Invite Code Management */}
      <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#833AB4] dark:text-[#FCB045]" />
          <h2 className="text-sm font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
            Circle Invite Code
          </h2>
        </div>
        <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
          Share this code privately with your 4 close friends. Nobody can create an account without it, and registration locks automatically at 5 members.
        </p>

        <form onSubmit={handleSaveInviteCode} className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              maxLength={32}
              aria-label="Invite Code"
              className="flex-1 min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]"
            />
            <button
              type="button"
              onClick={handleCopyCode}
              aria-label="Copy invite code"
              className="min-h-[44px] px-3.5 rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-xs font-medium flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={savingCode}
            className="min-h-[44px] px-5 rounded-xl bg-cohert-gradient text-white text-xs font-semibold shadow-xs disabled:opacity-50"
          >
            {savingCode ? 'Updating...' : 'Update Invite Code'}
          </button>
        </form>

        {codeMessage && (
          <p className="text-xs font-medium text-[#833AB4] dark:text-[#FCB045]">{codeMessage}</p>
        )}
      </div>

      {/* Member Directory (Max 5) */}
      <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#833AB4] dark:text-[#FCB045]" />
            <h2 className="text-sm font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
              Circle Members ({circleMembers.length} / {MAX_CIRCLE_MEMBERS})
            </h2>
          </div>
        </div>

        <div className="divide-y divide-[#DBDBDB] dark:divide-[#262626]">
          {circleMembers.map((member) => {
            const isMe = member.userId === currentUserId;
            const email = memberEmails[member.userId] || (isMe ? 'Admin (You)' : 'Verified Member');
            return (
              <div
                key={member.userId}
                className="py-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626] overflow-hidden flex items-center justify-center text-xs font-semibold shrink-0">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getInitials(member.name)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#262626] dark:text-[#F5F5F5]">
                      <span className="truncate">{member.name || 'Unnamed Member'}</span>
                      {isMe && (
                        <span className="text-xs font-normal text-[#833AB4] dark:text-[#FCB045]">
                          · Admin
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#737373] dark:text-[#A8A8A8]">
                      <span>{email}</span>
                      <span aria-hidden="true">·</span>
                      <span>Joined {formatRelativeTime(member.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {!isMe && (
                  <button
                    type="button"
                    disabled={removingUid === member.userId}
                    onClick={() => handleRemoveMember(member)}
                    aria-label={`Remove ${member.name || 'member'}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] text-xs font-medium text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{removingUid === member.userId ? 'Removing...' : 'Remove'}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
