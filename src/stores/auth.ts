import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    loggedIn: false,
  }),
  actions: {
    setLoggedIn(status: boolean): void {
      this.loggedIn = status
    },
  },
})
