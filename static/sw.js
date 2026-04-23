self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "HAOne";
    const options = {
      body: data.body || "You have a new update.",
      icon: "/icon-192x192.png",
      badge: "/icon-bw-72x72.png",
      data: data.url || "/resident/laundry",
      vibrate: [100, 50, 100]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error("Error parsing push data:", e);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data;

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
