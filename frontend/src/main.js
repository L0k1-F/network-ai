import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'

// Restore dark mode preference
const darkMode = localStorage.getItem('topo-dark-mode')
if (darkMode === 'true') {
  document.documentElement.classList.add('dark')
}

const app = createApp(App)
app.use(ElementPlus)
app.mount('#app')
