<script setup lang="ts">
import { rid, getAPIOrLocalData, contactsListConfig, createDataConfig } from "@/rethinkid";
import { ref, onUnmounted, computed } from "vue";
import type { Ref } from "vue";
import type {
  Contact,
  AcceptedInvitation,
  Invitation,
  Permission,
  ReceivedInvitation,
} from "@rethinkid/rethinkid-js-sdk";
import { STATE_CHANGE_DURATION_MS } from "@/timing";
import { useNotificationsStore } from "@/stores/notifications";
import { useListsStore } from "@/stores/lists";
import { useUserStore } from "@/stores/user.js";
import { useRoute } from "vue-router";
import router from "@/router";
import { HOME } from "@/router/route-names";

const route = useRoute();

const notificationsStore = useNotificationsStore();
const listsStore = useListsStore();
const userStore = useUserStore();

function listNameById(listId: string) {
  const list = listsStore.getList(listId);
  if (list) return list.name;
  return "";
}

/**
 * Contacts
 */
const contacts: Ref<Contact[]> = ref([]);

async function fetchContacts() {
  const contactsList = await getAPIOrLocalData(contactsListConfig);
  contacts.value = contactsList;
}
fetchContacts();

/**
 * Permissions
 */
const permissions: Ref<Permission[]> = ref([]);

async function fetchPermissions() {
  const permissionsConfig = createDataConfig(() => rid.permissions.get(), "permissions");
  const data = await getAPIOrLocalData(permissionsConfig);
  permissions.value = data;
}
fetchPermissions();

/**
 * Sent Invitations
 */
const sentInvitations: Ref<Invitation[]> = ref([]);

async function fetchInvitations() {
  const sentInvitationsConfig = createDataConfig(
    () => rid.invitations.list({ includeAccepted: true }),
    "sentInvitations",
  );
  const data = await getAPIOrLocalData(sentInvitationsConfig);
  sentInvitations.value = data;
}
fetchInvitations();

const invitationLinks = computed(() => {
  return sentInvitations.value.filter((invitation) => invitation.type === "link");
});

const userInvitations = computed(() => {
  return sentInvitations.value.filter((invitation) => invitation.type === "user");
});

function isUserSentInvitationAccepted(invitation: Invitation) {
  return invitation.type === "user" && invitation.accepted && invitation.accepted.length > 0;
}

/**
 * Received Invitations
 */
const receivedInvitations: Ref<ReceivedInvitation[]> = ref([]);

rid.invitations.onReceived((receivedInvitation) => {
  receivedInvitations.value.push(receivedInvitation);

  if (!isAcceptedReceivedInvitation(receivedInvitation.id)) {
    notificationsStore.addNotification("Invitation received.");
  }
});

/**
 * Accepted received invitations
 */
interface AcceptedReceivedInvitation {
  id: string; // received invitation ID
}

const acceptedReceivedInvitations: Ref<AcceptedReceivedInvitation[]> = ref([]);
const acceptedReceivedInvitationsTable = rid.table("accepted_received_invitation");

// Fetch accepted received invitations IDs
async function fetchAcceptedReceivedInvitations() {
  const acceptedReceivedInvitationsConfig = createDataConfig(
    () => acceptedReceivedInvitationsTable.read(),
    "acceptedReceivedInvitations",
  );
  const data = await getAPIOrLocalData(acceptedReceivedInvitationsConfig);
  acceptedReceivedInvitations.value = data as AcceptedReceivedInvitation[];
}
fetchAcceptedReceivedInvitations();

function isAcceptedReceivedInvitation(receivedInvitationId: string) {
  return acceptedReceivedInvitations.value.some((invitation) => invitation.id === receivedInvitationId);
}

/**
 * Accept received invitation
 */
async function acceptReceivedInvitation(receivedInvitation: ReceivedInvitation) {
  console.log("receivedInvitationId", receivedInvitation.id);
  try {
    const response = await rid.invitations.acceptReceived(receivedInvitation.id);
    console.log("acceptReceivedInvitation response", response);
    if (response.message === "Invitation already accepted.") {
      deleteReceivedInvitation(receivedInvitation.id);
      notificationsStore.addNotification("Invitation already accepted and has been deleted.");
      return;
    }

    listsStore.addContentSharer(receivedInvitation.hostId);

    notificationsStore.addNotification("Invitation accepted.");

    // Add receivedInvitation to check if accepted
    const acceptedReceivedInvitation: AcceptedReceivedInvitation = { id: receivedInvitation.id };
    acceptedReceivedInvitations.value.push(acceptedReceivedInvitation);
    acceptedReceivedInvitationsTable.insert(acceptedReceivedInvitation);
  } catch (e: any) {
    console.log("acceptReceivedInvitation error", e.message);
    if (e.message === "Invitation no longer exists.") {
      deleteReceivedInvitation(receivedInvitation.id);
      notificationsStore.addNotification("Invitation no longer exists and has been deleted.");
    }
  }
}

/**
 * Delete received invitation
 */
async function deleteReceivedInvitation(receivedInvitationId: string) {
  try {
    const response = await rid.invitations.deleteReceived(receivedInvitationId);
    console.log("deleteReceivedInvitation response", response);

    // Remove invitation from local state
    receivedInvitations.value = receivedInvitations.value.filter(
      (invitation) => invitation.id !== receivedInvitationId,
    );

    // Delete acceptedReceivedInvitation entries
    acceptedReceivedInvitations.value = acceptedReceivedInvitations.value.filter(
      (invitation) => invitation.id !== receivedInvitationId,
    );
    acceptedReceivedInvitationsTable.delete({ rowId: receivedInvitationId });
  } catch (e) {
    console.log("deleteReceivedInvitation error:", e);
  }
}

/**
 * onAccepted
 */
const acceptedInvitations: Ref<AcceptedInvitation[]> = ref([]);

rid.invitations.onAccepted((acceptedInvitation) => {
  acceptedInvitations.value.push(acceptedInvitation);

  console.log("inAccepted acceptedInvitation", acceptedInvitation);

  if (userStore.autoHandleInvitations) {
    console.log("auto-handle invitation on Invitations view");
    handleAcceptedSentInvitation(acceptedInvitation);
    router.push({ name: HOME });
    return;
  }
});

async function handleAcceptedSentInvitation(acceptedInvitation: AcceptedInvitation) {
  const invitation = sentInvitations.value.find((invitation) => invitation.id === acceptedInvitation.invitationId);

  if (!invitation) {
    console.log("Invitation of acceptedInvitation not found");
    return;
  }

  console.log("invitation to be handled", invitation);

  try {
    const list = await listsStore.getList(invitation.resource);

    if (!list) {
      console.log("List not found");
      return;
    }

    const userId = acceptedInvitation.userId;

    if (!userId) {
      console.log("acceptedInvitation has no userId");
      return;
    }

    list.userIDsWithAccess.push(userId);

    try {
      const response = await listsStore.updateList(list);
      console.log("updateList response", response);
    } catch (e: any) {
      console.log("Could not update list:", e.message);
    }

    await listsStore.addContentSharer(userId);
    await listsStore.fetchContentSharedWithMe();

    // mark as handled
    markAcceptedSentInvitationAsHandled(acceptedInvitation.id);

    // remove invitation from local state
    acceptedInvitations.value = acceptedInvitations.value.filter(
      (invitation) => invitation.id !== acceptedInvitation.id,
    );
  } catch (e: any) {
    console.log("permissions set error", e.message);
  }
}

async function markAcceptedSentInvitationAsHandled(acceptedInvitationId: string) {
  try {
    const response = await rid.invitations.handleAccepted(acceptedInvitationId);
    console.log("handleAcceptedSentInvitation response", response);
    notificationsStore.addNotification("Handled accepted invitation.");
  } catch (e: any) {
    console.log("handleAcceptedSentInvitation error: ", e.message);
  }
}

/**
 * Delete sent invitation
 */
async function deleteSentInvitation(invitationId: string) {
  try {
    const response = await rid.invitations.delete(invitationId);
    console.log("deleteSentInvitation response", response);

    // Remove invitation from local state
    sentInvitations.value = sentInvitations.value.filter((invitation) => invitation.id !== invitationId);
  } catch (e) {
    console.log("deleteSentInvitation error:", e);
  }
}

/**
 * Create link form
 */
const createLinkButtonTextInitial = "Create Invitation Link";
const createLinkButtonTextUpdating = "Creating...";
const createLinkButtonText = ref(createLinkButtonTextInitial);

const limitInputValue = ref(0);
const resourceInputValue = ref("");

if (route.query.listId) {
  resourceInputValue.value = route.query.listId as string;
}

async function submitCreateLink() {
  // Disable button while submitting
  createLinkButtonText.value = createLinkButtonTextUpdating;

  // Button text
  createLinkButtonText.value = createLinkButtonTextUpdating;
  setTimeout(() => (createLinkButtonText.value = createLinkButtonTextInitial), STATE_CHANGE_DURATION_MS);

  const link = await rid.invitations.createLink(limitInputValue.value, resourceInputValue.value);
  console.log("createLink response", link);

  // Need to fetch because only link returned. No ID.
  fetchInvitations();

  limitInputValue.value = 0;
  resourceInputValue.value = "";
}

/** Copy link url */
const copyLinkUrlButtonTextInitial = "Copy";
const copyLinkUrlButtonText = ref(copyLinkUrlButtonTextInitial);

function copyLinkUrlToClipboard(url: string): void {
  copyLinkUrlButtonText.value = "Copied!";
  navigator.clipboard.writeText(url);

  setTimeout(() => {
    copyLinkUrlButtonText.value = copyLinkUrlButtonTextInitial;
  }, 1000);
}

/**
 * Invite user form
 */
const inviteButtonTextInitial = "Invite User";
const inviteButtonTextUpdating = "Inviting...";
const inviteButtonText = ref(inviteButtonTextInitial);

const userIdInputValue = ref("");

async function submitInviteUser() {
  // Disable button while submitting
  inviteButtonText.value = inviteButtonTextUpdating;

  // Button text
  inviteButtonText.value = inviteButtonTextUpdating;
  setTimeout(() => (inviteButtonText.value = inviteButtonTextInitial), STATE_CHANGE_DURATION_MS);

  const response = await rid.invitations.inviteUser(userIdInputValue.value, resourceInputValue.value);

  console.log(response);

  userIdInputValue.value = "";

  // Need to fetch because only link returned. No ID.
  fetchInvitations();
}

onUnmounted(() => {
  console.log("Unmount Invitations View");
  rid.invitations.stopOnAccepted().then(() => console.log("did stopOnAccepted:"));
  rid.invitations.stopOnReceived().then(() => console.log("did stopOnReceived:"));
});
</script>

<template>
  <header class="contacts-header">
    <h1>Invitations</h1>
  </header>

  <div class="contacts-grid">
    <!-- col 1 -->
    <div>
      <div class="card">
        <h2>Invite User</h2>
        <form @submit.prevent="submitInviteUser()">
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
                {{ listsStore.getSharerUsername(contact.contactId) }}
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

          <button class="button">{{ inviteButtonText }}</button>
        </form>
      </div>
      <div class="card" v-if="userInvitations.length > 0">
        <h2>Sent User Invitations</h2>
        <ul class="contacts-list list-reset">
          <li v-for="invitation of userInvitations" :key="invitation.id">
            <div>
              <ul class="list-reset">
                <li><strong>User ID:</strong> {{ invitation.userId }}</li>
                <li><strong>Resource:</strong> {{ listNameById(invitation.resource) }}</li>
                <!-- <li>Accepted: {{ invitation.accepted }}</li> -->
              </ul>
            </div>
            <div class="button-list">
              <span v-if="isUserSentInvitationAccepted(invitation)" class="button button-orange button-disabled"
                >Accepted</span
              >
              <button class="button button-danger" @click="deleteSentInvitation(invitation.id)">Delete</button>
            </div>
          </li>
        </ul>
      </div>
      <div class="card" v-if="acceptedInvitations.length > 0">
        <h2>Unhandled Accepted Sent Invitations</h2>
        <ul class="contacts-list list-reset">
          <li v-for="invitation of acceptedInvitations" :key="invitation.id">
            <div>
              <ul class="list-reset">
                <li>User ID: {{ invitation.userId }}</li>
                <li>Invitation ID: {{ invitation.invitationId }}</li>
                <li>Handled: {{ invitation.handled }}</li>
              </ul>
            </div>
            <div class="button-list">
              <button class="button" @click="handleAcceptedSentInvitation(invitation)">Handle</button>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <!-- col 2 -->
    <div>
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
      <div class="card" v-if="invitationLinks.length > 0">
        <h2>Invitation Links</h2>
        <ul class="contacts-list list-reset">
          <li v-for="invitation of invitationLinks" :key="invitation.id">
            <div>
              <ul class="list-reset">
                <li class="link-url-item">
                  <strong>Link:</strong> {{ invitation.link }}
                  <button class="button is-small-text" @click="copyLinkUrlToClipboard(invitation.link as string)">
                    {{ copyLinkUrlButtonText }}
                  </button>
                </li>
                <li>Limit: {{ invitation.limit }}</li>
                <li>Accepted: {{ invitation.accepted }}</li>
                <li>Resource: {{ invitation.resource }}</li>
              </ul>
            </div>
            <div class="button-list">
              <span v-if="isUserSentInvitationAccepted(invitation)" class="button button-orange button-disabled"
                >Accepted</span
              >
              <button class="button button-danger" @click="deleteSentInvitation(invitation.id)">Delete</button>
            </div>
          </li>
        </ul>
      </div>
      <div class="card" v-if="receivedInvitations.length > 0">
        <h2>Received Invitations</h2>
        <ul class="contacts-list list-reset">
          <li v-for="invitation of receivedInvitations" :key="invitation.id">
            <div>
              <ul class="list-reset">
                <li>User ID: {{ invitation.userId }}</li>
                <li>Host ID: {{ invitation.hostId }}</li>
                <li>App ID: {{ invitation.appId }}</li>
                <li>Invitation ID: {{ invitation.invitationId }}</li>
                <li>Resource: Mystery Box</li>
              </ul>
            </div>
            <div class="button-list">
              <span v-if="isAcceptedReceivedInvitation(invitation.id)" class="button button-orange button-disabled"
                >Accepted</span
              >
              <button v-else class="button" @click="acceptReceivedInvitation(invitation)">
                Accept (and share username)
              </button>
              <button class="button button-danger" @click="deleteReceivedInvitation(invitation.id)">Delete</button>
            </div>
          </li>
        </ul>
      </div>
      <div class="card" v-if="listsStore.contentSharers && listsStore.contentSharers.length > 0">
        <h2>Content Sharers (those who share with me)</h2>
        <ul>
          <li v-for="sharer of listsStore.contentSharers" :key="sharer.id">
            {{ listsStore.getSharerUsername(sharer.id) }}
          </li>
        </ul>
      </div>
      <div class="card">
        <h2>All Permissions (I give to others)</h2>
        <ul class="contacts-list list-reset">
          <li v-for="permission of permissions" :key="permission.id">
            <ul class="list-reset">
              <li>Table: {{ permission.tableName }}</li>
              <li>Type: {{ permission.type }}</li>
              <li>User: {{ listsStore.getSharerUsername(permission.userId) }}</li>
              <li>Condition: {{ permission.condition }}</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.link-url-item {
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>
