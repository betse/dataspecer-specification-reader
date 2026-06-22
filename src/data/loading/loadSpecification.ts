import type { Specification } from "../model/specification";
import { loadSampleSpecification } from "./sampleSpecificationLoader";

export async function loadSpecification(sourceUrl?: string): Promise<Specification> {
  if (sourceUrl) {
    // Real Dataspecer artifact loading will be introduced after the data model is agreed.
    return loadSampleSpecification();
  }

  return loadSampleSpecification();
}
