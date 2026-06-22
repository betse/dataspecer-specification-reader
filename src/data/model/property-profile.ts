export type RequirementLevel = "mandatory" | "recommended" | "optional";

export interface PropertyProfile {
  id: string;
  label: string;
  iri: string;
  range?: string;
  cardinality?: string;
  requirementLevel?: RequirementLevel;
  description?: string;
}
