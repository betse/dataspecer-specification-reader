<script setup lang="ts">
import {
  defaultClassSelection,
  showRequirementColumn,
  sortClassesByRole,
} from "./model/explorer-defaults";
import "../../shared/styles/semantic-loading.css";
import { computed, nextTick, reactive, ref, shallowRef, watch } from "vue";
import { RouterLink } from "vue-router";
import { routes } from "../../app/router";
import { collectReferencedClasses } from "./model/referenced-classes";
import {
  selectCodeProperties,
  setCodePropertyPreset,
  type CodePropertySelection,
} from "./model/code-property-selection";
import { loadSemanticSpecification } from "../../data/loading/load-semantic-specification";
import type { SemanticSpecification } from "../../data/semantic/semantic-specification";
import { useSpecificationState } from "../../state/specification-state";
import {
  createSpecificationExplorer,
  type ExplorerClass,
  type ExplorerProperty,
} from "./model/specification-explorer";

import ClassReference from "./ClassReference.vue";

type RoleFilter = "all" | "main" | "supportive";
type CodeFormat = "typescript" | "json" | "turtle";
type ColumnId =
  "name" | "requirement" | "type" | "cardinality" | "range" | "domain" | "definition" | "iri";

interface ExplorerColumn {
  id: ColumnId;
  label: string;
  always: boolean;
  simple: boolean;
}

interface PanelState {
  requirement: string;
  propertyKind: string;
  rangeIri: string;
  search: string;
  detailsOpen: boolean;
  columnOverrides: Partial<Record<ColumnId, boolean>>;
  columnWidths: Partial<Record<ColumnId, number>>;
  sortColumn?: ColumnId;
  sortDirection: 1 | -1;
}

const columns: ExplorerColumn[] = [
  { id: "name", label: "Label", always: true, simple: true },
  { id: "requirement", label: "Requirement", always: false, simple: true },
  { id: "type", label: "Value type", always: false, simple: false },
  { id: "cardinality", label: "Cardinality", always: false, simple: false },
  { id: "range", label: "Range", always: false, simple: false },
  { id: "domain", label: "Domain", always: false, simple: false },
  { id: "definition", label: "Definition", always: false, simple: true },
  { id: "iri", label: "IRI", always: false, simple: false },
];

const state = useSpecificationState();
const semanticSpecification = shallowRef<SemanticSpecification>();
const isLoading = ref(false);
const errorMessage = ref<string>();
const roleFilter = ref<RoleFilter>("all");
const sidebarSearch = ref("");
const selectedClassIris = ref<string[]>([]);
const activeView = ref<"list" | "code">("list");
const codeFormat = ref<CodeFormat>("typescript");
const codeCopied = ref(false);
const codeSidebarTab = ref<"classes" | "properties">("classes");
const codePropertySearch = ref("");
const codeRequirement = ref("all");
const codePropertySelection = ref<CodePropertySelection>({});
const expandedPropertyKeys = ref<string[]>([]);
const openColumnPickerIri = ref<string>();
const panelStates = reactive<Record<string, PanelState>>({});

const explorer = computed(() =>
  state.specification && semanticSpecification.value
    ? createSpecificationExplorer(state.specification, semanticSpecification.value)
    : undefined,
);
const selectedClasses = computed(() =>
  selectedClassIris.value.flatMap((iri) => {
    const value = explorer.value?.classes.find((item) => item.iri === iri);
    return value ? [value] : [];
  }),
);
const selectedPropertyCount = computed(() =>
  selectedClasses.value.reduce((total, value) => total + value.properties.length, 0),
);
// Keep the original model intact: only code generation sees the inclusion overrides.
const codeClasses = computed(() =>
  selectCodeProperties(explorer.value?.classes ?? [], codePropertySelection.value),
);
const selectedCodeClasses = computed(() =>
  selectedClassIris.value.flatMap((iri) => {
    const value = codeClasses.value.find((item) => item.iri === iri);
    return value ? [value] : [];
  }),
);
const codePropertyCount = computed(() =>
  selectedCodeClasses.value.reduce((sum, value) => sum + value.properties.length, 0),
);
const omittedMandatory = computed(() =>
  selectedClasses.value.flatMap((value) =>
    value.properties
      .filter(
        (property) =>
          property.requirement === "mandatory" && !isCodePropertyIncluded(value.iri, property.iri),
      )
      .map((property) => ({
        key: JSON.stringify([value.iri, property.iri]),
        label: value.label + " — " + property.label,
      })),
  ),
);
const codePropertyGroups = computed(() => {
  const query = codePropertySearch.value.trim().toLocaleLowerCase();
  return selectedClasses.value
    .map((value) => ({
      ...value,
      properties: value.properties.filter(
        (property) =>
          (codeRequirement.value === "all" ||
            (property.requirement ?? "unspecified") === codeRequirement.value) &&
          (!query ||
            [property.label, property.iri].some((text) =>
              text.toLocaleLowerCase().includes(query),
            )),
      ),
    }))
    .filter((value) => value.properties.length > 0);
});
function isCodePropertyIncluded(classIri: string, propertyIri: string): boolean {
  return codePropertySelection.value[classIri]?.[propertyIri] !== false;
}
function toggleCodeProperty(classIri: string, propertyIri: string) {
  const included = isCodePropertyIncluded(classIri, propertyIri);
  (codePropertySelection.value[classIri] ??= {})[propertyIri] = !included;
}
function applyCodePropertyPreset(mandatoryOnly: boolean) {
  Object.assign(
    codePropertySelection.value,
    setCodePropertyPreset(selectedClasses.value, mandatoryOnly),
  );
}
const referencedClasses = computed(() =>
  collectReferencedClasses(codeClasses.value, selectedClassIris.value),
);
const referencedClassCount = computed(
  () => referencedClasses.value.classIris.length - selectedClassIris.value.length,
);

function includeReferencedClasses() {
  selectedClassIris.value = referencedClasses.value.classIris;
}

const filteredClasses = computed(() => {
  const query = sidebarSearch.value.trim().toLocaleLowerCase();
  return sortClassesByRole(explorer.value?.classes ?? []).filter((value) => {
    const matchesRole = roleFilter.value === "all" || value.role === roleFilter.value;
    const matchesSearch =
      !query ||
      value.label.toLocaleLowerCase().includes(query) ||
      value.iri.toLocaleLowerCase().includes(query) ||
      value.properties.some((property) =>
        [property.label, property.iri].some((text) => text.toLocaleLowerCase().includes(query)),
      );
    return matchesRole && matchesSearch;
  });
});
const generatedCode = computed(() => {
  if (!selectedClasses.value.length) return "// Select a class from the sidebar";
  return selectedCodeClasses.value
    .map((value) => {
      if (codeFormat.value === "json") return createJsonSchema(value);
      if (codeFormat.value === "turtle") return createTurtleExample(value);
      return createTypeScriptInterface(value);
    })
    .join("\n\n");
});
const highlightedCode = computed(() => highlightCode(generatedCode.value, codeFormat.value));

watch(
  () => state.specification,
  async (specification, _previous, onCleanup) => {
    semanticSpecification.value = undefined;
    errorMessage.value = undefined;
    selectedClassIris.value = [];
    codePropertySelection.value = {};
    codePropertySearch.value = "";
    codeRequirement.value = "all";
    codeSidebarTab.value = "classes";
    if (!specification) return;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    isLoading.value = true;
    try {
      const result = await loadSemanticSpecification(specification);
      if (!cancelled) semanticSpecification.value = result;
    } catch (error) {
      if (!cancelled) errorMessage.value = error instanceof Error ? error.message : String(error);
    } finally {
      if (!cancelled) isLoading.value = false;
    }
  },
  { immediate: true },
);

watch(
  () => explorer.value?.classes,
  (classes) => {
    if (!classes) return;
    selectedClassIris.value = defaultClassSelection(classes);
  },
);

watch(
  () => state.detailMode,
  () => {
    for (const value of Object.values(panelStates)) {
      const requirement = value.columnOverrides.requirement;
      value.columnOverrides = requirement === undefined ? {} : { requirement };
    }
  },
);

function panelState(iri: string): PanelState {
  return (panelStates[iri] ??= {
    requirement: "",
    propertyKind: "",
    rangeIri: "",
    search: "",
    detailsOpen: false,
    columnOverrides: {},
    columnWidths: {},
    sortDirection: 1,
  });
}

function isColumnVisible(classIri: string, column: ExplorerColumn): boolean {
  if (column.always) return true;
  const override = panelState(classIri).columnOverrides[column.id];
  if (column.id === "requirement") {
    const properties =
      explorer.value?.classes.find((value) => value.iri === classIri)?.properties ?? [];
    return showRequirementColumn(properties, override);
  }
  return override ?? (state.detailMode === "simple" ? column.simple : true);
}

function visibleColumns(classIri: string): ExplorerColumn[] {
  return columns.filter((column) => isColumnVisible(classIri, column));
}

function toggleColumn(classIri: string, column: ExplorerColumn) {
  if (column.always) return;
  panelState(classIri).columnOverrides[column.id] = !isColumnVisible(classIri, column);
}

const MIN_COLUMN_WIDTH = 140;
const MAX_COLUMN_WIDTH = 1200;
const resizing = ref<{
  iri: string;
  column: ColumnId;
  x: number;
  width: number;
  pointerId: number;
}>();

function columnWidth(iri: string, column: ColumnId): number {
  return panelState(iri).columnWidths[column] ?? (column === "definition" ? 360 : 180);
}

function setColumnWidth(iri: string, column: ColumnId, width: number) {
  panelState(iri).columnWidths[column] = Math.max(
    MIN_COLUMN_WIDTH,
    Math.min(MAX_COLUMN_WIDTH, width),
  );
}

function startResize(event: PointerEvent, iri: string, column: ColumnId) {
  if (event.button !== 0) return;
  const handle = event.currentTarget as HTMLElement;
  // Capture rendered widths after the table stretches to fill its container.
  // This prevents a jump back to default pixel widths when dragging starts.
  const headers = handle.closest("table")?.querySelectorAll<HTMLElement>("th[data-column-id]");
  headers?.forEach((header) => {
    panelState(iri).columnWidths[header.dataset.columnId as ColumnId] =
      header.getBoundingClientRect().width;
  });
  const width = handle.parentElement?.getBoundingClientRect().width ?? columnWidth(iri, column);
  resizing.value = { iri, column, x: event.clientX, width, pointerId: event.pointerId };
  handle.setPointerCapture(event.pointerId);
}

function resizeColumn(event: PointerEvent) {
  const current = resizing.value;
  if (!current || event.pointerId !== current.pointerId) return;
  setColumnWidth(current.iri, current.column, current.width + event.clientX - current.x);
}

function finishResize(event: PointerEvent) {
  if (resizing.value?.pointerId !== event.pointerId) return;
  const handle = event.currentTarget as HTMLElement;
  resizing.value = undefined;
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
}

function resetColumns(classIri: string) {
  panelState(classIri).columnOverrides = {};
}

function hasLocalClass(iri: string): boolean {
  return explorer.value?.classes.some((value) => value.iri === iri) ?? false;
}

function classPanelId(iri: string): string {
  return "explorer-class-" + encodeURIComponent(iri);
}

async function navigateToClass(iri: string) {
  if (!hasLocalClass(iri)) return;
  if (!selectedClassIris.value.includes(iri)) {
    selectedClassIris.value = [...selectedClassIris.value, iri];
  }
  activeView.value = "list";
  panelState(iri).detailsOpen = true;
  await nextTick();
  const panel = globalThis.document.getElementById(classPanelId(iri));
  panel?.focus({ preventScroll: true });
  panel?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectClass(iri: string, additive: boolean) {
  if (!additive) selectedClassIris.value = [iri];
  else if (!selectedClassIris.value.includes(iri)) {
    selectedClassIris.value = [...selectedClassIris.value, iri];
  }
}

function toggleClass(iri: string) {
  selectedClassIris.value = selectedClassIris.value.includes(iri)
    ? selectedClassIris.value.filter((value) => value !== iri)
    : [...selectedClassIris.value, iri];
}

function selectAll() {
  selectedClassIris.value = (explorer.value?.classes ?? []).map((value) => value.iri);
}

function clearSelection() {
  selectedClassIris.value = [];
}

// Options come from every property, independent of the active table filters.
function rangeOptions(value: ExplorerClass): { iri: string; label: string }[] {
  const labels = new Map<string, string>();
  for (const property of value.properties) {
    property.rangeIris.forEach((iri, index) => {
      if (!labels.has(iri)) labels.set(iri, property.rangeLabels[index] || termLabel(iri));
    });
  }
  const counts = new Map<string, number>();
  for (const label of labels.values()) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...labels]
    .map(([iri, label]) => ({
      iri,
      label: (counts.get(label) ?? 0) > 1 ? label + " — " + iri : label,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function visibleProperties(value: ExplorerClass): ExplorerProperty[] {
  const filters = panelState(value.iri);
  const query = filters.search.trim().toLocaleLowerCase();
  const result = value.properties.filter((property) => {
    const matchesRequirement = !filters.requirement || property.requirement === filters.requirement;
    const matchesKind = !filters.propertyKind || property.kind === filters.propertyKind;
    const matchesSearch =
      !query ||
      [
        property.label,
        property.iri,
        property.definition,
        property.domainLabel,
        ...property.rangeLabels,
      ].some((text) => text?.toLocaleLowerCase().includes(query));
    const matchesRange = !filters.rangeIri || property.rangeIris.includes(filters.rangeIri);
    return matchesRequirement && matchesKind && matchesRange && matchesSearch;
  });
  if (filters.sortColumn) {
    result.sort(
      (left, right) =>
        propertyColumnValue(left, filters.sortColumn!).localeCompare(
          propertyColumnValue(right, filters.sortColumn!),
          undefined,
          { numeric: true, sensitivity: "base" },
        ) * filters.sortDirection,
    );
  }
  return result;
}

function sortTable(classIri: string, column: ColumnId) {
  const value = panelState(classIri);
  if (value.sortColumn === column) value.sortDirection *= -1;
  else {
    value.sortColumn = column;
    value.sortDirection = 1;
  }
}

function propertyColumnValue(property: ExplorerProperty, column: ColumnId): string {
  const values: Record<ColumnId, string> = {
    name: property.label,
    requirement: property.requirement ?? "",
    type: property.kind,
    cardinality: property.cardinality ?? "",
    range: property.rangeLabels.join(", "),
    domain: property.domainLabel ?? "",
    definition: property.definition ?? "",
    iri: property.iri,
  };
  return values[column];
}

function toggleProperty(classIri: string, propertyIri: string) {
  const key = `${classIri}\n${propertyIri}`;
  expandedPropertyKeys.value = expandedPropertyKeys.value.includes(key)
    ? expandedPropertyKeys.value.filter((value) => value !== key)
    : [...expandedPropertyKeys.value, key];
}

function isPropertyExpanded(classIri: string, propertyIri: string): boolean {
  return expandedPropertyKeys.value.includes(`${classIri}\n${propertyIri}`);
}

function roleLabel(value: ExplorerClass): string {
  return value.role ?? (value.kind === "class-profile" ? "profile" : "class");
}

function profileLabels(value: ExplorerClass): string[] {
  const iris = [...value.profiledClassIris, ...value.profileOfIris];
  return iris.map((iri) => termLabel(iri));
}

function termLabel(iri: string): string {
  const term = [...(explorer.value?.classes ?? []), ...(explorer.value?.properties ?? [])].find(
    (value) => value.iri === iri,
  );
  if (term) return term.label;
  return decodeURIComponent(
    iri
      .replace(/[/#]+$/, "")
      .split(/[/#]/)
      .pop() ?? iri,
  );
}

function createTypeScriptInterface(value: ExplorerClass): string {
  const rows = value.properties.flatMap((property) => {
    const optional = property.requirement === "mandatory" ? "" : "?";
    const rawType = propertyTypeName(property);
    const type = rawType.includes(" | ") ? "(" + rawType + ")" : rawType;
    const many = property.cardinality?.endsWith("*") ? "[]" : "";
    const declaration = `  ${safeIdentifier(property.label)}${optional}: ${type}${many};`;
    return state.detailMode === "detailed"
      ? [`  /** ${property.definition || property.label} */`, declaration]
      : [declaration];
  });
  const description =
    state.detailMode === "detailed" ? `/** ${value.definition || value.label} */\n` : "";
  return `${description}export interface ${safeIdentifier(value.label)} {\n${rows.join("\n")}\n}`;
}

function createJsonSchema(value: ExplorerClass): string {
  const required: string[] = [];
  const properties = Object.fromEntries(
    value.properties.map((property) => {
      const name = safeIdentifier(property.label);
      const schema: Record<string, unknown> = {
        type: property.kind === "object" ? "object" : jsonType(property),
      };
      if (state.detailMode === "detailed") {
        schema.description = property.definition || property.label;
      }
      if (property.requirement === "mandatory") required.push(name);
      return [
        name,
        property.cardinality?.endsWith("*") ? { type: "array", items: schema } : schema,
      ];
    }),
  );
  return JSON.stringify(
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: value.label,
      ...(state.detailMode === "detailed" && value.definition
        ? { description: value.definition }
        : {}),
      type: "object",
      properties,
      required,
    },
    null,
    2,
  );
}

function createTurtleExample(value: ExplorerClass): string {
  const statements = value.properties.map((property) => {
    const target = property.kind === "object" ? `<${property.rangeIris[0] ?? ""}>` : '"string"';
    const description =
      state.detailMode === "detailed" ? `  # ${property.definition || property.label}\n` : "";
    return `${description}  <${property.iri}> ${target}`;
  });
  const description =
    state.detailMode === "detailed" ? `# ${value.definition || value.label}\n` : "";
  return `${description}<${value.iri}>\n  a <${value.profiledClassIris[0] ?? value.iri}>${statements.length ? " ;\n" : " ."}${statements.join(" ;\n")} .`;
}

function propertyTypeName(property: ExplorerProperty): string {
  if (property.kind !== "datatype") {
    // Match interface declaration labels and preserve all object ranges.
    const types = property.rangeIris.map((iri, index) => {
      const target = explorer.value?.classes.find((value) => value.iri === iri);
      return safeIdentifier(target?.label ?? property.rangeLabels[index] ?? termLabel(iri));
    });
    return [...new Set(types)].join(" | ") || "unknown";
  }
  const range = property.rangeLabels[0]?.toLocaleLowerCase() ?? "";
  if (range.includes("boolean")) return "boolean";
  if (range.includes("integer") || range.includes("decimal") || range.includes("number")) {
    return "number";
  }
  if (range.includes("date")) return "Date";
  return "string";
}

function jsonType(property: ExplorerProperty): string {
  const type = propertyTypeName(property);
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  return "string";
}

function highlightCode(code: string, format: CodeFormat): string {
  let html = escapeHtml(code);
  if (format === "typescript") {
    html = html
      .replace(/(\/\*\*[\s\S]*?\*\/)/g, '<span class="cc">$1</span>')
      .replace(/\b(export|interface)\b/g, '<span class="ck">$1</span>')
      .replace(/\b(string|number|boolean|Date)\b/g, '<span class="ct">$1</span>');
  } else if (format === "json") {
    html = html
      .replace(/(&quot;.*?&quot;)(?=\s*:)/g, '<span class="ck">$1</span>')
      .replace(/:\s*(&quot;.*?&quot;)/g, ': <span class="cs">$1</span>')
      .replace(/\b(true|false|null|\d+)\b/g, '<span class="ct">$1</span>');
  } else {
    html = html
      .replace(/(^|\n)(\s*#.*)/g, '$1<span class="cc">$2</span>')
      .replace(/(&lt;.*?&gt;)/g, '<span class="ck">$1</span>')
      .replace(/(&quot;.*?&quot;)/g, '<span class="cs">$1</span>')
      .replace(/\b(a)\b/g, '<span class="ct">$1</span>');
  }
  return html;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function copyCode() {
  await globalThis.navigator.clipboard.writeText(generatedCode.value);
  codeCopied.value = true;
  globalThis.setTimeout(() => (codeCopied.value = false), 1400);
}

function safeIdentifier(value?: string): string {
  const result = (value ?? "Resource").replace(/[^a-zA-Z0-9_$]+(.)?/g, (_match, next) =>
    next ? String(next).toUpperCase() : "",
  );
  return /^[a-zA-Z_$]/.test(result) ? result : `_${result}`;
}
</script>

<template>
  <div class="explorer-shell" :aria-busy="isLoading">
    <Transition name="semantic-reveal" mode="out-in">
      <section v-if="!state.specification" key="empty" class="load-state">
        <h1>No specification loaded</h1>
        <p>Load a published specification before opening the explorer.</p>
        <RouterLink :to="routes.landing">Load specification</RouterLink>
      </section>
      <section v-else-if="isLoading" key="loading" class="load-state" role="status">
        <h1>
          <span class="semantic-loading-spinner" aria-hidden="true"></span>Loading semantic data…
        </h1>
        <p>Reading vocabulary and application-profile artifacts.</p>
      </section>
      <section v-else-if="errorMessage" key="error" class="load-state error" role="alert">
        <h1>Unable to load the explorer</h1>
        <p>{{ errorMessage }}</p>
      </section>
      <section v-else-if="explorer" key="content" class="layout">
        <aside class="sidebar">
          <div v-if="activeView === 'list' || codeSidebarTab === 'classes'" class="sb-head">
            <div class="sb-section-label">Search</div>
            <div class="search-wrap">
              <svg
                class="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                v-model="sidebarSearch"
                class="search-input"
                type="search"
                placeholder="Search classes or properties…"
                aria-label="Find classes by class or property label or IRI"
              />
            </div>
            <div>
              <div class="sb-section-label">Class role</div>
              <div class="role-chips">
                <button
                  v-for="role in ['all', 'main', 'supportive'] as const"
                  :key="role"
                  class="role-chip"
                  :class="{ [`on-${role}`]: roleFilter === role }"
                  type="button"
                  @click="roleFilter = role"
                >
                  {{ role[0].toUpperCase() + role.slice(1) }}
                </button>
              </div>
            </div>
          </div>
          <div v-else class="sb-head code-property-controls">
            <label for="code-property-search" class="sb-section-label">Search</label>
            <div class="search-wrap">
              <svg
                class="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="code-property-search"
                v-model="codePropertySearch"
                class="search-input"
                type="search"
                placeholder="Search properties…"
              />
            </div>
            <label for="code-requirement" class="sb-section-label">Requirement</label>
            <select id="code-requirement" v-model="codeRequirement" class="search-input">
              <option value="all">All</option>
              <option value="mandatory">Mandatory</option>
              <option value="recommended">Recommended</option>
              <option value="optional">Optional</option>
              <option value="unspecified">Unspecified</option>
            </select>
          </div>
          <div
            v-if="activeView === 'code'"
            class="code-sidebar-tabs"
            role="group"
            aria-label="Code selection"
          >
            <button
              v-for="tab in ['classes', 'properties'] as const"
              :key="tab"
              class="code-sidebar-tab"
              :class="{ active: codeSidebarTab === tab }"
              :aria-pressed="codeSidebarTab === tab"
              type="button"
              @click="codeSidebarTab = tab"
            >
              {{ tab === "classes" ? "Classes" : "Properties" }}
            </button>
          </div>
          <template v-if="activeView === 'list' || codeSidebarTab === 'classes'">
            <div v-if="activeView === 'list'" class="class-list-heading">Classes</div>
            <p id="class-selection-hint" class="selection-hint">
              Click to select one. Shift+click to add. Use checkboxes to toggle.
            </p>
            <div class="class-list">
              <div
                v-for="item in filteredClasses"
                :key="item.iri"
                class="class-item"
                :class="{ selected: selectedClassIris.includes(item.iri) }"
              >
                <input
                  class="ci-check"
                  type="checkbox"
                  :checked="selectedClassIris.includes(item.iri)"
                  :aria-label="'Include ' + item.label + ' in active context'"
                  @change="toggleClass(item.iri)"
                />
                <button
                  class="class-select"
                  type="button"
                  :aria-pressed="selectedClassIris.includes(item.iri)"
                  aria-describedby="class-selection-hint"
                  @click="selectClass(item.iri, $event.shiftKey)"
                >
                  <span class="ci-badge" :class="item.role">{{ roleLabel(item) }}</span>
                  <span class="ci-name">{{ item.label }}</span>
                  <span class="ci-count">{{ item.properties.length }}</span>
                </button>
              </div>
              <p v-if="!filteredClasses.length" class="class-list-empty">No matching classes.</p>
            </div>
            <div class="sb-footer">
              <button class="sel-btn" type="button" @click="selectAll">Select all</button>
              <button class="sel-btn" type="button" @click="clearSelection">Clear</button>
            </div>
          </template>
          <template v-else>
            <p class="selection-hint">
              Choose properties to include in code. Filters only narrow this checklist.
            </p>
            <div class="class-list">
              <section
                v-for="item in codePropertyGroups"
                :key="item.iri"
                class="code-property-group"
              >
                <h3 :title="item.iri">{{ item.label }}</h3>
                <label
                  v-for="property in item.properties"
                  :key="property.iri"
                  class="code-property-option"
                  :title="property.iri"
                >
                  <input
                    type="checkbox"
                    :checked="isCodePropertyIncluded(item.iri, property.iri)"
                    :aria-label="'Include ' + property.label + ' in ' + item.label + ' code'"
                    @change="toggleCodeProperty(item.iri, property.iri)"
                  />
                  <span
                    >{{ property.label
                    }}<small>{{ property.requirement ?? "Unspecified" }}</small></span
                  >
                </label>
              </section>
              <p v-if="!selectedClasses.length" class="class-list-empty">
                Select classes in the Classes tab first.
              </p>
              <p v-else-if="!selectedPropertyCount" class="class-list-empty">
                No properties are available for the selected classes.
              </p>
              <p v-else-if="!codePropertyGroups.length" class="class-list-empty">
                No properties match your search or filters.
              </p>
            </div>
            <div class="sb-footer code-property-actions">
              <span>Apply to all selected classes, regardless of filters:</span>
              <button
                class="sel-btn"
                type="button"
                :disabled="!selectedClasses.length"
                @click="applyCodePropertyPreset(false)"
              >
                Include all
              </button>
              <button
                class="sel-btn"
                type="button"
                :disabled="!selectedClasses.length"
                @click="applyCodePropertyPreset(true)"
              >
                Include mandatory only
              </button>
            </div>
          </template>
        </aside>

        <main class="main">
          <div class="view-tabs">
            <button
              class="view-tab"
              :class="{ active: activeView === 'list' }"
              type="button"
              @click="activeView = 'list'"
            >
              <svg viewBox="0 0 24 24">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              List view
            </button>
            <button
              class="view-tab"
              :class="{ active: activeView === 'code' }"
              type="button"
              @click="activeView = 'code'"
            >
              <svg viewBox="0 0 24 24">
                <polyline points="16,18 22,12 16,6" />
                <polyline points="8,6 2,12 8,18" />
              </svg>
              Code view
            </button>
            <div class="vt-spacer"></div>
          </div>

          <div class="ctx-bar">
            <span class="ctx-label">Viewing</span>
            <div class="ctx-tags">
              <span v-if="!selectedClasses.length" class="ctx-empty"
                >Select classes from the sidebar to begin</span
              >
              <span v-for="item in selectedClasses" v-else :key="item.iri" class="ctx-tag">
                {{ item.label }} <button type="button" @click="toggleClass(item.iri)">×</button>
              </span>
            </div>
            <span v-if="selectedClasses.length" class="ctx-count">
              {{ selectedPropertyCount }} properties · {{ selectedClasses.length }} classes
            </span>
          </div>

          <div
            v-if="activeView === 'list'"
            class="panels-scroll"
            @click="openColumnPickerIri = undefined"
          >
            <!-- <details v-if="explorer.warnings.length" class="warnings">
            <summary>{{ explorer.warnings.length }} data loading warnings</summary>
            <ul>
              <li v-for="warning in explorer.warnings" :key="warning">{{ warning }}</li>
            </ul>
          </details> -->
            <div v-if="!selectedClasses.length" class="no-selection">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              <p>No classes selected</p>
              <small>Choose one or more from the sidebar — each gets its own table</small>
            </div>

            <article
              v-for="item in selectedClasses"
              :key="item.iri"
              :id="classPanelId(item.iri)"
              tabindex="-1"
              class="class-panel"
            >
              <header class="panel-header">
                <div class="panel-title-wrap">
                  <h2 class="panel-class-name">{{ item.label }}</h2>
                  <div class="panel-iri">{{ item.iri }}</div>
                </div>
                <button
                  class="panel-detail-btn"
                  :class="{ expanded: panelState(item.iri).detailsOpen }"
                  type="button"
                  @click="panelState(item.iri).detailsOpen = !panelState(item.iri).detailsOpen"
                >
                  Details
                  <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
              </header>
              <div class="class-meta">
                <span class="meta-pill" :class="`role-${item.role ?? 'class'}`">{{
                  roleLabel(item)
                }}</span>
                <span v-for="label in profileLabels(item)" :key="label" class="meta-pill profiled"
                  >profiles {{ label }}</span
                >
              </div>
              <div class="panel-extra" :class="{ open: panelState(item.iri).detailsOpen }">
                <div class="extra-inner">
                  <div class="extra-grid">
                    <div
                      v-for="(reuse, index) in item.reusedValues"
                      :key="index"
                      class="extra-field ef-full"
                    >
                      <label
                        >{{
                          reuse.field === "prefLabel"
                            ? "Label"
                            : reuse.field === "usageNote"
                              ? "Usage note"
                              : "Definition"
                        }}
                        source</label
                      >
                      <div class="ef-val">
                        <span v-if="reuse.resolved">Reused from </span>
                        <span v-else
                          >Reused value unavailable. External vocabularies are not fetched; internal
                          sources may be missing or inaccessible. Source:
                        </span>
                        <a :href="reuse.sourceIri" target="_blank" rel="noopener noreferrer">{{
                          reuse.sourceIri
                        }}</a>
                      </div>
                    </div>
                    <div
                      v-if="
                        !item.definition &&
                        !item.usageNote &&
                        !item.backwardsAssociations.length &&
                        !item.reusedValues?.length
                      "
                      class="extra-field ef-full"
                    >
                      No additional details are available in the loaded artifacts.
                    </div>
                    <div v-if="item.definition" class="extra-field ef-full">
                      <label>Definition</label>
                      <div class="ef-val">{{ item.definition }}</div>
                    </div>
                    <div v-if="item.usageNote" class="extra-field ef-full">
                      <label>Usage note</label>
                      <div class="ef-val">{{ item.usageNote }}</div>
                    </div>
                    <div v-if="item.backwardsAssociations.length" class="extra-field">
                      <label>Backwards associations</label>
                      <ul class="back-list">
                        <li
                          v-for="association in item.backwardsAssociations"
                          :key="association.propertyIri + association.sourceClassIri"
                        >
                          <strong>{{ association.sourceClassLabel }}</strong> ·
                          {{ association.propertyLabel }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div class="panel-toolbar">
                <div class="filter-group">
                  <span class="filter-label">Requirement</span>
                  <select v-model="panelState(item.iri).requirement" class="filter-select">
                    <option value="">All</option>
                    <option value="mandatory">Mandatory</option>
                    <option value="recommended">Recommended</option>
                    <option value="optional">Optional</option>
                  </select>
                </div>
                <div class="filter-group">
                  <span class="filter-label">Value type</span>
                  <select v-model="panelState(item.iri).propertyKind" class="filter-select">
                    <option value="">All</option>
                    <option value="object">Object</option>
                    <option value="datatype">Datatype</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <label class="filter-group">
                  <span class="filter-label">Range</span>
                  <select
                    v-model="panelState(item.iri).rangeIri"
                    class="filter-select range-select"
                    :title="panelState(item.iri).rangeIri || 'All ranges'"
                  >
                    <option value="">All ranges</option>
                    <option
                      v-for="range in rangeOptions(item)"
                      :key="range.iri"
                      :value="range.iri"
                      :title="range.iri"
                    >
                      {{ range.label }}
                    </option>
                  </select>
                </label>
                <div class="tbl-search-wrap">
                  <svg class="tbl-search-icon" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    v-model="panelState(item.iri).search"
                    class="tbl-search-input"
                    type="search"
                    placeholder="Search properties…"
                  />
                </div>
                <span class="row-count"
                  >{{ visibleProperties(item).length }} / {{ item.properties.length }}</span
                >
                <div class="col-picker" @click.stop>
                  <button
                    class="col-picker-btn"
                    type="button"
                    :aria-expanded="openColumnPickerIri === item.iri"
                    @click="
                      openColumnPickerIri = openColumnPickerIri === item.iri ? undefined : item.iri
                    "
                  >
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                    Columns
                  </button>
                  <div v-if="openColumnPickerIri === item.iri" class="col-dropdown" @click.stop>
                    <div class="dd-section">Add / remove columns</div>
                    <div
                      v-for="column in columns.filter((value) => !value.always)"
                      :key="column.id"
                      class="dd-item"
                    >
                      <span
                        class="dd-item-name"
                        :class="{ off: !isColumnVisible(item.iri, column) }"
                      >
                        {{ column.label }}
                      </span>
                      <button
                        class="dd-toggle"
                        :class="isColumnVisible(item.iri, column) ? 'remove' : 'add'"
                        type="button"
                        @click="toggleColumn(item.iri, column)"
                      >
                        {{ isColumnVisible(item.iri, column) ? "−" : "+" }}
                      </button>
                    </div>
                    <div class="dd-divider"></div>
                    <button class="dd-reset" type="button" @click="resetColumns(item.iri)">
                      Reset to {{ state.detailMode }} defaults
                    </button>
                    <button
                      class="dd-reset"
                      type="button"
                      @click="panelState(item.iri).columnWidths = {}"
                    >
                      Reset column widths
                    </button>
                  </div>
                </div>
              </div>

              <div class="table-wrap">
                <div v-if="!visibleProperties(item).length" class="panel-empty">
                  No properties match — try adjusting the filters above.
                </div>
                <table
                  v-else
                  class="spec-table"
                  :style="{
                    width:
                      42 +
                      visibleColumns(item.iri).reduce(
                        (total, column) => total + columnWidth(item.iri, column.id),
                        0,
                      ) +
                      'px',
                  }"
                >
                  <colgroup>
                    <col style="width: 42px" />
                    <col
                      v-for="column in visibleColumns(item.iri)"
                      :key="column.id"
                      :style="{ width: columnWidth(item.iri, column.id) + 'px' }"
                    />
                  </colgroup>
                  <thead>
                    <tr>
                      <th class="expand-column"></th>
                      <th
                        v-for="column in visibleColumns(item.iri)"
                        :key="column.id"
                        :data-column-id="column.id"
                        :class="{ sorted: panelState(item.iri).sortColumn === column.id }"
                        @click="sortTable(item.iri, column.id)"
                      >
                        {{ column.label }}
                        <span class="sa">
                          {{
                            panelState(item.iri).sortColumn === column.id
                              ? panelState(item.iri).sortDirection === 1
                                ? "▲"
                                : "▼"
                              : "⇅"
                          }}
                        </span>
                        <span
                          class="column-resizer"
                          role="separator"
                          tabindex="0"
                          aria-orientation="vertical"
                          :aria-label="'Resize ' + column.label + ' column'"
                          :aria-valuenow="columnWidth(item.iri, column.id)"
                          :aria-valuemin="MIN_COLUMN_WIDTH"
                          :aria-valuemax="MAX_COLUMN_WIDTH"
                          title="Drag to resize. Use arrow keys to adjust; double-click to reset."
                          @click.stop
                          @dblclick.stop="delete panelState(item.iri).columnWidths[column.id]"
                          @pointerdown.stop.prevent="startResize($event, item.iri, column.id)"
                          @pointermove="resizeColumn"
                          @pointerup="finishResize"
                          @pointercancel="finishResize"
                          @lostpointercapture="resizing = undefined"
                          @keydown.left.stop.prevent="
                            setColumnWidth(
                              item.iri,
                              column.id,
                              columnWidth(item.iri, column.id) - 20,
                            )
                          "
                          @keydown.right.stop.prevent="
                            setColumnWidth(
                              item.iri,
                              column.id,
                              columnWidth(item.iri, column.id) + 20,
                            )
                          "
                        ></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="property in visibleProperties(item)" :key="property.iri">
                      <tr>
                        <td class="expand-column">
                          <button
                            class="expand-btn"
                            :class="{ expanded: isPropertyExpanded(item.iri, property.iri) }"
                            type="button"
                            @click="toggleProperty(item.iri, property.iri)"
                          >
                            <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                          </button>
                        </td>
                        <td v-for="column in visibleColumns(item.iri)" :key="column.id">
                          <strong v-if="column.id === 'name'">{{ property.label }}</strong>
                          <template v-else-if="column.id === 'requirement'">
                            <span
                              v-if="property.requirement"
                              class="tag"
                              :class="property.requirement"
                              >{{ property.requirement }}</span
                            >
                            <span v-else>—</span>
                          </template>
                          <span
                            v-else-if="column.id === 'type'"
                            class="tag"
                            :class="property.kind"
                            >{{ property.kind }}</span
                          >
                          <span v-else-if="column.id === 'cardinality'" class="tag card">
                            {{ property.cardinality ?? "—" }}
                          </span>
                          <span v-else-if="column.id === 'range'" class="mono-cell">
                            <template v-for="(iri, index) in property.rangeIris" :key="iri">
                              <span v-if="index">, </span>
                              <ClassReference
                                :iri="iri"
                                :label="property.rangeLabels[index] ?? termLabel(iri)"
                                :local="hasLocalClass(iri)"
                                @navigate="navigateToClass"
                              />
                            </template>
                            <span v-if="!property.rangeIris.length">—</span>
                          </span>
                          <span v-else-if="column.id === 'domain'" class="domain-value">
                            <ClassReference
                              v-if="property.domainIri"
                              :iri="property.domainIri"
                              :label="property.domainLabel ?? termLabel(property.domainIri)"
                              :local="hasLocalClass(property.domainIri)"
                              @navigate="navigateToClass"
                            />
                            <span v-else>—</span>
                          </span>
                          <span v-else-if="column.id === 'definition'" class="definition-cell">
                            {{ property.definition ?? "—" }}
                          </span>
                          <span
                            v-else-if="column.id === 'iri'"
                            class="iri-cell"
                            :title="property.iri"
                          >
                            {{ termLabel(property.iri) }}
                          </span>
                        </td>
                      </tr>
                      <tr v-if="isPropertyExpanded(item.iri, property.iri)" class="detail-row">
                        <td :colspan="visibleColumns(item.iri).length + 1">
                          <div class="detail-grid">
                            <div
                              v-for="(reuse, index) in property.reusedValues"
                              :key="index"
                              class="df full"
                            >
                              <label
                                >{{
                                  reuse.field === "prefLabel"
                                    ? "Label"
                                    : reuse.field === "usageNote"
                                      ? "Usage note"
                                      : "Definition"
                                }}
                                source</label
                              >
                              <div class="dv">
                                {{
                                  reuse.resolved
                                    ? "Reused from"
                                    : "Reused value unavailable in loaded data; external vocabularies are not fetched. Source:"
                                }}
                                <a
                                  :href="reuse.sourceIri"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  >{{ reuse.sourceIri }}</a
                                >
                              </div>
                            </div>
                            <div class="df">
                              <label>Full IRI</label>
                              <div class="dv mono">{{ property.iri }}</div>
                            </div>
                            <div class="df">
                              <label>Value type</label>
                              <div class="dv">{{ property.kind }}</div>
                            </div>
                            <div class="df">
                              <label>Domain</label>
                              <div class="dv domain-value">
                                <ClassReference
                                  v-if="property.domainIri"
                                  :iri="property.domainIri"
                                  :label="property.domainLabel ?? termLabel(property.domainIri)"
                                  :local="hasLocalClass(property.domainIri)"
                                  @navigate="navigateToClass"
                                />
                                <span v-else>—</span>
                              </div>
                            </div>
                            <div class="df">
                              <label>Range</label>
                              <div class="dv">
                                <template v-for="(iri, index) in property.rangeIris" :key="iri">
                                  <span v-if="index">, </span>
                                  <ClassReference
                                    :iri="iri"
                                    :label="property.rangeLabels[index] ?? termLabel(iri)"
                                    :local="hasLocalClass(iri)"
                                    @navigate="navigateToClass"
                                  />
                                </template>
                                <span v-if="!property.rangeIris.length">—</span>
                              </div>
                            </div>
                            <div class="df">
                              <label>Cardinality</label>
                              <div class="dv">{{ property.cardinality ?? "—" }}</div>
                            </div>
                            <div class="df">
                              <label>Requirement</label>
                              <div class="dv">{{ property.requirement ?? "—" }}</div>
                            </div>
                            <div v-if="property.labelDerivedFromIri" class="df full">
                              <label>Label source</label>
                              <div class="dv muted">
                                Derived from the property identifier because no published label was
                                available in the loaded data. This is not a translated or retrieved
                                label.
                              </div>
                            </div>
                            <div v-if="property.definition" class="df full">
                              <label>Definition</label>
                              <div class="dv muted">{{ property.definition }}</div>
                            </div>
                            <div v-if="property.usageNote" class="df full">
                              <label>Usage note</label>
                              <div class="dv muted">{{ property.usageNote }}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </article>
          </div>

          <div v-else class="code-view">
            <div class="code-toolbar">
              <span>Format</span>
              <div class="code-fmt-tabs">
                <button
                  v-for="format in ['typescript', 'json', 'turtle'] as const"
                  :key="format"
                  class="fmt-btn"
                  :class="{ active: codeFormat === format }"
                  type="button"
                  @click="codeFormat = format"
                >
                  {{ format === "typescript" ? "TS" : format === "json" ? "JSON" : "TTL" }}
                </button>
              </div>
              <span class="code-context-count"
                >{{ codePropertyCount }} properties from {{ selectedClasses.length }} selected
                classes</span
              >
              <button
                v-if="codeFormat === 'typescript'"
                class="fmt-btn"
                type="button"
                :disabled="!referencedClassCount"
                @click="includeReferencedClasses"
              >
                Include referenced classes ({{ referencedClassCount }})
              </button>
            </div>
            <div
              v-if="codeFormat === 'typescript' && referencedClasses.missingIris.length"
              class="code-reference-warning"
              role="status"
            >
              Definitions for these referenced types are not available in the loaded data. Supply
              their declarations or imports before using the code:
              <ul>
                <li v-for="iri in referencedClasses.missingIris" :key="iri">{{ iri }}</li>
              </ul>
            </div>
            <div v-if="omittedMandatory.length" class="code-reference-warning" role="status">
              Mandatory properties are excluded. This output is a partial selection, not a complete
              conforming record:
              <ul>
                <li v-for="property in omittedMandatory" :key="property.key">
                  {{ property.label }}
                </li>
              </ul>
            </div>
            <pre
              class="code-area"
            ><button class="code-copy" type="button" @click="copyCode">{{ codeCopied ? "Copied!" : "Copy" }}</button><!-- The generated markup is escaped by highlightCode. --><!-- eslint-disable-next-line vue/no-v-html --><code v-html="highlightedCode"></code></pre>
          </div>
        </main>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.code-sidebar-tabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}
.code-sidebar-tab {
  flex: 1;
  padding: 10px 8px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text2);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.code-sidebar-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.code-sidebar-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -3px;
}
.code-property-controls {
  display: grid;
  gap: 8px;
}
.code-property-controls select.search-input {
  width: 100%;
  padding-left: 10px;
}
.code-property-group {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.code-property-group h3 {
  margin: 0 0 8px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.code-property-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  cursor: pointer;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.code-property-option input {
  flex-shrink: 0;
  accent-color: var(--accent);
}
.code-property-option span {
  min-width: 0;
}
.code-property-option small {
  display: block;
  color: var(--text2);
  font-size: 11px;
}
.code-property-actions {
  flex-wrap: wrap;
}
.code-property-actions span {
  width: 100%;
  font-size: 11px;
  color: var(--text2);
}

.range-select {
  max-width: 240px;
  text-overflow: ellipsis;
}
.column-resizer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  touch-action: none;
  border-right: 1px solid var(--border);
}
/* .column-resizer:hover,
.column-resizer:focus-visible {
  background: var(--accent-mid);
  outline: 1px solid var(--border2);
} */

.domain-value {
  font-weight: 400;
}
.class-panel {
  scroll-margin-top: 16px;
}
.code-reference-warning {
  padding: 12px 18px;
  background: var(--amber-bg);
  color: var(--amber-fg);
  overflow-wrap: anywhere;
  max-height: 180px;
  overflow-y: auto;
  flex-shrink: 0;
}
.code-reference-warning ul {
  margin-left: 2em;
}

.explorer-shell {
  --code-bg: #f8f9fc;
  --code-text: #24283b;
  --code-keyword: #2454b8;
  --code-string: #246b36;
  --code-type: #9c2853;
  --code-comment: #626779;
  --bg: #f9f9ff;
  --surface: #fff;
  --surface2: #f1f3ff;
  --surface3: #e9edff;
  --border: #e3dff1;
  --border2: #797587;
  --text: #141b2c;
  --text2: #484556;
  --text3: #797587;
  --accent: #2454d6;
  --accent-bg: #dfe7ff;
  --accent-mid: #b8c9ff;
  --amber-bg: #fef0da;
  --amber-fg: #7a4a08;
  --red-bg: #feeaea;
  --red-fg: #9a2020;
  --gray-bg: #f1f3ff;
  --gray-fg: #484556;
  --mono: "JetBrains Mono", monospace;
  font-family: "Jost", sans-serif;
  height: calc(100vh - 52px);
  font-size: calc(15px + var(--responsive-font-increase));
  line-height: 1.6;
  background: var(--bg);
  color: var(--text);
}
:global([data-theme="dark"] .explorer-shell) {
  --code-bg: #1a1c24;
  --code-text: #cdd6f4;
  --code-keyword: #89b4fa;
  --code-string: #a6e3a1;
  --code-type: #f38ba8;
  --code-comment: #a0a5ba;
  --bg: #293041;
  --surface: #141b2c;
  --surface2: #293041;
  --surface3: #363942;
  --border: #484556;
  --border2: #797587;
  --text: #edf0ff;
  --text2: #c4c6d2;
  --text3: #c0c2ce;
  --accent: #b8c9ff;
  --accent-bg: #10265f;
  --accent-mid: #2454d6;
  --amber-bg: #271a08;
  --amber-fg: #f0b86e;
  --red-bg: #2a1010;
  --red-fg: #f09090;
  --gray-bg: #293041;
  --gray-fg: #c4c6d2;
}
.layout {
  display: grid;
  grid-template-columns: 252px 1fr;
  height: 100%;
  min-height: 0;
}
.sidebar {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border);
  background: var(--surface);
}
.sb-head {
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--border);
}
.sb-section-label {
  margin-bottom: 7px;
  color: var(--text3);
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.search-wrap {
  position: relative;
  margin-bottom: 10px;
}
.search-icon,
.tbl-search-icon {
  position: absolute;
  top: 50%;
  left: 9px;
  width: 13px;
  height: 13px;
  transform: translateY(-50%);
  color: var(--text3);
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 6px 10px 6px 28px;
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  background: var(--surface2);
  color: var(--text);
  font-size: calc(12px + var(--responsive-font-increase));
}
.search-input:focus {
  border-color: var(--accent);
}
.role-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.role-chip,
.sel-btn {
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface2);
  color: var(--text2);
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 500;
  line-height: 1.4;
  transform: none;
}
.role-chip:hover,
.sel-btn:hover {
  border-color: var(--border2);
  background: var(--surface2);
  transform: none;
}
.role-chip.on-all {
  color: var(--text);
  font-weight: 600;
}
.role-chip.on-main,
.role-chip.on-supportive {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
}
.class-list-heading {
  padding: 7px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text2);
  font-size: calc(11px + var(--responsive-font-increase));
  font-weight: 500;
}
.class-list-empty {
  padding: 7px 14px;
  color: var(--text2);
}
.class-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.class-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  font-weight: 400;
  text-align: left;
  transform: none;
}
.class-item:hover {
  background: var(--surface2);
  transform: none;
}
.class-item.selected {
  background: var(--accent-bg);
}
.class-item.selected .ci-name {
  color: var(--accent);
  font-weight: 500;
}
.selection-hint {
  margin: 0;
  padding: 6px 14px;
  color: var(--text2);
  font-size: 12px;
}
.class-select {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  padding: 7px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  box-shadow: none;
  transform: none;
}
.class-select:hover {
  background: transparent;
  transform: none;
}
.class-select:focus-visible {
  outline: 2px solid var(--accent);
}
.ci-check {
  width: 15px;
  height: 15px;
  margin: 0;
  flex-shrink: 0;
  accent-color: var(--accent);
  cursor: pointer;
}
.ci-badge {
  flex-shrink: 0;
  padding: 2px 5px;
  border-radius: 3px;
  background: var(--surface2);
  color: var(--text2);
  font-size: calc(9px + var(--responsive-font-increase));
  font-weight: 700;
}
.ci-badge.main,
.ci-badge.object {
  background: var(--accent-bg);
  color: var(--accent);
}
.ci-badge.supportive {
  background: var(--blue-bg, var(--accent-bg));
  color: var(--blue-fg, var(--accent));
}
.ci-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: calc(12px + var(--responsive-font-increase));
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ci-count {
  flex-shrink: 0;
  color: var(--text3);
  font-size: calc(10px + var(--responsive-font-increase));
}
.sb-footer {
  display: flex;
  gap: 5px;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
}
.sel-btn {
  border-radius: 5px;
}
.main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}
.view-tabs {
  display: flex;
  height: 42px;
  align-items: center;
  flex-shrink: 0;
  padding: 0 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.view-tab {
  display: flex;
  height: 100%;
  align-items: center;
  gap: 5px;
  padding: 0 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: none;
  color: var(--text2);
  font-size: calc(12px + var(--responsive-font-increase));
  font-weight: 400;
  transform: none;
}
.view-tab:hover {
  background: none;
  color: var(--text);
  transform: none;
}
.view-tab.active {
  border-bottom-color: var(--accent);
  color: var(--accent);
  font-weight: 500;
}
.view-tab svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
.vt-spacer {
  flex: 1;
}
.mode-toggle {
  display: flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface2);
}
.mode-toggle button {
  padding: 3px 11px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text2);
  font-size: calc(11px + var(--responsive-font-increase));
  font-weight: 400;
  transform: none;
}
.mode-toggle button.active {
  background: var(--surface);
  color: var(--text);
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.ctx-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
  padding: 7px 20px;
  border-bottom: 1px solid var(--accent-mid);
  background: var(--accent-bg);
}
.ctx-label {
  flex-shrink: 0;
  color: var(--accent);
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.ctx-tags {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  flex-wrap: wrap;
}
.ctx-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border: 1px solid var(--accent-mid);
  border-radius: 4px;
  background: var(--surface);
  color: var(--accent);
  font-size: calc(11px + var(--responsive-font-increase));
  font-weight: 500;
}
.ctx-tag button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font-size: calc(12px + var(--responsive-font-increase));
  font-weight: 400;
  line-height: 1;
  opacity: 0.5;
  transform: none;
}
.ctx-empty {
  color: var(--text3);
  font-size: calc(11px + var(--responsive-font-increase));
  font-style: italic;
}
.ctx-count {
  margin-left: auto;
  color: var(--text3);
  font-size: calc(11px + var(--responsive-font-increase));
}
.panels-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
.warnings {
  margin-bottom: 12px;
  padding: 5px 10px;
  border: 1px solid #e6c96c;
  border-radius: 6px;
  background: #fff9e6;
  color: #72520c;
  font-size: calc(11px + var(--responsive-font-increase));
}
.class-panel {
  margin-bottom: 18px;
  overflow: visible;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}
.panel-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 18px 0;
}
.panel-title-wrap {
  min-width: 0;
  flex: 1;
}
.panel-class-name {
  margin: 0 0 2px;
  color: var(--text);
  font-size: calc(15px + var(--responsive-font-increase));
  font-weight: 600;
}
.panel-iri {
  color: var(--text3);
  font-family: var(--mono);
  font-size: calc(10px + var(--responsive-font-increase));
  word-break: break-all;
}
.panel-detail-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-top: 2px;
  padding: 4px 8px 4px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text2);
  font-size: calc(11px + var(--responsive-font-increase));
  font-weight: 400;
  white-space: nowrap;
  transform: none;
}
.panel-detail-btn:hover {
  border-color: var(--border2);
  background: var(--surface2);
  color: var(--text);
  transform: none;
}
.panel-detail-btn svg,
.expand-btn svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
}
.panel-detail-btn svg {
  transition: transform 0.15s;
}
.panel-detail-btn.expanded svg {
  transform: rotate(180deg);
}
.class-meta {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  padding: 8px 18px 0;
}
.meta-pill {
  display: inline-flex;
  padding: 2px 8px;
  border: 1px solid transparent;
  border-radius: 20px;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 500;
}
.meta-pill.profiled {
  border-color: var(--border);
  background: var(--surface2);
  color: var(--gray-fg);
}
.panel-extra {
  max-height: 0;
  overflow: hidden;
  transition:
    max-height 0.25s ease,
    padding 0.25s;
}
.panel-extra.open {
  max-height: 600px;
  padding: 12px 18px;
}
.extra-inner {
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}
.extra-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px 22px;
}
.extra-field label,
.df label {
  display: block;
  margin-bottom: 4px;
  color: var(--text3);
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.ef-val {
  color: var(--text2);
  font-size: calc(12px + var(--responsive-font-increase));
  line-height: 1.55;
}
.back-list {
  list-style: none;
}
.back-list li {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 0;
  color: var(--text2);
  font-size: calc(11px + var(--responsive-font-increase));
}
.back-list li::before {
  content: "←";
  color: var(--text3);
  font-size: calc(10px + var(--responsive-font-increase));
}
.ef-full {
  grid-column: 1/-1;
}
.panel-toolbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 10px;
  padding: 9px 18px;
  border-top: 1px solid var(--border);
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 5px;
}
.filter-label {
  color: var(--text3);
  font-size: calc(11px + var(--responsive-font-increase));
  white-space: nowrap;
}
.filter-select {
  min-width: 88px;
  padding: 4px 7px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface2);
  color: var(--text);
  font-size: calc(11px + var(--responsive-font-increase));
}
.tbl-search-wrap {
  position: relative;
  flex-shrink: 0;
}
.tbl-search-icon {
  left: 8px;
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
.tbl-search-input {
  width: 160px;
  padding: 4px 8px 4px 26px;
  border: 1px solid var(--border);
  border-radius: 5px;
  outline: none;
  background: var(--surface2);
  color: var(--text);
  font-size: calc(11px + var(--responsive-font-increase));
  transition: width 0.2s;
}
.tbl-search-input:focus {
  width: 200px;
  border-color: var(--accent);
}
.row-count {
  color: var(--text3);
  font-size: calc(10px + var(--responsive-font-increase));
}
.col-picker {
  position: relative;
  margin-left: auto;
}
.col-picker-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface2);
  color: var(--text2);
  font-size: calc(11px + var(--responsive-font-increase));
  font-weight: 400;
  white-space: nowrap;
  transform: none;
}
.col-picker-btn:hover {
  border-color: var(--border2);
  background: var(--surface2);
  color: var(--text);
  transform: none;
}
.col-picker-btn svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
.col-dropdown {
  position: absolute;
  z-index: 300;
  top: calc(100% + 5px);
  right: 0;
  min-width: 210px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.13);
}
.dd-section {
  padding: 6px 10px 4px;
  color: var(--text3);
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.dd-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  border-radius: 6px;
}
.dd-item:hover {
  background: var(--surface2);
}
.dd-item-name {
  color: var(--text);
  font-size: calc(12px + var(--responsive-font-increase));
}
.dd-item-name.off {
  color: var(--text3);
}
.dd-toggle {
  display: flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: none;
  color: var(--text2);
  font-size: calc(14px + var(--responsive-font-increase));
  font-weight: 400;
  line-height: 1;
  transform: none;
}
.dd-toggle.add {
  border-color: var(--green);
  color: var(--green);
}
.dd-toggle.remove {
  border-color: var(--red-fg);
  color: var(--red-fg);
}
.dd-toggle:hover {
  background: none;
  opacity: 0.7;
  transform: none;
}
.dd-divider {
  height: 1px;
  margin: 5px 0;
  background: var(--border);
}
.dd-reset {
  display: block;
  width: 100%;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface2);
  color: var(--text3);
  font-size: calc(11px + var(--responsive-font-increase));
  font-weight: 400;
  text-align: center;
  transform: none;
  margin: 2px 1px;
}
.dd-reset:hover {
  border-color: var(--border);
  background: var(--surface2);
  color: var(--text2);
  transform: none;
}
.table-wrap {
  overflow-x: auto;
  border-top: 1px solid var(--border);
}
.spec-table {
  min-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: calc(12px + var(--responsive-font-increase));
}
.spec-table th {
  position: relative;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text3);
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 600;
  letter-spacing: 0.05em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.spec-table th.expand-column {
  cursor: default;
}
.sa {
  margin-left: 3px;
  color: var(--text);
  font-size: calc(10px + var(--responsive-font-increase));
  opacity: 0.25;
}
.spec-table th:hover .sa {
  opacity: 0.8;
}
.spec-table th.sorted .sa {
  color: var(--accent);
  opacity: 1;
}
.spec-table tbody tr {
  border-bottom: 1px solid var(--border);
}
.spec-table tbody tr:last-child {
  border-bottom: 0;
}
.spec-table tbody tr:hover {
  background: var(--surface2);
}
.spec-table td {
  overflow-wrap: anywhere;
  padding: 14px;
  vertical-align: top;
}
.expand-column {
  width: 42px !important;
  padding-right: 4px !important;
}
.expand-btn {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text2);
  transform: none;
}
.expand-btn:hover {
  border-color: var(--border2);
  background: var(--surface2);
  transform: none;
}
.expand-btn svg {
  transition: transform 0.15s;
}
.expand-btn.expanded svg {
  transform: rotate(90deg);
}
.tag {
  display: inline-flex;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 600;
  white-space: nowrap;
}
.tag.mandatory {
  background: var(--amber-bg);
  color: var(--amber-fg);
}
.tag.recommended,
.tag.object {
  background: var(--accent-bg);
  color: var(--accent);
}
.tag.optional {
  background: var(--gray-bg);
  color: var(--gray-fg);
}
.tag.datatype {
  background: var(--green-bg);
  color: var(--green);
}
.tag.card {
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text2);
  font-family: var(--mono);
}
.mono-cell {
  color: var(--text2);
  font-family: var(--mono);
  font-size: calc(11px + var(--responsive-font-increase));
}
.definition-cell {
  max-width: 430px;
  color: var(--text2);
}
.iri-cell {
  color: var(--text3);
  font-family: var(--mono);
  font-size: calc(10px + var(--responsive-font-increase));
}
.detail-row td {
  padding: 10px 14px 14px 36px !important;
  background: var(--surface2);
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px 20px;
}
.df .dv {
  color: var(--text);
  font-size: calc(11px + var(--responsive-font-increase));
}
.df .dv.mono {
  font-family: var(--mono);
  font-size: calc(10px + var(--responsive-font-increase));
  overflow-wrap: anywhere;
}
.df .dv.muted {
  color: var(--text2);
}
.df.full {
  grid-column: 1/-1;
}
.panel-empty {
  padding: 28px;
  color: var(--text3);
  font-size: calc(12px + var(--responsive-font-increase));
  text-align: center;
}
.no-selection {
  display: flex;
  height: 360px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: var(--text3);
}
.no-selection svg {
  width: 44px;
  height: 44px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  opacity: 0.2;
}
.no-selection p {
  font-size: calc(13px + var(--responsive-font-increase));
}
.no-selection small {
  font-size: calc(11px + var(--responsive-font-increase));
}
.code-view {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}
.code-toolbar {
  display: flex;
  min-height: 45px;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  color: var(--text3);
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.code-context-count {
  margin-left: auto;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}
.code-sb {
  width: 185px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--surface);
}
.code-sb-title {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text3);
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.code-fmt-tabs {
  display: flex;
  gap: 4px;
}
.fmt-btn {
  padding: 3px 7px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text2);
  font-family: var(--mono);
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 400;
  transform: none;
}
.fmt-btn.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}
.code-nav-item {
  display: block;
  width: 100%;
  padding: 7px 14px;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--text2);
  font-size: calc(11px + var(--responsive-font-increase));
  font-weight: 400;
  text-align: left;
  transform: none;
}
.code-nav-item:hover {
  background: var(--surface2);
  color: var(--text);
  transform: none;
}
.code-nav-item.active {
  border-left-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
}
.code-area {
  flex: 1;
  overflow: auto;
  margin: 0;
  padding: 20px 24px;
  background: var(--code-bg);
  color: var(--code-text);
  font-family: var(--mono);
  font-size: calc(12px + var(--responsive-font-increase));
  line-height: 1.8;
  white-space: pre;
}
.code-area code {
  font: inherit;
}
.code-area :deep(.ck) {
  color: var(--code-keyword);
}
.code-area :deep(.cs) {
  color: var(--code-string);
}
.code-area :deep(.ct) {
  color: var(--code-type);
}
.code-area :deep(.cc) {
  color: var(--code-comment);
}
.code-copy {
  position: sticky;
  top: 0;
  float: right;
  margin: -2px -6px 4px 12px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface2);
  color: var(--text2);
  font-family: "Jost", sans-serif;
  font-size: calc(10px + var(--responsive-font-increase));
  font-weight: 400;
  transform: none;
}
.code-copy:hover {
  border-color: var(--accent);
  background: var(--surface3);
  color: var(--text);
  transform: none;
}
.load-state {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
}
.load-state.error {
  color: var(--red-fg);
}
@media (max-width: 800px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .sidebar {
    max-height: 300px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
  .explorer-shell {
    height: auto;
    min-height: calc(100vh - 52px);
  }
  .main {
    min-height: 650px;
  }
  .panel-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
