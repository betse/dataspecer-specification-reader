import type { SpecificationArtifact } from "./artifact";
import type { LocalizedString } from "./localized-string";
import type { RelatedSpecification } from "./specification-relation";
/**
 * High-level identity and descriptive metadata for a specification.
 *
 * This is intentionally generic: class profiles, property profiles, constraints,
 * and other detailed domain structures should be modeled separately after the
 * high-level JSON-LD normalization is stable.
 */
export interface SpecificationMetadata {
  /**
   * Stable identifier for this specification within the reader.
   * Derived from the @id in JSON-LD, or from the source URL when
   * @id is absent.
   */
  id: string;

  /**
   * The URL from which this specification was loaded.
   * Set by the loader — not present in the JSON-LD itself.
   */
  sourceUrl?: string;

  /** The canonical IRI of this specification.
   * sourced from @id in JSON-LD.
   * Example: "https://mff-uk.github.io/specifications/dcat-ap#"
   */
  iri?: string;

  /**
   * Human-readable name of the specification.
   * May contain multiple language variants from JSON-LD language maps.
   */
  title: LocalizedString;

  /** Human-readable description of the specification, possibly in multiple languages.
   */
  description?: LocalizedString;

  /**
   * All RDF types declared by this specification in JSON-LD.
   * Typically includes "prof:Profile", DSV-specific type or owl:Ontology.
   */
  types: string[];

  /** Version string of this specification, if published in JSON-LD.
   */
  version?: string;

  /** Publisher name or identifier, possibly in multiple languages. */
  publisher?: LocalizedString;

  /** License name, IRI, or URL resolved to a display string. */
  license?: string;
}

/**
 * Normalized high-level representation of a published Dataspecer specification.
 */
export interface Specification {
  /** Identity and descriptive fields for the specification itself. */
  metadata: SpecificationMetadata;

  /** Generated resources linked from the specification, such as HTML, RDF, SHACL, or diagrams. */
  artifacts: SpecificationArtifact[];

  /** External specifications, profiles, or vocabularies referenced by this specification. */
  relatedSpecifications: RelatedSpecification[];
}
