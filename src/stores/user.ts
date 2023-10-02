import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";
import { rid } from "@/rethinkid";

export const useUserStore = defineStore("user", {
  state: () => ({
    loggedIn: useStorage("loggedIn", false),
    userId: useStorage("userId", ""),
    online: window.navigator.onLine,
  }),
  actions: {
    listenOnline(): void {
      window.addEventListener("online", () => (this.online = true));
      window.addEventListener("offline", () => (this.online = false));
    },
    setLoggedIn(status: boolean): void {
      this.loggedIn = status;
    },
    async fetchUserInfo(): Promise<void> {
      if (!window.navigator.onLine) return;

      const userInfo = await rid.social.getUser();
      this.userId = userInfo.id;
    },
  },
});
