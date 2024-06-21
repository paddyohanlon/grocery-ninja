import { BazaarApp } from "@bzr/bazaar";
import type { BazaarOptions, Doc, SubscribeListener } from "@bzr/bazaar";

const config: BazaarOptions = {
  appId: import.meta.env.VITE_BAZAAR_APP_ID,
  loginRedirectUri: import.meta.env.VITE_BAZAAR_REDIRECT_URI,
  onApiConnectError: async (bzr, message) => {
    console.log("On Init: onApiConnectError. Message:", message);
    if (message.includes("invalid_token")) {
      bzr.logOut();
    }
  },
};

if (import.meta.env.VITE_BAZAAR_USE_MOCK || import.meta.env.DEV) {
  console.log("Using mock urls in ENV:", import.meta.env.MODE);
  config.bazaarUri = import.meta.env.VITE_BAZAAR_MOCK_SERVER_URL;
}

export const bzr = new BazaarApp(config);

export function createSubscribeListener<T extends Doc>(storeProperty: Doc[]): SubscribeListener<T> {
  const onAdd = (doc: Doc) => {
    if (storeProperty.some((r: Doc) => r.id === doc.id)) return;
    storeProperty.push(doc);
  };

  const handleChange = (doc: Doc) => {
    storeProperty.forEach((r: Doc, index: number) => {
      if (r.id === doc.id) {
        storeProperty[index] = doc;
      }
    });
  };

  const onDelete = (doc: Doc) => {
    for (let i = storeProperty.length - 1; i >= 0; i--) {
      if (storeProperty[i].id === doc.id) {
        storeProperty.splice(i, 1);
      }
    }
  };

  const onInitial = (doc: Doc) => {
    if (storeProperty.some((r: any) => r.id === doc.id)) {
      handleChange(doc);
    } else {
      onAdd(doc);
    }
  };

  return {
    onAdd,
    onChange: (oldDoc: Doc, newDoc: Doc) => {
      handleChange(newDoc);
    },
    onDelete,
    onInitial,
  };
}
