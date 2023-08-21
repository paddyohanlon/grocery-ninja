import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";

import BaseLayout from "./components/BaseLayout.vue";

// import { useRethinkIdPiniaPlugin } from "./pinia/plugin";

import "./assets/main.css";

const app = createApp(App);

app.component("BaseLayout", BaseLayout);

const pinia = createPinia();

// import type { List } from "./types";
// declare module "pinia" {
//   export interface PiniaCustomProperties {
//     set lists(value: List[]);
//     get lists(): List[];
//   }
// }

// pinia.use(useRethinkIdPiniaPlugin("lists", ["lists"]));

app.use(pinia);

app.use(router);

app.mount("#app");
