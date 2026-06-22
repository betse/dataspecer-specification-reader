<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { routes } from "../../app/routes";
import { loadSpecification } from "../../data/loading/loadSpecification";
import { useSpecificationState, type DetailMode } from "../../state/specificationState";

const router = useRouter();
const state = useSpecificationState();
const sourceUrl = ref("");
const detailMode = ref<DetailMode>(state.detailMode);

async function openSpecification() {
  state.setLoading(true);
  state.setError(null);

  try {
    const specification = await loadSpecification(sourceUrl.value || undefined);
    state.setSpecification(specification);
    state.setDetailMode(detailMode.value);
    await router.push(routes.specToSpec);
  } catch (error) {
    state.setError(error instanceof Error ? error.message : "Unable to load specification");
  } finally {
    state.setLoading(false);
  }
}
</script>

<template>
  <section class="view">
    <div class="panel">
      <h2>Open a specification</h2>
      <p class="muted">
        This first implementation slice loads a prepared sample specification and
        carries it through the focused views.
      </p>
    </div>
  </section>
</template>

<style scoped>
.field {
  display: grid;
  gap: 0.35rem;
  margin: 1rem 0;
  font-weight: 700;
}

input,
select {
  width: min(100%, 560px);
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0.7rem;
  color: #172033;
  background: #ffffff;
}

.error {
  color: #b91c1c;
}
</style>
