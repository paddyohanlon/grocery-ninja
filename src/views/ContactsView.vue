<script setup lang="ts">
import { ref } from "vue";
import type { Ref } from "vue";
import { rid } from "@/rethinkid";
import type { Contact } from "@rethinkid/rethinkid-js-sdk";

const contacts: Ref<Contact[]> = ref([]);

rid.social.contacts.list().then((fetchedContacts) => {
  console.log("fetchedContacts", fetchedContacts);
  for (const contact of fetchedContacts) {
    contacts.value.push(contact);
  }
});
</script>

<template>
  <div>
    <header class="sharing-header">
      <h1>Contacts</h1>
    </header>

    <div class="sharing-grid">
      <div class="card">
        <h2>Modal</h2>
        <ul class="list-reset">
          <li><button class="button" @click="rid.social.openModal()">Open Social Modal</button></li>
        </ul>
      </div>

      <div class="card">
        <ul>
          <li v-for="c of contacts" :key="c.id">
            <ul class="list-reset">
              <li>Contact: {{ c.user.name }} ({{ c.user.email }})</li>
              <li>Connected: {{ c.connected }}</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
