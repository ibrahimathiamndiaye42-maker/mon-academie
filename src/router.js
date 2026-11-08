import { createRouter, createWebHashHistory } from 'vue-router'

export const routes = [
  { path: '/', name: 'dashboard', component: () => import('./views/Dashboard.vue') },
  { path: '/emploi-du-temps', name: 'timetable', component: () => import('./views/Timetable.vue') },
  { path: '/planning', name: 'planning', component: () => import('./views/Planning.vue') },
  { path: '/chrono', name: 'timer', component: () => import('./views/Timer.vue') },
  { path: '/cours', name: 'courses', component: () => import('./views/Courses.vue') },
  { path: '/cours/:id', name: 'reader', component: () => import('./views/Reader.vue'), meta: { bare: true } },
  { path: '/matieres', name: 'subjects', component: () => import('./views/Subjects.vue') },
  { path: '/notes', name: 'grades', component: () => import('./views/Grades.vue') },
  { path: '/priorites', name: 'priorities', component: () => import('./views/Priorities.vue') },
  { path: '/statistiques', name: 'stats', component: () => import('./views/Stats.vue') },
  { path: '/parametres', name: 'settings', component: () => import('./views/Settings.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]
// Hash history : fonctionne sur n'importe quel hébergement statique et hors ligne.
export default createRouter({ history: createWebHashHistory(), routes })
