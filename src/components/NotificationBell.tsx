import React, { useMemo, useState } from 'react';
import { Bell, X, Check, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

type NotificationType = 'info' | 'success' | 'warning';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  is_read: number;
  created_at: string;
}

const fallbackNotifications: Notification[] = [
  {
    id: 'system-ready',
    message:
      'Inventory, Purchases, Kitchen, and Campus Orders workflows are now active.',
    type: 'success',
    is_read: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'convex-notifications-coming',
    message:
      'Live notifications will be connected later through Convex for low stock, pending orders, and payment reviews.',
    type: 'info',
    is_read: 0,
    created_at: new Date().toISOString(),
  },
];

function getNotificationIcon(type: NotificationType) {
  if (type === 'success') return CheckCircle2;
  if (type === 'warning') return AlertTriangle;
  return Info;
}

export function NotificationBell() {
  const [notifications, setNotifications] =
    useState<Notification[]>(fallbackNotifications);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? { ...notification, is_read: 1 }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        is_read: 1,
      }))
    );
  };

  const clearNotification = (id: string) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 z-30 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-brand-text">Notifications</h3>
                <p className="text-xs text-brand-text-muted">
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : 'All caught up'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs font-semibold text-brand-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Bell className="mx-auto mb-3 text-gray-300" size={32} />
                  <p className="text-sm font-medium">No notifications yet</p>
                  <p className="text-xs mt-1">
                    Alerts will appear here once Convex notifications are added.
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        !notification.is_read ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            notification.type === 'success'
                              ? 'bg-green-50 text-green-700'
                              : notification.type === 'warning'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          <Icon size={17} />
                        </div>

                        <div className="flex-1">
                          <div className="flex justify-between gap-2">
                            <p
                              className={`text-sm leading-relaxed ${
                                !notification.is_read
                                  ? 'font-medium text-brand-text'
                                  : 'text-brand-text-muted'
                              }`}
                            >
                              {notification.message}
                            </p>

                            <div className="flex items-start gap-2 shrink-0">
                              {!notification.is_read && (
                                <button
                                  type="button"
                                  onClick={() => markAsRead(notification.id)}
                                  className="text-brand-primary hover:text-brand-primary/80"
                                  title="Mark as read"
                                >
                                  <Check size={16} />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => clearNotification(notification.id)}
                                className="text-gray-300 hover:text-gray-500"
                                title="Clear notification"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>

                          <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-brand-text-muted">
                This is a temporary local notification panel. We will connect it to Convex later.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}