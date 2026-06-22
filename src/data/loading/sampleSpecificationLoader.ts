import type { Specification } from "../model/specification";
import { normalizeSpecification } from "../normalization/normalizeSpecification";

export async function loadSampleSpecification(): Promise<Specification> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}sample-data/demo-specification.json`,
  );

  if (!response.ok) {
    throw new Error(`Unable to load sample specification: ${response.status}`);
  }

  const data = (await response.json()) as Specification;
  return normalizeSpecification(data);
}
