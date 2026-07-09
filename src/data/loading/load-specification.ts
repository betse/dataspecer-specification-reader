import type { Specification } from "../model/specification";
import { loadSampleSpecification } from "./load-sample-specification";
import { loadSpecificationFromUrl } from "./load-specification-from-url";
import type { SpecificationSource } from "./specification-source";

/**
 * Main loading entry point for the data layer.
 *
 * The caller provides a structured source, and this function delegates to the
 * correct loader. This keeps UI/input decisions separate from the mechanics of
 * loading and normalizing a specification.
 */
export async function loadSpecification(source: SpecificationSource): Promise<Specification> {
  switch (source.type) {
    case "url":
      return loadSpecificationFromUrl(source.url);
    case "static":
      return loadSampleSpecification();
  }
}
