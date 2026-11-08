import { reactive } from 'vue'
export const vp = reactive({ w: typeof window === 'undefined' ? 1200 : window.innerWidth })
if (typeof window !== 'undefined') window.addEventListener('resize', () => { vp.w = window.innerWidth })
export const isMobile = () => vp.w <= 900
