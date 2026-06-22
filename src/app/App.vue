<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import { routes } from "./routes";
import { useSpecificationState } from "../state/specificationState";

const state = useSpecificationState();
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink class="tb-logo" :to="routes.landing" aria-label="Specification Reader home">
        <span class="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="m12 3 9 5-9 5-9-5 9-5Zm5.85 12.02L12 18.27l-5.85-3.25L3 16.77l9 5 9-5-3.15-1.75Zm0-4L12 14.27l-5.85-3.25L3 12.77l9 5 9-5-3.15-1.75Z"
            />
          </svg>
        </span>
        <span class="tb-logo-text">Spec <em>Viewer</em></span>
      </RouterLink>

      <nav class="tb-nav" aria-label="Main navigation">
        <RouterLink :to="routes.specToSpec">Spec-to-Spec</RouterLink>
        <RouterLink :to="routes.primer">Primer</RouterLink>
        <RouterLink :to="routes.specExplorer">Explorer</RouterLink>
      </nav>
    </header>

    <main class="app-main">
      <section v-if="state.selectedSpecification" class="context-strip">
        <span>Active specification</span>
        <strong>{{ state.selectedSpecification.title }}</strong>
        <span>{{ state.detailMode }} mode</span>
      </section>

      <RouterView />
    </main>
  </div>
</template>
