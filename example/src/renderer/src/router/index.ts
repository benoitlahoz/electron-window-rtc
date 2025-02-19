import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    alias: '/index.html',
    component: () => import('@/components/SenderWindow.vue'),
  },
  {
    path: '/receiver',
    component: () => import('@/components/ReceiverWindow.vue'),
  },
  {
    path: '/console',
    component: () => import('@/components/ConsoleWindow.vue'),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
