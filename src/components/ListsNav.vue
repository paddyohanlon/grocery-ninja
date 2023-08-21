<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { LIST } from "@/router/route-names";
import { useListsStore } from "@/stores/lists";
import { useUserStore } from "@/stores/user.js";
import { storeToRefs } from "pinia";

const listsStore = useListsStore();
const userStore = useUserStore();

const { lists } = storeToRefs(listsStore);

const router = useRouter();
const route = useRoute();

const listIdParam = ref(route.params.listId as string);

watch(
  () => route.params.listId,
  (newId) => {
    listIdParam.value = newId as string;
  },
);

const name = ref("");

async function createAndGoToList() {
  const listId = await listsStore.createList(name.value);
  name.value = "";
  router.push({ name: LIST, params: { listId } });
}
</script>

<template>
  <nav aria-label="Lists" class="list-nav can-scroll">
    <ul v-if="lists && lists.length > 0" class="list-reset">
      <li v-for="list in lists" :key="list.id">
        <RouterLink :class="{ 'is-active': listIdParam === list.id }" :to="{ name: LIST, params: { listId: list.id } }"
          ><span>{{ list.name }} </span>
          <span class="item-info">
            <img
              v-if="userStore.userId && list._hostId && userStore.userId !== list._hostId"
              alt="Shared list icon"
              src="@/assets/share.svg"
              width="16"
              height="16"
            />
            <img
              v-if="list.id === userStore.primaryListId"
              alt="Primary list icon"
              src="@/assets/house.svg"
              width="16"
              height="16"
            />
            <span>{{ listsStore.getUncheckedItems(list.id).length }}</span>
          </span>
        </RouterLink>
      </li>
    </ul>
  </nav>

  <form @submit.prevent="createAndGoToList()" class="create-list-form">
    <label class="list-name-label">
      <span class="screen-reader-text">List name</span>
      <input
        class="list-name-input text-input"
        v-model="name"
        type="text"
        placeholder="New list"
        maxlength="255"
        autocomplete="off"
        required
      /><button class="create-list-button link-button no-underline">
        <span class="plus-icon">+</span><span class="screen-reader-text">Create new list</span>
      </button>
    </label>
  </form>
</template>

<style scoped>
.list-nav {
  flex: 1;
}

.list-nav a {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;

  padding: 10px 15px;
}
.list-nav a.is-active {
  background: #000;
}

.item-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.create-list-form {
  margin-top: 1rem;
}

.list-name-label {
  display: flex;
}

.list-name-input {
  flex: 1;
}

.create-list-button {
  padding: 0 10px;
}

.plus-icon {
  font-size: 2rem;
}

.shared-lists-title {
  padding: 20px 15px 10px 15px;
}
</style>
