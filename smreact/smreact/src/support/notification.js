export function requestNotificationPermission() {

    if (!("Notification" in window)) return;

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}


export function showSupportNotification({title, body}) {

    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {

        new Notification(title, {
            body: body,
            icon: "/logo.png"
        });

    }
}