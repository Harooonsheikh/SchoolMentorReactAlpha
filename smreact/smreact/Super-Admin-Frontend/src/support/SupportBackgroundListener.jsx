import React, { useEffect, useRef } from 'react';
import { useSupportChat } from './useSupportChat';
import { playIncomingChime } from './sound';
import { showSupportNotification } from './notification';

export default function SupportBackgroundListener({
  enabled = true,
  onUnreadChange,
}) {
  const previousUnreadRef = useRef(0);
  const initializedRef = useRef(false);

  const chat = useSupportChat({
    role: 'agent',

    // Background listener must never mark messages as read.
    viewing: false,

    onError: () => {},
  });

  useEffect(() => {
    if (!enabled) return;

    chat.start();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const totalUnread = chat.activeSessions.reduce(
    (total, session) =>
      total + Number(session.unreadCount || 0),
    0
  );

  useEffect(() => {
    onUnreadChange?.(totalUnread);

    // Don't sound for messages that were already unread
    // when Super Admin initially loaded.
    if (!initializedRef.current) {
      previousUnreadRef.current = totalUnread;
      initializedRef.current = true;
      return;
    }

    if (totalUnread > previousUnreadRef.current) {
      playIncomingChime();

      showSupportNotification({
        title: 'School Mentor Support',
        body: 'You have a new support message.',
      });
    }

    previousUnreadRef.current = totalUnread;
  }, [totalUnread, onUnreadChange]);

  return null;
}