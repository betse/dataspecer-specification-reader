import { createRouter, createWebHistory } from "vue-router";
import { routes } from "./routes";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: routes.landing,
      name: "landing",
      component: () => import("../modules/spec-loader/LandingView.vue"),
    },
    {
      path: routes.specToSpec,
      name: "spec-to-spec",
      component: () => import("../modules/spec-to-spec/SpecToSpecView.vue"),
    },
    {
      path: routes.primer,
      name: "primer",
      component: () => import("../modules/primer/PrimerView.vue"),
    },
    {
      path: routes.specExplorer,
      name: "explorer",
      component: () => import("../modules/spec-explorer/SpecExplorerView.vue"),
    },
  ],
});
