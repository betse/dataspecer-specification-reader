import type { ArtifactType, SpecificationArtifact } from "../../../data/model/artifact";
import { selectLocalizedString } from "../../../data/model/localized-string";
import type {
  RelatedSpecification,
  RelatedSpecificationKind,
} from "../../../data/model/specification-relation";
import type { Specification } from "../../../data/model/specification";

export interface SpecificationOverview {
  id: string;
  title: string;
  description: string;
  typeLabels: string[];
  metadata: SpecificationOverviewMetadataRow[];
  statistics: SpecificationOverviewStatistics;
  artifacts: SpecificationOverviewArtifact[];
  relatedSpecifications: SpecificationOverviewRelation[];
}

export interface SpecificationOverviewMetadataRow {
  label: string;
  value: string;
  mono?: boolean;
  href?: string;
}

export interface SpecificationOverviewStatistics {
  classes?: number;
  properties?: number;
  artifacts: number;
}

export interface SpecificationOverviewArtifact {
  id: string;
  title: string;
  type: ArtifactType;
  formatLabel: string;
  formatClass: string;
  mediaType?: string;
  url: string;
}

export interface SpecificationOverviewRelation {
  id: string;
  title: string;
  relation: string;
  relationLabel: string;
  kind: RelatedSpecificationKind;
  targetIri: string;
  targetUrl: string;
}

/** Creates the display-ready model consumed by the S2S overview. */
export function createSpecificationOverview(specification: Specification): SpecificationOverview {
  const metadata = specification.metadata;
  const sourceUrl = metadata.sourceUrl ?? metadata.iri;

  return {
    id: metadata.id,
    title: selectLocalizedString(metadata.title) ?? "Untitled specification",
    description:
      selectLocalizedString(metadata.description) ??
      "No description was provided by the specification metadata.",
    typeLabels: metadata.types.map(resourceTypeLabel),
    metadata: [
      metadata.iri ? { label: "IRI", value: metadata.iri, mono: true } : undefined,
      metadata.version ? { label: "Version", value: metadata.version } : undefined,
      localizedRow("Publisher", metadata.publisher),
      metadata.license ? { label: "License", value: metadata.license } : undefined,
      metadata.types.length
        ? {
            label: "Resource Type",
            value: metadata.types.map(resourceTypeLabel).join(", "),
            mono: true,
          }
        : undefined,
      sourceUrl ? { label: "Source", value: sourceUrl, href: sourceUrl } : undefined,
    ].filter((row): row is SpecificationOverviewMetadataRow => row !== undefined),
    statistics: {
      artifacts: specification.artifacts.length,
    },
    artifacts: specification.artifacts.map(createOverviewArtifact),
    relatedSpecifications: specification.relatedSpecifications.map((relation) => ({
      id: relation.id,
      title: relatedSpecificationTitle(relation),
      relation: relation.relation,
      relationLabel: specificationRelationLabel(relation.relation),
      kind: relation.kind,
      targetIri: relation.targetIri,
      targetUrl: relation.targetUrl ?? relation.targetIri,
    })),
  };
}

function relatedSpecificationTitle(relation: RelatedSpecification): string {
  const title = selectLocalizedString(relation.title);
  const label = selectLocalizedString(relation.label);

  if (title && title !== relation.targetIri && !isUrl(title)) {
    return title;
  }

  if (label) {
    return label;
  }

  return titleFromIri(relation.targetIri) ?? "Unnamed related specification";
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function titleFromIri(iri: string): string | undefined {
  try {
    const url = new URL(iri);
    const hash = url.hash.slice(1);
    if (hash) {
      return decodeURIComponent(hash);
    }
    const segments = url.pathname.split("/").filter(Boolean).at(-1);

    if (!segments) {
      return undefined;
    }

    return decodeURIComponent(segments).replace(/\.(ttl|owl|rdf|jsonld|html)$/i, "");
  } catch {
    return undefined;
  }
}

function localizedRow(
  label: string,
  value: Parameters<typeof selectLocalizedString>[0],
): SpecificationOverviewMetadataRow | undefined {
  const selected = selectLocalizedString(value);
  return selected ? { label, value: selected } : undefined;
}

function createOverviewArtifact(artifact: SpecificationArtifact): SpecificationOverviewArtifact {
  const formatLabel = artifactFormatLabel(artifact);

  return {
    id: artifact.id,
    title: selectLocalizedString(artifact.title) ?? artifact.url,
    type: artifact.type,
    formatLabel,
    formatClass: artifactFormatClass(artifact.type, formatLabel),
    mediaType: artifact.mediaType,
    url: artifact.url,
  };
}

function artifactFormatLabel(artifact: SpecificationArtifact): string {
  const value = `${artifact.mediaType ?? ""} ${artifact.url}`.toLowerCase();

  if (artifact.type === "rdf" && (value.includes("turtle") || value.endsWith(".ttl"))) {
    return "TTL";
  }
  if (artifact.type === "json-schema") return "JSON";
  if (artifact.type === "xml-schema") return "XSD";
  return artifact.type.toUpperCase();
}

function artifactFormatClass(type: ArtifactType, formatLabel: string): string {
  const normalizedLabel = formatLabel.toLowerCase();
  if (["ttl", "json", "xsd"].includes(normalizedLabel)) return normalizedLabel;
  return type;
}

function resourceTypeLabel(type: string): string {
  return type.replace(/^[^:]+:/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function specificationRelationLabel(relation: string): string {
  const labels: Record<string, string> = {
    isProfileOf: "Profiles",
    "prof:isProfileOf": "Profiles",
    conformsTo: "Conforms to",
    "dcterms:conformsTo": "Conforms to",
    imports: "Imports",
    "owl:imports": "Imports",
  };

  return labels[relation] ?? relation.replace(/^[^:]+:/, "");
}
