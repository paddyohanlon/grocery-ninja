<script setup lang="ts">
import { ref } from "vue";

const SIDEBAR_LEFT_IS_VISIBLE = "sidebarLeftIsVisible";

function getLocalStorageBoolean(key: string): boolean {
  return localStorage.getItem(key) === "false" ? false : true;
}

const sidebarLeftIsVisible = ref(getLocalStorageBoolean(SIDEBAR_LEFT_IS_VISIBLE));

function toggleSidebarLeft(): void {
  sidebarLeftIsVisible.value = !sidebarLeftIsVisible.value;

  localStorage.setItem(SIDEBAR_LEFT_IS_VISIBLE, sidebarLeftIsVisible.value.toString());
}
</script>

<template>
  <div class="view-container">
    <aside :class="{ 'sidebar-left-closed': !sidebarLeftIsVisible }" class="sidebar-left hide-below-900px">
      <button
        @click="toggleSidebarLeft"
        :class="{ 'menu-icon-active': sidebarLeftIsVisible }"
        class="menu-icon link-button"
        aria-hidden="true"
      >
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </button>
      <div :class="{ 'is-invisible': !sidebarLeftIsVisible }" class="sidebar-left-content">
        <slot name="sidebarLeft"></slot>
      </div>
    </aside>
    <main class="column-center"><slot name="main"></slot></main> 
    <slot name="sidebarRight"></slot>
  </div>
</template>

<style scoped>
.view-container {
  display: flex;
  overflow: hidden;
  position: relative;
  flex: 1 1 0px;
}

.sidebar-left {
  display: flex;
  flex-direction: column;

  background-color: var(--color-black);
  box-shadow: 3px 3px 3px var(--color-background-shadow);
  width: 290px;
}
.sidebar-left-closed {
  width: 48px;
}

.sidebar-left-content {
  display: flex;
  flex-direction: column;
  flex: 1;

  overflow: hidden;
}

.column-center {
  flex: 1 1 0px;
  display: flex;
  overflow: hidden;
}

.menu-icon {
  color: var(--color-text);
  cursor: pointer;
  display: block;
  height: 3rem;
  width: 3rem;
}

.menu-icon span {
  background-color: currentColor;
  display: block;
  height: 1px;
  left: calc(50% - 8px);
  position: absolute;
  transform-origin: center;
  transition-duration: 86ms;
  transition-property: background-color, opacity, transform;
  transition-timing-function: ease-out;
  width: 16px;
}
.menu-icon span:nth-child(1) {
  top: calc(50% - 6px);
}
.menu-icon span:nth-child(2) {
  top: calc(50% - 1px);
}
.menu-icon span:nth-child(3) {
  top: calc(50% + 4px);
}
.menu-icon:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
</style>
