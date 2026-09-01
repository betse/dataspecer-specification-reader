<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from "vue";
import { RouterLink } from "vue-router";
import { routes } from "../../app/router";
import { loadSemanticSpecification } from "../../data/loading/load-semantic-specification";
import type { SemanticSpecification } from "../../data/semantic/semantic-specification";
import { useSpecificationState } from "../../state/specification-state";
import {
  createSpecificationExplorer,
  type ExplorerClass,
  type ExplorerProperty,
} from "./model/specification-explorer";

type SidebarTab = "classes" | "properties";
type RoleFilter = "all" | "main" | "supportive";
type CodeFormat = "typescript" | "json" | "turtle";
type ColumnId =
  | "name"
  | "requirement"
  | "type"
  | "cardinality"
  | "range"
  | "domain"
  | "definition"
  | "usageNote"
  | "iri";

interface ExplorerColumn {
  id: ColumnId;
  label: string;
  always: boolean;
  simple: boolean;
}

interface PanelState {
  requirement: string;
  propertyKind: string;
  search: string;
  detailsOpen: boolean;
  columnOverrides: Partial<Record<ColumnId, boolean>>;
  sortColumn?: ColumnId;
  sortDirection: 1 | -1;
}

const columns: ExplorerColumn[] = [
  { id: "name", label: "Name", always: true, simple: true },
  { id: "requirement", label: "Requirement", always: false, simple: true },
  { id: "type", label: "Value type", always: false, simple: false },
  { id: "cardinality", label: "Cardinality", always: false, simple: false },
  { id: "range", label: "Range", always: false, simple: false },
  { id: "domain", label: "Domain", always: false, simple: false },
  { id: "definition", label: "Definition", always: false, simple: true },
  { id: "usageNote", label: "Usage note", always: false, simple: false },
  { id: "iri", label: "IRI", always: false, simple: false },
];

const state = useSpecificationState();
const semanticSpecification = shallowRef<SemanticSpecification>();
const isLoading = ref(false);
const errorMessage = ref<string>();
const sidebarTab = ref<SidebarTab>("classes");
const roleFilter = ref<RoleFilter>("all");
const sidebarSearch = ref("");
const selectedClassIris = ref<string[]>([]);
const activeView = ref<"list" | "code">("list");
const codeFormat = ref<CodeFormat>("typescript");
const codeCopied = ref(false);
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
const uniqueProperties = computed(() => {
  const values = explorer.value?.properties ?? [];
  return [...new Map(values.map((value) => [value.iri, value])).values()];
});
const filteredClasses = computed(() => {
  const query = sidebarSearch.value.trim().toLocaleLowerCase();
  return (explorer.value?.classes ?? []).filter((value) => {
    const matchesRole = roleFilter.value === "all" || value.role === roleFilter.value;
    const matchesSearch =
      !query ||
      value.label.toLocaleLowerCase().includes(query) ||
      value.iri.toLocaleLowerCase().includes(query);
    return matchesRole && matchesSearch;
  });
});
const filteredProperties = computed(() => {
  const query = sidebarSearch.value.trim().toLocaleLowerCase();
  return uniqueProperties.value.filter(
    (value) =>
      !query ||
      value.label.toLocaleLowerCase().includes(query) ||
      value.iri.toLocaleLowerCase().includes(query),
  );
});
const generatedCode = computed(() => {
  if (!selectedClasses.value.length) return "// Select a class from the sidebar";
  return selectedClasses.value
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
    selectedClassIris.value = classes.slice(0, 2).map((value) => value.iri);
  },
);

watch(
  () => state.detailMode,
  (mode) => {
    for (const value of Object.values(panelStates)) {
      value.requirement = mode === "simple" ? "mandatory" : "";
      value.columnOverrides = {};
    }
  },
);

function panelState(iri: string): PanelState {
  return (panelStates[iri] ??= {
    requirement: state.detailMode === "simple" ? "mandatory" : "",
    propertyKind: "",
    search: "",
    detailsOpen: false,
    columnOverrides: {},
    sortDirection: 1,
  });
}

function isColumnVisible(classIri: string, column: ExplorerColumn): boolean {
  if (column.always) return true;
  const override = panelState(classIri).columnOverrides[column.id];
  return override ?? (state.detailMode === "simple" ? column.simple : true);
}

function visibleColumns(classIri: string): ExplorerColumn[] {
  return columns.filter((column) => isColumnVisible(classIri, column));
}

function toggleColumn(classIri: string, column: ExplorerColumn) {
  if (column.always) return;
  panelState(classIri).columnOverrides[column.id] = !isColumnVisible(classIri, column);
}

function resetColumns(classIri: string) {
  panelState(classIri).columnOverrides = {};
}

function toggleClass(iri: string) {
  selectedClassIris.value = selectedClassIris.value.includes(iri)
    ? selectedClassIris.value.filter((value) => value !== iri)
    : [...selectedClassIris.value, iri];
}

function selectProperty(property: ExplorerProperty) {
  const owner = explorer.value?.classes.find((value) => value.iri === property.domainIri);
  if (!owner) return;
  if (!selectedClassIris.value.includes(owner.iri)) {
    selectedClassIris.value = [...selectedClassIris.value, owner.iri];
  }
  panelState(owner.iri).search = property.label;
}

function selectAll() {
  selectedClassIris.value = (explorer.value?.classes ?? []).map((value) => value.iri);
}

function clearSelection() {
  selectedClassIris.value = [];
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
    return matchesRequirement && matchesKind && matchesSearch;
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
    usageNote: property.usageNote ?? "",
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
    const type = propertyTypeName(property);
    const many = property.cardinality?.endsWith("*") ? "[]" : "";
    return [
      `  /** ${property.definition || property.label} */`,
      `  ${safeIdentifier(property.label)}${optional}: ${type}${many};`,
    ];
  });
  return `/** ${value.definition || value.label} */\nexport interface ${safeIdentifier(value.label)} {\n${rows.join("\n")}\n}`;
}

function createJsonSchema(value: ExplorerClass): string {
  const required: string[] = [];
  const properties = Object.fromEntries(
    value.properties.map((property) => {
      const name = safeIdentifier(property.label);
      const schema = {
        type: property.kind === "object" ? "object" : jsonType(property),
        description: property.definition || property.label,
      };
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
      description: value.definition,
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
    return `  # ${property.definition || property.label}\n  <${property.iri}> ${target}`;
  });
  return `# ${value.definition || value.label}\n<${value.iri}>\n  a <${value.profiledClassIris[0] ?? value.iri}>${statements.length ? " ;\n" : " ."}${statements.join(" ;\n")} .`;
}

function propertyTypeName(property: ExplorerProperty): string {
  const range = property.rangeLabels[0]?.toLocaleLowerCase() ?? "";
  if (range.includes("boolean")) return "boolean";
  if (range.includes("integer") || range.includes("decimal") || range.includes("number")) {
    return "number";
  }
  if (range.includes("date")) return "Date";
  return property.kind === "datatype" ? "string" : safeIdentifier(property.rangeLabels[0]);
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
  <div class="explorer-shell">
    <section v-if="!state.specification" class="load-state">
      <h1>No specification loaded</h1>
      <p>Load a published specification before opening the explorer.</p>
      <RouterLink :to="routes.landing">Load specification</RouterLink>
    </section>
    <section v-else-if="isLoading" class="load-state" aria-live="polite">
      <h1>Loading semantic data…</h1>
      <p>Reading vocabulary and application-profile artifacts.</p>
    </section>
    <section v-else-if="errorMessage" class="load-state error" role="alert">
      <h1>Unable to load the explorer</h1>
      <p>{{ errorMessage }}</p>
    </section>
    <section v-else-if="explorer" class="layout">
      <aside class="sidebar">
        <div class="sb-head">
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
              :placeholder="sidebarTab === 'classes' ? 'Filter classes…' : 'Filter properties…'"
            />
          </div>
          <template v-if="sidebarTab === 'classes'">
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
          </template>
        </div>
        <div class="sb-tabs">
          <button
            class="sb-tab"
            :class="{ active: sidebarTab === 'classes' }"
            type="button"
            @click="sidebarTab = 'classes'"
          >
            Classes
          </button>
          <button
            class="sb-tab"
            :class="{ active: sidebarTab === 'properties' }"
            type="button"
            @click="sidebarTab = 'properties'"
          >
            Properties
          </button>
        </div>
        <div class="class-list">
          <template v-if="sidebarTab === 'classes'">
            <button
              v-for="item in filteredClasses"
              :key="item.iri"
              class="class-item"
              :class="{ selected: selectedClassIris.includes(item.iri) }"
              type="button"
              @click="toggleClass(item.iri)"
            >
              <span class="ci-check">
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <polyline points="1,3.5 3.5,6 8,1" stroke="white" stroke-width="1.8" />
                </svg>
              </span>
              <span class="ci-badge" :class="item.role">{{ roleLabel(item) }}</span>
              <span class="ci-name">{{ item.label }}</span>
              <span class="ci-count">{{ item.properties.length }}</span>
            </button>
          </template>
          <template v-else>
            <button
              v-for="property in filteredProperties"
              :key="property.iri"
              class="class-item property-item"
              type="button"
              @click="selectProperty(property)"
            >
              <span class="ci-badge" :class="property.kind">{{ property.kind }}</span>
              <span class="ci-name">{{ property.label }}</span>
            </button>
          </template>
        </div>
        <div class="sb-footer">
          <button class="sel-btn" type="button" @click="selectAll">Select all</button>
          <button class="sel-btn" type="button" @click="clearSelection">Clear</button>
        </div>
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
          <!-- <div
            v-if="explorer.warnings.length"
            class="warnings"
            :title="explorer.warnings.join('\n')"
          >
            {{ explorer.warnings.length }} semantic data warning{{
              explorer.warnings.length === 1 ? "" : "s"
            }}
          </div> -->
          <div v-if="!selectedClasses.length" class="no-selection">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <p>No classes selected</p>
            <small>Choose one or more from the sidebar — each gets its own table</small>
          </div>

          <article v-for="item in selectedClasses" :key="item.iri" class="class-panel">
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
                    <span class="dd-item-name" :class="{ off: !isColumnVisible(item.iri, column) }">
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
                </div>
              </div>
            </div>

            <div class="table-wrap">
              <div v-if="!visibleProperties(item).length" class="panel-empty">
                No properties match — try adjusting the filters above.
              </div>
              <table v-else class="spec-table">
                <thead>
                  <tr>
                    <th class="expand-column"></th>
                    <th
                      v-for="column in visibleColumns(item.iri)"
                      :key="column.id"
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
                        <span v-else-if="column.id === 'type'" class="tag" :class="property.kind">{{
                          property.kind
                        }}</span>
                        <span v-else-if="column.id === 'cardinality'" class="tag card">
                          {{ property.cardinality ?? "—" }}
                        </span>
                        <span v-else-if="column.id === 'range'" class="mono-cell">
                          {{ property.rangeLabels.join(", ") || "—" }}
                        </span>
                        <span v-else-if="column.id === 'domain'">
                          {{ property.domainLabel ?? "—" }}
                        </span>
                        <span v-else-if="column.id === 'definition'" class="definition-cell">
                          {{ property.definition ?? "—" }}
                        </span>
                        <span v-else-if="column.id === 'usageNote'" class="usage-note-cell">
                          {{ property.usageNote ?? "—" }}
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
                            <div class="dv">{{ property.domainLabel ?? "—" }}</div>
                          </div>
                          <div class="df">
                            <label>Range</label>
                            <div class="dv">{{ property.rangeLabels.join(", ") || "—" }}</div>
                          </div>
                          <div class="df">
                            <label>Cardinality</label>
                            <div class="dv">{{ property.cardinality ?? "—" }}</div>
                          </div>
                          <div class="df">
                            <label>Requirement</label>
                            <div class="dv">{{ property.requirement ?? "—" }}</div>
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
              >From {{ selectedClasses.length }} selected classes</span
            >
          </div>
          <pre
            class="code-area"
          ><button class="code-copy" type="button" @click="copyCode">{{ codeCopied ? "Copied!" : "Copy" }}</button><!-- The generated markup is escaped by highlightCode. --><!-- eslint-disable-next-line vue/no-v-html --><code v-html="highlightedCode"></code></pre>
        </div>
      </main>
    </section>
  </div>
</template>

<style scoped>
.explorer-shell {
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
  font-size: 15px;
  line-height: 1.6;
  background: var(--bg);
  color: var(--text);
}
:global([data-theme="dark"] .explorer-shell) {
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
  font-size: 10px;
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
  font-size: 12px;
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
  font-size: 10px;
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
.sb-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}
.sb-tab {
  flex: 1;
  padding: 7px 0;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: none;
  color: var(--text2);
  font-size: 11px;
  font-weight: 500;
  transform: none;
}
.sb-tab:hover {
  border-color: transparent;
  background: none;
  color: var(--text);
  transform: none;
}
.sb-tab.active {
  border-bottom-color: var(--accent);
  color: var(--accent);
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
  padding: 7px 14px;
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
.ci-check {
  display: flex;
  width: 15px;
  height: 15px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1.5px solid var(--border2);
  border-radius: 3px;
  background: var(--surface);
}
.ci-check svg {
  display: none;
}
.class-item.selected .ci-check {
  border-color: var(--accent);
  background: var(--accent);
}
.class-item.selected .ci-check svg {
  display: block;
}
.ci-badge {
  flex-shrink: 0;
  padding: 2px 5px;
  border-radius: 3px;
  background: var(--surface2);
  color: var(--text2);
  font-size: 9px;
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
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ci-count {
  flex-shrink: 0;
  color: var(--text3);
  font-size: 10px;
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
  font-size: 12px;
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
  font-size: 11px;
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
  font-size: 10px;
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
  font-size: 11px;
  font-weight: 500;
}
.ctx-tag button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font-size: 12px;
  font-weight: 400;
  line-height: 1;
  opacity: 0.5;
  transform: none;
}
.ctx-empty {
  color: var(--text3);
  font-size: 11px;
  font-style: italic;
}
.ctx-count {
  margin-left: auto;
  color: var(--text3);
  font-size: 11px;
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
  font-size: 11px;
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
  font-size: 15px;
  font-weight: 600;
}
.panel-iri {
  color: var(--text3);
  font-family: var(--mono);
  font-size: 10px;
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
  font-size: 11px;
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
  font-size: 10px;
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
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.ef-val {
  color: var(--text2);
  font-size: 12px;
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
  font-size: 11px;
}
.back-list li::before {
  content: "←";
  color: var(--text3);
  font-size: 10px;
}
.ef-full {
  grid-column: 1/-1;
}
.panel-toolbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
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
  font-size: 11px;
  white-space: nowrap;
}
.filter-select {
  min-width: 88px;
  padding: 4px 7px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface2);
  color: var(--text);
  font-size: 11px;
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
  font-size: 11px;
  transition: width 0.2s;
}
.tbl-search-input:focus {
  width: 200px;
  border-color: var(--accent);
}
.row-count {
  color: var(--text3);
  font-size: 10px;
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
  font-size: 11px;
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
  font-size: 10px;
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
  font-size: 12px;
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
  font-size: 14px;
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
  font-size: 11px;
  font-weight: 400;
  text-align: center;
  transform: none;
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
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.spec-table th {
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text3);
  font-size: 10px;
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
  font-size: 10px;
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
  font-size: 10px;
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
  font-size: 11px;
}
.definition-cell {
  max-width: 430px;
  color: var(--text2);
}
.usage-note-cell {
  color: var(--text3);
  font-style: italic;
}
.iri-cell {
  color: var(--text3);
  font-family: var(--mono);
  font-size: 10px;
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
  font-size: 11px;
}
.df .dv.mono {
  font-family: var(--mono);
  font-size: 10px;
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
  font-size: 12px;
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
  font-size: 13px;
}
.no-selection small {
  font-size: 11px;
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
  font-size: 10px;
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
  font-size: 10px;
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
  font-size: 10px;
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
  font-size: 11px;
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
  background: #1a1c24;
  color: #cdd6f4;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.8;
  white-space: pre;
}
.code-area code {
  font: inherit;
}
.code-area :deep(.ck) {
  color: #89b4fa;
}
.code-area :deep(.cs) {
  color: #a6e3a1;
}
.code-area :deep(.ct) {
  color: #f38ba8;
}
.code-area :deep(.cc) {
  color: #585b70;
}
.code-copy {
  position: sticky;
  top: 0;
  float: right;
  margin: -2px -6px 4px 12px;
  padding: 4px 10px;
  border: 1px solid #3a3c4e;
  border-radius: 5px;
  background: #252738;
  color: #aaa;
  font-family: "Jost", sans-serif;
  font-size: 10px;
  font-weight: 400;
  transform: none;
}
.code-copy:hover {
  border-color: #666;
  background: #252738;
  color: #fff;
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
