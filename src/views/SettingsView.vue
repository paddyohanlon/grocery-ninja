<script setup lang="ts">
import { ref } from "vue";
import { useUserStore } from "@/stores/user";
import type { Settings } from "@/types";
import { useRouter } from "vue-router";
import { HOME } from "@/router/route-names";

const router = useRouter();

const userStore = useUserStore();

const buttonTextInitial = "Save settings";
const buttonTextUpdating = "Saving...";
const buttonText = ref(buttonTextInitial);

const newUsername = ref(userStore.username);

async function submitSave() {
  if (buttonText.value === buttonTextUpdating) return;
  await userStore.updateUsername(newUsername.value);
  router.push({ name: HOME });
}
</script>

<template>
  <div class="container">
    <h1>Settings</h1>

    <div class="card">
      <form @submit.prevent="submitSave()">
        <div class="form-control">
          <label class="form-control-label" for="username">Username</label>
          <input
            id="username"
            v-model="newUsername"
            type="text"
            class="text-input input-has-border-light is-full-width"
            required
          />
        </div>
        <button class="button">{{ buttonText }}</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.container {
  padding: 1rem;
}
</style>
