<script setup lang="ts">
import { useUserStore } from "@/stores/user.js";
import ListsNav from "@/components/ListsNav.vue";

const userStore = useUserStore();
</script>

<template>
  <div class="has-padding">
    <div v-if="userStore.loggedIn" class="card no-padding">
      <ListsNav />
    </div>
    <div v-else class="welcome-view">
      <img alt="Logo" class="logo" src="@/assets/logo.svg" width="50" height="50" />
      <h1>Grocery Ninja</h1>
      <p>Never forget an item.</p>
    </div>
  </div>
</template>

<style scoped>
.welcome-view {
  margin-top: 5rem;
  text-align: center;
}

.get-started-button {
  margin-top: 2.5rem;
}
</style>
