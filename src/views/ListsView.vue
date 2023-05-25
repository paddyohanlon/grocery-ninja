<script setup lang="ts">
import ListsNav from "@/components/ListsNav.vue";
</script>

<template>
  <div class="container">
    <h1>Lists</h1>
    <div class="card no-padding">
      <ListsNav />
    </div>
  </div>
</template>

<style scoped>
.container {
  padding: 1rem;
}

.no-padding {
  padding: 0;
}
</style>
