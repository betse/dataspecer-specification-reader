<script setup lang="ts">
import { computed } from "vue";
import { selectLocalizedString } from "../../data/model/localized-string";
import { useSpecificationState } from "../../state/specification-state";

const state = useSpecificationState();
const specification = computed(() => state.specification);
</script>

<template>
  <section class="view">
    <div class="panel">
      <h2>Primer</h2>
      <p class="muted">
        Guided explanation and interactive SVG support will be developed in this module.
      </p>
    </div>

    <div class="grid">
      <article v-if="specification" class="panel">
        <h3>{{ selectLocalizedString(specification.metadata.title) }}</h3>
        <p v-if="specification.metadata.description">
          {{ selectLocalizedString(specification.metadata.description) }}
        </p>
      </article>
    </div>
  </section>
</template>
