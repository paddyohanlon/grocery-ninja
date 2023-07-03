import { defineStore } from "pinia";
import { useUserStore } from "@/stores/user";
import type { List, NewList, ListItem, OrderTableDoc, ContentSharer } from "@/types";
import {
  listsTable,
  orderTable,
  LISTS_TABLE_NAME,
  contentSharersTable,
  SETTINGS_TABLE_NAME,
  SETTING_USERNAME,
  getAPIOrLocalData,
  createDataConfig,
  listsConfig,
  listsOrderDocConfig,
  contentSharersConfig,
  replaceListAPIOrLocalData,
} from "@/rethinkid";
import type { TableAPI } from "@rethinkid/rethinkid-js-sdk";
import { v4 as uuidv4 } from "uuid";
import { rid, getOwnedOrSharedListsTable } from "@/rethinkid";

export const useListsStore = defineStore("lists", {
  state: () => ({
    lists: null as List[] | null,
    listsOrder: [] as string[], // list IDs
    contentSharers: null as ContentSharer[] | null,
  }),
  actions: {
    async addContentSharer(hostId: string): Promise<void> {
      const contentSharer: ContentSharer = { id: hostId, username: "" };

      try {
        // ID might already exist which is fine
        await contentSharersTable.insert(contentSharer);

        if (!this.contentSharers) this.contentSharers = [];
        if (this.contentSharers.some((sharer) => sharer.id === contentSharer.id)) return;
        this.contentSharers.push(contentSharer);
      } catch (e: any) {
        console.log("addContentSharer error:", e.message);
      }
    },
    // Fetch lists and usernames shared with me
    async fetchContentSharedWithMe(): Promise<void> {
      if (!this.lists) this.lists = [];

      try {
        this.contentSharers = (await getAPIOrLocalData(contentSharersConfig)) as ContentSharer[];

        for (const sharer of this.contentSharers) {
          console.log("sharer", sharer);
          const hostId = sharer.id;

          try {
            // Get content sharer username:
            // Fetch from `username` row of `settings` table of hostId
            const sharerSettingsTable = rid.table(SETTINGS_TABLE_NAME, { userId: hostId });
            const usernameRowConfig = createDataConfig(
              () => sharerSettingsTable.read({ rowId: SETTING_USERNAME }),
              `usernameRow_${hostId}`,
            );
            const usernameRow = (await getAPIOrLocalData(usernameRowConfig)) as {
              id: string;
              value: string;
            };
            console.log("usernameRow.value", usernameRow.value);
            sharer.username = usernameRow.value;

            // Save to contentSharers local state
          } catch (e: any) {
            console.log("sharer username error", e.message);
          }

          // Get shared lists
          const sharedListsTable = rid.table(LISTS_TABLE_NAME, { userId: hostId }) as TableAPI;
          const sharedListsConfig = createDataConfig(() => sharedListsTable.read(), `sharedLists_${hostId}`);
          const sharedLists = (await getAPIOrLocalData(sharedListsConfig)) as List[];

          if (!sharedLists || (sharedLists && sharedLists.length === 0)) return;

          for (const list of sharedLists) {
            this.lists.push(list);
          }

          // Subscribe
          if (window.navigator.onLine) {
            sharedListsTable.subscribe({}, (changes) => {
              console.log("Subscribe changers for host ID:", hostId);

              //  added
              if (changes.new_val && changes.old_val === null) {
                console.log("Added", changes.new_val);
              }
              // deleted
              if (changes.new_val === null && changes.old_val) {
                console.log("A list shared with me was deleted", changes.old_val);
                const deletedList = changes.old_val as List;

                // Remove list from local state
                if (!this.lists) return;

                this.lists = this.lists.filter((list) => list.id !== deletedList.id);
              }
              // updated
              if (changes.new_val && changes.old_val) {
                console.log("Updated", changes.new_val);
                const updatedList = changes.new_val as List;

                if (!this.lists) return;

                this.lists = this.lists.map((list) => {
                  if (list.id === updatedList.id) {
                    return updatedList;
                  }
                  return list;
                });
              }
            });
          }
        }
      } catch (e) {
        console.log("fetchContentSharedWithMe error", e);
      }
    },
    async fetchLists(): Promise<void> {
      let lists = [] as List[];
      try {
        lists = (await getAPIOrLocalData(listsConfig)) as List[];
      } catch (e) {
        console.log("read lists error", e);
      }

      if (lists.length === 0) {
        console.log("create default list");
        // Create default list
        await this.createList("Groceries");
        return;
      }

      let listsOrderDoc = null;
      try {
        listsOrderDoc = (await getAPIOrLocalData(listsOrderDocConfig)) as OrderTableDoc;
      } catch (e) {
        console.log("error reading order", e);
      }

      if (!listsOrderDoc) {
        console.log("listsOrderDoc null, return");
        return;
      }

      this.listsOrder = listsOrderDoc.order;

      const orderedLists = listsOrderDoc.order.map((id) => {
        const foundList = lists.find((list) => {
          return list.id === id;
        });
        return foundList;
      }) as List[];

      this.lists = orderedLists;
    },
    async createList(name: string): Promise<string> {
      const userStore = useUserStore();

      const newList: NewList = {
        name,
        items: [],
        archived: false,
        userIDsWithAccess: [],
        hostId: userStore.userId,
      };

      const id = await listsTable.insert(newList);

      const firstId = id[0];

      if (!this.lists || (this.lists && this.lists.length === 0)) {
        await userStore.updatePrimaryListId(firstId);
      }

      this.listsOrder.push(firstId);
      const orderDoc: OrderTableDoc = { id: LISTS_TABLE_NAME, order: this.listsOrder };
      await orderTable.update(orderDoc);

      const list: List = {
        id: firstId,
        ...newList,
      };

      if (!this.lists) this.lists = [];

      this.lists.push(list);

      return firstId;
    },
    async updateList(updatedList: List): Promise<void> {
      if (!this.lists) return;

      this.lists = this.lists.map((list) => {
        if (list.id === updatedList.id) {
          return updatedList;
        }
        return list;
      });

      const listsTable = await getOwnedOrSharedListsTable(updatedList);
      listsTable.update(updatedList);
    },
    async deleteList(deletedList: List): Promise<void> {
      if (!this.lists) return;

      this.lists = this.lists.filter((list) => {
        return list.id !== deletedList.id;
      });

      const listsTable = await getOwnedOrSharedListsTable(deletedList);
      listsTable.delete({ rowId: deletedList.id });

      const index = this.listsOrder.indexOf(deletedList.id);
      if (index > -1) {
        this.listsOrder.splice(index, 1);
      }
      const orderDoc: OrderTableDoc = { id: LISTS_TABLE_NAME, order: this.listsOrder };

      try {
        await orderTable.replace(orderDoc);
      } catch (e) {
        console.log("ordertable update e", e);
      }

      try {
        (await orderTable.read({ rowId: LISTS_TABLE_NAME })) as OrderTableDoc;
      } catch (e) {
        console.log("error reading order", e);
      }

      // Set as new primary list
      const userStore = useUserStore();
      if (deletedList.id === userStore.primaryListId) {
        userStore.updatePrimaryListId(this.listsOrder[0]);
      }
    },
    removeNeedsSync(): void {
      console.log("removeNeedsSync");
      if (!this.lists) return;
      for (const list of this.lists) {
        if (list.needsSync) delete list.needsSync;
      }
    },
    async addItem(listId: string, itemName: string): Promise<void> {
      const list = this.getList(listId);

      if (!list) return;

      const newItem: ListItem = {
        id: uuidv4(),
        name: itemName,
        price: 0,
        vendor: "",
        quantity: 0,
        notes: "",
        checked: false,
      };

      list.items.push(newItem);

      await replaceListAPIOrLocalData(list);
    },
    async updateItem(listId: string, updatedItem: ListItem) {
      const list = this.getList(listId);

      if (!list) return;

      list.items = list.items.map((item) => {
        if (item.id === updatedItem.id) {
          return updatedItem;
        }
        return item;
      });

      await replaceListAPIOrLocalData(list);
    },
    async deleteItem(listId: string, itemId: string) {
      const list = this.getList(listId);

      if (!list) return;

      list.items = list.items.filter((item) => item.id !== itemId);

      try {
        await replaceListAPIOrLocalData(list);
      } catch (e) {
        console.log("error deleting item", e);
      }
    },
  },
  getters: {
    getSharerUsername: (state): ((userId: string) => string) => {
      return (userId: string) => {
        const sharer = state.contentSharers?.find((sharer) => sharer.id === userId);
        return sharer && sharer.username ? sharer.username : userId;
      };
    },
    getList: (state): ((listId: string) => List | null) => {
      return (listId: string) => {
        if (!state.lists) return null;

        const list = state.lists.find((list) => list.id === listId);

        if (!list) {
          console.log("List not found.");
          return null;
        }

        return list;
      };
    },
    getItem: (state): ((listId: string, itemId: string) => ListItem | null) => {
      return (listId: string, itemId: string) => {
        // @ts-ignore - getter does exist
        const list = state.getList(listId) as List | null;

        if (!list) return null;

        const item = list.items.find((item) => item.id === itemId);

        if (!item) {
          console.log("Item not found.");
          return null;
        }

        return item;
      };
    },
    getCheckedItems: (state): ((listId: string) => ListItem[]) => {
      return (listId: string) => {
        // @ts-ignore - getter does exist
        const list = state.getList(listId) as List | null;

        if (!list) return [];

        const items = list.items.filter((item) => item.checked);

        items.reverse();

        return items;
      };
    },
    getUncheckedItems: (state): ((listId: string) => ListItem[]) => {
      return (listId: string) => {
        // @ts-ignore - getter does exist
        const list = state.getList(listId) as List | null;

        if (!list) return [];

        const items = list.items.filter((item) => !item.checked);

        items.reverse();

        return items;
      };
    },
    getMyLists: (state): List[] => {
      if (!state.lists) return [];

      const userStore = useUserStore();

      return state.lists.filter((list) => list.hostId === userStore.userId);
    },
  },
});
