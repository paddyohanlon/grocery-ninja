import { RethinkID } from "@rethinkid/rethinkid-js-sdk";
import type { Options } from "@rethinkid/rethinkid-js-sdk";

const config: Options = {
  appId: import.meta.env.VITE_RETHINKID_APP_ID,
  loginRedirectUri: import.meta.env.VITE_RETHINKID_REDIRECT_URI,
  onApiConnectError: async (rid, message) => {
    console.log("On Init: onApiConnectError. Message:", message);
    if (message.includes("invalid_token")) {
      rid.logOut();
    }
  },
};

if (import.meta.env.VITE_RETHINKID_USE_MOCK || import.meta.env.DEV) {
  console.log("Using mock urls in ENV:", import.meta.env.MODE);
  config.rethinkIdUri = import.meta.env.VITE_RETHINKID_MOCK_SERVER_URL;
}

export const rid = new RethinkID(config);

export type Changes = {
  newDoc: null | object;
  oldDoc: null | object;
};

export function isAddedChange(changes: Changes) {
  return changes.newDoc && changes.oldDoc === null;
}
export function isDeletedChange(changes: Changes) {
  return changes.newDoc === null && changes.oldDoc;
}
export function isUpdatedChange(changes: Changes) {
  return changes.newDoc && changes.oldDoc;
}
