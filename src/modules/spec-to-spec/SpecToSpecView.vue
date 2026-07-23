<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { routes } from "../../app/routes";
import type { SpecificationArtifact } from "../../data/model/artifact";
import { selectLocalizedString } from "../../data/model/localized-string";
import { useSpecificationState } from "../../state/specificationState";
import SpecificationBrowser from "./SpecificationBrowser.vue";

type S2STab = "overview" | "browser";

const state = useSpecificationState();
const specification = computed(() => state.specification);
const activeTab = ref<S2STab>("overview");

const title = computed(
  () => selectLocalizedString(specification.value?.metadata.title) ?? "Untitled specification",
);

const description = computed(
  () =>
    selectLocalizedString(specification.value?.metadata.description) ??
    "No description was provided by the specification metadata.",
);

const focusLabel = computed(() => title.value.split(/\s+/).slice(0, 3).join(" "));

const sourceUrl = computed(
  () => specification.value?.metadata.sourceUrl ?? specification.value?.metadata.iri,
);

const metadataRows = computed(() => {
  if (!specification.value) {
    return [];
  }

  const metadata = specification.value.metadata;

  return [
    { label: "IRI", value: metadata.iri, mono: true },
    { label: "Version", value: metadata.version },
    { label: "Publisher", value: selectLocalizedString(metadata.publisher) },
    { label: "License", value: metadata.license },
    // { label: "Conforms to", value: metadata.types.join(", "), mono: true },
    { label: "Resource Type", value: metadata.types.map(typeLabel).join(", "), mono: true },
    { label: "Source", value: sourceUrl.value, href: sourceUrl.value },
  ].filter((row) => row.value);
});

function typeLabel(type: string): string {
  return type.replace(/^[^:]+:/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function artifactFormatLabel(artifact: SpecificationArtifact): string {
  const value = `${artifact.mediaType ?? ""} ${artifact.url}`.toLowerCase();

  if (artifact.type === "rdf" && (value.includes("turtle") || value.endsWith(".ttl"))) {
    return "TTL";
  }

  if (artifact.type === "json-schema") {
    return "JSON";
  }

  if (artifact.type === "xml-schema") {
    return "XSD";
  }

  return artifact.type.toUpperCase();
}

function artifactFormatClass(artifact: SpecificationArtifact): string {
  const label = artifactFormatLabel(artifact).toLowerCase();

  if (label === "ttl") {
    return "ttl";
  }

  if (label === "json") {
    return "json";
  }

  if (label === "xsd") {
    return "xsd";
  }

  return artifact.type;
}
</script>

<template>
  <section class="s2s-shell">
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'overview' }"
        type="button"
        @click="activeTab = 'overview'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        Specification Overview
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'browser' }"
        type="button"
        :disabled="!specification"
        @click="activeTab = 'browser'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="3" />
          <circle cx="5" cy="19" r="3" />
          <circle cx="19" cy="19" r="3" />
          <line x1="12" y1="8" x2="5" y2="16" />
          <line x1="12" y1="8" x2="19" y2="16" />
        </svg>
        Specification Browser
      </button>
      <div class="tab-spacer"></div>
      <div v-if="specification" class="focus-indicator">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="9" stroke-dasharray="4 2" />
        </svg>
        Focus: <strong>{{ focusLabel }}</strong>
      </div>
    </div>

    <div v-show="activeTab === 'overview'" class="tab-panel active">
      <div class="overview-panel">
        <div v-if="specification" class="ov-wrap">
          <div class="spec-header">
            <div>
              <div class="spec-eyebrow">Specification Overview</div>
              <h1 class="spec-title">{{ title }}</h1>
              <p class="spec-desc">{{ description }}</p>
              <div class="spec-badges">
                <span v-for="type in specification.metadata.types" :key="type" class="badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12h8" />
                    <path d="M12 8v8" />
                  </svg>
                  {{ typeLabel(type) }}
                </span>
                <span class="badge status-ok">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                  Loaded
                </span>
              </div>
            </div>
          </div>

          <div v-if="metadataRows.length" class="ov-section">
            <div class="ov-heading">
              <div class="ov-heading-text">Metadata</div>
              <div class="ov-heading-line"></div>
            </div>
            <table class="meta-table">
              <tbody>
                <tr v-for="row in metadataRows" :key="row.label">
                  <td>{{ row.label }}</td>
                  <td>
                    <a v-if="row.href" :href="row.href" target="_blank" rel="noreferrer">
                      {{ row.value }}
                    </a>
                    <span v-else :class="{ 'mono-val': row.mono }">{{ row.value }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="ov-section">
            <div class="ov-heading">
              <div class="ov-heading-text">Artifacts</div>
              <div class="ov-heading-line"></div>
            </div>
            <div v-if="specification.artifacts.length" class="artifact-list">
              <a
                v-for="artifact in specification.artifacts"
                :key="artifact.id"
                class="artifact-row"
                :href="artifact.url"
                target="_blank"
                rel="noreferrer"
              >
                <div class="artifact-fmt" :class="artifactFormatClass(artifact)">
                  {{ artifactFormatLabel(artifact) }}
                </div>
                <div class="artifact-main">
                  <div class="artifact-name">
                    {{ selectLocalizedString(artifact.title) }}
                  </div>
                  <div class="artifact-type">{{ artifact.mediaType ?? artifact.type }}</div>
                </div>
                <span class="artifact-role">{{ artifact.type }}</span>
                <span class="artifact-open" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15,3 21,3 21,9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </span>
              </a>
            </div>
            <p v-else class="empty-copy">No generated artifacts were found in the JSON-LD.</p>
          </div>

          <div class="ov-section">
            <div class="ov-heading">
              <div class="ov-heading-text">Related Specifications</div>
              <div class="ov-heading-line"></div>
            </div>
            <div v-if="specification.relatedSpecifications.length" class="related-chips">
              <a
                v-for="related in specification.relatedSpecifications"
                :key="related.id"
                class="rel-chip"
                :href="related.targetIri"
                target="_blank"
                rel="noreferrer"
              >
                <span class="rel-chip-dot"></span>
                <span class="rel-chip-name">{{ selectLocalizedString(related.title) }}</span>
                <span class="rel-chip-rel">{{ related.relation }}</span>
                <span class="rel-chip-arrow">↗</span>
              </a>
            </div>
            <p v-else class="empty-copy">No related specifications were found in the JSON-LD.</p>
          </div>

          <div class="ov-actions">
            <RouterLink class="ov-action-btn primary" :to="routes.primer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              Open Primer
            </RouterLink>
            <RouterLink class="ov-action-btn secondary" :to="routes.specExplorer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              Open in Explorer
            </RouterLink>
            <button class="ov-action-btn secondary" type="button" @click="activeTab = 'browser'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="5" r="3" />
                <circle cx="5" cy="19" r="3" />
                <circle cx="19" cy="19" r="3" />
                <line x1="12" y1="8" x2="5" y2="16" />
                <line x1="12" y1="8" x2="19" y2="16" />
              </svg>
              Browse Relationships
            </button>
          </div>
        </div>

        <div v-else class="empty-state">
          <div class="spec-eyebrow">Specification Overview</div>
          <h1 class="spec-title">No specification loaded</h1>
          <p class="spec-desc">
            Open a Dataspecer page or load the bundled sample from the landing screen first.
          </p>
          <RouterLink class="ov-action-btn primary" :to="routes.landing">
            Open a specification
          </RouterLink>
        </div>
      </div>
    </div>

    <div v-if="specification && activeTab === 'browser'" class="tab-panel active">
      <SpecificationBrowser :specification="specification" />
    </div>
  </section>
</template>

<style scoped>
.s2s-shell {
  display: flex;
  height: calc(100vh - 52px);
  flex-direction: column;
  overflow: hidden;
}

.tab-bar {
  display: flex;
  flex-shrink: 0;
  align-items: flex-end;
  gap: 0;
  border-bottom: 1px solid var(--border);
  padding: 0 24px;
  background: var(--surface);
  transition:
    background 0.25s,
    border-color 0.25s;
}

.tab-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  padding: 12px 18px 11px;
  background: none;
  color: var(--text2);
  cursor: pointer;
  font-family: "Jost", ui-sans-serif, system-ui, sans-serif;
  font-size: 15px;
  font-weight: 400;
  transition: all 0.15s;
}

.tab-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.tab-btn:hover {
  background: none;
  color: var(--text);
  transform: none;
}

.tab-btn.active {
  border-bottom-color: var(--accent);
  color: var(--accent);
  font-weight: 500;
}

.tab-btn svg {
  width: 14px;
  height: 14px;
  opacity: 0.6;
}

.tab-btn.active svg {
  opacity: 1;
}

.tab-spacer {
  flex: 1;
}

.focus-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  border: 1px solid var(--accent-mid);
  border-radius: 5px;
  padding: 4px 10px;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 11px;
  font-weight: 500;
}

.focus-indicator svg {
  width: 11px;
  height: 11px;
}

.tab-panel {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.overview-panel {
  flex: 1;
  overflow-y: auto;
  padding: 36px 24px 60px;
}

.ov-wrap {
  max-width: 900px;
  margin: 0 auto;
}

.spec-header {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
  margin-bottom: 32px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 32px;
  animation: fadeUp 0.45s ease both;
}

.spec-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--accent);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.spec-eyebrow::before {
  display: inline-block;
  width: 18px;
  height: 1px;
  background: var(--accent);
  content: "";
}

.spec-title {
  margin-bottom: 12px;
  color: var(--text);
  font-family: "Jost", ui-sans-serif, system-ui, sans-serif;
  font-size: clamp(24px, 3.5vw, 36px);
  font-weight: 500;
  line-height: 1.15;
}

.spec-desc {
  max-width: 540px;
  margin-bottom: 16px;
  color: var(--text2);
  font-size: 15px;
  line-height: 1.75;
}

.spec-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 4px 10px;
  background: var(--surface2);
  color: var(--text2);
  font-size: 11px;
  font-weight: 500;
}

.badge svg {
  width: 11px;
  height: 11px;
  opacity: 0.65;
}

.badge.status-ok {
  border-color: var(--green-bg);
  background: var(--green-bg);
  color: var(--green);
}

.ov-section {
  margin-bottom: 36px;
  animation: fadeUp 0.45s ease both;
}

.ov-section:nth-child(2) {
  animation-delay: 0.06s;
}

.ov-section:nth-child(3) {
  animation-delay: 0.1s;
}

.ov-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.ov-heading-line {
  height: 1px;
  flex: 1;
  background: var(--border);
}

.ov-heading-text {
  color: var(--text3);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.meta-table {
  width: 100%;
  border-collapse: collapse;
}

.meta-table tr {
  border-bottom: 1px solid var(--border);
}

.meta-table tr:last-child {
  border-bottom: none;
}

.meta-table td {
  padding: 10px 0;
  font-size: 13px;
  vertical-align: top;
}

.meta-table td:first-child {
  width: 160px;
  padding-right: 16px;
  color: var(--text3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.meta-table a {
  color: var(--accent);
  text-decoration: none;
  word-break: break-word;
}

.meta-table a:hover {
  text-decoration: underline;
}

.mono-val {
  color: var(--text2);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  font-size: 13px;
  word-break: break-word;
}

.artifact-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.artifact-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 14px;
  background: var(--surface);
  color: inherit;
  text-decoration: none;
  transition:
    box-shadow 0.15s,
    transform 0.15s;
}

.artifact-row:hover {
  box-shadow: var(--shadow);
  text-decoration: none;
  transform: translateX(2px);
}

.artifact-fmt {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 7px;
  background: var(--accent-bg);
  color: var(--accent);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.artifact-fmt.ttl,
.artifact-fmt.rdf {
  background: var(--green-bg);
  color: var(--green);
}

.artifact-fmt.shacl {
  background: var(--gold-bg);
  color: var(--gold);
}

.artifact-fmt.html {
  background: var(--teal-bg);
  color: var(--teal);
}

.artifact-fmt.svg {
  background: var(--purple-bg);
  color: var(--purple);
}

.artifact-fmt.json,
.artifact-fmt.json-schema {
  background: var(--accent-bg);
  color: var(--accent);
}

.artifact-fmt.xsd,
.artifact-fmt.xml-schema {
  background: var(--surface3);
  color: var(--text2);
}

.artifact-main {
  min-width: 0;
}

.artifact-name {
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
}

.artifact-type {
  color: var(--text3);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  font-size: 13px;
  word-break: break-word;
}

.artifact-role {
  flex-shrink: 0;
  margin-left: auto;
  border-radius: 4px;
  padding: 2px 8px;
  background: var(--surface2);
  color: var(--text2);
  font-size: 12px;
  font-weight: 600;
}

.artifact-open {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text3);
  transition: all 0.12s;
}

.artifact-row:hover .artifact-open {
  border-color: var(--accent);
  color: var(--accent);
}

.artifact-open svg {
  width: 13px;
  height: 13px;
}

.related-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rel-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  background: var(--surface);
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  text-decoration: none;
  transition: all 0.15s;
}

.rel-chip:hover {
  border-color: var(--accent-mid);
  box-shadow: var(--shadow);
  text-decoration: none;
}

.rel-chip-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.rel-chip-name {
  color: var(--text);
  font-weight: 500;
}

.rel-chip-rel {
  color: var(--text3);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
}

.rel-chip-arrow {
  color: var(--text3);
  font-size: 15px;
}

.empty-copy {
  color: var(--text3);
  font-size: 14px;
}

.ov-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
  border-top: 1px solid var(--border);
  padding-top: 28px;
}

.ov-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 18px;
  cursor: pointer;
  font-family: "Jost", ui-sans-serif, system-ui, sans-serif;
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s;
}

.ov-action-btn svg {
  width: 15px;
  height: 15px;
}

.ov-action-btn.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.ov-action-btn.primary:hover {
  border-color: var(--accent2);
  background: var(--accent2);
  text-decoration: none;
}

.ov-action-btn.secondary {
  background: var(--surface2);
  color: var(--text2);
}

.ov-action-btn.secondary:hover {
  border-color: var(--border2);
  background: var(--surface3);
  color: var(--text);
  text-decoration: none;
}

.empty-state {
  max-width: 900px;
  margin: 0 auto;
  padding-top: 20px;
}

@media (max-width: 700px) {
  .tab-bar {
    align-items: stretch;
    flex-direction: column;
    padding: 0 16px 10px;
  }

  .tab-btn {
    justify-content: flex-start;
    padding-right: 0;
    padding-left: 0;
  }

  .focus-indicator {
    width: fit-content;
  }

  .overview-panel {
    padding: 28px 16px 48px;
  }

  .meta-table td:first-child {
    width: 110px;
  }

  .artifact-row {
    align-items: flex-start;
  }

  .artifact-role {
    display: none;
  }
}
</style>
