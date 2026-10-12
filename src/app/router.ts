import { createRouter, createWebHashHistory } from "vue-router";

import { useSpecificationState } from "../state/specification-state";

export const routes = {
  landing: "/",
  specToSpec: "/spec-to-spec",
  primer: "/primer",
  specExplorer: "/spec-explorer",
} as const;

export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
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

// Preserve the source on navigation so every reader page can be shared or refreshed.
router.beforeEach((to, from) => {
  if (to.path === routes.landing || to.query.specificationUrl) return;
  const source =
    from.query.specificationUrl ?? useSpecificationState().specification?.metadata.sourceUrl;
  if (source)
    return {
      path: to.path,
      query: { ...to.query, specificationUrl: source },
      hash: to.hash,
      replace: true,
    };
});
