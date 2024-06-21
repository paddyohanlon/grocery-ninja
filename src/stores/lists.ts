import { defineStore } from "pinia";
import { bzr } from "@/bzr";
import { useUserStore } from "@/stores/user";
import type { List, NewList, ListItem } from "@/types";
import { v4 as uuidv4 } from "uuid";
import {
  arrayMirrorSubscribeListener,
  type CollectionAPI,
  type GrantedPermission,
  type SubscribeListener,
} from "@bzr/bazaar";
import { useStorage } from "@vueuse/core";

export const LISTS_COLLECTION_NAME = "lists";

const myListsCollection = bzr.collection<List>(LISTS_COLLECTION_NAME);

export function getOwnedOrSharedListsCollection(ownerId: string): CollectionAPI<List> {
  return bzr.collection<List>(LISTS_COLLECTION_NAME, { userId: ownerId });
}

function replaceListOnline(list: List) {
  if (window.navigator.onLine) {
    const listsCollection = getOwnedOrSharedListsCollection(list.ownerId);
    listsCollection.replaceOne(list.id, list);
  }
}

function touchList(list: List) {
  list.lastUpdated = Date.now();
}

export const useListsStore = defineStore("lists", {
  state: () => ({
    lists: useStorage("lists", [] as List[]),
  }),
  actions: {
    async syncLists(): Promise<void> {
      // console.log("syncLists: Sync local and remote lists");

      if (!window.navigator.onLine) return;

      const ownedAndSharedRemoteLists: List[] = [];

      // Get my lists
      const myRemoteLists = (await myListsCollection.getAll()) as List[];
      ownedAndSharedRemoteLists.push(...myRemoteLists);

      // Get lists shared-with-me
      const permissionsGrantedToMe = await bzr.permissions.granted.list({
        collectionName: LISTS_COLLECTION_NAME,
      });

      for (const grantedPermission of permissionsGrantedToMe) {
        const collection = getOwnedOrSharedListsCollection(grantedPermission.ownerId);
        const docId = grantedPermission.permission?.filter?.id as string | undefined;
        if (!docId) continue;
        const remoteList = (await collection.getOne(docId)) as List;
        ownedAndSharedRemoteLists.push(remoteList);
      }

      // Sync local with remote
      for (const localList of this.lists) {
        const remoteList = ownedAndSharedRemoteLists.find((remoteList) => remoteList.id === localList.id);

        // if this local list has no corresponding remote list
        // and I don't own this list, it's probably an artifact from
        // a different account. Delete it.
        if (!remoteList) {
          const userInfo = await bzr.social.getUser();
          const myUserId = userInfo.id;

          if (localList.ownerId !== myUserId) {
            this.lists = this.lists.filter((list) => list.id !== localList.id);
          }

          continue;
        }

        // Only syncing updates, not adding or deleting lists for simplicity
        const collection = getOwnedOrSharedListsCollection(localList.ownerId);
        const mostRecentlyUpdatedList = localList.lastUpdated > remoteList.lastUpdated ? localList : remoteList;
        collection.replaceOne(localList.id, mostRecentlyUpdatedList);
      }
    },
    async mirrorMyLists(): Promise<void> {
      if (!window.navigator.onLine) return;

      myListsCollection.subscribeAll({}, arrayMirrorSubscribeListener(this.lists));
    },
    async createList(name: string): Promise<string> {
      const userStore = useUserStore();

      const newList: NewList = {
        name,
        items: [],
        archived: false,
        ownerId: userStore.userId,
        lastUpdated: Date.now(),
      };

      return myListsCollection.insertOne(newList);
    },
    async mirrorSharedWithMeLists(): Promise<void> {
      if (!window.navigator.onLine) return;

      const permissionsGrantedToMe = await bzr.permissions.granted.list({
        collectionName: LISTS_COLLECTION_NAME,
      });

      const mirrorGrantedPermission = (grantedPermission: GrantedPermission) => {
        const collection = getOwnedOrSharedListsCollection(grantedPermission.ownerId);

        const docId = grantedPermission.permission?.filter?.id as string | undefined;
        if (!docId) return;

        collection.subscribeOne(docId, arrayMirrorSubscribeListener(this.lists));
      };

      for (const grantedPermission of permissionsGrantedToMe) {
        mirrorGrantedPermission(grantedPermission);
      }

      const subscribeListener: SubscribeListener<GrantedPermission> = {
        onAdd: (doc) => {
          console.log("Granted Permission added");
          mirrorGrantedPermission(doc);
        },
        onChange: (doc) => {
          console.log("Granted Permission updated");
          mirrorGrantedPermission(doc);
        },
        onInitial: (doc) => {
          console.log("Granted Permission onInitial", doc);
        },
      };

      // Subscribe to new permissions
      bzr.permissions.granted.subscribe(
        {
          collectionName: LISTS_COLLECTION_NAME,
        },
        subscribeListener,
      );
    },
    updateList(updatedList: List): void {
      const listsCollection = getOwnedOrSharedListsCollection(updatedList.ownerId);
      touchList(updatedList);
      listsCollection.updateOne(updatedList.id, updatedList);
    },
    async deleteList(deletedList: List): Promise<void> {
      console.log("deleteList:");
      try {
        const listsCollection = getOwnedOrSharedListsCollection(deletedList.ownerId);
        await listsCollection.deleteOne(deletedList.id);
      } catch (error: any) {
        // List possibly loaded from localStorage for a user that no longer exists
        this.lists = this.lists.filter((list) => list.id !== deletedList.id);
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

      touchList(list);

      await replaceListOnline(list);
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

      touchList(list);

      await replaceListOnline(list);
    },
    async deleteItem(listId: string, itemId: string) {
      const list = this.getList(listId);

      if (!list) return;

      list.items = list.items.filter((item) => item.id !== itemId);

      touchList(list);

      await replaceListOnline(list);
    },
  },
  getters: {
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

      return state.lists.filter((list) => list.ownerId === userStore.userId);
    },
  },
});
