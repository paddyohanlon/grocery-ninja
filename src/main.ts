import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";

import BaseLayout from "./components/BaseLayout.vue";

import "./assets/main.css";

const app = createApp(App);

app.component("BaseLayout", BaseLayout);

const pinia = createPinia();

app.use(pinia);

app.use(router);

app.mount("#app");
