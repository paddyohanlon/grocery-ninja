<script setup lang="ts">
import { ref } from "vue";
import type { Ref } from "vue";
import { rid } from "@/rethinkid";
import type { Contact } from "@rethinkid/rethinkid-js-sdk";

const contacts: Ref<Contact[]> = ref([]);

rid.social.listContacts().then((fetchedContacts) => {
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

      <ul class="list-reset">
        <li v-for="contact of contacts" :key="contact.id">
          {{ contact }}
        </li>
      </ul>
    </header>
  </div>
</template>

<style scoped></style>
