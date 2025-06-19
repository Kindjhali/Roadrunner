import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import Index from './pages/index.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', component: Index }]
})

createApp(App).use(router).mount('#app')
