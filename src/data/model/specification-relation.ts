import type { LocalizedString } from "./localized-string";

export type RelatedSpecificationKind = "published-specification" | "external-resource";

/**
 * A directed relationship from the loaded specification to another
 * specification, profile, or vocabulary.
 *
 * Currently extracted from `isProfileOf` entries in the Dataspecer JSON-LD.
 * The `targetIri` points to the related resource, while `relation` preserves
 * the JSON-LD relation name used to connect it.
 *
 * Example JSON-LD:
 * {
 *   "isProfileOf": {
 *     "@id": "https://www.w3.org/TR/vocab-dcat-3/",
 *     "title": { "en": "DCAT" }
 *   }
 * }
 */
export interface RelatedSpecification {
  /** Stable identifier used by the reader; usually the related resource IRI. */
  id: string;

  /** Human-readable name shown in the UI, possibly in multiple languages. */
  title: LocalizedString;

  /** JSON-LD relation that connects this item to the current specification. */
  relation: string;

  /** IRI or URL of the referenced specification/profile/vocabulary. */
  targetIri: string;

  /**
   * Navigable resource advertised for the target, when it differs from the
   * target's canonical IRI. This is commonly a published HTML page or RDF file.
   */
  targetUrl?: string;

  /** Whether the relation resolves to a published specification or a referenced resource. */
  kind: RelatedSpecificationKind;

  /** Optional shorter label when the JSON-LD provides one separately from title. */
  label?: LocalizedString;
}
