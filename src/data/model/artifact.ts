import type { LocalizedString } from "./localized-string";

/** Broad category of a generated specification resource. */
export type ArtifactType =
  "html" | "rdf" | "svg" | "shacl" | "json-schema" | "xml-schema" | "other";

/**
 * Generated or linked resource belonging to a specification.
 *
 * Dataspecer JSON-LD usually exposes these through `hasResource` entries with
 * `hasArtifact`, `hasRole`, and `format` values.
 */
export interface SpecificationArtifact {
  /** Stable identifier used by the reader; often the resource `@id` or resolved URL. */
  id: string;

  /** Human-readable label derived from the resource role, format, or type. */
  title: LocalizedString;

  /** Reader-friendly artifact category inferred from role, format, or file extension. */
  type: ArtifactType;

  /** Original JSON-LD format/media value, for example `filetype:RDF_TURTLE`. */
  mediaType?: string;

  /** Resolved URL of the generated resource. */
  url: string;
}
