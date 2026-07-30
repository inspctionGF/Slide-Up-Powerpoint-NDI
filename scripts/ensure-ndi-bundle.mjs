import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ndiDir = join(root, 'resources', 'ndi')

const required = [
  join(ndiDir, 'slideup-ndi.exe'),
  join(ndiDir, 'Processing.NDI.Lib.x64.dll')
]

const missing = required.filter((path) => !existsSync(path))
if (missing.length > 0) {
  console.error('Bundle NDI incomplet. Fichiers manquants :')
  for (const path of missing) console.error(`  - ${path}`)
  console.error('Lancez d’abord : npm run build:ndi')
  process.exit(1)
}

for (const path of required) {
  const size = statSync(path).size
  if (size < 1024) {
    console.error(`Fichier NDI trop petit / invalide : ${path}`)
    process.exit(1)
  }
  console.log(`OK bundle ← ${path} (${Math.round(size / 1024)} Ko)`)
}

console.log('Runtime NDI prête à être empaquetée avec l’application.')
