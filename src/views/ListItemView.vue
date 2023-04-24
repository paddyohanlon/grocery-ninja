<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { LIST } from "@/router/route-names";
import { useListsStore } from "@/stores/lists";
import CheckItemButton from "@/components/CheckItemButton.vue";
import { STATE_CHANGE_DURATION_MS } from "@/timing";

const store = useListsStore();

const route = useRoute();
const router = useRouter();

const listIdParam = ref(route.params.listId as string);
const itemIdParam = ref(route.params.itemId as string);

const item = ref(store.getItem(listIdParam.value, itemIdParam.value));
const newItem = ref(Object.assign({}, item.value));

const sidebarRightIsVisible = ref(false);

const updateButtonTextInitial = "Update";
const updateButtonTextUpdating = "Updating...";

const updateButtonText = ref(updateButtonTextInitial);

watch(
  () => route.params.itemId,
  (newId) => {
    itemIdParam.value = newId as string;
    if (itemIdParam.value) {
      sidebarRightIsVisible.value = true;
      item.value = store.getItem(listIdParam.value, itemIdParam.value);

      if (!item.value) return;
      newItem.value = Object.assign({}, item.value);
    } else {
      sidebarRightIsVisible.value = false;
    }
  },
  { immediate: true },
);

function closeItem() {
  router.push({ name: LIST, params: { listId: listIdParam.value } });
}

function updateItem() {
  if (updateButtonText.value === updateButtonTextUpdating) return;

  if (!item.value) return;

  item.value = Object.assign(item.value, newItem.value);

  updateButtonText.value = updateButtonTextUpdating;
  setTimeout(() => (updateButtonText.value = updateButtonTextInitial), STATE_CHANGE_DURATION_MS);

  store.updateItem(listIdParam.value, item.value);
}

function deleteItem() {
  if (window.confirm("Are you sure you want to delete this item?")) {
    store.deleteItem(listIdParam.value, itemIdParam.value);
    closeItem();
  }
}
</script>

<template>
  <template v-if="!item || !newItem">Item not found.</template>
  <template v-else>
    <aside :class="{ 'sidebar-right-closed': !sidebarRightIsVisible }" class="sidebar-right">
      <div class="sidebar-actions">
        <button class="close-item-button link-button" @click="closeItem">
          <span class="screen-reader-text">Close item</span>&times;
        </button>
      </div>

      <div class="item-shell">
        <div class="item-content">
          <form @submit.prevent="updateItem()">
            <div class="item-header">
              <CheckItemButton :listId="listIdParam" :item="item" />

              <label class="form-control-label screen-reader-text" for="new-name">Item Name</label>
              <input
                id="new-name"
                v-model="newItem.name"
                class="is-full-width"
                type="text"
                placeholder="Item name"
                maxlength="255"
                autocomplete="off"
                required
              />
            </div>

            <div class="form-control">
              <label class="form-control-label" for="new-price">Price</label>
              <input
                id="new-price"
                v-model="newItem.price"
                class="item-input is-full-width"
                type="number"
                autocomplete="off"
                step="0.01"
              />
            </div>

            <div class="form-control">
              <label class="form-control-label" for="new-quantity">Quantity</label>
              <input
                id="new-quantity"
                v-model="newItem.quantity"
                class="item-input is-full-width"
                type="number"
                autocomplete="off"
                step="0.01"
              />
            </div>

            <div class="form-control">
              <label class="form-control-label" for="new-vendor">Vendor</label>
              <input
                id="new-vendor"
                v-model="newItem.vendor"
                class="item-input is-full-width"
                type="text"
                autocomplete="off"
              />
            </div>

            <div class="form-control">
              <label class="form-control-label" for="new-notes">Notes</label>
              <textarea id="new-notes" v-model="newItem.notes" class="item-input is-full-width"></textarea>
            </div>

            <button class="button">{{ updateButtonText }}</button>
          </form>

          <div class="danger-zone">
            <button class="button button-danger" @click="deleteItem()">Delete Item</button>
          </div>
        </div>
      </div>
    </aside>
  </template>
</template>

<style scoped>
.sidebar-right {
  display: flex;
  flex-direction: column;

  box-shadow: -3px 3px 3px var(--color-background-shadow);
  width: 360px;
}
.sidebar-right-closed {
  width: 0;
}

.sidebar-actions {
  display: flex;
  justify-content: flex-end;
}

.close-item-button {
  color: var(--color-text);
  font-size: 2rem;
  padding: 6px 14px;
}

.item-shell {
  display: flex;
  flex-direction: column;
  flex: 1;

  padding: 10px 15px;
  overflow: hidden;
}

.item-content {
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.item-header {
  display: flex;
  align-items: center;

  margin-bottom: 1rem;
}

.item-input {
  border: 1px solid var(--color-black);
  border-radius: var(--border-radius);
}
</style>
