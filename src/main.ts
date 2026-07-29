import { createApp } from "vue";
import App from "./app/App.vue";
import { router } from "./app/router";
import "./main.css";

createApp(App).use(router).mount("#app");
