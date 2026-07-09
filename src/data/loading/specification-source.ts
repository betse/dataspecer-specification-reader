/**
 * Source description used by the data layer before loading starts.
 *
 * Keeping the source as a structured value separates input handling from the
 * actual loading logic: callers decide what kind of source they have, and the
 * loader can switch on `source.type`.
 */

/**
 * Load from a live published specification page.
 *
 * The URL is fetched as HTML, then embedded JSON-LD is extracted and normalized.
 */
export interface UrlSpecificationSource {
  type: "url";
  /** Fully qualified URL of the specification HTML page. */
  url: string;
}

/**
 * Load from a pre-bundled static JSON file.
 *
 * Used for offline demos and development samples. The key is intended to map
 * to a JSON file in `/public/sample-data`.
 */
export interface StaticSpecificationSource {
  type: "static";
  /**
   * Identifier that maps to a file in /public/sample-data/{key}.json.
   * Example: "dcat-ap", "dcat-dap", "demo-specification".
   */
  key: string;
}

/**
 * Union of source kinds the loading layer can be designed to accept.
 *
 * When `loadSpecification` accepts this type, switching on `source.type` will
 * let TypeScript narrow the source automatically in each branch.
 */
export type SpecificationSource = UrlSpecificationSource | StaticSpecificationSource;
