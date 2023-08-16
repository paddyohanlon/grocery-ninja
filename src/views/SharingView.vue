<script setup lang="ts">
import { ref } from "vue";
import type { Ref } from "vue";
import { LISTS_TABLE_NAME, rid, getAPIOrLocalData, contactsListConfig } from "@/rethinkid";
import { PermissionType } from "@rethinkid/rethinkid-js-sdk";
import type {
  Link,
  GrantedPermission,
  Permission,
  PermissionTemplate,
  PermissionCondition,
  Contact,
} from "@rethinkid/rethinkid-js-sdk/dist/types/types/index";
import { STATE_CHANGE_DURATION_MS } from "@/timing";
import { useRoute } from "vue-router";
import { useListsStore } from "@/stores/lists";

const route = useRoute();

const listsStore = useListsStore();

/**
 * Contacts
 */
const contacts: Ref<Contact[]> = ref([]);

async function fetchContacts() {
  const contactsList = await getAPIOrLocalData(contactsListConfig);
  contacts.value = contactsList;
}
fetchContacts();

const baseUrl = import.meta.env.MODE === "development" ? "http://localhost:3377/l/" : "https://id.rethinkdb.cloud/l/";

const permissions: Ref<Permission[]> = ref([]);
rid.sharing.list({}).then((response) => {
  permissions.value = response;
});

const links: Ref<Link[]> = ref([]);
rid.sharing.listLinks({}).then((response) => {
  links.value = response;
});

const itemsShared: Ref<GrantedPermission[]> = ref([]);
rid.sharing.listShared().then((response) => {
  console.log("listShared", response);
  itemsShared.value = response;
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

  const permissionCondition: PermissionCondition = {
    rowId: resourceInputValue.value,
  };

  const permission: PermissionTemplate = {
    tableName: LISTS_TABLE_NAME,
    types: [PermissionType.READ, PermissionType.INSERT, PermissionType.UPDATE, PermissionType.DELETE],
    condition: permissionCondition,
  };

  const link = await rid.sharing.createLink(permission, limitInputValue.value);
  console.log("createLink response", link);

  // TODO add link to local state? Is ID returned

  limitInputValue.value = 0;
}

function deletePermission(permissionId: string) {
  rid.sharing.delete({ permissionId }).then((res) => {
    console.log("sharing.delete res", res);
  });
}

function deleteShared(permissionId: string) {
  rid.sharing.deleteShared(permissionId).then((res) => {
    console.log("sharing.deleteShared res", res);
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

  // const permissionCondition: PermissionCondition = {
  //   rowId: resourceInputValue.value,
  // };

  const permission: PermissionTemplate = {
    tableName: LISTS_TABLE_NAME,
    types: [PermissionType.READ, PermissionType.INSERT, PermissionType.UPDATE, PermissionType.DELETE],
    // condition: permissionCondition,
  };

  const response = await rid.sharing.withUser(userIdInputValue.value, permission);

  console.log(response);

  userIdInputValue.value = "";

  // Need to fetch because only link returned. No ID.
  // fetch something?
}
</script>

<template>
  <header class="contacts-header">
    <h1>Sharing</h1>
  </header>

  <div class="contacts-grid">
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

        <div v-if="contacts && contacts.length > 0" class="form-control">
          <label class="form-control-label" for="contact">Contact</label>
          <select id="contact" v-model="userIdInputValue" class="select-input input-has-border-light is-full-width">
            <option disable value="">Select a contact</option>
            <option v-for="contact of contacts" :key="contact.id" :value="contact.contactId">
              {{ contact.contactId }}
            </option>
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

    <!-- linkLinks -->
    <div class="card">
      <h2>Links (listLinks)</h2>
      <ul class="contacts-list list-reset">
        <li v-for="l in links" :key="l.id">
          <div>
            <a href="{{ baseUrl }}{{ l.id }}">{{ baseUrl }}{{ l.id }}</a>
            <div>{{ l }}</div>
          </div>
          <div class="button-list">
            <button class="button button-danger" @click="deletePermission(l.permissionId)">Delete Permission</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- listShared -->
    <div class="card">
      <h2>Shared with Me (listShared)</h2>
      <ul class="contacts-list list-reset">
        <li v-for="l in itemsShared" :key="l.id">
          <div>{{ l }}</div>
          <div class="button-list">
            <button class="button button-danger" @click="deleteShared(l.permissionId)">Delete Shared</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- list -->
    <div class="card">
      <h2>Permission (list)</h2>
      <ul class="contacts-list list-reset">
        <li v-for="p in permissions" :key="p.id">
          <div>{{ p }}</div>
          <div class="button-list">
            <button class="button button-danger" @click="deletePermission(p.id)">Delete Permission</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped></style>
