export function requestSupportNotificationPermission() {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window)
  ) {
    return;
  }

  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

export function showSupportNotification({
  title = 'School Mentor Support',
  body = 'New support message received',
} = {}) {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window)
  ) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'school-mentor-support',
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.error('Support notification error:', error);
  }
}