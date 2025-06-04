console.log('Logging from TOP of roadrunner/frontend/src/main.js - Attempt 2');

import { createApp } from 'vue';
import App from './App.vue';
import store from './store'; // Import the store
import './styles/roadrunner.css';

const app = createApp(App);
app.use(store); // Provide the store to the app
app.mount('#app');
