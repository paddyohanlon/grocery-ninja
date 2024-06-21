<script setup lang="ts">
import { ref } from "vue";
import type { Ref } from "vue";
import { bzr } from "@/bzr";
import { LISTS_COLLECTION_NAME } from "@/stores/lists";
import { STATE_CHANGE_DURATION_MS } from "@/timing";
import { useRoute } from "vue-router";
import { useListsStore } from "@/stores/lists";
import {
  PermissionType,
  type FilterObject,
  type GrantedPermission,
  type Link,
  type Permission,
  type PermissionTemplate,
  type NewPermission,
} from "@bzr/bazaar";

const route = useRoute();

const listsStore = useListsStore();

const permissions: Ref<Permission[]> = ref([]);
function fetchPermissions(): void {
  bzr.permissions.list().then((response) => {
    permissions.value = response;
  });
}
fetchPermissions();

const links: Ref<Link[]> = ref([]);
function fetchLinks() {
  bzr.permissions.links.list().then((response) => {
    links.value = response;
    console.log("links.value", links.value);
  });
}
fetchLinks();

const permissionsGrantedToMe: Ref<GrantedPermission[]> = ref([]);
function fetchPermissionsGrantedToMe() {
  bzr.permissions.granted.list().then((response) => {
    permissionsGrantedToMe.value = response;
  });
}
fetchPermissionsGrantedToMe();

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

  const listName = listsStore.getList(resourceInputValue.value)?.name;

  const permission: PermissionTemplate = {
    collectionName: LISTS_COLLECTION_NAME,
    types: [PermissionType.READ, PermissionType.INSERT, PermissionType.UPDATE, PermissionType.DELETE],
    filter: filterObject,
  };

  const link = await bzr.permissions.links.create(permission, `Link to share ${listName} list`, limitInputValue.value);
  console.log("createLink response", link);

  links.value.push(link);

  limitInputValue.value = 0;
}

function deletePermission(permissionId: string) {
  bzr.permissions.delete(permissionId).then((res) => {
    console.log("delete permission res", res);
    fetchPermissions();
  });
}

function deleteLink(linkId: string) {
  console.log("linkId", linkId);
  bzr.permissions.links.delete(linkId).then((res) => {
    console.log("deleted link res:", res);
    links.value = links.value.filter((l) => l.id !== linkId);
  });
}

function deleteShared(grantedPermissionId: string) {
  bzr.permissions.granted.delete(grantedPermissionId).then((res) => {
    console.log("delete granted (shared with me) permission. res", res);
    permissionsGrantedToMe.value = permissionsGrantedToMe.value.filter((pg) => pg.id !== grantedPermissionId);
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

  const newPermission: NewPermission = {
    collectionName: LISTS_COLLECTION_NAME,
    userId: userIdInputValue.value,
    types: [PermissionType.READ, PermissionType.INSERT, PermissionType.UPDATE, PermissionType.DELETE],
    filter: filterObject,
  };

  const response = await bzr.permissions.create(newPermission);

  const permission: Permission = { id: response.id, ...newPermission };

  permissions.value.push(permission);

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
            v-model.number="limitInputValue"
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
            <ul class="list-reset">
              <li>List Name: {{ listsStore.getList(l.permission.filter?.id as string)?.name }}</li>
              <li>Used: {{ l.users?.length }}/{{ l.limit }} (users/limit)</li>
              <li>Description: {{ l.description }}</li>
              <li>
                Link: <a href="{{ l.url }}">{{ l.url }}</a>
              </li>
            </ul>
          </div>
          <div class="button-list">
            <button class="button button-danger" @click="deleteLink(l.id)">Delete Link</button>
          </div>
        </li>
      </ul>
    </div>

    <div class="card">
      <h2>Permissions (I've granted)</h2>
      <ul class="sharing-list list-reset">
        <li v-for="p in permissions" :key="p.id">
          <ul class="list-reset">
            <li>List Name: {{ listsStore.getList(p.filter?.id as string)?.name }}</li>
            <li>User ID: {{ p.userId }}</li>
          </ul>
          <div class="button-list">
            <!-- TODO: ID should always be present -->
            <button class="button button-danger" @click="deletePermission(p.id || '')">Delete Permission</button>
          </div>
        </li>
      </ul>
    </div>

    <div class="card">
      <h2>Permissions (Granted To Me)</h2>
      <ul class="sharing-list list-reset">
        <li v-for="gp in permissionsGrantedToMe" :key="gp.id">
          <ul class="list-reset">
            <li>List ID: {{ gp.permission?.filter?.id }}</li>
            <li>Owner ID: {{ gp.ownerId }}</li>
          </ul>
          <div class="button-list">
            <button class="button button-danger" @click="deleteShared(gp.id)">Delete Shared</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped></style>
@/bzr
