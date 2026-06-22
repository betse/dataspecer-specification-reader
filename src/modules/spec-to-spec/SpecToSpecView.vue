<script setup lang="ts">
import { computed } from "vue";
import { useSpecificationState } from "../../state/specificationState";

const state = useSpecificationState();
const specification = computed(() => state.specification);
</script>

<template>
  <section class="view">
    <div class="panel">
      <h2>Spec-to-Spec</h2>
      <p class="muted">
        Overview, related specifications, and generated artifacts will be developed here.
      </p>
    </div>

    <div v-if="specification" class="grid">
      <article class="panel">
        <h3>{{ specification.metadata.title }}</h3>
        <p>{{ specification.metadata.description }}</p>
        <p v-if="specification.metadata.iri" class="muted">
          {{ specification.metadata.iri }}
        </p>
      </article>

      <article class="panel">
        <h3>Artifacts</h3>
        <ul>
          <li v-for="artifact in specification.artifacts" :key="artifact.id">
            {{ artifact.title }} <span class="muted">({{ artifact.type }})</span>
          </li>
        </ul>
      </article>

      <article class="panel">
        <h3>Related specifications</h3>
        <ul>
          <li v-for="related in specification.relatedSpecifications" :key="related.id">
            {{ related.title }} <span class="muted">{{ related.relation }}</span>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>
