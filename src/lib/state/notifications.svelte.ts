import { browser } from "$app/environment";
import { toast } from "svelte-sonner";
import { savePushSubscription, deletePushSubscription } from "$lib/logic/shared-records-logic";

class NotificationManager {
  #subscription = $state<PushSubscription | null>(null);
  #permission = $state<NotificationPermission>("default");
  #isSupported = $state(false);

  constructor() {
    if (browser) {
      this.#isSupported =
        "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
      this.#permission = Notification.permission;
      this.#checkCurrentSubscription();
    }
  }

  async #checkCurrentSubscription() {
    if (!this.#isSupported) return;
    const registration = await navigator.serviceWorker.ready;
    this.#subscription = await registration.pushManager.getSubscription();
  }

  get isSupported() {
    return this.#isSupported;
  }
  get permission() {
    return this.#permission;
  }
  get isSubscribed() {
    return !!this.#subscription;
  }

  async requestPermission() {
    if (!this.#isSupported) return false;
    const result = await Notification.requestPermission();
    this.#permission = result;
    return result === "granted";
  }

  async subscribe(vapidPublicKey: string) {
    if (!this.#isSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });

      await savePushSubscription(subscription);
      this.#subscription = subscription;
      toast.success("Notifications enabled");
    } catch (e: any) {
      console.error("Subscription failed:", e);
      toast.error("Failed to enable notifications");
    }
  }

  async unsubscribe() {
    if (!this.#subscription) return;

    try {
      await deletePushSubscription(this.#subscription.endpoint);
      await this.#subscription.unsubscribe();
      this.#subscription = null;
      toast.success("Notifications disabled");
    } catch (e: any) {
      console.error("Unsubscription failed:", e);
      toast.error("Failed to disable notifications");
    }
  }
}

export const notifications = new NotificationManager();
