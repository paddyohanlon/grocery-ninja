import { defineStore } from "pinia";
import { settingsTable, SETTING_PRIMARY_LIST_ID, getAPIOrLocalData, userInfoConfig, settingsConfig } from "@/rethinkid";

export const useUserStore = defineStore("user", {
  state: () => ({
    loggedIn: false,
    userId: "",
    primaryListId: "",
  }),
  actions: {
    setLoggedIn(status: boolean): void {
      this.loggedIn = status;
    },
    async fetchUserInfo(): Promise<void> {
      const userInfo = await getAPIOrLocalData(userInfoConfig);
      this.userId = userInfo.id;
    },
    async fetchSettings(): Promise<void> {
      const settings = (await getAPIOrLocalData(settingsConfig)) as any[];

      const primaryListId = settings.find((setting) => setting.id === SETTING_PRIMARY_LIST_ID);
      this.primaryListId = primaryListId.value;
    },
    async updatePrimaryListId(id: string): Promise<void> {
      this.primaryListId = id;
      await settingsTable.update({ id: SETTING_PRIMARY_LIST_ID, value: id });
    },
  },
});
