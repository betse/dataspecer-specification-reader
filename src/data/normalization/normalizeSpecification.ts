import type { Specification } from "../model/specification";

export function normalizeSpecification(specification: Specification): Specification {
  return {
    ...specification,
    artifacts: specification.artifacts ?? [],
    relatedSpecifications: specification.relatedSpecifications ?? [],
    classes: specification.classes ?? [],
  };
}
