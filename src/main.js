import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import router from './router'
import './styles.css'
import { init } from './store'

registerSW({ immediate: true })
init()
createApp(App).use(router).mount('#app')
