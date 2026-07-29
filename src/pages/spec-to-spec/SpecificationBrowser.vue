<script setup lang="ts">
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  select,
  zoom as createZoom,
  zoomIdentity,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
  type ZoomBehavior,
} from "d3";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { routes } from "../../app/router";
import type {
  SpecificationBrowser,
  SpecificationBrowserEdge,
  SpecificationBrowserNode,
  SpecificationBrowserNodeKind,
} from "./model/specification-browser";

type Scope = "all" | "published-specification" | "external-resource";
type BrowserNode = SpecificationBrowserNode;
type GraphSvgElement = globalThis.SVGSVGElement;
type GraphNode = SimulationNodeDatum & { id: string; node: BrowserNode };
type GraphLink = SimulationLinkDatum<GraphNode>;
type PositionedNode = { node: BrowserNode; x: number; y: number };

const props = defineProps<{ browser: SpecificationBrowser }>();

const query = ref("");
const scope = ref<Scope>("all");
const selectedId = ref<string | null>(null);
const graphSvg = ref<GraphSvgElement | null>(null);
const graphTransform = ref(zoomIdentity.toString());
const positionedNodes = ref<PositionedNode[]>([]);
let zoomBehavior: ZoomBehavior<GraphSvgElement, unknown> | null = null;

const focusNode = computed<BrowserNode>(() => {
  const focalNode = props.browser.nodes.find((node) => node.id === props.browser.focalNodeId);
  if (!focalNode) {
    throw new Error("Specification browser model is missing its focal node.");
  }
  return focalNode;
});

const relationNodes = computed<BrowserNode[]>(() =>
  props.browser.nodes.filter((node) => node.id !== props.browser.focalNodeId),
);

const publishedCount = computed(() => props.browser.counts.published);
const externalCount = computed(() => props.browser.counts.external);

const visibleRelations = computed(() =>
  relationNodes.value.filter((node) => scope.value === "all" || node.kind === scope.value),
);

const visibleNodes = computed(() => [focusNode.value, ...visibleRelations.value]);
const visibleEdges = computed(() => {
  const visibleNodeIds = new Set(visibleNodes.value.map((node) => node.id));
  return props.browser.edges.filter(
    (edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId),
  );
});

const listedNodes = computed(() => {
  const normalizedQuery = query.value.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return visibleNodes.value;
  }

  return visibleNodes.value.filter((node) =>
    [node.title, node.graphLabel, node.iri, node.kindLabel, edgeForNode(node.id)?.predicate]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
});

function layoutGraph(): void {
  const count = visibleRelations.value.length;
  const radius = Math.min(205, 115 + count * 8);
  const simulationNodes: GraphNode[] = [
    {
      id: focusNode.value.id,
      node: focusNode.value,
      x: 500,
      y: 310,
      fx: 500,
      fy: 310,
    },
    ...visibleRelations.value.map((node, index) => {
      const angle = count === 1 ? -Math.PI / 2 : -Math.PI / 2 + (index * Math.PI * 2) / count;
      return {
        id: node.id,
        node,
        x: 500 + Math.cos(angle) * radius,
        y: 310 + Math.sin(angle) * radius,
      };
    }),
  ];
  const links: GraphLink[] = visibleEdges.value.map((edge) => ({
    source: edge.sourceId,
    target: edge.targetId,
  }));

  const simulation = forceSimulation<GraphNode>(simulationNodes)
    .force(
      "link",
      forceLink<GraphNode, GraphLink>(links)
        .id((node) => node.id)
        .distance(radius)
        .strength(1),
    )
    .force("charge", forceManyBody().strength(-380))
    .force("center", forceCenter(500, 310))
    .force("collision", forceCollide<GraphNode>(90).strength(1))
    .stop();

  simulation.tick(180);
  positionedNodes.value = simulationNodes
    .filter((node) => node.id !== focusNode.value.id)
    .map((node) => ({
      node: node.node,
      x: node.x ?? 500,
      y: node.y ?? 310,
    }));
  simulation.stop();
}

const selectedNode = computed(
  () => visibleNodes.value.find((node) => node.id === selectedId.value) ?? null,
);

watch(visibleNodes, (nodes) => {
  if (selectedId.value && !nodes.some((node) => node.id === selectedId.value)) {
    selectedId.value = null;
  }
});

watch([visibleRelations, focusNode], layoutGraph, { immediate: true });

onMounted(() => {
  if (!graphSvg.value) return;
  zoomBehavior = createZoom<GraphSvgElement, unknown>()
    .scaleExtent([0.35, 2.5])
    .on("zoom", (event) => {
      graphTransform.value = event.transform.toString();
    });
  select(graphSvg.value).call(zoomBehavior);
});

onBeforeUnmount(() => {
  if (graphSvg.value) select(graphSvg.value).on(".zoom", null);
});

function setScope(value: Scope): void {
  scope.value = value;
  resetGraph(false);
}

function selectNode(node: BrowserNode): void {
  selectedId.value = node.id;
}

function closeDrawer(): void {
  selectedId.value = null;
}

function edgeForNode(nodeId: string): SpecificationBrowserEdge | undefined {
  return props.browser.edges.find(
    (edge) => edge.sourceId === focusNode.value.id && edge.targetId === nodeId,
  );
}

function nodeClass(kind: SpecificationBrowserNodeKind): string {
  if (kind === "published-specification") return "published";
  if (kind === "external-resource") return "external";
  return "focal";
}

function targetLink(node: SpecificationBrowserNode): string {
  return node.resourceUrl ?? node.iri;
}

function changeZoom(factor: number): void {
  if (!graphSvg.value || !zoomBehavior) return;
  select(graphSvg.value).call(zoomBehavior.scaleBy, factor);
}

function resetGraph(closeSelection = true): void {
  if (graphSvg.value && zoomBehavior) {
    select(graphSvg.value).call(zoomBehavior.transform, zoomIdentity);
  } else {
    graphTransform.value = zoomIdentity.toString();
  }
  if (closeSelection) selectedId.value = null;
}
</script>

<template>
  <div class="browser-panel">
    <div class="browser-sidebar">
      <div class="bs-head">
        <div class="bs-head-title">Search specifications</div>
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
          <input v-model="query" class="search-input" type="search" placeholder="Filter specs…" />
        </div>

        <div class="bs-head-title scope-title">Specification scope</div>
        <div class="rel-filters">
          <button
            class="rel-filter-item"
            :class="{ active: scope === 'all' }"
            type="button"
            @click="setScope('all')"
          >
            <span class="rf-dot all"></span>
            <span>All specifications</span>
            <span class="rf-count">{{ browser.counts.all }}</span>
            <span class="rf-check"><svg viewBox="0 0 9 7"><polyline points="1,3.5 3.5,6 8,1" /></svg></span>
          </button>
          <button
            class="rel-filter-item"
            :class="{ active: scope === 'published-specification' }"
            type="button"
            @click="setScope('published-specification')"
          >
            <span class="rf-dot published"></span>
            <span>Published specifications</span>
            <span class="rf-count">{{ publishedCount }}</span>
            <span class="rf-check"><svg viewBox="0 0 9 7"><polyline points="1,3.5 3.5,6 8,1" /></svg></span>
          </button>
          <button
            class="rel-filter-item"
            :class="{ active: scope === 'external-resource' }"
            type="button"
            @click="setScope('external-resource')"
          >
            <span class="rf-dot external"></span>
            <span>External resources</span>
            <span class="rf-count">{{ externalCount }}</span>
            <span class="rf-check"><svg viewBox="0 0 9 7"><polyline points="1,3.5 3.5,6 8,1" /></svg></span>
          </button>
        </div>
      </div>

      <div class="bs-spec-list">
        <button
          v-for="node in listedNodes"
          :key="node.id"
          class="spec-list-item"
          :class="{ focal: node.kind === 'focal', active: selectedId === node.id }"
          type="button"
          @click="selectNode(node)"
        >
          <span class="sli-dot" :class="nodeClass(node.kind)"></span>
          <span class="sli-name">{{ node.title }}<template v-if="node.kind === 'focal'"> ★</template></span>
          <span class="sli-type">{{ node.kindLabel }}</span>
        </button>
        <p v-if="!listedNodes.length" class="list-empty">No specifications match this search.</p>
      </div>
    </div>

    <div class="graph-area">
      <div class="graph-toolbar">
        <div class="graph-legend">
          <span class="gl-item"><i class="gl-dot focal"></i>{{ focusNode.kindLabel }}</span>
          <span class="gl-item"><i class="gl-dot published"></i>Published Spec</span>
          <span class="gl-item"><i class="gl-dot external"></i>External</span>
        </div>
        <span class="graph-hint">Drag · scroll to zoom · click node to inspect</span>
        <div class="graph-controls">
          <button class="gc-btn" type="button" title="Zoom in" @click="changeZoom(1.2)">+</button>
          <button class="gc-btn" type="button" title="Zoom out" @click="changeZoom(0.8)">−</button>
          <button class="gc-btn reset" type="button" title="Reset view" @click="resetGraph()">
            ⊙
          </button>
        </div>
      </div>

      <div class="graph-canvas-wrap">
        <svg
          ref="graphSvg"
          class="relation-graph"
          viewBox="0 0 1000 620"
          role="img"
          :aria-label="`Direct specification relationships for ${focusNode.title}`"
        >
          <defs>
            <pattern id="prototype-dot-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" class="grid-dot" />
            </pattern>
            <marker
              id="prototype-arrow"
              markerWidth="8"
              markerHeight="7"
              refX="7"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 8 3.5, 0 7" class="edge-arrow" />
            </marker>
          </defs>
          <g :transform="graphTransform">
            <rect x="-500" y="-300" width="2000" height="1220" fill="url(#prototype-dot-grid)" />

            <g v-for="position in positionedNodes" :key="`edge-${position.node.id}`">
              <path
                class="graph-edge"
                :d="`M 500 310 Q ${(500 + position.x) / 2 + (position.y - 310) * 0.12} ${(310 + position.y) / 2 - (position.x - 500) * 0.12} ${position.x} ${position.y}`"
                marker-end="url(#prototype-arrow)"
              />
              <text
                class="edge-label"
                :x="(500 + position.x) / 2 + (position.y - 310) * 0.12"
                :y="(310 + position.y) / 2 - (position.x - 500) * 0.12 - 5"
                text-anchor="middle"
              >
                {{ edgeForNode(position.node.id)?.label ?? "Related" }}
              </text>
            </g>

            <g
              class="graph-node focal"
              :class="{ active: selectedId === focusNode.id }"
              transform="translate(500 310)"
              role="button"
              tabindex="0"
              @click.stop="selectNode(focusNode)"
              @keydown.enter="selectNode(focusNode)"
            >
              <rect x="-70" y="-22" width="140" height="44" rx="10" />
              <text y="-5" text-anchor="middle">{{ focusNode.graphLabel }}</text>
              <text class="node-type" y="10" text-anchor="middle">{{ focusNode.kindLabel }}</text>
              <text class="focal-star" x="42" y="-11">★</text>
            </g>

            <g
              v-for="position in positionedNodes"
              :key="position.node.id"
              class="graph-node"
              :class="[nodeClass(position.node.kind), { active: selectedId === position.node.id }]"
              :transform="`translate(${position.x} ${position.y})`"
              role="button"
              tabindex="0"
              @click.stop="selectNode(position.node)"
              @keydown.enter="selectNode(position.node)"
            >
              <rect x="-70" y="-22" width="140" height="44" rx="10" />
              <text y="-5" text-anchor="middle">{{ position.node.graphLabel }}</text>
              <text class="node-type" y="10" text-anchor="middle">
                {{ position.node.kindLabel }}
              </text>
            </g>
          </g>
        </svg>

        <div v-if="!visibleRelations.length" class="graph-empty">
          No relations are available for this scope.
        </div>
      </div>
    </div>

    <aside class="detail-drawer" :class="{ open: selectedNode }">
      <template v-if="selectedNode">
        <div class="drawer-head">
          <span class="drawer-type-dot" :class="nodeClass(selectedNode.kind)"></span>
          <div>
            <div class="drawer-title">{{ selectedNode.title }}</div>
            <div class="drawer-version">{{ selectedNode.kindLabel }}</div>
          </div>
          <button
            class="drawer-close"
            type="button"
            aria-label="Close details"
            @click="closeDrawer"
          >
            ×
          </button>
        </div>

        <div class="drawer-body">
          <div v-if="edgeForNode(selectedNode.id)" class="drawer-section">
            <div class="drawer-section-label">Relationship to {{ focusNode.title }}</div>
            <span class="rel-badge">{{ edgeForNode(selectedNode.id)?.label }}</span>
          </div>

          <div class="drawer-section">
            <div class="drawer-section-label">Description</div>
            <div class="drawer-desc">
              {{
                selectedNode.description ??
                  "No description is available in the loaded specification metadata."
              }}
            </div>
          </div>

          <div class="drawer-section">
            <div class="drawer-section-label">Statistics</div>
            <div class="drawer-stat-row">
              <div class="drawer-stat">
                <div class="drawer-stat-n">{{ selectedNode.statistics.classes ?? "—" }}</div>
                <div class="drawer-stat-l">Classes</div>
              </div>
              <div class="drawer-stat">
                <div class="drawer-stat-n">{{ selectedNode.statistics.properties ?? "—" }}</div>
                <div class="drawer-stat-l">Props</div>
              </div>
              <div class="drawer-stat">
                <div class="drawer-stat-n">
                  {{ selectedNode.statistics.artifacts ?? "—" }}
                </div>
                <div class="drawer-stat-l">Artifacts</div>
              </div>
            </div>
          </div>

          <div class="drawer-section">
            <div class="drawer-section-label">IRI</div>
            <div class="drawer-iri">{{ selectedNode.iri }}</div>
          </div>

          <div v-if="selectedNode.artifacts.length" class="drawer-section">
            <div class="drawer-section-label">Artifacts</div>
            <div class="drawer-artifact-mini">
              <a
                v-for="artifact in selectedNode.artifacts"
                :key="artifact.id"
                class="dam-row"
                :href="artifact.url"
                target="_blank"
                rel="noreferrer"
              >
                <span class="dam-fmt">{{ artifact.type.toUpperCase() }}</span>
                <span class="dam-name">{{ artifact.title }}</span>
                <span class="dam-role">{{ artifact.type }}</span>
              </a>
            </div>
          </div>
        </div>

        <div class="drawer-footer">
          <template v-if="selectedNode.kind === 'focal'">
            <RouterLink class="drawer-action primary" :to="routes.primer">Open Primer</RouterLink>
            <RouterLink class="drawer-action secondary" :to="routes.specExplorer">
              Open in Explorer
            </RouterLink>
          </template>
          <a
            v-else
            class="drawer-action primary"
            :href="targetLink(selectedNode)"
            target="_blank"
            rel="noreferrer"
          >Open referenced resource ↗</a>
        </div>
      </template>
    </aside>
  </div>
</template>

<style scoped>
.browser-panel {
  --node-focal-fill: #2454d6;
  --node-focal-text: #ffffff;
  --node-vocab-fill: #146038;
  --node-vocab-bg: #e2f2ea;
  --node-ext-fill: #797587;
  --node-ext-bg: #f1f3ff;
  --edge-profile: #2454d6;
  --graph-bg: #f9f9ff;
  --graph-dot: #c9c4d9;
  flex: 1;
  display: flex;
  min-width: 0;
  overflow: hidden;
}
.browser-sidebar {
  width: 270px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border);
  background: var(--surface);
  transition:
    background 0.25s,
    border-color 0.25s;
}
.bs-head {
  border-bottom: 1px solid var(--border);
  padding: 14px 16px;
}
.bs-head-title {
  margin-bottom: 10px;
  color: var(--text3);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.scope-title {
  margin-top: 4px;
}
.search-wrap {
  position: relative;
  margin-bottom: 10px;
}
.search-icon {
  position: absolute;
  top: 50%;
  left: 9px;
  width: 13px;
  height: 13px;
  color: var(--text3);
  pointer-events: none;
  transform: translateY(-50%);
}
.search-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 10px 7px 29px;
  outline: none;
  background: var(--surface2);
  color: var(--text);
  font-family: "Jost", sans-serif;
  font-size: 12px;
  transition: border-color 0.15s;
}
.search-input:focus {
  border-color: var(--accent);
}
.search-input::placeholder {
  color: var(--text3);
}
.rel-filters {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rel-filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 0;
  border-radius: 7px;
  padding: 5px 8px;
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  font-family: "Jost", sans-serif;
  font-size: 12px;
  text-align: left;
  transition: background 0.1s;
}
.rel-filter-item:hover,
.rel-filter-item.active {
  background: var(--surface2);
}
.rel-filter-item.active {
  color: var(--text);
}
.rf-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}
.rf-dot.all {
  background: var(--accent);
}
.rf-dot.published,
.sli-dot.published,
.gl-dot.published,
.drawer-type-dot.published {
  background: #146038;
}
.rf-dot.external,
.sli-dot.external,
.gl-dot.external,
.drawer-type-dot.external {
  background: #686858;
}
.rf-count {
  margin-left: auto;
  color: var(--text3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
}
.rf-check {
  display: flex;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--border2);
  border-radius: 3px;
  background: var(--surface);
  transition: all 0.12s;
}
.rf-check svg {
  display: none;
  width: 9px;
  height: 7px;
  fill: none;
}
.rf-check polyline {
  stroke: #fff;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}
.rel-filter-item.active .rf-check {
  border-color: var(--accent);
  background: var(--accent);
}
.rel-filter-item.active .rf-check svg {
  display: block;
}
.bs-spec-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}
.spec-list-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  border: 0;
  border-left: 3px solid transparent;
  padding: 8px 16px;
  background: transparent;
  cursor: pointer;
  font-family: "Jost", sans-serif;
  text-align: left;
  transition: background 0.1s;
}
.spec-list-item:hover {
  background: var(--surface2);
}
.spec-list-item.active {
  border-left-color: var(--accent);
  background: var(--accent-bg);
}
.spec-list-item.focal {
  border-left-color: var(--gold);
}
.sli-dot {
  width: 9px;
  height: 9px;
  flex-shrink: 0;
  border-radius: 50%;
}
.sli-dot.focal,
.gl-dot.focal,
.drawer-type-dot.focal {
  background: #3e2ea0;
}
.sli-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sli-type {
  flex-shrink: 0;
  color: var(--text3);
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
}
.list-empty {
  padding: 12px 16px;
  color: var(--text3);
  font-size: 12px;
}
.graph-area {
  position: relative;
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.graph-toolbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding: 8px 16px;
  background: var(--surface);
  transition: background 0.25s;
}
.graph-legend {
  display: flex;
  align-items: center;
  gap: 10px;
}
.gl-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text2);
  font-size: 11px;
}
.gl-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.graph-hint {
  margin-left: auto;
  color: var(--text3);
  font-size: 11px;
  font-style: italic;
}
.graph-controls {
  display: flex;
  gap: 4px;
}
.gc-btn {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface2);
  color: var(--text2);
  cursor: pointer;
  font-family: "Jost", sans-serif;
  font-size: 16px;
  line-height: 1;
  transition: all 0.12s;
}
.gc-btn.reset {
  font-size: 12px;
}
.gc-btn:hover {
  border-color: var(--border2);
  color: var(--text);
}
.graph-canvas-wrap {
  position: relative;
  flex: 1;
  overflow: hidden;
  background: var(--graph-bg);
  cursor: grab;
  transition: background 0.25s;
}
.relation-graph {
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.grid-dot {
  fill: var(--graph-dot);
}
.graph-edge {
  fill: none;
  stroke: var(--edge-profile);
  stroke-width: 1.8;
  opacity: 0.7;
}
.edge-arrow {
  fill: var(--edge-profile);
}
.edge-label {
  fill: var(--edge-profile);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  opacity: 0.75;
  paint-order: stroke;
  stroke: var(--graph-bg);
  stroke-width: 4px;
}
.graph-node {
  cursor: pointer;
  outline: none;
}
.graph-node rect {
  stroke-width: 1.5;
  transition:
    filter 0.12s,
    stroke-width 0.12s;
}
.graph-node:hover rect,
.graph-node.active rect,
.graph-node:focus rect {
  filter: drop-shadow(0 4px 8px rgba(20, 27, 44, 0.22));
  stroke-width: 2;
}
.graph-node.focal rect {
  fill: var(--node-focal-fill);
  stroke: var(--node-focal-fill);
  stroke-width: 2.5;
}
.graph-node.published rect {
  fill: var(--node-vocab-bg);
  stroke: var(--node-vocab-fill);
}
.graph-node.external rect {
  fill: var(--node-ext-bg);
  stroke: var(--node-ext-fill);
}
.graph-node text {
  fill: var(--text);
  font-family: "Jost", sans-serif;
  font-size: 12px;
  font-weight: 500;
  pointer-events: none;
}
.graph-node.focal text {
  fill: var(--node-focal-text);
  font-weight: 600;
}
.graph-node .node-type {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 400;
  opacity: 0.7;
}
.graph-node .focal-star {
  font-family: sans-serif;
  font-size: 10px;
  opacity: 0.8;
}
.graph-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text3);
  font-size: 12px;
  pointer-events: none;
}
.detail-drawer {
  width: 0;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid var(--border);
  background: var(--surface);
  transition: width 0.25s ease;
}
.detail-drawer.open {
  width: 290px;
}
.drawer-head {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding: 14px 16px;
}
.drawer-type-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  margin-top: 5px;
  border-radius: 50%;
}
.drawer-title {
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}
.drawer-version {
  margin-top: 2px;
  color: var(--text3);
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
}
.drawer-close {
  margin-left: auto;
  border: 0;
  padding: 0;
  background: none;
  color: var(--text3);
  cursor: pointer;
  font-family: "Jost", sans-serif;
  font-size: 18px;
  line-height: 1;
  transition: color 0.12s;
}
.drawer-close:hover {
  color: var(--text);
}
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
}
.drawer-section {
  margin-bottom: 16px;
}
.drawer-section-label {
  margin-bottom: 6px;
  color: var(--text3);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.drawer-desc {
  color: var(--text2);
  font-size: 12px;
  line-height: 1.65;
}
.rel-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 6px;
  padding: 4px 10px;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
}
.drawer-stat-row {
  display: flex;
  gap: 8px;
}
.drawer-stat {
  flex: 1;
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--surface2);
  text-align: center;
}
.drawer-stat-n {
  color: var(--text);
  font-family: "Jost", sans-serif;
  font-size: 20px;
  font-weight: 500;
}
.drawer-stat-l {
  color: var(--text3);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.drawer-iri {
  color: var(--text3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.drawer-artifact-mini {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dam-row {
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid var(--border);
  padding: 4px 0;
  color: var(--text2);
  font-size: 11px;
  text-decoration: none;
}
.dam-row:last-child {
  border-bottom: 0;
}
.dam-fmt {
  flex-shrink: 0;
  border-radius: 3px;
  padding: 2px 5px;
  background: var(--surface2);
  color: var(--text3);
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 700;
}
.dam-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dam-role {
  color: var(--text3);
  font-size: 10px;
}
.drawer-footer {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--border);
  padding: 12px 16px;
}
.drawer-action {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 9px 14px;
  cursor: pointer;
  font-family: "Jost", sans-serif;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s;
}
.drawer-action.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}
.drawer-action.primary:hover {
  background: var(--accent2);
}
.drawer-action.secondary {
  background: var(--surface2);
  color: var(--text2);
}
.drawer-action.secondary:hover {
  background: var(--surface3);
  color: var(--text);
}
@media (max-width: 900px) {
  .detail-drawer.open {
    position: absolute;
    z-index: 5;
    top: 45px;
    right: 0;
    bottom: 0;
    width: min(290px, 85vw);
    box-shadow: var(--shadow-lg);
  }
}
@media (max-width: 700px) {
  .browser-sidebar {
    width: 230px;
  }
  .graph-legend,
  .graph-hint {
    display: none;
  }
}
</style>
