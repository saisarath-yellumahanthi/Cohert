import React from 'react';
import {
  Bell,
  CheckCheck,
  Compass,
  Heart,
  MessageCircle,
  MessagesSquare,
  UserPlus,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { NotificationItem, OperationType } from '../types';
import { formatRelativeTime, getInitials } from '../utils/validation';

interface NotificationsProps {
  notifications: NotificationItem[];
  onExploreFeed: () => void;
  isPreviewMode?: boolean;
  onPreviewMarkRead?: (id: string) => void;
}

export const Notifications: React.FC<NotificationsProps> = ({
  notifications,
  onExploreFeed,
  isPreviewMode = false,
  onPreviewMarkRead,
}) => {
  const handleMarkRead = async (notif: NotificationItem) => {
    if (notif.read) return;
    if (isPreviewMode && onPreviewMarkRead) {
      onPreviewMarkRead(notif.id);
      return;
    }
    try {
      await updateDoc(doc(db, 'notifications', notif.id), {
        read: true,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${notif.id}`);
    }
  };

  return (
    <div className="w-full max-w-[600px] mx-auto space-y-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg font-bold font-heading text-[#262626] dark:text-[#F5F5F5]">
            Activity
          </h1>
          <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
            Likes, comments, messages, and teammate requests from your circle
          </p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] px-6 py-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-cohert-gradient p-[2px] mx-auto">
            <div className="w-full h-full rounded-full bg-[#FFFFFF] dark:bg-[#121212] flex items-center justify-center">
              <Bell className="w-6 h-6 text-[#833AB4] dark:text-[#FCB045]" />
            </div>
          </div>
          <div className="space-y-1 max-w-xs mx-auto">
            <h2 className="text-base font-semibold font-heading text-[#262626] dark:text-[#F5F5F5]">
              You&apos;re all caught up.
            </h2>
            <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
              Real likes, comments, messages, and teammate requests from your friends will appear here.
            </p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={onExploreFeed}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-cohert-gradient text-white text-xs font-semibold shadow-sm transition-transform active:scale-95"
            >
              <Compass className="w-4 h-4" />
              <span>Explore feed</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] divide-y divide-[#DBDBDB] dark:divide-[#262626] overflow-hidden">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-colors ${
                n.read ? 'opacity-75' : 'bg-[#FAFAFA] dark:bg-[#1A1A1A]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-[#EFEFEF] dark:bg-[#262626] overflow-hidden flex items-center justify-center text-xs font-semibold">
                    {n.actorAvatar ? (
                      <img
                        src={n.actorAvatar}
                        alt={n.actorName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getInitials(n.actorName)
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FFFFFF] dark:bg-[#121212] flex items-center justify-center shadow-2xs">
                    {n.type === 'like' && <Heart className="w-3 h-3 fill-[#FD1D1D] text-[#FD1D1D]" />}
                    {n.type === 'comment' && <MessageCircle className="w-3 h-3 text-[#833AB4]" />}
                    {n.type === 'message' && <MessagesSquare className="w-3 h-3 text-[#FCB045]" />}
                    {n.type === 'teammate_request' && <UserPlus className="w-3 h-3 text-[#FD1D1D]" />}
                  </div>
                </div>

                <div className="text-xs leading-relaxed min-w-0">
                  <p className="text-[#262626] dark:text-[#F5F5F5]">
                    <span className="font-semibold">{n.actorName}</span>{' '}
                    <span>{n.message}</span>
                  </p>
                  <p className="text-[11px] text-[#737373] dark:text-[#A8A8A8] mt-0.5">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
              </div>

              {!n.read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n)}
                  aria-label="Mark notification as read"
                  className="min-w-[40px] min-h-[40px] px-2.5 rounded-xl border border-[#DBDBDB] dark:border-[#262626] text-xs font-medium text-[#833AB4] dark:text-[#FCB045] flex items-center gap-1 shrink-0"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
