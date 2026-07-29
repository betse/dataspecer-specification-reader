import { createRouter, createWebHistory } from "vue-router";

export const routes = {
  landing: "/",
  specToSpec: "/spec-to-spec",
  primer: "/primer",
  specExplorer: "/spec-explorer",
} as const;

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: routes.landing,
      name: "landing",
      component: () => import("../pages/spec-loader/LandingView.vue"),
    },
    {
      path: routes.specToSpec,
      name: "spec-to-spec",
      component: () => import("../pages/spec-to-spec/SpecToSpecView.vue"),
    },
    {
      path: routes.primer,
      name: "primer",
      component: () => import("../pages/primer/PrimerView.vue"),
    },
    {
      path: routes.specExplorer,
      name: "explorer",
      component: () => import("../pages/spec-explorer/SpecExplorerView.vue"),
    },
  ],
});
