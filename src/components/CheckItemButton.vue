<script setup lang="ts">
import { ref } from "vue";
import type { PropType } from "vue";
import { useListsStore } from "@/stores/lists";
import type { ListItem } from "@/types";

const store = useListsStore();

const props = defineProps({
  listId: {
    type: String,
    required: true,
  },
  item: {
    type: Object as PropType<ListItem>,
    required: true,
  },
});

const item = ref(props.item);

function toggleItemChecked() {
  item.value.checked = !item.value.checked;
  store.updateItem(props.listId, item.value);
}
</script>

<template>
  <button
    type="button"
    @click="toggleItemChecked()"
    :class="{ 'check-button-checked': item.checked }"
    class="check-button link-button"
  >
    <span class="screen-reader-text">Toggle item checked</span>
  </button>
</template>

<style scoped>
.check-button {
  border-radius: 10px;
  border: 1px solid var(--color-green);
  height: 18px;
  width: 18px;
  position: relative;
  text-decoration: none;
  z-index: 100;
}
.check-button:hover:before,
.check-button-checked:before {
  font-size: 0.9rem;
  position: absolute;
  top: 0;
  left: 3px;
  content: "\2713";
}
</style>
