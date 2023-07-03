import { RethinkID, TableAPI } from "@rethinkid/rethinkid-js-sdk";
import type { Options } from "@rethinkid/rethinkid-js-sdk";
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
const CONTENT_SHARERS_TABLE_NAME = "content_sharers";
export const SETTINGS_TABLE_NAME = "settings";

export const listsTable = rid.table(LISTS_TABLE_NAME, {
  onCreate: async () => {
    console.log("set permissions to matchUserId on userIDsWithAccess");
    await rid.permissions.set([
      {
        type: "read", // private sort of
        userId: "*",
        tableName: LISTS_TABLE_NAME,
        condition: {
          matchUserId: "userIDsWithAccess",
        },
      },
      {
        type: "insert", // public with matchUserId, others must be written to first
        userId: "*", // optional if using matchUserId
        tableName: LISTS_TABLE_NAME,
        condition: {
          matchUserId: "userIDsWithAccess", // matchUserIdField
        },
      },
      {
        type: "update",
        userId: "*",
        tableName: LISTS_TABLE_NAME,
        condition: {
          matchUserId: "userIDsWithAccess",
        },
      },
      {
        type: "delete",
        userId: "*",
        tableName: LISTS_TABLE_NAME,
        condition: {
          matchUserId: "userIDsWithAccess",
        },
      },
    ]);
  },
});

export const orderTable = rid.table(ORDER_TABLE_NAME, {
  onCreate: async () => {
    console.log("insert after create order table");
    await rid.table(ORDER_TABLE_NAME).insert({ id: LISTS_TABLE_NAME, order: [] });
  },
});

export const contentSharersTable = rid.table(CONTENT_SHARERS_TABLE_NAME);

export const SETTING_USERNAME = "username";
export const SETTING_PRIMARY_LIST_ID = "primaryListId";
export const SETTING_AUTO_HANDLE_INVITATIONS = "autoHandleInvitations";

export const settingsTable = rid.table(SETTINGS_TABLE_NAME, {
  onCreate: async () => {
    await rid.table(SETTINGS_TABLE_NAME).insert({ id: SETTING_USERNAME, value: "" });
    await rid.table(SETTINGS_TABLE_NAME).insert({ id: SETTING_PRIMARY_LIST_ID, value: "" });
    await rid.table(SETTINGS_TABLE_NAME).insert({ id: SETTING_AUTO_HANDLE_INVITATIONS, value: true });

    // give permissions to 'username' row to userId *
    await rid.permissions.set([
      {
        type: "read",
        userId: "*",
        tableName: SETTINGS_TABLE_NAME,
        condition: {
          rowId: SETTING_USERNAME,
        },
      },
    ]);
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
  console.log("Get", localItemName);
  if (window.navigator.onLine) {
    const data = await APICallClosure();
    localStorage.setItem(localItemName, JSON.stringify(data));
    console.log("online: get from API:", data);
    return data;
  }
  const data = getLocalData(localItemName);
  console.log("offline: get from localStorage:", data);
  return data;
}

export const LISTS_LOCAL_ITEM_NAME = "lists";

export async function syncData() {
  if (!window.navigator.onLine) return null;
  console.log("Sync data");
  const localLists = getLocalData(LISTS_LOCAL_ITEM_NAME) as List[];
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
export const contentSharersConfig = createDataConfig(() => contentSharersTable.read(), "contentSharers");
export const contactsListConfig = createDataConfig(() => rid.contacts.list(), "contactsList");
