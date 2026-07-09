<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { routes } from "../../app/routes";
import { loadSpecification } from "../../data/loading/load-specification";
import type { SpecificationSource } from "../../data/loading/specification-source";
import { useSpecificationState, type DetailMode } from "../../state/specificationState";

const router = useRouter();
const state = useSpecificationState();
const sourceUrl = ref("");
const detailMode = ref<DetailMode>(state.detailMode);

async function openSpecification() {
  state.setLoading(true);
  state.setError(null);

  try {
    const source: SpecificationSource = sourceUrl.value.trim()
      ? { type: "url", url: sourceUrl.value.trim() }
      : { type: "static", key: "demo-specification" };
    const specification = await loadSpecification(source);
    state.setSpecification(specification);
    state.setDetailMode(detailMode.value);
    await router.push(routes.specToSpec);
  } catch (error) {
    state.setError(error instanceof Error ? error.message : "Unable to load specification");
  } finally {
    state.setLoading(false);
  }
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
}
</style>
