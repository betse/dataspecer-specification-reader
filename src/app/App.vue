<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import type { DetailMode } from "../state/specification-state";
import { useSpecificationState } from "../state/specification-state";
import { routes } from "./router";

import { loadSpecificationFromUrl } from "../data/loading/load-specification-from-url";

type Theme = "light" | "dark";

const state = useSpecificationState();
const route = useRoute();
const restoring = ref(false);
const restoreError = ref<string>();
const retryCount = ref(0);

// Restore metadata on any reader page, including direct links and browser history.
watch(
  () => [route.path, route.query.specificationUrl, retryCount.value] as const,
  async ([path, source], _previous, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    restoring.value = false;
    restoreError.value = undefined;
    if (path === routes.landing || typeof source !== "string" || !source.trim()) return;
    if (state.specification?.metadata.sourceUrl === source) return;
    restoring.value = true;
    try {
      const specification = await loadSpecificationFromUrl(source);
      if (!cancelled) state.setSpecification(specification);
    } catch (error) {
      if (!cancelled)
        restoreError.value =
          error instanceof Error ? error.message : "Unable to load specification.";
    } finally {
      if (!cancelled) restoring.value = false;
    }
  },
  { immediate: true },
);
const settingsOpen = ref(false);
const theme = ref<Theme>("light");
const settingsWrap = useTemplateRef("settingsWrap");

onMounted(() => {
  const savedTheme = globalThis.localStorage.getItem("sv-theme");
  theme.value = savedTheme === "dark" ? "dark" : "light";
  applyTheme();

  const savedMode = globalThis.localStorage.getItem("sv-mode");
  if (savedMode === "simple" || savedMode === "detailed") state.setDetailMode(savedMode);
  globalThis.document.addEventListener("click", closeSettingsOutside);
});

onUnmounted(() => globalThis.document.removeEventListener("click", closeSettingsOutside));

function toggleTheme() {
  theme.value = theme.value === "light" ? "dark" : "light";
  globalThis.localStorage.setItem("sv-theme", theme.value);
  applyTheme();
}

function applyTheme() {
  globalThis.document.documentElement.dataset.theme = theme.value;
}

function setMode(mode: DetailMode) {
  state.setDetailMode(mode);
  globalThis.localStorage.setItem("sv-mode", mode);
}

function closeSettingsOutside(event: unknown) {
  const target = (event as { target?: unknown }).target;
  if (!(target instanceof globalThis.Node) || !settingsWrap.value?.contains(target)) {
    settingsOpen.value = false;
  }
}
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
        <template v-if="state.specification">
          <RouterLink :to="routes.specToSpec">Spec-to-Spec</RouterLink>
          <RouterLink :to="routes.primer">Primer</RouterLink>
          <RouterLink :to="routes.specExplorer">Explorer</RouterLink>
          <span class="tb-separator"></span>
        </template>
        <a href="https://dataspecer.com" target="_blank" rel="noreferrer">Dataspecer ↗</a>
        <span class="tb-separator"></span>

        <div ref="settingsWrap" class="settings-wrap">
          <button
            class="topbar-icon-btn"
            type="button"
            title="Settings"
            aria-label="Settings"
            :aria-expanded="settingsOpen"
            @click="settingsOpen = !settingsOpen"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.38 1.1V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .38-1.1V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06A2 2 0 1 1 19.71 7l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.31.42.56.75.68.17.06.35.09.54.09H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"
              />
            </svg>
          </button>
          <div v-if="settingsOpen" class="settings-panel">
            <div class="settings-title">Display mode</div>
            <div class="mode-options">
              <label class="mode-radio" :class="{ selected: state.detailMode === 'simple' }">
                <input
                  type="radio"
                  name="display-mode"
                  value="simple"
                  :checked="state.detailMode === 'simple'"
                  @change="setMode('simple')"
                />
                <span class="radio-dot"></span>Simple
              </label>
              <label class="mode-radio" :class="{ selected: state.detailMode === 'detailed' }">
                <input
                  type="radio"
                  name="display-mode"
                  value="detailed"
                  :checked="state.detailMode === 'detailed'"
                  @change="setMode('detailed')"
                />
                <span class="radio-dot"></span>Detail
              </label>
            </div>
          </div>
        </div>

        <button
          class="topbar-icon-btn"
          type="button"
          title="Toggle theme"
          :aria-label="`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`"
          @click="toggleTheme"
        >
          <svg
            v-if="theme === 'light'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
          </svg>
        </button>
      </nav>
    </header>

    <main class="app-main" :class="`app-main--${String($route.name)}`">
      <section v-if="restoring" role="status" class="route-status">
        <h1>Loading specification…</h1>
      </section>
      <section v-else-if="restoreError" role="alert" class="route-status">
        <h1>Unable to load specification</h1>
        <p>{{ restoreError }}</p>
        <button type="button" @click="retryCount++">Retry</button>
        <RouterLink :to="routes.landing">Choose another specification</RouterLink>
      </section>
      <RouterView v-else />
    </main>
  </div>
</template>

<style scoped>
.route-status {
  padding: 2rem;
  color: var(--text);
}
.route-status button {
  margin-right: 1rem;
}
</style>
