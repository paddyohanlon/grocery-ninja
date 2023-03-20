<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { LIST } from '@/router/route-names'
import { useListsStore } from '@/stores/lists'
import { storeToRefs } from 'pinia'

const store = useListsStore()

const { lists } = storeToRefs(store)

const router = useRouter()
const route = useRoute()

const listIdParam = ref(route.params.listId as string)

watch(
  () => route.params.listId,
  (newId) => {
    listIdParam.value = newId as string
  },
)

const name = ref('')

async function createAndGoToList() {
  const listId = await store.createList(name.value)
  name.value = ''
  router.push({ name: LIST, params: { listId } })
}
</script>

<template>
  <nav aria-label="Lists" class="list-nav">
    <ul v-if="lists && lists.length > 0" class="list-reset">
      <li v-for="list in lists" :key="list.id">
        <RouterLink
          :class="{ 'is-active': listIdParam === list.id }"
          :to="{ name: LIST, params: { listId: list.id } }"
          ><span>{{ list.name }}</span>
          <img
            v-if="list.isPrimary"
            alt="Primary list icon"
            src="@/assets/house.svg"
            width="16"
            height="16"
          />
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

  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
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
</style>
