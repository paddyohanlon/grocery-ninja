<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { rid, syncData } from "@/rethinkid";
import { useUserStore } from "@/stores/user.js";
import { useListsStore } from "@/stores/lists";
import { useNotificationsStore } from "@/stores/notifications";
import { useRouter } from "vue-router";
import { CONTACTS, SHARING } from "@/router/route-names";

const router = useRouter();

const loading = ref(true);

const accountDropdownIsVisible = ref(false);

const userStore = useUserStore();
const listsStore = useListsStore();
const notificationsStore = useNotificationsStore();

const online = ref(window.navigator.onLine);
window.addEventListener("online", () => {
  online.value = true;

  // poll till connected
  function pollConnectSync() {
    console.log("pollConnectSync");
    rid.tables
      .list()
      .then((res) => {
        console.log("sync poll list tables res", res);
        console.log("Could list tables, we're connected. Sync!");
        syncData().then(() => listsStore.removeNeedsSync());
      })
      .catch((e) => {
        console.log("sync poll list tables error, re-try in a bit", e.message);
        setTimeout(() => {
          console.log("retry");
          pollConnectSync();
        }, 500);
      });
  }
  pollConnectSync();
});
window.addEventListener("offline", () => (online.value = false));

async function onLogin() {
  userStore.setLoggedIn(true);

  await userStore.fetchUserInfo();
  await userStore.fetchSettings();

  // Receive contact connection requests
  rid.contacts.onConnectionRequest(() => {
    notificationsStore.addNotification("Contact connection request received.");
  });

  await listsStore.fetchLists();
  await listsStore.fetchSharedLists();

  loading.value = false;

  // type Changes = {
  //   new_val: null | object;
  //   old_val: null | object;
  // };

  // function isAddedChange(changes: Changes) {
  //   return changes.new_val && changes.old_val === null;
  // }
  // function isDeletedChange(changes: Changes) {
  //   return changes.new_val === null && changes.old_val;
  // }
  // function isUpdateChange(changes: Changes) {
  //   return changes.new_val && changes.old_val;
  // }

  // Tidy all this
  // Go to HOME, make HOME lists view
  // syncData()
  //   .then(() => {
  //     return listsStore.fetchLists();
  //   })
  //   .then(() => {
  //     // Subscribe to my lists table changes
  //     if (window.navigator.onLine) {
  //       listsTable.subscribe({}, (changes) => {
  //         if (isAddedChange(changes)) {
  //           console.log("Added", changes.new_val);
  //         }
  //         if (isDeletedChange(changes)) {
  //           console.log("One of my lists was deleted", changes.old_val);
  //           const deletedList = changes.old_val as List;

  //           // Remove list from local state
  //           if (!listsStore.lists) return;

  //           listsStore.lists = listsStore.lists.filter((list) => list.id !== deletedList.id);
  //         }
  //         if (isUpdateChange(changes)) {
  //           console.log("Updated", changes.new_val);
  //           const updatedList = changes.new_val as List;

  //           if (!listsStore.lists) return;

  //           listsStore.lists = listsStore.lists.map((list) => {
  //             if (list.id === updatedList.id) {
  //               return updatedList;
  //             }
  //             return list;
  //           });
  //         }
  //       });
  //     }

  //     if (listsStore.lists === null) return;
  //     loading.value = false;

  //     // Redirect the home route to the primary list
  //     if (route.name !== HOME) return;

  //     const primaryListId = userStore.primaryListId;
  //     if (!primaryListId) return;
  //     router.push({ name: LIST, params: { listId: primaryListId } });
  //   });
}

function goToFromAccountDropdown(routeName: string) {
  router.push({ name: routeName });
  accountDropdownIsVisible.value = false;
}

if (rid.isLoggedIn()) {
  onLogin();
} else {
  loading.value = false;

  rid.onLogin(async () => {
    onLogin();
  });
}

function toggleAccountDropdown() {
  accountDropdownIsVisible.value = !accountDropdownIsVisible.value;
}

function closeAccountDropdown() {
  accountDropdownIsVisible.value = false;
}

/**
 * Copy user ID to clipboard
 */
const copyButtonTextInitial = "Copy user ID";
const copyButtonText = ref(copyButtonTextInitial);

function copyToClipboard(): void {
  copyButtonText.value = "Copied!";
  navigator.clipboard.writeText(userStore.userId);

  setTimeout(() => {
    copyButtonText.value = copyButtonTextInitial;
  }, 1000);
}

function onWindowClick(event: any) {
  if (event.target.closest("#account-dropdown") || event.target.closest("#toggle-account-button")) return;
  closeAccountDropdown();
}

function onEscapeKeyDown(event: any) {
  if (event.key === "Escape" || event.code === "Escape") {
    closeAccountDropdown();
  }
}

onMounted(() => {
  window.addEventListener("click", onWindowClick);
  window.addEventListener("keydown", onEscapeKeyDown);
});
</script>

<template>
  <div class="page-container">
    <div class="header-shell">
      <header class="header">
        <RouterLink to="/" class="logo-link">
          <img alt="Logo" class="logo" src="@/assets/logo.svg" width="24" height="24" />
        </RouterLink>

        <div class="header-region-right">
          <div v-if="!online" class="header-item-highlight header-text-item">Offline</div>
          <template v-if="!userStore.loggedIn">
            <button @click="rid.login()" class="header-button link-button">Get Started</button>
            <button @click="rid.login()" class="header-button link-button">Sign In</button>
          </template>
          <template v-else>
            <div class="header-text-item">{{ userStore.userId }}</div>
            <button
              @click.stop="toggleAccountDropdown"
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
                <li>
                  {{ userStore.userId }}
                  <button class="button is-small-text" @click="copyToClipboard">
                    {{ copyButtonText }}
                  </button>
                </li>
                <li><button @click="goToFromAccountDropdown(CONTACTS)" class="link-button">Contacts</button></li>
                <li><button @click="goToFromAccountDropdown(SHARING)" class="link-button">Sharing</button></li>
                <li><button @click="rid.logOut()" class="link-button">Sign out</button></li>
              </ul>
            </div>
          </template>
        </div>
      </header>
    </div>

    <div class="loading" v-if="loading">Loading...</div>
    <template v-else><RouterView /></template>

    <div
      class="notifications"
      :class="{ 'visually-hidden': notificationsStore.notifications.length === 0 }"
      role="alert"
    >
      <ul v-if="notificationsStore.notifications.length > 0" class="notifications-list list-reset">
        <li v-for="(notification, index) of notificationsStore.notifications" :key="index">
          {{ notification }}
        </li>
      </ul>
    </div>
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

.account-dropdown {
  top: var(--header-height);
}

.account-dropdown-list {
  font-size: 13px;
  line-height: 2;
}
.account-dropdown-list a:hover {
  background: transparent;
}

.has-transparent-background {
  background: transparent;
}

.header-text-item {
  padding: 0 12px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-item-highlight {
  background: #069867;
  text-transform: uppercase;
  font-style: bold;
}
</style>
