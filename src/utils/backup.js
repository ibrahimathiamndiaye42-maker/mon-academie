import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import * as db from '../db'

// Format de sauvegarde : archive ZIP contenant manifest.json, data.json et files/<id>.pdf
// formatVersion permet de faire évoluer l'application sans rendre les anciennes sauvegardes inutilisables.
export const BACKUP_FORMAT = 'mon-academie-backup'
export const BACKUP_VERSION = 1
const DATA_STORES = db.STORES.filter((s) => s !== 'kv')

function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16)
}
export async function checksum(str) {
  try {
    if (globalThis.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', strToU8(str))
      return 'sha256:' + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch { /* repli ci-dessous */ }
  return 'fnv1a:' + fnv1a(str)
}

export async function buildBackup() {
  const data = {}
  for (const s of DATA_STORES) data[s] = await db.getAll(s)
  data.kv = (await db.getAll('kv')).filter((e) => e.key === 'settings')
  const files = await db.getAll(db.FILES)
  data.filesMeta = files.map((f) => ({ id: f.id, name: f.name, type: f.type, size: f.size }))
  const json = JSON.stringify(data)
  const counts = Object.fromEntries(DATA_STORES.map((s) => [s, data[s].length]))
  counts.files = files.length
  const manifest = { format: BACKUP_FORMAT, formatVersion: BACKUP_VERSION, appVersion: '1.0.0', exportedAt: new Date().toISOString(), counts, checksum: await checksum(json) }
  const entries = {
    'manifest.json': [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }],
    'data.json': [strToU8(json), { level: 6 }]
  }
  for (const f of files) entries[`files/${f.id}.pdf`] = [new Uint8Array(f.data), { level: 0 }]
  return { bytes: zipSync(entries), manifest }
}

export async function parseBackup(u8) {
  let entries
  try { entries = unzipSync(u8) } catch { throw new Error("Ce fichier n'est pas une sauvegarde MON ACADÉMIE valide (archive illisible).") }
  if (!entries['manifest.json'] || !entries['data.json']) throw new Error('Sauvegarde incomplète : manifest.json ou data.json est absent.')
  let manifest, jsonStr, data
  try { manifest = JSON.parse(strFromU8(entries['manifest.json'])) } catch { throw new Error('Le manifeste de la sauvegarde est illisible.') }
  if (manifest.format !== BACKUP_FORMAT) throw new Error("Ce fichier n'est pas une sauvegarde MON ACADÉMIE.")
  if (!(manifest.formatVersion >= 1)) throw new Error('Version de sauvegarde inconnue.')
  if (manifest.formatVersion > BACKUP_VERSION) throw new Error('Cette sauvegarde a été créée par une version plus récente de MON ACADÉMIE. Mets l’application à jour avant de la restaurer.')
  jsonStr = strFromU8(entries['data.json'])
  if ((await checksum(jsonStr)) !== manifest.checksum) throw new Error("Contrôle d'intégrité échoué : le fichier est corrompu ou a été modifié. Rien n'a été changé.")
  try { data = JSON.parse(jsonStr) } catch { throw new Error('Les données de la sauvegarde sont illisibles.') }
  for (const s of DATA_STORES) if (!Array.isArray(data[s])) throw new Error(`Données invalides : la section « ${s} » est absente.`)
  data = migrate(data, manifest.formatVersion)
  const warnings = []
  const files = new Map()
  for (const m of data.filesMeta || []) {
    const e = entries[`files/${m.id}.pdf`]
    if (!e) warnings.push(`Le PDF « ${m.name} » est absent de l'archive.`)
    else files.set(m.id, { meta: m, bytes: e })
  }
  for (const d of data.documents) if (!files.has(d.id)) warnings.push(`Le document « ${d.title} » n'a pas de fichier PDF dans la sauvegarde.`)
  const counts = Object.fromEntries(DATA_STORES.map((s) => [s, data[s].length])); counts.files = files.size
  return { manifest, data, files, warnings, counts }
}

// Point d'extension : transformer d'anciens formats vers le format courant.
function migrate(data) { return data }

const toBuffer = (u8) => u8.slice().buffer

// mode 'replace' : remplace tout, en une seule transaction (tout ou rien).
// mode 'merge'  : ajoute uniquement les éléments dont l'identifiant n'existe pas déjà (rien n'est écrasé).
export async function applyBackup(parsed, mode) {
  const { data, files } = parsed
  const fileRecs = [...files.values()].map(({ meta, bytes }) => ({ id: meta.id, name: meta.name, type: meta.type || 'application/pdf', size: meta.size, data: toBuffer(bytes) }))
  if (mode === 'replace') {
    const payload = { kv: data.kv || [], files: fileRecs }
    for (const s of DATA_STORES) payload[s] = data[s]
    await db.replaceAll({ ...payload, [db.FILES]: fileRecs })
    return { added: parsed.counts, skipped: {} }
  }
  const added = {}, skipped = {}
  for (const s of DATA_STORES) {
    const existing = new Set((await db.getAll(s)).map((x) => x.id))
    const fresh = data[s].filter((x) => !existing.has(x.id))
    await db.putMany(s, fresh)
    added[s] = fresh.length; skipped[s] = data[s].length - fresh.length
  }
  const existingFiles = new Set((await db.getAll(db.FILES)).map((x) => x.id))
  const freshFiles = fileRecs.filter((f) => !existingFiles.has(f.id))
  await db.putMany(db.FILES, freshFiles)
  added.files = freshFiles.length
  return { added, skipped }
}

export function downloadBytes(bytes, filename, type = 'application/zip') {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
export const backupFilename = () => `mon-academie-sauvegarde-${new Date().toISOString().slice(0, 10)}.zip`
