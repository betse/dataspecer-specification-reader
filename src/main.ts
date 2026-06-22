import { createApp } from "vue";
import App from "./app/App.vue";
import { router } from "./app/router";
import "./shared/styles/base.css";

createApp(App).use(router).mount("#app");
