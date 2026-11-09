export const CHAPTER_STATUS = [
  { key: 'non_commence', label: 'Non commencé', weight: 0, tone: 'neutral' },
  { key: 'en_cours', label: "En cours d'apprentissage", weight: 0.25, tone: 'info' },
  { key: 'etudie', label: 'Étudié', weight: 0.6, tone: 'info' },
  { key: 'maitrise', label: 'Maîtrisé', weight: 1, tone: 'ok' },
  { key: 'a_revoir', label: 'À revoir', weight: 0.4, tone: 'warn' },
  { key: 'difficile', label: 'Difficile', weight: 0.25, tone: 'danger' }
]
export const statusInfo = (k) => CHAPTER_STATUS.find((s) => s.key === k) || CHAPTER_STATUS[0]

export const SESSION_TYPES = [
  'Compréhension du cours', 'Apprentissage', 'Exercices', 'Révision générale', 'Préparation d’examen', 'Relecture des annotations'
]
export const SESSION_STATUS = {
  planned: { label: 'Prévue', tone: 'info' },
  running: { label: 'En cours', tone: 'accent' },
  done: { label: 'Terminée', tone: 'ok' },
  postponed: { label: 'Reportée', tone: 'warn' },
  cancelled: { label: 'Annulée', tone: 'neutral' }
}
export const PRIORITY_LEVELS = [
  { key: 1, label: 'Basse' }, { key: 2, label: 'Normale' }, { key: 3, label: 'Haute' }
]
export const EVAL_TYPES = ['Devoir', 'Interrogation', 'Examen', 'Travaux pratiques', 'Projet', 'Autre']

export const SUBJECT_COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#be123c', '#ea580c', '#ca8a04', '#0891b2', '#4d7c0f', '#c026d3', '#475569']
export const SUBJECT_ICONS = ['book', 'code', 'database', 'network', 'shield', 'sigma', 'globe', 'flask', 'cpu', 'language']

export const ANNOT_COLORS = {
  yellow: { label: 'Jaune', meaning: 'À retenir', css: '#facc15' },
  green: { label: 'Vert', meaning: 'Définition', css: '#4ade80' },
  blue: { label: 'Bleu', meaning: 'Exemple', css: '#60a5fa' },
  red: { label: 'Rouge', meaning: 'À revoir', css: '#f87171' }
}

export const ACCENTS = {
  blue: { label: 'Bleu', light: '#2563eb', dark: '#6b9bff' },
  navy: { label: 'Bleu marine', light: '#1e3a8a', dark: '#8aa4ff' },
  emerald: { label: 'Vert émeraude', light: '#047857', dark: '#34d399' },
  violet: { label: 'Violet', light: '#7c3aed', dark: '#b497ff' },
  bordeaux: { label: 'Bordeaux', light: '#9f1239', dark: '#ff7a9c' },
  orange: { label: 'Orange', light: '#c2410c', dark: '#ff9a5c' }
}

import { DEFAULT_SKIN } from './utils/theme'

export const DEFAULT_SETTINGS = {
  name: '',
  theme: 'dark', skin: DEFAULT_SKIN, fontSize: 'md', density: 'comfortable',
  dailyGoalMin: 180, weeklyGoalMin: 900, sessionMin: 50, breakMin: 10,
  weekStart: 1, showWeekend: true, dayStartHour: 7, dayEndHour: 21,
  notif: { sessions: true, evaluations: true, postponed: true, daily: true, remindBeforeMin: 10, dailyHour: 18 },
  priorityBoost: {},
  lastBackup: null
}
