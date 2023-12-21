<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { Ref } from "vue";
import { useListsStore } from "@/stores/lists";
import { useUserStore } from "@/stores/user.js";
import { useNotificationsStore } from "@/stores/notifications";
import { useRoute, useRouter } from "vue-router";
import { HOME, LISTS, LIST_ITEM, SHARING } from "@/router/route-names";
import ListsNav from "@/components/ListsNav.vue";
import CheckItemButton from "@/components/CheckItemButton.vue";
import { STATE_CHANGE_DURATION_MS } from "@/timing";

const listsStore = useListsStore();
const userStore = useUserStore();
const notificationStore = useNotificationsStore();

const route = useRoute();
const router = useRouter();

const newItemName = ref("");

const updatingList = ref(false);

const checkedListIsVisible = ref(false);
const listDropdownIsVisible = ref(false);

const listIdParam = ref(route.params.listId as string);
const itemIdParam = ref(route.params.itemId as string);

const list = computed(() => listsStore.getList(listIdParam.value));

const newList = ref(Object.assign({}, list.value));

watch(
  () => list.value,
  (listNew) => {
    if (!listNew) {
      notificationStore.addNotification("List was deleted");
      router.push({ name: HOME });
    }
    newList.value = Object.assign({}, listNew);
  },
);

watch(
  () => route.params.listId,
  (newId) => {
    listDropdownIsVisible.value = false;
    listIdParam.value = newId as string;
  },
);

watch(
  () => route.params.itemId,
  (newId) => {
    listDropdownIsVisible.value = false;
    itemIdParam.value = newId as string;
  },
);

// Template elements with a `ref` attribute
type HTMLRef = null | HTMLElement;
const addItemInput: Ref<HTMLRef> = ref(null);

function itemCheckToggled(): void {
  console.log("itemCheckToggled");
}

function submitAddItem() {
  listsStore.addItem(listIdParam.value, newItemName.value);
  newItemName.value = "";
}

function toggleCheckedList() {
  checkedListIsVisible.value = !checkedListIsVisible.value;
}

function toggleListDropdown() {
  listDropdownIsVisible.value = !listDropdownIsVisible.value;
}

async function deleteList() {
  if (window.confirm("Are you sure you want to delete this list?")) {
    if (!list.value) return;

    await listsStore.deleteList(list.value);
    router.push({ name: HOME });
  }
}

function submitUpdateList() {
  if (!list.value) return;

  updatingList.value = true;
  setTimeout(() => (updatingList.value = false), STATE_CHANGE_DURATION_MS);

  listsStore.updateList(newList.value);
}

const commaSeparator = ",";

function handleExportClick(): void {
  const itemNames = listsStore.getUncheckedItems(listIdParam.value).map((item) => item.name);
  const commaSeparatedNames = itemNames.join(commaSeparator);
  console.log("Copied to clip board:", commaSeparatedNames);
  navigator.clipboard.writeText(commaSeparatedNames);
}

function handleAddCommaSeparatedItems(): void {
  const names = newItemName.value.split(commaSeparator);

  for (const name of names) {
    console.log(name);
    listsStore.addItem(listIdParam.value, name);
  }

  newItemName.value = "";
}
</script>

<template>
  <BaseLayout>
    <template #sidebarLeft>
      <ListsNav />
    </template>
    <template #main>
      <div class="list-content">
        <template v-if="!list">List not found.</template>
        <template v-else>
          <RouterLink class="hide-above-900px" :to="{ name: LISTS }">&larr; Lists</RouterLink>
          <header class="list-header">
            <div>
              <form class="list-name-form" @submit.prevent="submitUpdateList()">
                <label class="form-control-label screen-reader-text" for="new-name">List Name</label>
                <input
                  id="new-name"
                  v-model="newList.name"
                  class="text-input list-title"
                  type="text"
                  placeholder="List name"
                  maxlength="255"
                  autocomplete="off"
                  required
                />
                <span v-if="updatingList" class="saved-notice" aria-hidden="true">Saved!</span>
                <button class="screen-reader-text">Update</button>
              </form>
              <div v-if="list.ownerId !== userStore.userId" class="shared-by">
                Shared by <strong>{{ list.ownerId }}</strong>
              </div>
              <div class="shared-by">Last updated: {{ new Date(list.lastUpdated).toLocaleString() }}</div>
            </div>

            <div v-if="userStore.online" class="list-actions">
              <button
                @click="toggleListDropdown"
                class="list-actions-button link-button"
                id="toggle-list-dropdown-button"
                aria-controls="list-dropdown"
                :aria-expanded="listDropdownIsVisible"
              >
                <span class="screen-reader-text">Toggle list manager</span>&hellip;
              </button>

              <div
                :class="{ 'visually-hidden': !listDropdownIsVisible }"
                class="list-dropdown dropdown-base"
                id="list-dropdown"
                aria-labelledby="toggle-list-dropdown-button"
              >
                <ul class="list-dropdown-list list-reset">
                  <li v-if="list.ownerId === userStore.userId">
                    <ul class="list-dropdown-sub-list list-reset">
                      <li>
                        <RouterLink class="button" :to="{ name: SHARING, query: { listId: list.id } }"
                          >Share List</RouterLink
                        >
                      </li>
                      <li>
                        <button class="button" @click="handleExportClick()">Export Item Names</button>
                      </li>
                    </ul>
                  </li>
                  <div class="danger-zone">
                    <button class="button button-danger" @click="deleteList()">Delete List</button>
                  </div>
                </ul>
              </div>
            </div>
          </header>

          <form @submit.prevent="submitAddItem()" class="create-item-form">
            <label>
              <span class="screen-reader-text">Add an item(s)</span>
              <input
                ref="addItemInput"
                v-model="newItemName"
                type="text"
                class="item-name-input text-input"
                placeholder="Add an item(s)"
                required
              />
            </label>
            <div class="create-item-actions">
              <button @click="handleAddCommaSeparatedItems()" class="create-item-button button" type="button">
                Add Comma Separated Items
              </button>
              <button class="create-item-button button" type="submit">Add</button>
            </div>
          </form>

          <div class="list-items-shell can-scroll">
            <ul class="list-reset">
              <li
                v-for="item in listsStore.getUncheckedItems(listIdParam)"
                :key="item.id"
                :class="{ 'is-active': itemIdParam === item.id }"
                class="item"
              >
                <CheckItemButton :listId="listIdParam" :item="item" @item-check-toggled="itemCheckToggled()" />
                <RouterLink :to="{ name: LIST_ITEM, params: { listId: listIdParam, itemId: item.id } }">
                  {{ item.name }}
                </RouterLink>
              </li>
            </ul>

            <template v-if="listsStore.getCheckedItems(listIdParam).length > 0">
              <h3 class="checked-title">
                <button
                  @click="toggleCheckedList"
                  class="toggle-checked-button link-button"
                  id="toggle-checked-button"
                  aria-controls="checked-dropdown"
                  :aria-expanded="checkedListIsVisible"
                >
                  <span :class="{ 'is-open': checkedListIsVisible }" class="disclose-triangle">&rsaquo;</span>
                  <span><span class="is-bold">Checked</span> {{ listsStore.getCheckedItems(listIdParam).length }}</span>
                </button>
              </h3>

              <ul
                :class="{ 'visually-hidden': !checkedListIsVisible }"
                class="list-reset"
                id="checked-dropdown"
                aria-labelledby="toggle-checked-button"
              >
                <li
                  v-for="item in listsStore.getCheckedItems(listIdParam)"
                  :key="item.id"
                  :class="{ 'is-active': itemIdParam === item.id }"
                  class="item"
                >
                  <CheckItemButton :listId="listIdParam" :item="item" @item-check-toggled="itemCheckToggled()" />
                  <RouterLink :to="{ name: LIST_ITEM, params: { listId: listIdParam, itemId: item.id } }">
                    {{ item.name }}
                  </RouterLink>
                </li>
              </ul>
            </template>
          </div>
        </template>
      </div>
    </template>
    <template #sidebarRight><RouterView /></template>
  </BaseLayout>
</template>

<style scoped>
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.list-actions-button {
  font-size: 1.25rem;
  font-weight: 700;
  padding: 12px;
}

.list-content {
  display: flex;
  flex-direction: column;

  padding: 1rem;
  width: 100%;
}

.list-title-form {
  width: 100%;
}

.list-title {
  font-size: 1.5rem;
  margin: 0;
  padding-left: 0;
  width: 100%;
}

.saved-notice {
  top: -5px;
  position: absolute;
  left: 0;
}

.disclose-triangle {
  font-size: 2rem;
  position: relative;
  top: -1px;
  transform-origin: center;
  height: 30px;
  width: 30px;
  line-height: 0.8;
  transition: all 0.1s ease-in-out;
}
.disclose-triangle.is-open {
  transform: rotate(90deg);
}

.item {
  display: flex;
  align-items: center;
  /* gap: 10px; */

  background: var(--color-black);
  box-shadow: 3px 3px 3px var(--color-background-shadow);
  border-radius: var(--border-radius);
  margin-bottom: 10px;
  /* padding: 10px 15px; */
  position: relative;
}

@media (hover: hover) and (pointer: fine) {
  .item:hover {
    background: var(--color-link-hover);
  }
}
.item.is-active {
  background: var(--color-link-hover);
}
.item > a {
  position: initial;
}
.item > a:hover {
  background: transparent;
}
.item > a::after {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  content: "";
}

.checked-title {
  font-size: 1rem;
  font-weight: 700;
  padding: 15px 0;
}

.toggle-checked-button {
  display: flex;
  align-items: center;

  position: relative;
}

.list-dropdown {
  top: 45px;
  z-index: 10000;
}

.list-dropdown-list li {
  margin-bottom: 10px;
}
.list-dropdown-list li:last-child {
  margin-bottom: 0;
}

.list-dropdown-sub-list li {
  margin-bottom: 0.5rem;
}

.shared-by {
  font-style: italic;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.list-items-shell {
  padding-bottom: 5rem;
}
</style>
