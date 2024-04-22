import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import ContactsView from "../views/ContactsView.vue";
import SharingView from "../views/SharingView.vue";
import ListsView from "../views/ListsView.vue";
import ListView from "../views/ListView.vue";
import ListItemView from "../views/ListItemView.vue";
import PageNotFoundView from "../views/PageNotFoundView.vue";
import { HOME, CONTACTS, LISTS, LIST, LIST_ITEM, PAGE_NOT_FOUND, SHARING } from "@/router/route-names";
import { bzr } from "@/bzr";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: HOME,
      component: HomeView,
      meta: { requiresAuth: false },
    },
    {
      path: "/contacts",
      name: CONTACTS,
      component: ContactsView,
    },
    {
      path: "/sharing",
      name: SHARING,
      component: SharingView,
    },
    {
      path: "/lists",
      name: LISTS,
      component: ListsView,
    },
    {
      path: "/lists/:listId",
      name: LIST,
      component: ListView,
      children: [
        {
          path: "items/:itemId",
          name: LIST_ITEM,
          component: ListItemView,
        },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      name: PAGE_NOT_FOUND,
      component: PageNotFoundView,
    },
  ],
});

router.beforeEach((to, from, next) => {
  // If route requires auth
  if (to.matched.some((record) => record.meta.requiresAuth !== false)) {
    if (!bzr.isLoggedIn()) {
      // Redirect to the sign in view if no token found and route requires auth
      next({ name: "home" });
      return;
    }
  }

  next();
});

export default router;
