import type { PropertyProfile } from "./property-profile";

export interface ClassProfile {
  id: string;
  label: string;
  iri: string;
  description?: string;
  properties: PropertyProfile[];
}
