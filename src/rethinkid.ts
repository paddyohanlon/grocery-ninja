import { RethinkID, TableAPI } from "@rethinkid/rethinkid-js-sdk";
import type { Options } from "@rethinkid/rethinkid-js-sdk";
import type { List } from "@/types";

console.log("app ID", import.meta.env.VITE_APP_ID);

const config: Options = {
  appId: import.meta.env.VITE_APP_ID,
  loginRedirectUri: import.meta.env.VITE_REDIRECT_URI,
  onApiConnectError: (rid, message) => {
    console.log("onApiConnectError callback fired! Message:", message);

    if (message.includes("invalid_token")) {
      rid.logOut();
    }
  },
};

if (import.meta.env.DEV) {
  config.oAuthUri = "http://localhost:3377";
  config.dataApiUri = "http://localhost:3377";
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
        type: "read",
        userId: "*",
        tableName: LISTS_TABLE_NAME,
        condition: {
          matchUserId: "userIDsWithAccess",
        },
      },
      {
        type: "insert",
        userId: "*",
        tableName: LISTS_TABLE_NAME,
        condition: {
          matchUserId: "userIDsWithAccess",
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
