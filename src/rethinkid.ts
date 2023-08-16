import { RethinkID, TableAPI } from "@rethinkid/rethinkid-js-sdk";
import type { Options, FilterObject } from "@rethinkid/rethinkid-js-sdk";
import type { List, ReadDataConfig } from "@/types";

const config: Options = {
  appId: import.meta.env.VITE_RETHINKID_APP_ID,
  // loginRedirectUri: 'http://localhost:8080',
  loginRedirectUri: import.meta.env.VITE_RETHINKID_REDIRECT_URI,
  onApiConnectError: (rid, message) => {
    console.log("onApiConnectError callback fired! Message:", message);

    if (message.includes("invalid_token")) {
      rid.logOut();
    }
  },
};

if (import.meta.env.VITE_RETHINKID_USE_MOCK || import.meta.env.DEV) {
  config.oAuthUri = import.meta.env.VITE_RETHINKID_MOCK_SERVER_URL;
  config.dataApiUri = import.meta.env.VITE_RETHINKID_MOCK_SERVER_URL;
}

export const rid = new RethinkID(config);

export const LISTS_TABLE_NAME = "lists";
const ORDER_TABLE_NAME = "order";
export const SETTINGS_TABLE_NAME = "settings";

export const listsTable = rid.table(LISTS_TABLE_NAME);

export const orderTable = rid.table(ORDER_TABLE_NAME, {
  onCreate: async () => {
    await rid.table(ORDER_TABLE_NAME).insert({ id: LISTS_TABLE_NAME, order: [] });
  },
});

export const SETTING_PRIMARY_LIST_ID = "primaryListId";

export const settingsTable = rid.table(SETTINGS_TABLE_NAME, {
  onCreate: async () => {
    await rid.table(SETTINGS_TABLE_NAME).insert({ id: SETTING_PRIMARY_LIST_ID, value: "" });
  },
});

export async function getOwnedOrSharedListsTable(list: List): Promise<TableAPI> {
  return rid.table(LISTS_TABLE_NAME, { userId: list.hostId });
}

// Data fetch config

export function getLocalData(localItemName: string): any {
  const dataJSONString = localStorage.getItem(localItemName);
  if (!dataJSONString) return null;
  return JSON.parse(dataJSONString);
}

export async function getAPIOrLocalData({ APICallClosure, localItemName }: ReadDataConfig): Promise<any> {
  // console.log("Get", localItemName);
  if (window.navigator.onLine) {
    const data = await APICallClosure();
    localStorage.setItem(localItemName, JSON.stringify(data));
    // console.log("online: get from API:", data);
    return data;
  }
  const data = getLocalData(localItemName);
  // console.log("offline: get from localStorage:", data);
  return data;
}

export const LISTS_LOCAL_ITEM_NAME = "lists";

export async function syncData() {
  if (!window.navigator.onLine) return null;
  const localLists = getLocalData(LISTS_LOCAL_ITEM_NAME) as List[] | null;
  if (!localLists) {
    console.log("No local data");
    return;
  }
  for (const list of localLists) {
    if (list.needsSync) {
      delete list.needsSync;
      await replaceListAPI(list);
    }
  }
}

export async function replaceListAPI(list: List) {
  const listsTable = await getOwnedOrSharedListsTable(list);
  listsTable.replace(list);
  await replaceListLocal(list);
}

function replaceListLocal(updatedList: List) {
  const listsJSONString = localStorage.getItem(LISTS_LOCAL_ITEM_NAME);
  if (!listsJSONString) return null;
  const lists = getLocalData(LISTS_LOCAL_ITEM_NAME) as List[];
  console.log("replace list in localStorage:", updatedList.name);
  const updatedLists = lists.map((list) => (list.id === updatedList.id ? updatedList : list));
  localStorage.setItem(LISTS_LOCAL_ITEM_NAME, JSON.stringify(updatedLists));
}

export async function replaceListAPIOrLocalData(list: List) {
  if (window.navigator.onLine) {
    console.log("replace online");
    await replaceListAPI(list);
    return;
  }
  console.log("replace offline");
  list.needsSync = true;
  replaceListLocal(list);
}

export function createDataConfig(APICallClosure: () => Promise<any>, localItemName: string): ReadDataConfig {
  const dataConfig = {
    APICallClosure,
    localItemName,
  };
  Object.freeze(dataConfig);
  return dataConfig;
}

export const userInfoConfig = createDataConfig(() => rid.users.getInfo(), "userInfo");
export const settingsConfig = createDataConfig(() => settingsTable.read(), "settings");
export const listsConfig = createDataConfig(() => listsTable.read(), LISTS_LOCAL_ITEM_NAME);
export const listsOrderDocConfig = createDataConfig(
  () => orderTable.read({ rowId: LISTS_TABLE_NAME }),
  "listsOrderDoc",
);
export const contactsListConfig = createDataConfig(() => rid.contacts.list(), "contactsList");

// Enhanced subscribe

type Changes = {
  new_val: null | object;
  old_val: null | object;
};

type Handlers = {
  onAdd?: (item: object) => void;
  onUpdate?: (newItem: object, oldItem: object) => void;
  onDelete?: (item: object) => void;
};

type SubscribeOptions = {
  rowId?: string;
  filter?: FilterObject;
};

export function enhancedSubscribe(table: TableAPI, options: SubscribeOptions, handlers: Handlers) {
  const isAdded = (changes: Changes) => changes.new_val && changes.old_val === null;
  const isUpdated = (changes: Changes) => changes.new_val && changes.old_val;
  const isDeleted = (changes: Changes) => changes.new_val === null && changes.old_val;

  table.subscribe(options, (changes: Changes) => {
    if (isAdded(changes) && handlers.onAdd) {
      handlers.onAdd(changes.new_val as object);
    } else if (isUpdated(changes) && handlers.onUpdate) {
      handlers.onUpdate(changes.new_val as object, changes.old_val as object);
    } else if (isDeleted(changes) && handlers.onDelete) {
      handlers.onDelete(changes.old_val as object);
    }
  });
}
