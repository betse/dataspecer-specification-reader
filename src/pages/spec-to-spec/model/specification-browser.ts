import { selectLocalizedString } from "../../../data/model/localized-string";
import type { RelatedSpecificationKind } from "../../../data/model/specification-relation";
import type { Specification } from "../../../data/model/specification";

export type SpecificationBrowserNodeKind = "focal" | RelatedSpecificationKind;

export interface SpecificationBrowser {
  focalNodeId: string;
  nodes: SpecificationBrowserNode[];
  edges: SpecificationBrowserEdge[];
  counts: SpecificationBrowserCounts;
}

export interface SpecificationBrowserNode {
  id: string;
  title: string;
  graphLabel: string;
  kind: SpecificationBrowserNodeKind;
  kindLabel: string;
  iri: string;
  resourceUrl?: string;
  description?: string;
  statistics: SpecificationBrowserStatistics;
  artifacts: SpecificationBrowserArtifact[];
}

export interface SpecificationBrowserEdge {
  id: string;
  sourceId: string;
  targetId: string;
  predicate: string;
  label: string;
}

export interface SpecificationBrowserCounts {
  all: number;
  published: number;
  external: number;
}

export interface SpecificationBrowserStatistics {
  classes?: number;
  properties?: number;
  artifacts?: number;
}

export interface SpecificationBrowserArtifact {
  id: string;
  title: string;
  type: string;
  mediaType?: string;
  url: string;
}

function createGraphLabel(title: string | undefined, iri: string, explicitLabel?: string): string {
  if (explicitLabel?.trim()) {
    return explicitLabel.trim();
  }

  const normalizedTitle = title?.trim();
  const abbreviation = extractParenthesizedAbbreviation(title);
  if (abbreviation) {
    return abbreviation.toUpperCase();
  }

  if (
    normalizedTitle &&
    normalizedTitle !== iri &&
    !isUrl(normalizedTitle) &&
    normalizedTitle.length <= 24
  ) {
    return normalizedTitle.toUpperCase();
  }

  const iriSegment = extractLastIriSegment(iri);
  if (iriSegment) {
    return iriSegment.toUpperCase();
  }

  return truncateTitle(normalizedTitle ?? "Unknown specification", 24);
}

function extractParenthesizedAbbreviation(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const match = title.match(/\(([A-Za-z][A-Za-z0-9-]{1,15})\)\s*$/);

  return match?.[1];
}

function extractLastIriSegment(iri: string): string | undefined {
  try {
    const url = new URL(iri);
    const hash = decodeURIComponent(url.hash.slice(1)).trim();
    if (hash) {
      return hash;
    }

    const pathSegments = url.pathname.split("/").filter(Boolean);

    let segment = pathSegments.at(-1);

    if (!segment && url.hash) {
      segment = url.hash.slice(1);
    }

    if (!segment) {
      return undefined;
    }

    return decodeURIComponent(segment)
      .replace(/\.(ttl|owl|rdf|jsonld|html)$/i, "")
      .trim();
  } catch {
    return undefined;
  }
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function truncateTitle(title: string, maximumLength: number): string {
  if (title.length <= maximumLength) {
    return title;
  }

  return `${title.slice(0, maximumLength - 1).trimEnd()}…`;
}

/** Creates the display-ready node and edge model consumed by the S2S browser. */
export function createSpecificationBrowser(specification: Specification): SpecificationBrowser {
  const focalNodeId = specification.metadata.id;
  const focalNode: SpecificationBrowserNode = {
    id: focalNodeId,
    title: selectLocalizedString(specification.metadata.title) ?? "Untitled specification",
    graphLabel: createGraphLabel(
      selectLocalizedString(specification.metadata.title),
      specification.metadata.iri ?? focalNodeId,
    ),
    kind: "focal",
    kindLabel: specificationTypeLabel(specification.metadata.types),
    iri: specification.metadata.iri ?? focalNodeId,
    resourceUrl: specification.metadata.sourceUrl,
    description: selectLocalizedString(specification.metadata.description),
    statistics: {
      artifacts: specification.artifacts.length,
    },
    artifacts: specification.artifacts.map((artifact) => ({
      id: artifact.id,
      title: selectLocalizedString(artifact.title) ?? artifact.url,
      type: artifact.type,
      mediaType: artifact.mediaType,
      url: artifact.url,
    })),
  };

  const relatedNodes: SpecificationBrowserNode[] = specification.relatedSpecifications.map(
    (relation) => {
      const title = selectLocalizedString(relation.title);

      return {
        id: relation.id,
        title: title ?? relation.targetIri,
        graphLabel: createGraphLabel(
          title,
          relation.targetIri,
          selectLocalizedString(relation.label),
        ),
        kind: relation.kind,
        kindLabel: relation.kind === "published-specification" ? "Published Spec" : "External",
        iri: relation.targetIri,
        resourceUrl: relation.targetUrl,
        statistics: {},
        artifacts: [],
      };
    },
  );

  const edges: SpecificationBrowserEdge[] = specification.relatedSpecifications.map((relation) => ({
    id: `${focalNodeId}:${relation.relation}:${relation.id}`,
    sourceId: focalNodeId,
    targetId: relation.id,
    predicate: relation.relation,
    label: relationLabel(relation.relation),
  }));

  return {
    focalNodeId,
    nodes: [focalNode, ...relatedNodes],
    edges,
    counts: {
      all: relatedNodes.length,
      published: relatedNodes.filter((node) => node.kind === "published-specification").length,
      external: relatedNodes.filter((node) => node.kind === "external-resource").length,
    },
  };
}

function specificationTypeLabel(types: string[]): string {
  if (types.some((type) => type.includes("ApplicationProfile"))) return "App Profile";
  if (types.some((type) => type.includes("Vocabulary") || type.includes("Ontology"))) {
    return "Vocabulary";
  }
  return "Specification";
}

function relationLabel(relation: string): string {
  const labels: Record<string, string> = {
    isProfileOf: "profiles",
    "prof:isProfileOf": "profiles",
    conformsTo: "conformsTo",
    "dcterms:conformsTo": "conformsTo",
    imports: "imports",
    "owl:imports": "imports",
  };

  return labels[relation] ?? relation.replace(/^[^:]+:/, "");
}
