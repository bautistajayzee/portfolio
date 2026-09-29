import { createApp } from 'vue'

import App from './App.vue'
import reveal from './directives/reveal.js'
import { initSmoothScroll } from './composables/useSmoothScroll.js'
import './style.css'

createApp(App).directive('reveal', reveal).mount('#app')

// Scroll-linked motion only. Smooth scrolling itself is the browser's job —
// see the note at the top of useSmoothScroll.js.
initSmoothScroll()
