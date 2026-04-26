import { useCallback, useEffect, useState } from 'react';
import { fetchNotifications, postNotificationsMarkRead } from '../lib/api';

/**
 * Recent document uploads for the bell + unread count (persisted in DB per user).
 */
export function useNotifications(enabled) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const res = await fetchNotifications();
    if (res.kind === 'ok') {
      setItems(Array.isArray(res.data.items) ? res.data.items : []);
      setUnreadCount(typeof res.data.unreadCount === 'number' ? res.data.unreadCount : 0);
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    function bump() {
      refresh();
    }
    window.addEventListener('medsupply:notifications-refresh', bump);
    return () => window.removeEventListener('medsupply:notifications-refresh', bump);
  }, [enabled, refresh]);

  const markAllRead = useCallback(async () => {
    const res = await postNotificationsMarkRead();
    if (res.kind === 'ok') {
      await refresh();
    }
  }, [refresh]);

  return { items, unreadCount, loading, refresh, markAllRead };
}
