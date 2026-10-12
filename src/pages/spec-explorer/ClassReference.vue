<script setup lang="ts">
defineProps<{ iri: string; label: string; local: boolean }>();
defineEmits<{ navigate: [iri: string] }>();
</script>

<template>
  <button
    v-if="local"
    class="class-reference"
    type="button"
    :title="`Show class definition: ${iri}`"
    @click.stop="$emit('navigate', iri)"
  >
    {{ label }}
  </button>
  <a
    v-else-if="/^https?:\/\//i.test(iri)"
    class="class-reference"
    :href="iri"
    target="_blank"
    rel="noopener noreferrer"
    :title="`Open external definition in a new tab: ${iri}`"
    :aria-label="`${label} — open external definition in a new tab`"
    >{{ label }} ↗</a
  >
  <span v-else :title="iri">{{ label }}</span>
</template>

<style scoped>
.class-reference {
  display: inline;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-weight: 400;
  text-align: inherit;
  text-decoration: underline;
  cursor: pointer;
  box-shadow: none;
  transform: none;
}
.class-reference:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
