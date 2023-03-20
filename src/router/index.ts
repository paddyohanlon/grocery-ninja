import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ListView from '../views/ListView.vue'
import ListItemView from '../views/ListItemView.vue'
import { HOME, LIST, LIST_ITEM } from '@/router/route-names'
import { rid } from '@/rethinkid'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: HOME,
      component: HomeView,
      meta: { requiresAuth: false },
    },
    {
      path: '/lists/:listId',
      name: LIST,
      component: ListView,
      children: [
        {
          path: 'items/:itemId',
          name: LIST_ITEM,
          component: ListItemView,
        },
      ],
    },
  ],
})

router.beforeEach((to, from, next) => {
  // If route requires auth
  if (to.matched.some((record) => record.meta.requiresAuth !== false)) {
    if (!rid.isLoggedIn()) {
      // Redirect to the sign in view if no token found and route requires auth
      next({ name: 'home' })
      return
    }
  }

  next()
})

export default router
