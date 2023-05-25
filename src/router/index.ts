import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import SettingsView from "../views/SettingsView.vue";
import ContactsView from "../views/ContactsView.vue";
import InvitationsView from "../views/InvitationsView.vue";
import ListsView from "../views/ListsView.vue";
import ListView from "../views/ListView.vue";
import ListItemView from "../views/ListItemView.vue";
import PageNotFoundView from "../views/PageNotFoundView.vue";
import { HOME, SETTINGS, CONTACTS, LISTS, LIST, LIST_ITEM, INVITATIONS, PAGE_NOT_FOUND } from "@/router/route-names";
import { rid } from "@/rethinkid";

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
      path: "/settings",
      name: SETTINGS,
      component: SettingsView,
    },
    {
      path: "/contacts",
      name: CONTACTS,
      component: ContactsView,
    },
    {
      path: "/invitations",
      name: INVITATIONS,
      component: InvitationsView,
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
    if (!rid.isLoggedIn()) {
      // Redirect to the sign in view if no token found and route requires auth
      next({ name: "home" });
      return;
    }
  }

  next();
});

export default router;
