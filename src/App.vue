<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { rid } from '@/rethinkid'
import { useAuthStore } from '@/stores/auth'
import { useListsStore } from '@/stores/lists'
import { useRouter, useRoute } from 'vue-router'
import { HOME, LIST } from '@/router/route-names'

const router = useRouter()
const route = useRoute()

const loading = ref(true)
const userId = ref('')

const accountDropdownIsVisible = ref(false)

const authStore = useAuthStore()
const listsStore = useListsStore()

function onLogin() {
  console.log('onLogin fired')
  authStore.setLoggedIn(true)

  rid.users.getInfo().then((response) => {
    userId.value = response.id
  })

  listsStore.fetchLists().then(() => {
    if (listsStore.lists === null) return
    loading.value = false

    // Redirect the home route to the primary list
    if (route.name !== HOME) return

    const primaryListId = listsStore.getPrimaryListId()
    if (!primaryListId) return
    router.push({ name: LIST, params: { listId: primaryListId } })
  })
}

if (rid.isLoggedIn()) {
  console.log('logged in')
  onLogin()
} else {
  console.log('NOT logged in')
  loading.value = false

  rid.onLogin(() => {
    onLogin()
  })
}

function toggleAccountDropdown() {
  accountDropdownIsVisible.value = !accountDropdownIsVisible.value
}
</script>

<template>
  <div class="page-container">
    <div class="header-shell">
      <header class="header">
        <RouterLink to="/" class="logo-link">
          <img alt="Logo" class="logo" src="@/assets/logo.svg" width="24" height="24" />
        </RouterLink>

        <div class="header-region-right">
          <template v-if="!authStore.loggedIn">
            <button @click="rid.login()" class="header-button link-button">Get Started</button>
            <button @click="rid.login()" class="header-button link-button">Sign In</button>
          </template>
          <template v-else>
            <button
              @click="toggleAccountDropdown"
              class="header-button link-button"
              :class="{ 'header-button-active': accountDropdownIsVisible }"
              id="toggle-account-button"
              aria-controls="account-dropdown"
              :aria-expanded="accountDropdownIsVisible"
            >
              <span class="screen-reader-text">Toggle account manager</span>
              <img
                alt=""
                class="account-icon"
                src="@/assets/user.svg"
                width="24"
                height="24"
                aria-hidden="true"
                role="presentation"
              />
            </button>

            <div
              :class="{ 'visually-hidden': !accountDropdownIsVisible }"
              class="account-dropdown dropdown-base"
              id="account-dropdown"
              aria-labelledby="toggle-account-button"
            >
              <ul class="account-dropdown-list list-reset">
                <li>{{ userId }}</li>
                <li><button @click="rid.logOut()" class="link-button">Sign out</button></li>
              </ul>
            </div>
          </template>
        </div>
      </header>
    </div>

    <div class="loading" v-if="loading">Loading...</div>
    <template v-else><RouterView /></template>
  </div>
</template>

<style scoped>
.loading {
  padding: 1rem;
}
.header-shell {
  height: var(--header-height);
  z-index: 100;
  border-bottom: 1px solid var(--color-background);
}

.header {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 1rem;

  background: var(--color-green);
  color: var(--color-white);
  height: var(--header-height);
  line-height: var(--header-height);
  width: 100%;
}

.logo-link {
  display: flex;
  padding-left: 11px;
  padding-right: 16px;
}

.logo {
  align-self: center;
  display: block;
  max-width: 21px;
}

.header-region-right {
  display: flex;
  align-items: stretch;
}

.account-dropdown {
  top: var(--header-height);
}

.account-dropdown-list {
  font-size: 13px;
  line-height: 2;
}

.header-button {
  color: var(--color-white);
  display: flex;
  align-items: center;
  padding-right: 12px;
  padding-left: 12px;
}

.header-button:focus {
  outline: none;
}

.header a:hover,
.header-button:hover,
.header-button-active {
  background-color: var(--color-green-hover);
}
</style>
