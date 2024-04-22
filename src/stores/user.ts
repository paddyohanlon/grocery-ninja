import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";
import { bzr } from "@/bzr";

export const useUserStore = defineStore("user", {
  state: () => ({
    loggedIn: useStorage("loggedIn", false),
    userId: useStorage("userId", ""),
    name: useStorage("name", ""),
    handle: useStorage("handle", ""),
    email: useStorage("email", ""),
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

      const userInfo = await bzr.social.getUser();
      this.userId = userInfo.id;
      this.name = userInfo.name || "";
      this.email = userInfo.email || "";
      this.handle = userInfo.handle || "";
    },
  },
});
