<script setup lang="ts">
import { rid } from "@/rethinkid";
import { useAuthStore } from "@/stores/auth";
import { useListsStore } from "@/stores/lists";
import { useRouter } from "vue-router";
import { LIST } from "@/router/route-names";

const authStore = useAuthStore();
const listsStore = useListsStore();

const router = useRouter();

if (authStore.loggedIn) {
  const primaryListId = listsStore.getPrimaryListId;
  if (primaryListId) {
    router.push({ name: LIST, params: { listId: primaryListId } });
  }
}
</script>

<template>
  <div class="welcome-view" v-if="!authStore.loggedIn">
    <img alt="Logo" class="logo" src="@/assets/logo.svg" width="50" height="50" />
    <h1>Grocery Ninja</h1>
    <p>Never forget an item.</p>
    <button @click="rid.login()" class="get-started-button button">Get Started</button>
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
