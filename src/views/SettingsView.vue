<script setup lang="ts">
import { ref } from "vue";
import { useUserStore } from "@/stores/user";
import { useRouter } from "vue-router";
import { HOME } from "@/router/route-names";

const router = useRouter();

const userStore = useUserStore();

const buttonTextInitial = "Save settings";
const buttonTextUpdating = "Saving...";
const buttonText = ref(buttonTextInitial);

const newUsername = ref(userStore.username);
console.log("userStore.autoHandleInvitations settings", userStore.autoHandleInvitations);
const autoHandleInvitationsOption = ref(userStore.autoHandleInvitations ? "yes" : "no");

async function submitSave() {
  if (buttonText.value === buttonTextUpdating) return;

  await userStore.updateUsername(newUsername.value);

  const newAutoHandleInvitation = autoHandleInvitationsOption.value === "yes";
  await userStore.updateAutoHandleInvitation(newAutoHandleInvitation);
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

        <div class="form-control">
          <label class="form-control-label" for="auto-handle-invitations">Auto-handle invitations</label>
          <select
            id="auto-handle-invitations"
            v-model="autoHandleInvitationsOption"
            class="select-input input-has-border-light is-full-width"
          >
            <option value="yes" :selected="userStore.autoHandleInvitations">Yes</option>
            <option value="no" :selected="!userStore.autoHandleInvitations">No</option>
          </select>
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
