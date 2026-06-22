<script setup lang="ts">
import { computed } from "vue";
import { useSpecificationState } from "../../state/specificationState";

const state = useSpecificationState();
const keyClasses = computed(() => state.specification?.classes.slice(0, 3) ?? []);
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
      <article v-for="classProfile in keyClasses" :key="classProfile.id" class="panel">
        <h3>{{ classProfile.label }}</h3>
        <p>{{ classProfile.description }}</p>
      </article>
    </div>
  </section>
</template>
