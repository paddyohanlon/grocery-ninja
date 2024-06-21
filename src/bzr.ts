import { BazaarApp } from "@bzr/bazaar";
import type { BazaarOptions } from "@bzr/bazaar";

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
