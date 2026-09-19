import { reactive } from "vue";
import type { Specification } from "../data/model/specification";

export type DetailMode = "simple" | "detailed";

/**
 * Application-wide state shared by the loader and all specification views.
 */
interface SpecificationState {
  selectedSpecification: Specification["metadata"] | null;
  specification: Specification | null;
  detailMode: DetailMode;
  isLoading: boolean;
  errorMessage: string | null;
}

const state = reactive<SpecificationState>({
  selectedSpecification: null,
  specification: null,
  detailMode: "simple",
  isLoading: false,
  errorMessage: null,
});

/**
 * Returns the shared specification state and the actions used to update it.
 * Every caller receives the same reactive object, so a specification loaded on
 * the landing page remains available in the S2S, Primer and Explorer pages.
 */
export function useSpecificationState() {
  /** Stores the normalized specification and exposes its metadata for navigation UI. */
  function setSpecification(specification: Specification) {
    state.specification = specification;
    state.selectedSpecification = specification.metadata;
  }

  /** Changes the presentation level shared by all reader pages. */
  function setDetailMode(detailMode: DetailMode) {
    state.detailMode = detailMode;
  }

  /** Updates the loading indicator used while a specification is being fetched. */
  function setLoading(isLoading: boolean) {
    state.isLoading = isLoading;
  }

  /** Sets or clears the user-facing specification loading error. */
  function setError(message: string | null) {
    state.errorMessage = message;
  }

  return Object.assign(state, {
    setSpecification,
    setDetailMode,
    setLoading,
    setError,
  });
}
