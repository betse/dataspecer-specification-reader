import type { Specification } from "../model/specification";
import { normalizeSpecification } from "../normalization/normalize-specification";

/**
 * Loads the bundled demo specification from `public/sample-data`.
 *
 * The sample file is stored as raw JSON-LD so it goes through the same
 * normalization path as a specification loaded from a URL.
 */
export async function loadSampleSpecification(): Promise<Specification> {
  const response = await fetch(`${import.meta.env.BASE_URL}sample-data/demo-specification.json`);

  if (!response.ok) {
    throw new Error(`Unable to load sample specification: ${response.status}`);
  }

  return normalizeSpecification(await response.json());
}
