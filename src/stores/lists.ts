import { defineStore } from "pinia";
import { useUserStore } from "@/stores/user";
import type { List, NewList, ListItem, OrderTableDoc } from "@/types";
import {
  rid,
  getOwnedOrSharedListsTable,
  listsTable,
  orderTable,
  LISTS_TABLE_NAME,
  getAPIOrLocalData,
  listsConfig,
  listsOrderDocConfig,
  replaceListAPIOrLocalData,
  enhancedSubscribe,
} from "@/rethinkid";
import { v4 as uuidv4 } from "uuid";

export const useListsStore = defineStore("lists", {
  state: () => ({
    lists: null as List[] | null,
    listsOrder: [] as string[], // list IDs
  }),
  actions: {
    async fetchSharedLists(): Promise<void> {
      try {
        const sharedItems = await rid.sharing.listShared();

        for (const item of sharedItems) {
          const hostId = item.hostId;
          const tableName = item.permission?.tableName;
          const rowId = item.permission?.condition?.rowId;

          if (!tableName) continue;
          if (tableName !== LISTS_TABLE_NAME) continue;
          if (!rowId) continue;

          console.log("hostId", hostId);
          console.log("tableName", tableName);
          console.log("rowId", rowId);

          // Get list
          const hostTable = rid.table(tableName, { userId: hostId });
          const sharedList = (await hostTable.read({ rowId })) as List;

          if (!this.lists) this.lists = [] as List[];

          this.lists.push(sharedList);

          if (!window.navigator.onLine) return;

          enhancedSubscribe(
            hostTable,
            { rowId },
            {
              onUpdate: (newItem) => {
                const updatedList = newItem as List;
                if (!this.lists) return;
                this.lists = this.lists.map((list) => {
                  if (list.id === updatedList.id) return updatedList;
                  return list;
                });
              },
              onDelete: (item) => {
                const deletedList = item as List;
                if (!this.lists) return;
                this.lists = this.lists.filter((list) => list.id !== deletedList.id);
              },
            },
          );
        }
      } catch (e) {
        console.log("fetchSharedLists error", e);
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
        // console.log("create default list");
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
    getList: (state): ((listId: string) => List | null) => {
      return (listId: string) => {
        if (!state.lists) return null;

        let list = state.lists.find((list) => list.id === listId);

        if (!list) list = state.listsShared.find((list) => list.id === listId);

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
