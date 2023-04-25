import { defineStore } from "pinia";

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    notifications: [] as string[],
  }),
  actions: {
    addNotification(message: string): void {
      this.notifications.push(message);

      setTimeout(() => {
        this.notifications.shift();
      }, 5000);
    },
  },
});
