<script setup lang="ts">
/* global AbortController, DOMParser, Element, Event, HTMLElement, KeyboardEvent, SVGSVGElement, SVGTextElement, document, fetch, requestAnimationFrame, setTimeout, window */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface InteractiveSvgTerm {
  iri: string;
  label: string;
  aliases?: string[];
}

export interface InteractiveSvgSelection {
  key: string;
  semanticIri?: string;
  iri?: string;
  label: string;
  description?: string;
}

const props = defineProps<{
  title: string;
  url: string;
  terms: InteractiveSvgTerm[];
  selectedKey?: string;
}>();

const emit = defineEmits<{
  select: [selection: InteractiveSvgSelection];
  discover: [semanticIris: string[]];
}>();

const host = ref<HTMLElement>();
const canvas = ref<HTMLElement>();
const hitboxLayer = ref<HTMLElement>();
const zoom = ref(1);
const status = ref("Loading SVG…");
const loadError = ref<string>();
const baseWidth = ref(1024);
const baseHeight = ref(768);
const preparedNodes = ref(0);
let svgElement: SVGSVGElement | undefined;
let removeNodeListeners: Array<() => void> = [];
let matchedNodes: Array<{ element: HTMLElement; selection: InteractiveSvgSelection }> = [];

const canvasStyle = computed(() => ({
  width: `${baseWidth.value * zoom.value}px`,
  height: `${baseHeight.value * zoom.value}px`,
}));
const hostStyle = computed(() => ({
  width: `${baseWidth.value}px`,
  height: `${baseHeight.value}px`,
  transform: `scale(${zoom.value})`,
}));

watch(
  () => props.url,
  async (url, _previous, onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    resetDiagram();

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const document = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
      const svg = document.documentElement;
      if (svg.localName !== "svg" || document.querySelector("parsererror")) {
        throw new Error("The resource is not valid SVG.");
      }

      sanitizeSvg(svg);
      svgElement = document.importNode(svg, true) as unknown as SVGSVGElement;
      configureDimensions(svgElement);
      await nextTick();
      if (controller.signal.aborted || !host.value) return;
      host.value.replaceChildren(svgElement);
      prepareNodes();
    } catch (error) {
      if (controller.signal.aborted) return;
      loadError.value = error instanceof Error ? error.message : String(error);
      status.value = "Interactive SVG unavailable";
    }
  },
  { immediate: true },
);

watch(
  () => props.terms,
  () => prepareNodes(),
  { deep: true },
);

watch(
  () => props.selectedKey,
  () => {
    updateSelection();
    updateHitboxSelection();
  },
);

watch(zoom, () => requestAnimationFrame(renderHitboxes));

onMounted(() => window.addEventListener("resize", renderHitboxes));
onBeforeUnmount(() => {
  clearNodeListeners();
  window.removeEventListener("resize", renderHitboxes);
});

function resetDiagram() {
  clearNodeListeners();
  svgElement = undefined;
  host.value?.replaceChildren();
  zoom.value = 1;
  preparedNodes.value = 0;
  matchedNodes = [];
  hitboxLayer.value?.replaceChildren();
  loadError.value = undefined;
  status.value = "Loading SVG…";
}

function sanitizeSvg(svg: Element) {
  svg.querySelectorAll("script, iframe, object, embed").forEach((element) => element.remove());
  for (const element of [svg, ...svg.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (
        name.startsWith("on") ||
        ((name === "href" || name.endsWith(":href")) && value.startsWith("javascript:"))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

function configureDimensions(svg: SVGSVGElement) {
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/[ ,]+/).map(Number);
  const width = numericDimension(svg.getAttribute("width"));
  const height = numericDimension(svg.getAttribute("height"));
  baseWidth.value = validDimension(viewBox?.[2]) ?? width ?? 1024;
  baseHeight.value = validDimension(viewBox?.[3]) ?? height ?? 768;

  if (!svg.hasAttribute("viewBox")) {
    svg.setAttribute("viewBox", `0 0 ${baseWidth.value} ${baseHeight.value}`);
  }
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.width = `${baseWidth.value}px`;
  svg.style.height = `${baseHeight.value}px`;
  svg.style.overflow = "visible";
}

function prepareNodes() {
  if (!svgElement) return;
  clearNodeListeners();

  const candidates = diagramNodeCandidates(svgElement);
  matchedNodes = [];
  candidates.forEach((element, index) => {
    const term = identifyTerm(element, props.terms);
    const selection = term ? semanticSelection(term) : svgSelection(element, index);
    if (!selection) return;

    matchedNodes.push({ element, selection });
    element.dataset.diagramKey = selection.key;
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("aria-label", `Show ${selection.label}`);

    const select = (event: Event) => {
      event.stopPropagation();
      emit("select", selection);
    };
    const selectWithKeyboard = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
      keyboardEvent.preventDefault();
      select(keyboardEvent);
    };
    element.addEventListener("click", select);
    element.addEventListener("keydown", selectWithKeyboard);
    removeNodeListeners.push(() => {
      element.removeEventListener("click", select);
      element.removeEventListener("keydown", selectWithKeyboard);
      element.removeAttribute("data-diagram-key");
    });
  });

  preparedNodes.value = matchedNodes.length;
  status.value = matchedNodes.length
    ? `${matchedNodes.length} interactive ${matchedNodes.length === 1 ? "node" : "nodes"}`
    : "SVG loaded; no semantic nodes matched";
  emit("discover", [
    ...new Set(matchedNodes.flatMap(({ selection }) => selection.semanticIri ?? [])),
  ]);
  updateSelection();
  requestAnimationFrame(renderHitboxes);
  setTimeout(renderHitboxes, 250);
}

function diagramNodeCandidates(svg: SVGSVGElement): HTMLElement[] {
  const dataspecerNodes = [...svg.querySelectorAll<HTMLElement>(".react-flow__node")];
  if (dataspecerNodes.length) return dataspecerNodes;

  const identifiedNodes = [...svg.querySelectorAll<HTMLElement>("[data-iri], [data-id], a[href]")];
  if (identifiedNodes.length) return identifiedNodes;

  return [...svg.querySelectorAll<SVGTextElement>("text")]
    .map((text) => text.parentElement)
    .filter((element): element is HTMLElement => element !== null);
}

function identifyTerm(element: HTMLElement, terms: InteractiveSvgTerm[]) {
  const searchable = normalize(
    [
      element.textContent,
      element.id,
      element.dataset.iri,
      element.dataset.id,
      element.getAttribute("href"),
    ].join(" "),
  );

  const tokens = terms.flatMap((term) =>
    [term.label, term.iri, iriLocalName(term.iri), ...(term.aliases ?? [])]
      .flatMap((value) => [value, iriLocalName(value)])
      .map(normalize)
      .filter((token) => token.length >= 4)
      .map((token) => ({ term, token })),
  );
  tokens.sort((left, right) => right.token.length - left.token.length);
  return tokens.find(({ token }) => searchable.includes(token))?.term;
}

function updateSelection() {
  if (!svgElement) return;
  svgElement.querySelectorAll<HTMLElement>("[data-diagram-key]").forEach((element) => {
    element.classList.toggle("is-selected", element.dataset.diagramKey === props.selectedKey);
  });
}

function clearNodeListeners() {
  removeNodeListeners.forEach((remove) => remove());
  removeNodeListeners = [];
}

function renderHitboxes() {
  const layer = hitboxLayer.value;
  const canvasElement = canvas.value;
  if (!layer || !canvasElement) return;

  layer.replaceChildren();
  const canvasRect = canvasElement.getBoundingClientRect();
  for (const { element, selection } of matchedNodes) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "hitbox";
    button.dataset.diagramKey = selection.key;
    button.title = selection.label;
    button.setAttribute("aria-label", `Show ${selection.label}`);
    button.style.left = `${rect.left - canvasRect.left}px`;
    button.style.top = `${rect.top - canvasRect.top}px`;
    button.style.width = `${rect.width}px`;
    button.style.height = `${rect.height}px`;
    button.addEventListener("click", () => emit("select", selection));
    layer.appendChild(button);
  }
  updateHitboxSelection();
}

function updateHitboxSelection() {
  hitboxLayer.value?.querySelectorAll<HTMLElement>(".hitbox").forEach((element) => {
    element.classList.toggle("selected", element.dataset.diagramKey === props.selectedKey);
  });
}

function setZoom(value: number) {
  zoom.value = Math.min(2.5, Math.max(0.35, value));
}

function numericDimension(value: string | null): number | undefined {
  return value ? validDimension(Number.parseFloat(value)) : undefined;
}

function validDimension(value?: number): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function iriLocalName(value: string): string {
  return value.replace(/\/$/, "").split(/[/#:]/).pop() ?? value;
}

function semanticSelection(term: InteractiveSvgTerm): InteractiveSvgSelection {
  return {
    key: term.iri,
    semanticIri: term.iri,
    iri: term.iri,
    label: term.label,
  };
}

function svgSelection(element: HTMLElement, index: number): InteractiveSvgSelection | undefined {
  const heading = element.querySelector<HTMLElement>(".drag-handle");
  const label =
    cleanText(heading?.textContent) ||
    cleanText(element.querySelector("title")?.textContent) ||
    cleanText(element.textContent);
  if (!label) return undefined;

  const compactIri = cleanText(
    element.querySelector<HTMLElement>(".overflow-x-clip.text-gray-500")?.textContent,
  );
  return {
    key: `svg-node:${index}:${compactIri || label}`,
    iri: compactIri || undefined,
    label,
    description: heading?.getAttribute("title") || undefined,
  };
}

function cleanText(value?: string | null): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}
</script>

<template>
  <article class="diagram-card">
    <div class="diagram-bar">
      <strong>{{ title }}</strong>
      <span class="svg-status" :class="{ error: loadError }">{{ status }}</span>
      <div class="zoom-controls" aria-label="Diagram zoom controls">
        <button type="button" title="Zoom out" @click="setZoom(zoom - 0.12)">−</button>
        <button type="button" title="Zoom in" @click="setZoom(zoom + 0.12)">+</button>
        <button type="button" title="Reset zoom" @click="setZoom(1)">0</button>
      </div>
    </div>

    <div v-if="!loadError" class="svg-stage">
      <div ref="canvas" class="svg-canvas" :style="canvasStyle">
        <div ref="host" class="svg-host" :style="hostStyle"></div>
        <div ref="hitboxLayer" class="hitbox-layer"></div>
      </div>
    </div>
    <a v-else class="image-fallback" :href="url" target="_blank" rel="noreferrer">
      <img :src="url" :alt="title" />
      <span>The SVG is shown as an image because interactive loading failed: {{ loadError }}</span>
    </a>

    <div class="diagram-footer">
      <span>Published SVG · {{ Math.round(zoom * 100) }}%</span>
      <a :href="url" target="_blank" rel="noreferrer">Open original ↗</a>
    </div>
  </article>
</template>

<style scoped>
.diagram-card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.diagram-bar,
.diagram-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--surface2);
  font-size: 13px;
}

.diagram-bar {
  border-bottom: 1px solid var(--border);
}

.diagram-bar > strong {
  margin-right: auto;
}

.svg-status {
  color: var(--text3);
  font-size: 10px;
}

.svg-status.error {
  color: #ba1a1a;
}

.zoom-controls {
  display: flex;
  gap: 4px;
}

.zoom-controls button {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface);
  color: var(--text2);
  cursor: pointer;
}

.zoom-controls button:hover {
  border-color: var(--accent-mid);
  color: var(--text);
}

.svg-stage {
  height: 500px;
  overflow: auto;
  background-color: var(--bg);
  background-image: radial-gradient(var(--border) 0.8px, transparent 0.8px);
  background-size: 24px 24px;
}

.svg-canvas {
  position: relative;
  min-width: 100%;
  min-height: 100%;
}

.svg-host {
  transform-origin: top left;
}

.hitbox-layer {
  position: absolute;
  z-index: 10;
  inset: 0;
  pointer-events: none;
}

.hitbox-layer :deep(.hitbox) {
  position: absolute;
  border: 3px solid transparent;
  border-radius: 2px;
  padding: 0;
  background: transparent;
  pointer-events: auto;
  cursor: pointer;
  transition:
    border-color 0.12s,
    box-shadow 0.12s;
}

.hitbox-layer :deep(.hitbox:hover) {
  border-color: var(--accent-mid);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 10%, transparent);
}

.hitbox-layer :deep(.hitbox.selected) {
  border-color: var(--accent);
  outline: 1px solid var(--accent);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 16%, transparent);
}

.svg-host :deep(.react-flow__node),
.svg-host :deep([data-diagram-key]) {
  cursor: pointer;
}

.svg-host :deep([data-diagram-key]:hover) {
  filter: drop-shadow(0 0 7px var(--accent-mid));
}

.svg-host :deep([data-diagram-key].is-selected) {
  filter: drop-shadow(0 0 10px var(--accent));
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.image-fallback {
  display: flex;
  min-height: 420px;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  padding: 22px;
  background: var(--bg);
  color: var(--text3);
  font-size: 11px;
  text-align: center;
}

.image-fallback img {
  display: block;
  max-width: 100%;
  max-height: 440px;
}

.diagram-footer {
  justify-content: space-between;
  border-top: 1px solid var(--border);
  color: var(--text3);
  font-size: 11px;
}
</style>
