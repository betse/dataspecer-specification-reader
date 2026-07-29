import type { SpecificationArtifact } from "../model/artifact";
import { localizedString, type LocalizedString } from "../model/localized-string";
import type { RelatedSpecification } from "../model/specification-relation";
import type { Specification, SpecificationMetadata } from "../model/specification";

interface NormalizeSpecificationOptions {
  sourceUrl?: string;
}

type JsonObject = Record<string, unknown>;

/**
 * Normalizes Dataspecer JSON-LD into the reader's high-level specification model.
 *
 * Published Dataspecer pages describe two related things in the same JSON-LD
 * block:
 * - the HTML document/resource descriptor that was loaded,
 * - the specification, vocabulary, or profile described by that document.
 *
 * The normalized model keeps only the stable high-level information for now:
 * metadata, generated artifacts, and related specifications.
 */
export function normalizeSpecification(
  jsonLd: unknown,
  options: NormalizeSpecificationOptions = {},
): Specification {
  const document = findDocumentResource(jsonLd);
  const describedSpecification = findDescribedSpecification(jsonLd);
  const metadata = normalizeMetadata(document, describedSpecification, options);

  return {
    metadata,
    artifacts: normalizeArtifacts(document, describedSpecification, options),
    relatedSpecifications: normalizeRelatedSpecifications(describedSpecification),
  };
}

/**
 * Finds the JSON-LD node representing the loaded specification document.
 *
 * Dataspecer usually marks this node as a specification document type and as a
 * resource with `role:specification`.
 */
function findDocumentResource(jsonLd: unknown): JsonObject | null {
  const objects = collectObjects(jsonLd);

  return (
    objects.find((item) => readStringList(item["@type"]).some(isSpecificationDocumentType)) ??
    objects.find((item) => readStringList(item.hasRole).includes("role:specification")) ??
    objects[0] ??
    null
  );
}

/**
 * Finds the actual specification described by the loaded document.
 *
 * In Dataspecer JSON-LD this is usually nested under `inSpecificationOf`.
 * If that structure is missing, the document node is used as a fallback so
 * simple JSON-LD samples can still be normalized.
 */
function findDescribedSpecification(jsonLd: unknown): JsonObject | null {
  const document = findDocumentResource(jsonLd);
  const specifications = toArray(document?.inSpecificationOf).filter(isJsonObject);

  return (
    specifications.find((item) =>
      Boolean(readFirstLocalizedString(item, ["title", "name", "label"])),
    ) ??
    specifications[0] ??
    document
  );
}

/** Builds the metadata section from the described specification node. */
function normalizeMetadata(
  document: JsonObject | null,
  describedSpecification: JsonObject | null,
  options: NormalizeSpecificationOptions,
): SpecificationMetadata {
  const source = describedSpecification ?? document;

  if (!source) {
    throw new Error("No specification metadata found in JSON-LD.");
  }

  const id = readFirstString(source, ["@id", "id", "identifier", "url"]) ?? options.sourceUrl;
  const title = readFirstLocalizedString(source, ["title", "name", "label"]);

  if (!id) {
    throw new Error("Specification JSON-LD is missing an identifier.");
  }

  if (!title) {
    throw new Error("Specification JSON-LD is missing a title.");
  }

  return {
    id,
    sourceUrl: options.sourceUrl,
    iri: readFirstString(source, ["@id", "iri", "url"]),
    title,
    description: readFirstLocalizedString(source, ["description", "abstract"]),
    types: readStringList(source["@type"]),
    version: readFirstString(source, ["version", "schema:version"]),
    publisher: readLocalizedString(source.publisher),
    license: readLabel(source.license),
  };
}

/**
 * Builds generated artifacts from `hasResource` entries.
 *
 * The loaded HTML document itself is also included as an artifact when it is
 * available through the document resource node.
 */
function normalizeArtifacts(
  document: JsonObject | null,
  describedSpecification: JsonObject | null,
  options: NormalizeSpecificationOptions,
): SpecificationArtifact[] {
  const resources = [
    ...toArray(describedSpecification?.hasResource),
    ...(document ? [document] : []),
  ].filter(isJsonObject);

  const artifacts = resources
    .map((resource) => normalizeArtifact(resource, options.sourceUrl))
    .filter((artifact): artifact is SpecificationArtifact => artifact !== null);

  return uniqueBy(artifacts, (artifact) => artifact.url);
}

/** Converts one JSON-LD resource descriptor into a reader artifact. */
function normalizeArtifact(
  resource: JsonObject,
  sourceUrl: string | undefined,
): SpecificationArtifact | null {
  const artifactUrl = readArtifactUrl(resource);
  const resolvedUrl = resolveArtifactUrl(artifactUrl, sourceUrl);

  if (!resolvedUrl) {
    return null;
  }

  const role = readFirstString(resource, ["hasRole"]);
  const format = readFirstString(resource, ["format"]);
  const type = inferArtifactType(role, format, resolvedUrl);

  return {
    id: readFirstString(resource, ["@id", "id"]) ?? resolvedUrl,
    title: localizedString(artifactTitle(type, role, format)),
    type,
    mediaType: format,
    url: resolvedUrl,
  };
}

function readArtifactUrl(resource: JsonObject): string | undefined {
  if (typeof resource.hasArtifact === "string") {
    return resource.hasArtifact.trim();
  }

  return readFirstString(resource, ["hasArtifact", "url", "@id"]);
}

/**
 * Builds outgoing relationships to reused/profiled specifications.
 *
 * Current support is intentionally focused on Dataspecer's `isProfileOf`
 * structure. More relation kinds can be added here when the UI needs them.
 */
function normalizeRelatedSpecifications(
  describedSpecification: JsonObject | null,
): RelatedSpecification[] {
  const related: RelatedSpecification[] = [];

  for (const item of toArray(describedSpecification?.isProfileOf)) {
    if (!isJsonObject(item)) {
      continue;
    }

    const resource = firstObject(item.hasResource);
    const canonicalTargetIri = readFirstString(item, ["@id", "id", "url"]);
    const targetUrl = readFirstString(resource, ["hasArtifact", "url", "@id"]);
    const targetIri = canonicalTargetIri ?? targetUrl;
    const title =
      readFirstLocalizedString(item, ["title", "name", "label"]) ??
      (targetIri ? localizedString(targetIri) : undefined);

    if (!targetIri || !title) {
      continue;
    }

    related.push({
      id: readFirstString(item, ["@id", "id"]) ?? targetIri,
      title,
      relation: "isProfileOf",
      targetIri,
      targetUrl,
      kind: canonicalTargetIri && targetUrl ? "published-specification" : "external-resource",
      label: readFirstLocalizedString(item, ["label"]),
    });
  }

  return uniqueBy(related, (item) => item.targetIri);
}

/** Flattens a JSON-LD object, array, or `@graph` into candidate objects. */
function collectObjects(value: unknown): JsonObject[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectObjects);
  }

  if (!isJsonObject(value)) {
    return [];
  }

  const graph = value["@graph"];

  if (Array.isArray(graph)) {
    return [value, ...graph.flatMap(collectObjects)];
  }

  return [value];
}

/** Identifies Dataspecer document nodes that describe a published specification page. */
function isSpecificationDocumentType(type: string): boolean {
  return (
    type === "dsv:ApplicationProfileSpecificationDocument" ||
    type === "dsv:VocabularySpecificationDocument"
  );
}

/**
 * Maps JSON-LD roles, media formats, and file extensions to the reader's
 * compact artifact categories.
 */
function inferArtifactType(
  role: string | undefined,
  format: string | undefined,
  url: string,
): SpecificationArtifact["type"] {
  const value = `${role ?? ""} ${format ?? ""} ${url}`.toLowerCase();

  if (value.includes("html")) {
    return "html";
  }

  if (value.includes("svg")) {
    return "svg";
  }

  if (value.includes("shacl")) {
    return "shacl";
  }

  if (value.includes("json-schema")) {
    return "json-schema";
  }

  if (value.includes("xml-schema") || value.endsWith(".xsd")) {
    return "xml-schema";
  }

  if (
    value.includes("rdf") ||
    value.includes("turtle") ||
    value.endsWith(".ttl") ||
    value.endsWith(".rdf") ||
    value.endsWith(".owl")
  ) {
    return "rdf";
  }

  return "other";
}

/** Creates a concise display title from the artifact role and inferred type. */
function artifactTitle(
  type: SpecificationArtifact["type"],
  role: string | undefined,
  format: string | undefined,
): string {
  const normalizedRole = role?.replace(/^role:/, "");

  if (normalizedRole === "specification") {
    return "Specification document";
  }

  if (normalizedRole === "constraints" && type === "shacl") {
    return "SHACL constraints";
  }

  if (normalizedRole === "constraints") {
    return "RDF constraints";
  }

  if (normalizedRole === "schema") {
    return "Schema";
  }

  if (normalizedRole === "guidance" && type === "svg") {
    return "Diagram";
  }

  return format ?? type;
}

/**
 * Resolves artifact URLs relative to the loaded page.
 *
 * Dataspecer uses values such as `./dsv.ttl`; an empty artifact value
 * means the artifact is the source HTML page itself.
 */
function resolveArtifactUrl(
  value: string | undefined,
  sourceUrl: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value) {
    return sourceUrl;
  }

  if (!sourceUrl) {
    return value;
  }

  try {
    return new URL(value, sourceUrl).toString();
  } catch {
    return value;
  }
}

/** Reads the first non-empty display string from a list of possible JSON-LD keys. */
function readFirstString(
  source: JsonObject | null | undefined,
  keys: string[],
): string | undefined {
  if (!source) {
    return undefined;
  }

  for (const key of keys) {
    const label = readLabel(source[key]);

    if (label) {
      return label;
    }
  }

  return undefined;
}

function readFirstLocalizedString(
  source: JsonObject | null | undefined,
  keys: string[],
): LocalizedString | undefined {
  if (!source) {
    return undefined;
  }

  for (const key of keys) {
    const value = readLocalizedString(source[key]);

    if (value) {
      return value;
    }
  }

  return undefined;
}

/**
 * Converts common JSON-LD value shapes into one display string.
 *
 * Handles plain strings, arrays, language maps such as `{ "en": "Title" }`,
 * and node objects with labels or identifiers.
 */
function readLabel(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const label = readLabel(item);

      if (label) {
        return label;
      }
    }
  }

  if (isJsonObject(value)) {
    return (
      readFirstString(value, ["en", "cs", "name", "title", "label", "@value", "@id", "url"]) ??
      firstStringValue(value)
    );
  }

  return undefined;
}

function readLocalizedString(value: unknown): LocalizedString | undefined {
  if (typeof value === "string" && value.trim()) {
    return localizedString(value.trim());
  }

  if (typeof value === "number") {
    return localizedString(String(value));
  }

  if (Array.isArray(value)) {
    const merged: LocalizedString = {};

    for (const item of value) {
      Object.assign(merged, readLocalizedString(item));
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  if (!isJsonObject(value)) {
    return undefined;
  }

  const literal = readJsonLdLiteral(value);

  if (literal) {
    return literal;
  }

  const languageMap = readLanguageMap(value);

  if (languageMap) {
    return languageMap;
  }

  return readFirstLocalizedString(value, ["name", "title", "label", "@id", "url"]);
}

function readJsonLdLiteral(value: JsonObject): LocalizedString | undefined {
  const literalValue = value["@value"];

  if (typeof literalValue !== "string" && typeof literalValue !== "number") {
    return undefined;
  }

  const language = typeof value["@language"] === "string" ? value["@language"] : undefined;
  return localizedString(String(literalValue), language);
}

function readLanguageMap(value: JsonObject): LocalizedString | undefined {
  const localized: LocalizedString = {};

  for (const [key, item] of Object.entries(value)) {
    if (!isLanguageTag(key)) {
      continue;
    }

    if (typeof item === "string" && item.trim()) {
      localized[key] = item.trim();
    }
  }

  return Object.keys(localized).length > 0 ? localized : undefined;
}

function isLanguageTag(value: string): boolean {
  return /^[a-z]{2,3}(-[a-z0-9]+)*$/i.test(value);
}

/** Fallback for language maps or compact objects with an unknown string key. */
function firstStringValue(value: JsonObject): string | undefined {
  for (const item of Object.values(value)) {
    if (typeof item === "string" && item.trim()) {
      return item.trim();
    }
  }

  return undefined;
}

/** Reads a JSON-LD value as a list of display strings. */
function readStringList(value: unknown): string[] {
  return toArray(value)
    .map(readLabel)
    .filter((item): item is string => item !== undefined);
}

/** Returns the first object from a JSON-LD value that may be a single item or an array. */
function firstObject(value: unknown): JsonObject | undefined {
  return toArray(value).find(isJsonObject);
}

/** Normalizes optional single-or-array JSON-LD values into an array. */
function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

/** Removes duplicates while preserving the first occurrence. */
function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
