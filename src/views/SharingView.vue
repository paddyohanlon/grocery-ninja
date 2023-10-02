<script setup lang="ts">
import { ref } from "vue";
import type { Ref } from "vue";
import { rid } from "@/rethinkid";
import { LISTS_COLLECTION_NAME } from "@/stores/lists";
import { PermissionType } from "@rethinkid/rethinkid-js-sdk";
import type {
  Link,
  GrantedPermission,
  Permission,
  PermissionTemplate,
  FilterObject,
} from "@rethinkid/rethinkid-js-sdk/dist/types/types/index";
import { STATE_CHANGE_DURATION_MS } from "@/timing";
import { useRoute } from "vue-router";
import { useListsStore } from "@/stores/lists";

const route = useRoute();

const listsStore = useListsStore();

const baseUrl = import.meta.env.MODE === "development" ? "http://localhost:3377/l/" : "https://id.rethinkdb.cloud/l/";

const permissions: Ref<Permission[]> = ref([]);
rid.permissions.list().then((response) => {
  permissions.value = response;
});

const links: Ref<Link[]> = ref([]);
rid.permissions.links.list().then((response) => {
  links.value = response;
});

const permissionsGrantedToMe: Ref<GrantedPermission[]> = ref([]);
rid.permissions.granted.list().then((response) => {
  console.log("permissions granted to me", response);
  permissionsGrantedToMe.value = response;
});

/**
 * Create link form
 */
const limitInputValue = ref(0);
const resourceInputValue = ref("");

if (route.query.listId) {
  resourceInputValue.value = route.query.listId as string;
}

const createLinkButtonTextInitial = "Create Share Link";
const createLinkButtonTextUpdating = "Creating...";
const createLinkButtonText = ref(createLinkButtonTextInitial);

async function submitCreateLink() {
  // Disable button while submitting
  createLinkButtonText.value = createLinkButtonTextUpdating;

  // Button text
  createLinkButtonText.value = createLinkButtonTextUpdating;
  setTimeout(() => (createLinkButtonText.value = createLinkButtonTextInitial), STATE_CHANGE_DURATION_MS);

  const filterObject: FilterObject = {
    id: resourceInputValue.value,
  };

  const permission: PermissionTemplate = {
    collectionName: LISTS_COLLECTION_NAME,
    types: [PermissionType.READ, PermissionType.INSERT, PermissionType.UPDATE, PermissionType.DELETE],
    filter: filterObject,
  };

  const link = await rid.permissions.links.create(permission, limitInputValue.value);
  console.log("createLink response", link);

  // TODO add link to local state? Is ID returned

  limitInputValue.value = 0;
}

function deletePermission(permissionId: string) {
  rid.permissions.delete(permissionId).then((res) => {
    console.log("delete permission res", res);
  });
}

function deleteLink(linkId: string) {
  rid.permissions.links.delete(linkId).then((res) => {
    console.log("deleted link res:", res);
  });
}

function deleteShared(permissionId: string) {
  rid.permissions.granted.delete(permissionId).then((res) => {
    console.log("delete granted (shared with me) permission. res", res);
  });
}

const shareButtonTextInitial = "Share List";
const shareButtonTextUpdating = "Sharing...";
const shareButtonText = ref(shareButtonTextInitial);

const userIdInputValue = ref("");

async function submitShareWithUser() {
  // Disable button while submitting
  shareButtonText.value = shareButtonTextUpdating;

  // Button text
  shareButtonText.value = shareButtonTextUpdating;
  setTimeout(() => (shareButtonText.value = shareButtonTextInitial), STATE_CHANGE_DURATION_MS);

  const filterObject: FilterObject = {
    id: resourceInputValue.value,
  };

  const permission: Permission = {
    collectionName: LISTS_COLLECTION_NAME,
    userId: userIdInputValue.value,
    types: [PermissionType.READ, PermissionType.INSERT, PermissionType.UPDATE, PermissionType.DELETE],
    filter: filterObject,
  };

  const response = await rid.permissions.create(permission);

  console.log(response);

  userIdInputValue.value = "";
}
</script>

<template>
  <header class="sharing-header">
    <h1>Sharing</h1>
  </header>

  <div class="sharing-grid">
    <!-- Form to explicitly share -->
    <div class="card">
      <h2>Share List with User</h2>
      <form @submit.prevent="submitShareWithUser()">
        <div class="form-control">
          <label class="form-control-label" for="resource">List (resource)</label>
          <select
            id="resource"
            v-model="resourceInputValue"
            class="select-input input-has-border-light is-full-width"
            required
          >
            <option disable value="">Select a list to share</option>
            <option v-for="list in listsStore.getMyLists" :key="list.id" :value="list.id">{{ list.name }}</option>
          </select>
        </div>

        <div class="form-control">
          <label class="form-control-label" for="user-id">User ID</label>
          <input
            id="user-id"
            v-model="userIdInputValue"
            type="text"
            class="text-input is-full-width"
            autocomplete="off"
            placeholder="e.g. 7023c9e7-1ffd-44f1-8f3c-26da76553a78"
            required
          />
        </div>

        <button class="button">{{ shareButtonText }}</button>
      </form>
    </div>

    <!-- Create link form -->
    <div class="card">
      <h2>Create Link</h2>
      <form @submit.prevent="submitCreateLink()">
        <div class="form-control">
          <label class="form-control-label" for="resource">List (resource)</label>
          <select
            id="resource"
            v-model="resourceInputValue"
            class="select-input input-has-border-light is-full-width"
            required
          >
            <option disable value="">Select a list to share</option>
            <option v-for="list in listsStore.getMyLists" :key="list.id" :value="list.id">{{ list.name }}</option>
          </select>
        </div>
        <div class="form-control">
          <label class="form-control-label" for="limit">Limit of uses</label>
          <input
            id="limit"
            v-model="limitInputValue"
            type="text"
            class="text-input input-has-border-light is-full-width"
          />
        </div>
        <button class="button">{{ createLinkButtonText }}</button>
      </form>
    </div>

    <div class="card">
      <h2>Links</h2>
      <ul class="sharing-list list-reset">
        <li v-for="l in links" :key="l.id">
          <div>
            <a href="{{ baseUrl }}{{ l.id }}">{{ baseUrl }}{{ l.id }}</a>
            <div>{{ l }}</div>
          </div>
          <div class="button-list">
            <button class="button button-danger" @click="deleteLink(l.id)">Delete Link</button>
          </div>
        </li>
      </ul>
    </div>

    <div class="card">
      <h2>Permissions (Granted To Me)</h2>
      <ul class="sharing-list list-reset">
        <li v-for="l in permissionsGrantedToMe" :key="l.id">
          <div>{{ l }}</div>
          <div class="button-list">
            <button class="button button-danger" @click="deleteShared(l.permissionId)">Delete Shared</button>
          </div>
        </li>
      </ul>
    </div>

    <div class="card">
      <h2>Permissions (I've granted)</h2>
      <ul class="sharing-list list-reset">
        <li v-for="p in permissions" :key="p.id">
          <div>{{ p }}</div>
          <div class="button-list">
            <!-- TODO: ID should always be present -->
            <button class="button button-danger" @click="deletePermission(p.id || '')">Delete Permission</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped></style>
