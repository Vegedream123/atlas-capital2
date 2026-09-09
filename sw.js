// Service worker Atlas Capital — notifications push
// Ce fichier tourne en arrière-plan, même quand le site n'est pas ouvert,
// et affiche les notifications reçues du serveur directement sur l'appareil
// (barre de notifications du téléphone / ordinateur), comme une app native.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let data = { title: 'Atlas Capital', body: '', url: '/dashboard.html' };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch (e) {
        if (event.data) data.body = event.data.text();
    }

    const options = {
        body: data.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        // "image" = grande bannière affichée dans la notification déployée
        // (parfait pour une annonce/promo). Ignoré si absent, aucun risque.
        image: data.image || undefined,
        data: { url: data.url || '/dashboard.html' },
        vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

// Au clic sur la notification : ouvre (ou remet au premier plan) le tableau de bord.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard.html';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
            for (const client of clientsArr) {
                if (client.url.includes('dashboard.html') && 'focus' in client) {
                    // L'onglet est déjà ouvert : on le fait naviguer vers le
                    // message précis (?notif=<id>) avant de le mettre au
                    // premier plan, sinon il resterait sur l'écran où il
                    // était et l'utilisateur ne verrait jamais le message.
                    if ('navigate' in client) {
                        return client.navigate(targetUrl).then((navigated) => (navigated || client).focus());
                    }
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
