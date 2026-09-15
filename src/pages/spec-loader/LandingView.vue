<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { routes } from "../../app/router";
import { loadSpecificationFromUrl } from "../../data/loading/load-specification-from-url";
import { useSpecificationState, type DetailMode } from "../../state/specification-state";
import { defaultSpecifications, type DefaultSpecification } from "./default-specifications";

const router = useRouter();
const route = useRoute();
const state = useSpecificationState();
const sourceUrl = ref("");
const detailMode = ref<DetailMode>(state.detailMode);

onMounted(() => {
  const requestedUrl = route.query.specificationUrl;
  if (typeof requestedUrl !== "string" || !requestedUrl.trim()) return;
  sourceUrl.value = normalizeUrl(requestedUrl);
  void openSpecification();
});

async function openSpecification() {
  const url = normalizeUrl(sourceUrl.value);
  if (!url) {
    state.setError("Enter a specification URL.");
    return;
  }

  state.setLoading(true);
  state.setError(null);

  try {
    const specification = await loadSpecificationFromUrl(url);
    state.setSpecification(specification);
    state.setDetailMode(detailMode.value);
    await router.push(routes.specToSpec);
  } catch (error) {
    state.setError(error instanceof Error ? error.message : "Unable to load specification");
  } finally {
    state.setLoading(false);
  }
}

function normalizeUrl(value: string): string {
  const markdownLink = value.trim().match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i);
  return markdownLink?.[1] ?? value.trim();
}

function selectDefaultSpecification(specification: DefaultSpecification) {
  sourceUrl.value = specification.url;
  state.setError(null);
}
</script>

<template>
  <section class="hero">
    <div class="hero-kicker">Dataspecer Specification Reader</div>

    <h1 class="hero-title">
      Read, explore &amp; <em>understand</em><br />
      semantic <span class="word-gold">data specifications</span>
    </h1>

    <p class="hero-sub">
      Load any <strong>Dataspecer</strong> published specification, choose how much detail you need,
      then navigate through the pages.
    </p>

    <form class="input-shell" @submit.prevent="openSpecification">
      <label class="input-label" for="spec-url">Specification URL</label>
      <div class="input-row">
        <div class="url-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <input
          id="spec-url"
          v-model="sourceUrl"
          class="url-input"
          type="url"
          placeholder="https://mff-uk.github.io/data-specification-vocabulary/dsv-dap/"
          autocomplete="off"
          spellcheck="false"
          required
        />
        <button class="open-btn" type="submit" :disabled="state.isLoading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12,5 19,12 12,19" />
          </svg>
          {{ state.isLoading ? "Loading..." : "Open S2S" }}
        </button>
      </div>

      <p v-if="state.errorMessage" class="error-message">{{ state.errorMessage }}</p>
    </form>

    <div class="mode-row">
      <span class="mode-label-text">Default mode</span>
      <div class="mode-options">
        <label class="mode-radio">
          <input v-model="detailMode" type="radio" name="mode-inline" value="simple" />
          <span class="radio-dot"></span>
          Simple
        </label>
        <label class="mode-radio">
          <input v-model="detailMode" type="radio" name="mode-inline" value="detailed" />
          <span class="radio-dot"></span>
          Detail
        </label>
      </div>
    </div>
  </section>

  <section class="specs-section" aria-labelledby="preloaded-specifications-title">
    <header class="specs-header">
      <div>
        <h2 id="preloaded-specifications-title" class="specs-title">Preloaded specifications</h2>
        <p class="specs-sub">Select a specification, then open it using the URL field above.</p>
      </div>
      <div class="specs-count">{{ defaultSpecifications.length }} specifications</div>
    </header>

    <div class="specs-grid">
      <button
        v-for="specification in defaultSpecifications"
        :key="specification.id"
        class="spec-card"
        :class="{ active: sourceUrl === specification.url }"
        :style="{ '--card-accent': specification.accent }"
        type="button"
        @click="selectDefaultSpecification(specification)"
      >
        <span class="card-header">
          <span class="card-icon">{{ specification.icon }}</span>
          <span class="card-title-group">
            <strong class="card-title">{{ specification.title }}</strong>
            <span class="card-subtitle">{{ specification.subtitle }}</span>
          </span>
        </span>
        <span class="card-desc">{{ specification.description }}</span>
        <span class="card-url">{{ specification.url }}</span>
        <span class="card-arrow" aria-hidden="true">→</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 24px 60px;
  text-align: center;
}

.hero-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  color: var(--accent);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  animation: fadeUp 0.6s ease both;
}

.hero-kicker::before,
.hero-kicker::after {
  display: block;
  width: 28px;
  height: 1px;
  background: var(--accent);
  content: "";
  opacity: 0.6;
}

.hero-title {
  max-width: 760px;
  margin-bottom: 20px;
  color: var(--text);
  font-size: clamp(36px, 6vw, 68px);
  font-weight: 700;
  line-height: 1.08;
  animation: fadeUp 0.6s 0.08s ease both;
}

.hero-title em {
  color: var(--accent);
  font-style: normal;
  font-weight: 700;
}

.hero-title .word-gold {
  color: var(--text);
}

.hero-sub {
  max-width: 480px;
  margin-bottom: 48px;
  color: var(--text2);
  font-size: 15px;
  font-weight: 300;
  line-height: 1.75;
  animation: fadeUp 0.6s 0.14s ease both;
}

.hero-sub strong {
  color: var(--text);
  font-weight: 500;
}

.input-shell {
  width: 100%;
  max-width: 700px;
  animation: fadeUp 0.6s 0.2s ease both;
}

.input-label {
  display: block;
  margin-bottom: 8px;
  color: var(--text3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-align: left;
  text-transform: uppercase;
}

.input-row {
  display: flex;
  overflow: hidden;
  border: 1.5px solid var(--border2);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.input-row:focus-within {
  border-color: var(--accent);
  box-shadow:
    0 0 0 4px var(--accent-bg),
    var(--shadow-lg);
}

.url-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  color: var(--text3);
}

.url-icon svg {
  width: 16px;
  height: 16px;
}

.url-input {
  min-width: 0;
  flex: 1;
  border: none;
  padding: 16px 8px;
  background: transparent;
  color: var(--text);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  font-size: 13px;
  outline: none;
}

.url-input::placeholder {
  color: var(--text3);
}

.open-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px;
  border: none;
  border-radius: 10px;
  padding: 12px 24px;
  background: var(--accent);
  color: #ffffff;
  cursor: pointer;
  font-family: "Jost", ui-sans-serif, system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition: all 0.18s;
  white-space: nowrap;
}

.open-btn:hover:not(:disabled) {
  background: var(--accent2);
  transform: translateX(2px);
}

:global([data-theme="dark"] .open-btn) {
  background: #2454d6;
  color: #fff;
}

:global([data-theme="dark"] .open-btn:hover:not(:disabled)) {
  background: #315fda;
  color: #fff;
}

.open-btn:disabled {
  cursor: progress;
  opacity: 0.7;
}

.open-btn svg {
  width: 15px;
  height: 15px;
}

.error-message {
  margin-top: 12px;
  color: #b91c1c;
  font-size: 13px;
}

.mode-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 18px;
  animation: fadeUp 0.6s 0.26s ease both;
}

.mode-label-text {
  color: var(--text2);
  font-size: 12px;
  font-weight: 500;
}

.mode-options {
  display: flex;
  gap: 6px;
  flex-direction: row;
}

.mode-radio {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 6px 14px;
  background: var(--surface);
  color: var(--text2);
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  transition: all 0.15s;
  user-select: none;
}

.mode-radio input[type="radio"] {
  display: none;
}

.mode-radio:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 500;
}

.radio-dot {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
  border: 2px solid var(--border2);
  border-radius: 50%;
  transition: all 0.15s;
}

.mode-radio:has(input:checked) .radio-dot {
  border-color: var(--accent);
  background: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-bg);
}

.mode-radio:has(input:checked) .radio-dot::after {
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #ffffff;
  content: "";
}

.specs-section {
  position: relative;
  z-index: 1;
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 32px 80px;
}

.specs-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}

.specs-title {
  color: var(--text);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.specs-sub {
  margin-top: 2px;
  color: var(--text3);
  font-size: 12px;
}

.specs-count {
  color: var(--text3);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
}

.specs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(238px, 1fr));
  gap: 12px;
}

.spec-card {
  --card-accent: var(--accent);
  position: relative;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-weight: 400;
  text-align: left;
  transform: none;
  transition: all 0.2s;
}

.spec-card::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  border-radius: 8px 8px 0 0;
  background: var(--card-accent);
  content: "";
  opacity: 0;
  transition: opacity 0.2s;
}

.spec-card:hover,
.spec-card.active {
  border-color: var(--card-accent);
  background: var(--surface);
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}

.spec-card.active {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--card-accent) 15%, transparent);
}

.spec-card:hover::before,
.spec-card.active::before {
  opacity: 1;
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.card-icon {
  display: flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 9px;
  background: color-mix(in srgb, var(--card-accent) 12%, var(--surface));
  color: var(--card-accent);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 700;
}

.card-title-group {
  min-width: 0;
  flex: 1;
}

.card-title,
.card-subtitle {
  display: block;
}

.card-title {
  overflow: hidden;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-subtitle {
  color: var(--text3);
  font-size: 11px;
}

.card-desc {
  flex: 1;
  margin-bottom: 14px;
  color: var(--text2);
  font-size: 12px;
  line-height: 1.6;
}

.card-url {
  overflow: hidden;
  padding-right: 18px;
  color: var(--text3);
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-arrow {
  position: absolute;
  right: 16px;
  bottom: 13px;
  color: var(--card-accent);
  font-size: 18px;
  opacity: 0;
  transition: all 0.2s;
}

.spec-card:hover .card-arrow,
.spec-card.active .card-arrow {
  opacity: 1;
}

@media (max-width: 700px) {
  .input-row,
  .mode-row {
    align-items: stretch;
    flex-direction: column;
  }

  .url-icon {
    display: none;
  }

  .url-input {
    padding: 16px;
  }

  .open-btn {
    justify-content: center;
  }

  .specs-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}
</style>
