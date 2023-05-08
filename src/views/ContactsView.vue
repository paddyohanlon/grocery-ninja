<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import type { Ref } from "vue";
import { rid, SETTINGS_TABLE_NAME, SETTING_USERNAME } from "@/rethinkid";
import { STATE_CHANGE_DURATION_MS } from "@/timing";
import type { Contact, Message, ConnectionRequest } from "@rethinkid/rethinkid-js-sdk";
import { useNotificationsStore } from "@/stores/notifications";
import { useListsStore } from "@/stores/lists";

interface SentConnectionRequest {
  id: string; // contact's user ID
}

const notificationsStore = useNotificationsStore();
const listsStore = useListsStore();

const contactIdInputValue = ref("");

const connectButtonTextInitial = "Add Friend";
const connectButtonTextUpdating = "Sending Friend Request...";
const connectButtonText = ref(connectButtonTextInitial);

const addButtonTextInitial = "Add Contact";
const addButtonTextUpdating = "Adding Contact...";
const addButtonText = ref(addButtonTextInitial);

/**
 * Contacts
 */
const contacts: Ref<Contact[]> = ref([]);

function fetchContacts() {
  rid.contacts.list().then((contactsList) => {
    contacts.value = contactsList;
  });
}
fetchContacts();

/**
 * Sent connection requests
 */
const sentConnectionRequests: Ref<SentConnectionRequest[]> = ref([]);

// Need to manage these in app, RethinkID doesn't provide a way to get them
const sentConnectionRequestsTable = rid.table("sent_connection_requests");

// Fetch sent connection requests
sentConnectionRequestsTable.read().then((requests) => {
  sentConnectionRequests.value = requests as SentConnectionRequest[];
});

/**
 * Received connection requests
 */
const receivedConnectionRequests: Ref<ConnectionRequest[]> = ref([]);

// Receive connection requests
rid.contacts.onConnectionRequest((request) => {
  receivedConnectionRequests.value.push(request);
});

/**
 * Connect (or "Add Friend")
 */
async function submitSendConnectionRequest() {
  // Disable button while submitting
  if (connectButtonText.value === connectButtonTextUpdating) return;

  // Button text
  connectButtonText.value = connectButtonTextUpdating;
  setTimeout(() => (connectButtonText.value = connectButtonTextInitial), STATE_CHANGE_DURATION_MS);

  await connectRequestOrAccept(contactIdInputValue.value);

  contactIdInputValue.value = "";
}

/**
 * Add contact (or "Follow")
 */
async function submitAddContact() {
  // Disable button while submitting
  if (addButtonText.value === addButtonTextUpdating) return;

  // Button text
  addButtonText.value = addButtonTextUpdating;
  setTimeout(() => (addButtonText.value = addButtonTextInitial), STATE_CHANGE_DURATION_MS);

  try {
    // Can add any string as a contact, doesn't have to be a real user ID
    await rid.contacts.add(contactIdInputValue.value);

    // Need to fetch because contact not returned.
    fetchContacts();
  } catch (e: any) {
    notificationsStore.addNotification(e.message);
  }

  contactIdInputValue.value = "";
}

/**
 * Remove contact from contacts list, which also disconnects from contact
 * Contact must be in list to connect.
 */
async function removeContact(contactId: string) {
  try {
    await rid.contacts.remove(contactId);

    contacts.value = contacts.value.filter((contact) => {
      return contact.contactId !== contactId;
    });
  } catch (e) {
    console.log("remove contact error:", e);
  }
}

/**
 * Disconnect from contact while keeping contact in contacts list
 * "Unfriend" while still "Following"
 */
async function disconnect(contactId: string) {
  // Disconnect contact in database
  try {
    await rid.contacts.disconnect(contactId);

    // Disconnect contact in local state
    const index = contacts.value.findIndex((contact) => contact.contactId === contactId);
    contacts.value[index].connected = false;
  } catch (e: any) {
    notificationsStore.addNotification(e.message);
  }
}

async function deleteReceivedRequest(requestId: string) {
  try {
    await rid.contacts.deleteConnectionRequest(requestId);

    receivedConnectionRequests.value = receivedConnectionRequests.value.filter((request) => request.id !== requestId);
  } catch (e) {
    console.log("delete received request error", e);
  }
}

async function deleteSentRequest(requestId: string) {
  try {
    await sentConnectionRequestsTable.delete({ rowId: requestId });

    sentConnectionRequests.value = sentConnectionRequests.value.filter((request) => request.id !== requestId);
  } catch (e) {
    console.log("delete received request error", e);
  }
}

async function insertSentConnectionRequest(contactId: string): Promise<void> {
  const connectionRequest: SentConnectionRequest = {
    id: contactId,
  };

  try {
    await sentConnectionRequestsTable.insert(connectionRequest);

    if (!isConnectionRequestSent(connectionRequest.id)) {
      sentConnectionRequests.value.push(connectionRequest);
    }
  } catch (e) {
    console.log("insert connection request error", e);
  }
}

/**
 * Send connection request or accept connection request if contact already sent request
 */
async function connectRequestOrAccept(contactId: string): Promise<void> {
  try {
    const connectResponse = await rid.contacts.connect(contactId);

    if (connectResponse.message === "Contact connection request accepted.") {
      // Remove accepted received request from list
      receivedConnectionRequests.value = receivedConnectionRequests.value.filter(
        (request) => request.contactId !== contactId,
      );
      return;
    }

    await insertSentConnectionRequest(contactId);
  } catch (e: any) {
    notificationsStore.addNotification(e.message);
  }
}

function isConnectionRequestSent(contactId: string): boolean {
  return sentConnectionRequests.value.some((request) => request.id === contactId);
}

let unsubscribe: null | (() => Promise<Message>) = null;

rid.contacts
  .subscribe(async (changes) => {
    //  added
    if (changes.new_val && changes.old_val === null) {
      console.log("Added new contact", changes.new_val);
      notificationsStore.addNotification("Contact added.");
      const newContact = changes.new_val as Contact;

      await listsStore.addContentSharer(newContact.contactId);

      contacts.value.push(newContact);

      // remove pending connection from database and store
      const index = sentConnectionRequests.value.findIndex((request) => request.id === newContact.contactId);

      if (index === -1) return;

      sentConnectionRequestsTable.delete({ rowId: sentConnectionRequests.value[index].id });

      sentConnectionRequests.value.splice(index, 1);
    }
    // deleted
    if (changes.new_val === null && changes.old_val) {
      console.log("Deleted contact", changes.old_val);
      notificationsStore.addNotification("Contact deleted.");
    }
    // updated
    if (changes.new_val && changes.old_val) {
      console.log("Updated contact", changes.new_val);
      notificationsStore.addNotification("Contact updated.");
      const updatedContact = changes.new_val as Contact;
      const index = contacts.value.findIndex((contact) => contact.id === updatedContact.id);

      if (index === -1) return;

      contacts.value[index] = updatedContact;

      // remove now connected contacts from sent requests list
      sentConnectionRequests.value = sentConnectionRequests.value.filter(
        (request) => !(request.id === updatedContact.contactId && updatedContact.connected),
      );
    }
  })
  .then((response) => {
    unsubscribe = response;
  });

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe().then((r) => console.log("did unsubscribe: ", r));
  }

  rid.contacts.stopOnConnectionRequest().then((response) => console.log("did stopOnConnectionRequest:", response));
});
</script>

<template>
  <div>
    <header class="contacts-header">
      <h1>Contacts</h1>

      <form @submit.prevent="submitAddContact()" class="create-item-form">
        <label>
          <span class="screen-reader-text">Contact ID</span>
          <input
            v-model="contactIdInputValue"
            type="text"
            class="item-name-input text-input"
            autocomplete="off"
            placeholder="e.g. 7023c9e7-1ffd-44f1-8f3c-26da76553a78"
            required
          />
        </label>
        <div class="create-item-actions">
          <button class="create-item-button button" type="submit">{{ addButtonText }}</button>
          <button class="create-item-button button" type="button" @click="submitSendConnectionRequest()">
            {{ connectButtonText }}
          </button>
        </div>
      </form>
    </header>

    <div class="contacts-grid">
      <!-- col 1 -->
      <div v-if="contacts && contacts.length > 0" class="card">
        <h2>Contacts List</h2>
        <ul class="contacts-list list-reset">
          <li v-for="contact in contacts" :key="contact.id">
            <div>{{ listsStore.getSharerUsername(contact.contactId) }}</div>
            <div class="button-list">
              <button v-if="contact.connected" @click="disconnect(contact.contactId)" class="button button-danger">
                Unfriend
              </button>
              <span
                v-else-if="isConnectionRequestSent(contact.contactId)"
                class="button button-orange button-disabled button-disabled"
                >Connection Request Sent</span
              >
              <button v-else class="button" @click="connectRequestOrAccept(contact.contactId)">Connect</button>
              <button class="button button-danger" @click="removeContact(contact.contactId)">
                <template v-if="contact.connected">Delete Contact</template>
                <template v-else>Delete Contact</template>
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- col 2 -->
      <div>
        <div v-if="receivedConnectionRequests && receivedConnectionRequests.length > 0" class="card">
          <h2>Received Connection Requests</h2>
          <ul class="contacts-list list-reset">
            <li v-for="request in receivedConnectionRequests" :key="request.id">
              <div>{{ request.contactId }}</div>
              <div class="button-list">
                <button @click="connectRequestOrAccept(request.contactId)" class="button">Accept</button>
                <button @click="deleteReceivedRequest(request.id)" class="button button-danger">Delete</button>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="sentConnectionRequests && sentConnectionRequests.length > 0" class="card">
          <h2>Sent Connection Requests</h2>
          <ul class="contacts-list list-reset">
            <li v-for="request in sentConnectionRequests" :key="request.id">
              <div>{{ request.id }}</div>
              <div class="button-list">
                <button @click="deleteSentRequest(request.id)" class="button button-danger">Delete</button>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
