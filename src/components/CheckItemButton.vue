<script setup lang="ts">
import { ref } from "vue";
import type { PropType } from "vue";
import { useListsStore } from "@/stores/lists";
import type { ListItem } from "@/types";

const emit = defineEmits(["itemCheckToggled"]);

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
  emit("itemCheckToggled");
}
</script>

<template>
  <button
    type="button"
    @click="toggleItemChecked()"
    :class="{ 'check-button-checked': item.checked }"
    class="check-button link-button"
  >
    <div class="check-button-circle" aria-hidden="true"></div>
    <span class="screen-reader-text">Toggle item checked</span>
  </button>
</template>

<style scoped>
.check-button {
  padding: 10px 15px;
  position: relative;
  text-decoration: none;
  z-index: 100;
}

.check-button-checked .check-button-circle:before {
  font-size: 0.9rem;
  position: absolute;
  top: 0;
  left: 3px;
  content: "\2713";
}
@media (hover: hover) and (pointer: fine) {
  .check-button:hover .check-button-circle:before {
    font-size: 0.9rem;
    position: absolute;
    top: 0;
    left: 3px;
    content: "\2713";
  }
}

.check-button-circle {
  border-radius: 10px;
  border: 1px solid var(--color-green);
  height: 18px;
  width: 18px;
}
</style>
