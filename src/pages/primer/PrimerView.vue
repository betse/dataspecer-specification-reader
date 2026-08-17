<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { RouterLink } from "vue-router";
import { routes } from "../../app/router";
import { loadPrimerData } from "../../data/loading/load-primer-data";
import type { SemanticSpecification } from "../../data/semantic/semantic-specification";
import { useSpecificationState } from "../../state/specification-state";
import InteractiveSvgDiagram, { type InteractiveSvgSelection } from "./InteractiveSvgDiagram.vue";
import { createPrimer } from "./model/primer";

const state = useSpecificationState();
const semanticSpecification = shallowRef<SemanticSpecification>();
const isSemanticLoading = ref(false);
const semanticError = ref<string>();
const selectedClassIri = ref<string>();
const selectedSvgNode = ref<InteractiveSvgSelection>();
const diagramClassIris = ref<string[]>([]);

const MAX_KEY_CLASSES = 8;
const MAX_PROPERTIES_PER_CLASS = 5;

const primer = computed(() =>
  state.specification ? createPrimer(state.specification, semanticSpecification.value) : null,
);
const selectedClass = computed(() => {
  if (!primer.value || !selectedClassIri.value) return undefined;
  return (
    primer.value.classProfiles.find((item) => item.iri === selectedClassIri.value) ??
    primer.value.vocabularyClasses.find((item) => item.iri === selectedClassIri.value)
  );
});
const selectedDiagramKey = computed(() => selectedClassIri.value ?? selectedSvgNode.value?.key);
const selectedProfiledClassIris = computed(() => {
  const selected = selectedClass.value;
  return selected && "profiledClassIris" in selected ? selected.profiledClassIris : [];
});
const selectedSpecializationIris = computed(() => {
  const selected = selectedClass.value;
  return selected && "specializationOfIris" in selected ? selected.specializationOfIris : [];
});
const diagramTerms = computed(() => [
  ...(primer.value?.classProfiles.map((profile) => ({
    iri: profile.iri,
    label: profile.label,
    aliases: [
      ...profile.profiledClassIris,
      ...profile.profileOfIris,
      ...profile.specializationOfIris,
    ],
  })) ?? []),
  ...(primer.value?.vocabularyClasses.map((concept) => ({
    iri: concept.iri,
    label: concept.label,
    aliases: concept.parentIris,
  })) ?? []),
]);
const keyClasses = computed(() => {
  if (!primer.value) return [];
  const allClasses = [...primer.value.classProfiles, ...primer.value.vocabularyClasses];
  const classByIri = new Map(allClasses.map((item) => [item.iri, item]));
  const fromDiagram = diagramClassIris.value.flatMap((iri) => {
    const item = classByIri.get(iri);
    return item ? [item] : [];
  });
  const diagramIris = new Set(fromDiagram.map((item) => item.iri));
  return [...fromDiagram, ...allClasses.filter((item) => !diagramIris.has(item.iri))].slice(
    0,
    MAX_KEY_CLASSES,
  );
});
const keyClassProfiles = computed(() =>
  keyClasses.value.filter((item) => "propertyProfileIris" in item),
);
interface SelectedProperty {
  iri: string;
  label: string;
  kindLabel: string;
  requirementLabel?: string;
  cardinalityLabel?: string;
  rangeLabels: string[];
}

const allSelectedProperties = computed<SelectedProperty[]>(() => {
  const selected = selectedClass.value;
  if (!primer.value || !selected) return [];

  if ("propertyProfileIris" in selected) {
    return sortPropertyProfiles(
      primer.value.propertyProfiles.filter(
        (property) =>
          property.domainIri === selected.iri ||
          selected.propertyProfileIris.includes(property.iri),
      ),
    ).map((property) => ({
      iri: property.iri,
      label: property.label,
      kindLabel: property.kindLabel,
      requirementLabel: property.requirementLabel,
      cardinalityLabel: property.cardinalityLabel,
      rangeLabels: property.rangeIris.map(termLabel),
    }));
  }

  return primer.value.vocabularyProperties
    .filter((property) => property.domainIri === selected.iri)
    .map((property) => ({
      iri: property.iri,
      label: property.label,
      kindLabel: property.kindLabel,
      rangeLabels: property.rangeIri ? [termLabel(property.rangeIri)] : [],
    }));
});
const selectedProperties = computed(() =>
  allSelectedProperties.value.slice(0, MAX_PROPERTIES_PER_CLASS),
);
const hiddenSelectedPropertyCount = computed(() =>
  Math.max(0, allSelectedProperties.value.length - selectedProperties.value.length),
);
const keyPropertyProfiles = computed(() => {
  if (!primer.value) return [];
  const selected: typeof primer.value.propertyProfiles = [];
  const seen = new Set<string>();

  for (const classProfile of keyClassProfiles.value) {
    const properties = sortPropertyProfiles(
      primer.value.propertyProfiles.filter(
        (property) =>
          property.domainIri === classProfile.iri ||
          classProfile.propertyProfileIris.includes(property.iri),
      ),
    ).slice(0, MAX_PROPERTIES_PER_CLASS);
    for (const property of properties) {
      if (seen.has(property.iri)) continue;
      seen.add(property.iri);
      selected.push(property);
    }
  }
  return selected;
});

watch(
  () => state.specification,
  async (specification, _previous, onCleanup) => {
    semanticSpecification.value = undefined;
    semanticError.value = undefined;
    selectedClassIri.value = undefined;
    selectedSvgNode.value = undefined;
    diagramClassIris.value = [];
    if (!specification) return;

    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    isSemanticLoading.value = true;

    try {
      const result = await loadPrimerData(specification);
      if (!cancelled) semanticSpecification.value = result;
    } catch (error) {
      if (!cancelled) {
        semanticError.value = error instanceof Error ? error.message : String(error);
      }
    } finally {
      if (!cancelled) isSemanticLoading.value = false;
    }
  },
  { immediate: true },
);

function selectClass(iri: string) {
  selectedClassIri.value = iri;
  selectedSvgNode.value = undefined;
}

function selectDiagramNode(selection: InteractiveSvgSelection) {
  selectedClassIri.value = selection.semanticIri;
  selectedSvgNode.value = selection.semanticIri ? undefined : selection;
}

function setDiagramClassOrder(iris: string[]) {
  diagramClassIris.value = iris;
}

function sortPropertyProfiles<T extends { requirementLabel?: string }>(properties: T[]): T[] {
  const priority: Record<string, number> = {
    Mandatory: 0,
    Recommended: 1,
    Optional: 2,
  };
  return properties
    .map((property, index) => ({ property, index }))
    .sort(
      (left, right) =>
        (priority[left.property.requirementLabel ?? ""] ?? 3) -
          (priority[right.property.requirementLabel ?? ""] ?? 3) || left.index - right.index,
    )
    .map(({ property }) => property);
}

function termLabel(iri?: string): string {
  if (!iri || !primer.value) return "—";
  const term = [
    ...primer.value.classProfiles,
    ...primer.value.vocabularyClasses,
    ...primer.value.propertyProfiles,
    ...primer.value.vocabularyProperties,
  ].find((item) => item.iri === iri);
  if (term) return term.label;

  const segment = iri.replace(/\/$/, "").split(/[/#]/).pop();
  return segment ? decodeURIComponent(segment).replace(/[-_]+/g, " ") : iri;
}
</script>

<template>
  <main class="primer-page">
    <template v-if="primer">
      <header class="hero">
        <div class="hero-copy">
          <div class="kicker">{{ primer.kindLabel }} · Primer</div>
          <h1>{{ primer.title }}</h1>
          <p class="lead">{{ primer.description }}</p>

          <div class="badges">
            <span v-for="badge in primer.badges" :key="badge.label" class="badge">
              {{ badge.label }}
            </span>
            <span v-if="isSemanticLoading" class="badge">Loading semantic data…</span>
            <span v-else class="badge status">Loaded</span>
          </div>

          <div v-if="primer.sourceUrl" class="source-line">
            <span>Source</span>
            <a :href="primer.sourceUrl" target="_blank" rel="noreferrer">
              {{ primer.sourceUrl }}
            </a>
          </div>
        </div>

        <div class="stats-grid">
          <div v-for="statistic in primer.statisticItems" :key="statistic.label" class="stat-cell">
            <div class="stat-number">{{ statistic.value }}</div>
            <div class="stat-label">{{ statistic.label }}</div>
          </div>
        </div>
      </header>

      <div class="primer-context">
        <article class="context-card">
          <div class="context-number">01</div>
          <div>
            <h2>Generated from published data</h2>
            <p>
              The title, description, source and resources below come from the loaded specification
              metadata.
            </p>
          </div>
        </article>
        <article class="context-card">
          <div class="context-number muted-number">02</div>
          <div>
            <h2>{{ isSemanticLoading ? "Loading semantic data" : "Semantic data" }}</h2>
            <p v-if="isSemanticLoading">Published RDF artifacts are being parsed.</p>
            <p v-else-if="primer.semanticSources.length">
              {{ primer.semanticSources.length }} RDF
              {{ primer.semanticSources.length === 1 ? "source was" : "sources were" }} inspected
              for vocabulary and application-profile content.
            </p>
            <p v-else>No RDF artifact was available for semantic inspection.</p>
          </div>
        </article>
        <article class="context-card">
          <div class="context-number available-number">03</div>
          <div>
            <h2>Linked artifacts</h2>
            <p>
              {{ primer.statistics.artifacts }} published
              {{ primer.statistics.artifacts === 1 ? "resource is" : "resources are" }} available
              for inspection.
            </p>
          </div>
        </article>
      </div>

      <div v-if="semanticError || primer.warnings.length" class="semantic-notices">
        <strong>Some semantic data could not be loaded.</strong>
        <ul>
          <li v-if="semanticError">{{ semanticError }}</li>
          <li v-for="warning in primer.warnings" :key="warning">{{ warning }}</li>
        </ul>
      </div>

      <nav class="section-nav" aria-label="Primer sections">
        <a href="#diagram">Diagram</a>
        <a href="#profiles">Key profiles</a>
        <a href="#requirements">Requirement matrix</a>
        <a href="#resources">Resources</a>
      </nav>

      <section id="diagram" class="primer-section">
        <div class="section-heading">
          <span>01</span>
          <div></div>
        </div>
        <h2>Conceptual diagram</h2>
        <p class="section-description">Diagram resource published for the loaded specification.</p>

        <div class="diagram-layout">
          <InteractiveSvgDiagram
            v-if="primer.diagram"
            :title="primer.diagram.title"
            :url="primer.diagram.url"
            :terms="diagramTerms"
            :selected-key="selectedDiagramKey"
            @select="selectDiagramNode"
            @discover="setDiagramClassOrder"
          />
          <article v-else class="diagram-card">
            <div class="diagram-bar">
              <strong>Conceptual diagram</strong>
              <span class="availability">Unavailable</span>
            </div>
            <div class="unavailable-state compact">
              <strong>No SVG artifact was advertised.</strong>
              <p>This specification does not expose a diagram in its current metadata.</p>
            </div>
          </article>

          <aside class="detail-panel">
            <div class="detail-head">
              <span class="detail-dot"></span>
              <strong>{{
                selectedClass?.label ?? selectedSvgNode?.label ?? "No class selected"
              }}</strong>
            </div>
            <div v-if="selectedClass" class="detail-content">
              <p>{{ selectedClass.description ?? "No description is available." }}</p>
              <dl>
                <template v-if="'roleLabel' in selectedClass && selectedClass.roleLabel">
                  <dt>Role</dt>
                  <dd>{{ selectedClass.roleLabel }}</dd>
                </template>
                <dt>IRI</dt>
                <dd>
                  <a :href="selectedClass.iri" target="_blank" rel="noreferrer">
                    {{ selectedClass.iri }}
                  </a>
                </dd>
                <template v-if="selectedProfiledClassIris.length">
                  <dt>Profiles</dt>
                  <dd v-for="iri in selectedProfiledClassIris" :key="iri">
                    <a :href="iri" target="_blank" rel="noreferrer">{{ termLabel(iri) }}</a>
                  </dd>
                </template>
                <template v-if="selectedSpecializationIris.length">
                  <dt>Specializes</dt>
                  <dd v-for="iri in selectedSpecializationIris" :key="iri">
                    <a :href="iri" target="_blank" rel="noreferrer">{{ termLabel(iri) }}</a>
                  </dd>
                </template>
                <dt>Properties</dt>
                <dd>
                  <div v-if="selectedProperties.length" class="detail-properties">
                    <article
                      v-for="property in selectedProperties"
                      :key="property.iri"
                      class="detail-property"
                    >
                      <div class="property-heading">
                        <a :href="property.iri" target="_blank" rel="noreferrer">
                          {{ property.label }}
                        </a>
                        <span
                          v-if="property.requirementLabel"
                          class="requirement-pill"
                          :class="property.requirementLabel.toLowerCase()"
                        >
                          {{ property.requirementLabel }}
                        </span>
                        <span v-if="property.cardinalityLabel" class="cardinality-pill">
                          {{ property.cardinalityLabel }}
                        </span>
                      </div>
                      <span class="property-meta">
                        {{ property.rangeLabels.join(", ") || property.kindLabel }}
                      </span>
                    </article>
                    <p v-if="hiddenSelectedPropertyCount" class="additional-count">
                      {{ hiddenSelectedPropertyCount }} additional
                      {{ hiddenSelectedPropertyCount === 1 ? "property" : "properties" }} not shown
                      in this primer selection.
                    </p>
                  </div>
                  <span v-else class="detail-empty">No direct properties were found.</span>
                </dd>
              </dl>
            </div>
            <div v-else-if="selectedSvgNode" class="detail-content">
              <p>
                {{ selectedSvgNode.description ?? "No description is embedded in this SVG node." }}
              </p>
              <dl>
                <template v-if="selectedSvgNode.iri">
                  <dt>Diagram identifier</dt>
                  <dd>{{ selectedSvgNode.iri }}</dd>
                </template>
                <dt>Properties</dt>
                <dd class="detail-empty">
                  No semantic property data was found for this external diagram node.
                </dd>
              </dl>
            </div>
            <div v-else class="unavailable-state compact">
              <strong>Select a class below.</strong>
              <p>Its description and profile role will be shown here.</p>
            </div>
          </aside>
        </div>
      </section>

      <section id="profiles" class="primer-section">
        <div class="section-heading">
          <span>02</span>
          <div></div>
        </div>
        <h2>Key profiles</h2>
        <p class="section-description">
          A primer selection of up to {{ MAX_KEY_CLASSES }} classes and profiles. Diagram classes
          are preferred, followed by source order.
        </p>
        <div v-if="isSemanticLoading" class="unavailable-state">
          <strong>Loading classes and profiles…</strong>
          <p>The published RDF artifacts are being parsed.</p>
        </div>
        <div v-else-if="keyClasses.length" class="profile-grid">
          <button
            v-for="item in keyClasses"
            :key="item.iri"
            class="profile-card"
            :class="{ selected: selectedClassIri === item.iri }"
            type="button"
            @click="selectClass(item.iri)"
          >
            <span class="profile-type">
              {{ "propertyProfileIris" in item ? "Class profile" : "Vocabulary class" }}
            </span>
            <strong>{{ item.label }}</strong>
            <p>{{ item.description ?? "No description available." }}</p>
            <span v-if="'roleLabel' in item && item.roleLabel" class="format-pill">
              {{ item.roleLabel }}
            </span>
          </button>
        </div>
        <div v-else class="unavailable-state">
          <strong>No classes or class profiles were found.</strong>
          <p>The published RDF resources do not contain supported class definitions.</p>
        </div>
      </section>

      <section id="requirements" class="primer-section">
        <div class="section-heading">
          <span>03</span>
          <div></div>
        </div>
        <h2>Requirement matrix</h2>
        <p class="section-description">
          Up to {{ MAX_PROPERTIES_PER_CLASS }} properties per selected class, prioritised by
          requirement level.
        </p>
        <div class="matrix-wrap">
          <table>
            <thead>
              <tr>
                <th>Class/profile</th>
                <th>Property</th>
                <th>Requirement</th>
                <th>Cardinality</th>
              </tr>
            </thead>
            <tbody v-if="keyPropertyProfiles.length">
              <tr v-for="property in keyPropertyProfiles" :key="property.iri">
                <td>{{ termLabel(property.domainIri) }}</td>
                <td>
                  <strong>{{ property.label }}</strong>
                  <span class="resource-media">{{ property.kindLabel }}</span>
                </td>
                <td>{{ property.requirementLabel ?? "—" }}</td>
                <td>{{ property.cardinalityLabel ?? "—" }}</td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr>
                <td colspan="4">No application-profile property requirements were found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="resources" class="primer-section">
        <div class="section-heading">
          <span>04</span>
          <div></div>
        </div>
        <h2>Resources</h2>
        <p class="section-description">Artifacts published for the loaded specification.</p>

        <div v-if="primer.resources.length" class="resources-wrap">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Description</th>
                <th>Format</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="resource in primer.resources" :key="resource.id">
                <td>
                  <strong>{{ resource.title }}</strong>
                  <span v-if="resource.mediaType" class="resource-media">
                    {{ resource.mediaType }}
                  </span>
                </td>
                <td>{{ resource.description }}</td>
                <td>
                  <span class="format-pill">{{ resource.formatLabel }}</span>
                </td>
                <td>
                  <a
                    :href="resource.url"
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open resource"
                  >
                    Open ↗
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="unavailable-state">
          <strong>No published artifacts were found.</strong>
          <p>The loaded specification metadata does not advertise additional resources.</p>
        </div>

        <div class="actions">
          <RouterLink class="action primary" :to="routes.specExplorer">
            Open Spec Explorer
          </RouterLink>
          <RouterLink class="action" :to="routes.specToSpec">Back to Spec-to-Spec</RouterLink>
          <a
            v-if="primer.sourceUrl"
            class="action"
            :href="primer.sourceUrl"
            target="_blank"
            rel="noreferrer"
          >
            Original output ↗
          </a>
        </div>
      </section>
    </template>

    <section v-else class="empty-page">
      <div class="kicker">Specification Primer</div>
      <h1>No specification loaded</h1>
      <p>Load a published Dataspecer specification before opening the Primer.</p>
      <RouterLink class="action primary" :to="routes.landing">Open a specification</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.primer-page {
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
  padding: 92px 0 80px;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  align-items: end;
  gap: 48px;
  padding-bottom: 36px;
  animation: fadeUp 0.45s ease both;
}

.kicker {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.kicker::before {
  width: 18px;
  height: 1px;
  background: var(--accent);
  content: "";
}

h1 {
  margin-bottom: 14px;
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 600;
  line-height: 1.08;
}

.lead {
  max-width: 700px;
  color: var(--text2);
  font-size: 16px;
  line-height: 1.75;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 16px;
}

.badge,
.availability,
.format-pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 9px;
  background: var(--surface2);
  color: var(--text2);
  font-size: 11px;
  font-weight: 600;
}

.badge.status,
.availability.available {
  border-color: var(--green-bg);
  background: var(--green-bg);
  color: var(--green);
}

.source-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 14px;
  color: var(--text3);
  font-size: 11px;
}

.source-line a {
  overflow: hidden;
  font-family: "JetBrains Mono", monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--border);
  box-shadow: var(--shadow);
  gap: 1px;
}

.stat-cell {
  padding: 18px 14px;
  background: var(--surface);
  text-align: center;
}

.stat-number {
  font-size: 30px;
  font-weight: 600;
  line-height: 1;
}

.stat-label {
  margin-top: 5px;
  color: var(--text3);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.primer-context {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  overflow: hidden;
  margin-bottom: 28px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--border);
  gap: 1px;
}

.semantic-notices {
  margin-bottom: 28px;
  border: 1px solid var(--orange, #c87920);
  border-radius: 9px;
  padding: 14px 18px;
  background: var(--surface);
  color: var(--text2);
  font-size: 12px;
}

.semantic-notices ul {
  margin: 7px 0 0;
  padding-left: 18px;
}

.semantic-notices li + li {
  margin-top: 4px;
}

.context-card {
  display: flex;
  gap: 12px;
  padding: 18px;
  background: var(--surface);
}

.context-number {
  flex: 0 0 28px;
  color: var(--accent);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 700;
}

.context-card h2 {
  margin-bottom: 5px;
  font-size: 13px;
}

.context-card p {
  color: var(--text2);
  font-size: 12px;
  line-height: 1.6;
}

.section-nav {
  position: sticky;
  z-index: 10;
  top: 52px;
  display: flex;
  overflow-x: auto;
  margin-bottom: 54px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(10px);
}

.section-nav a {
  flex: 0 0 auto;
  padding: 11px 16px;
  border-bottom: 2px solid transparent;
  color: var(--text2);
  font-size: 12px;
  font-weight: 600;
}

.section-nav a:hover {
  border-bottom-color: var(--accent);
  color: var(--accent);
  text-decoration: none;
}

.primer-section {
  scroll-margin-top: 115px;
  margin-bottom: 72px;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  color: var(--accent);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 700;
}

.section-heading div {
  width: 42px;
  height: 1px;
  background: var(--accent-mid);
}

.primer-section > h2 {
  margin-bottom: 6px;
  font-size: 26px;
  font-weight: 600;
}

.section-description {
  margin-bottom: 20px;
  color: var(--text2);
  font-size: 14px;
}

.diagram-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  align-items: start;
  gap: 18px;
}

.diagram-card,
.detail-panel,
.unavailable-state,
.matrix-wrap,
.resources-wrap {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.diagram-bar,
.detail-head,
.diagram-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  font-size: 13px;
}

.diagram-bar .availability {
  margin-left: auto;
}

.diagram-stage {
  display: flex;
  min-height: 420px;
  align-items: center;
  justify-content: center;
  padding: 22px;
  background-color: var(--bg);
  background-image: radial-gradient(var(--border) 0.8px, transparent 0.8px);
  background-size: 24px 24px;
}

.diagram-stage img {
  display: block;
  max-width: 100%;
  max-height: 520px;
}

.diagram-footer {
  justify-content: space-between;
  border-top: 1px solid var(--border);
  border-bottom: 0;
  color: var(--text3);
  font-size: 11px;
}

.detail-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border2);
}

.detail-panel {
  position: sticky;
  top: 112px;
}

.detail-content {
  overflow: auto;
  max-height: 560px;
  padding: 18px;
}

.detail-content > p {
  margin-bottom: 18px;
  color: var(--text2);
  font-size: 13px;
  line-height: 1.65;
}

.detail-content dl {
  margin: 0;
}

.detail-content dt {
  margin-top: 12px;
  color: var(--text3);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.detail-content dd {
  overflow-wrap: anywhere;
  margin: 3px 0 0;
  font-size: 12px;
}

.detail-properties {
  margin-top: 8px;
}

.detail-property {
  margin-bottom: 6px;
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 8px 10px;
  background: var(--surface2);
}

.property-heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}

.property-heading > a {
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
}

.requirement-pill,
.cardinality-pill {
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 700;
}

.requirement-pill.mandatory {
  background: var(--amber-bg, var(--surface3));
  color: var(--amber, var(--text2));
}

.requirement-pill.recommended {
  background: var(--accent-bg);
  color: var(--accent);
}

.requirement-pill.optional {
  background: var(--gray-bg, var(--surface3));
  color: var(--gray, var(--text2));
}

.cardinality-pill {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text3);
  font-family: "JetBrains Mono", monospace;
}

.property-meta {
  display: block;
  margin-top: 3px;
  color: var(--text3);
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
}

.detail-empty {
  color: var(--text3);
  font-style: italic;
}

.additional-count {
  margin: 9px 2px 0;
  color: var(--text3);
  font-size: 10px;
  line-height: 1.45;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.profile-card {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 16px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  text-align: left;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}

.profile-card:hover,
.profile-card.selected {
  border-color: var(--accent-mid);
}

.profile-card.selected {
  box-shadow: inset 3px 0 0 var(--accent);
}

.profile-card strong {
  display: block;
  margin: 5px 0 7px;
  font-size: 14px;
}

.profile-card p {
  display: -webkit-box;
  overflow: hidden;
  margin-bottom: 12px;
  color: var(--text2);
  font-size: 12px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.profile-type {
  color: var(--accent);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.unavailable-state {
  padding: 28px;
  background: var(--surface2);
}

.unavailable-state.compact {
  min-height: 140px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.unavailable-state strong {
  display: block;
  margin-bottom: 5px;
  color: var(--text2);
  font-size: 14px;
}

.unavailable-state p {
  max-width: 680px;
  color: var(--text3);
  font-size: 13px;
  line-height: 1.65;
}

.matrix-wrap,
.resources-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-family: inherit;
  font-size: 13px;
}

th,
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

th {
  color: var(--text3);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

tbody tr:last-child td {
  border-bottom: 0;
}

.matrix-wrap td[colspan] {
  padding: 28px 14px;
  color: var(--text3);
  text-align: center;
}

.resource-media {
  display: block;
  margin-top: 3px;
  color: var(--text3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
}

.format-pill {
  border-radius: 5px;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
}

.actions {
  margin-top: 18px;
}

.action {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 9px 13px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
}

.action.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.action:hover {
  border-color: var(--accent-mid);
  text-decoration: none;
}

.empty-page {
  max-width: 620px;
  padding: 60px 0;
}

.empty-page p {
  margin-bottom: 20px;
  color: var(--text2);
}

@media (max-width: 980px) {
  .hero,
  .primer-context,
  .diagram-layout,
  .profile-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    align-items: stretch;
  }

  .stats-grid {
    max-width: 420px;
  }

  .detail-panel {
    position: static;
  }
}

@media (max-width: 760px) {
  .primer-page {
    width: min(100% - 32px, 1180px);
    padding-top: 150px;
  }

  .section-nav {
    top: 104px;
  }

  .source-line {
    align-items: flex-start;
    flex-direction: column;
  }

  .source-line a {
    width: 100%;
  }

  .diagram-stage {
    min-height: 280px;
  }
}
</style>
