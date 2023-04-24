<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import type { Ref } from "vue";
import { rid } from "@/rethinkid";
import { STATE_CHANGE_DURATION_MS } from "@/timing";
import type { Contact, Message, ConnectionRequest } from "@rethinkid/rethinkid-js-sdk";

interface SentConnectionRequest {
  id: string;
  contactId: string;
}

type NewSentConnectionRequest = Omit<SentConnectionRequest, "id">;

const sentConnectionRequestsTable = rid.table("sentConnectionRequests");

const userToConnectId = ref("");
const userToAddId = ref("");

const connectButtonTextInitial = "Connect";
const connectButtonTextUpdating = "Connecting...";
const connectButtonText = ref(connectButtonTextInitial);

const addButtonTextInitial = "Add";
const addButtonTextUpdating = "Adding...";
const addButtonText = ref(addButtonTextInitial);

rid.contacts.onConnectionRequest((request) => {
  receivedConnectionRequests.value.push(request);
});

const contacts: Ref<Contact[]> = ref([]);

function fetchContactsList() {
  rid.contacts.list().then((contactsList) => {
    contacts.value = contactsList;
  });
}

fetchContactsList();

const sentConnectionRequests: Ref<SentConnectionRequest[]> = ref([]);

const receivedConnectionRequests: Ref<ConnectionRequest[]> = ref([]);

sentConnectionRequestsTable.read().then((requests) => {
  sentConnectionRequests.value = requests as SentConnectionRequest[];
});

async function connectRequestOrAccept(contactId: string): Promise<void> {
  const connectResponse = await rid.contacts.connect(contactId);

  if (connectResponse.message === "Contact connection request accepted.") {
    receivedConnectionRequests.value = receivedConnectionRequests.value.filter(
      (request) => request.contactId !== contactId,
    );
    return;
  }
  await addSentConnectionRequest(contactId);
}

async function submitSendConnectionRequest() {
  if (connectButtonText.value === connectButtonTextUpdating) return;

  connectButtonText.value = connectButtonTextUpdating;
  setTimeout(() => (connectButtonText.value = connectButtonTextInitial), STATE_CHANGE_DURATION_MS);

  await connectRequestOrAccept(userToConnectId.value);

  userToConnectId.value = "";
}

async function addSentConnectionRequest(contactId: string) {
  if (sentConnectionRequests.value.some((request) => request.contactId === contactId)) {
    console.log("Sent connection request already added!");
    return;
  }

  const connectionRequest: NewSentConnectionRequest = {
    contactId,
  };

  const id = await sentConnectionRequestsTable.insert(connectionRequest);

  const firstId = id[0]

  const requestSent: SentConnectionRequest = {
    id: firstId,
    ...connectionRequest,
  };

  sentConnectionRequests.value.push(requestSent);
}

function isPendingSentConnectionRequest(contactId: string): boolean {
  console.log("contactId", contactId);
  return sentConnectionRequests.value.some((request) => request.contactId === contactId);
}

async function addUserId() {
  if (addButtonText.value === addButtonTextUpdating) return;

  addButtonText.value = addButtonTextUpdating;
  setTimeout(() => (addButtonText.value = addButtonTextInitial), STATE_CHANGE_DURATION_MS);

  const addResponse = await rid.contacts.add(userToAddId.value);
  console.log("addResponse", addResponse);

  userToAddId.value = "";

  fetchContactsList();
}

async function removeContact(contactId: string) {
  const r = await rid.contacts.remove(contactId);
  console.log("removed contact:", r);

  contacts.value = contacts.value.filter((contact) => {
    return contact.contactId !== contactId;
  });

  rid.contacts.deleteConnectionRequest
}

async function disconnect(contactId: string) {
  const r = await rid.contacts.disconnect(contactId);
  console.log("disconnected from user: ", r);

  const index = contacts.value.findIndex((contact) => contact.contactId === contactId);
  contacts.value[index].connected = false;
}

async function deleteRequest(requestId: string) {
  const r = await rid.contacts.deleteConnectionRequest(requestId)
  console.log('deleteConnectionRequest response', r)

  receivedConnectionRequests.value = receivedConnectionRequests.value.filter(
    (request) => request.id !== requestId,
  );
}

let unsubscribe: null | (() => Promise<Message>) = null;

rid.contacts
  .subscribe((changes) => {
    console.log("contacts subscribe changes", changes);

    //  added
    if (changes.new_val && changes.old_val === null) {
      console.log("added new contact", changes.new_val);
      const newContact = changes.new_val as Contact;
      contacts.value.push(newContact);

      // remove pending connection from database and store
      const index = sentConnectionRequests.value.findIndex(request => request.contactId === newContact.contactId);

      if (index === -1) return; 

      sentConnectionRequestsTable.delete({ rowId: sentConnectionRequests.value[index].id })

      sentConnectionRequests.value.splice(index, 1);
    }
    // deleted
    if (changes.new_val === null && changes.old_val) {
      console.log("TODO deleted contact", changes.old_val);
    }
    // updated
    if (changes.new_val && changes.old_val) {
      console.log("updated contact", changes.new_val);
      const updatedContact = changes.new_val as Contact;
      const index = contacts.value.findIndex((contact) => contact.id === updatedContact.id);
      contacts.value[index] = updatedContact;

      sentConnectionRequests.value = sentConnectionRequests.value.filter(
        (request) => !(request.contactId === updatedContact.contactId && updatedContact.connected),
      );
    }
  })
  .then((response) => {
    unsubscribe = response;
  });

onUnmounted(() => {
  console.log("Unmounting ContactsView");
  if (unsubscribe) {
    unsubscribe().then((r) => console.log("did unsubscribe: ", r));
  }

  rid.contacts.stopOnConnectionRequest().then((response) => console.log("did stopOnConnectionRequest:", response));
});
</script>

<template>
  <div>
    <h1 class="screen-reader-text">Contacts</h1>

    <div class="contacts-grid">
      <div>
        <div class="card">
          <h2>Add Contact (Follow)</h2>
          <form @submit.prevent="addUserId()">
            <div class="form-control">
              <label class="form-control-label" for="user-to-add-id">User ID</label>
              <input
                id="user-to-add-id"
                v-model="userToAddId"
                type="text"
                class="text-input is-full-width has-black-border"
                autocomplete="off"
                placeholder="e.g. 7023c9e7-1ffd-44f1-8f3c-26da76553a78"
                required
              />
            </div>

            <button class="update-button button">{{ addButtonText }}</button>
          </form>
        </div>

        <div class="card">
          <h2>Contacts List</h2>
          <ul class="contacts-list list-reset">
            <li v-for="contact in contacts" :key="contact.id">
              <div>{{ contact.contactId }}</div>
              <div class="button-list">
                <button v-if="contact.connected" @click="disconnect(contact.contactId)" class="button button-danger">
                  Disconnect Only
                </button>
                <span v-else-if="isPendingSentConnectionRequest(contact.contactId)" class="button button-orange button-disabled" >Pending</span>
                <button v-else class="button" @click="connectRequestOrAccept(contact.contactId)">Connect</button>
                <button class="button button-danger" @click="removeContact(contact.contactId)">Disconnect and Delete</button>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div>
        <div class="card">
          <h2>Send Connection Request (Add as Friend & Follow)</h2>
          <form @submit.prevent="submitSendConnectionRequest()">
            <div class="form-control">
              <label class="form-control-label" for="user-to-connect-id">User ID</label>
              <input
                id="user-to-connect-id"
                v-model="userToConnectId"
                type="text"
                class="text-input is-full-width has-black-border"
                autocomplete="off"
                placeholder="e.g. 7023c9e7-1ffd-44f1-8f3c-26da76553a78"
                required
              />
            </div>

            <button class="button">{{ connectButtonText }}</button>
          </form>
        </div>

        <div class="card">
          <h2>Sent Connection Requests</h2>
          <ul class="contacts-list list-reset">
            <li v-for="request in sentConnectionRequests" :key="request.id">
              {{ request.contactId }}
            </li>
          </ul>
        </div>
        
        <div class="card">
          <h2>Received Connection Requests</h2>
          <ul class="contacts-list list-reset">
            <li v-for="request in receivedConnectionRequests" :key="request.id">
              <div>{{ request.contactId }}</div>
              <div class="button-list">
                <button @click="connectRequestOrAccept(request.contactId)" class="button">Accept</button>
                <button @click="deleteRequest(request.id)" class="button button-danger">Delete</button>
              </div>
            </li>
          </ul>
        </div>
      </div>
      
    </div>
  </div>
</template>

<style scoped>
.contacts-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
  padding: 1rem;
}

.contacts-list li {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

.button-list {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
}


</style>
