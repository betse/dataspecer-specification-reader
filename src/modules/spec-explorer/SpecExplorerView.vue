<script setup lang="ts">
import { computed } from "vue";
import { useSpecificationState } from "../../state/specificationState";

const state = useSpecificationState();
const classes = computed(() => state.specification?.classes ?? []);
</script>

<template>
  <section class="view">
    <div class="panel">
      <h2>Spec-Explorer</h2>
      <p class="muted">
        Detailed class/property inspection, filtering, active context, and code-oriented
        representations will be developed in this module.
      </p>
    </div>

    <article v-for="classProfile in classes" :key="classProfile.id" class="panel">
      <h3>{{ classProfile.label }}</h3>
      <p class="muted">{{ classProfile.iri }}</p>

      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Range</th>
            <th>Cardinality</th>
            <th>Requirement</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="property in classProfile.properties" :key="property.id">
            <td>{{ property.label }}</td>
            <td>{{ property.range }}</td>
            <td>{{ property.cardinality }}</td>
            <td>{{ property.requirementLevel }}</td>
          </tr>
        </tbody>
      </table>
    </article>
  </section>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border-top: 1px solid #d9deea;
  padding: 0.6rem;
  text-align: left;
}
</style>
