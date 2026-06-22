import { reactive } from "vue";
import type { Specification } from "../data/model/specification";

export type DetailMode = "simple" | "detailed";

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

export function useSpecificationState() {
  function setSpecification(specification: Specification) {
    state.specification = specification;
    state.selectedSpecification = specification.metadata;
  }

  function setDetailMode(detailMode: DetailMode) {
    state.detailMode = detailMode;
  }

  function setLoading(isLoading: boolean) {
    state.isLoading = isLoading;
  }

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
