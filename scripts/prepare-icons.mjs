/**
 * Génère les icônes app (ICO / PNG) depuis public/logo.svg
 * pour electron-builder, la fenêtre et le tray.
 *
 * Sorties :
 *   build/icon.ico          — installateur + .exe Windows
 *   build/icon.png          — 512×512 (réf. electron-builder)
 *   resources/icon.png      — runtime (tray / fenêtre)
 *   resources/icon-16.png   — tray Windows haute lisibilité
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'public', 'logo.svg')
const buildDir = join(root, 'build')
const resourcesDir = join(root, 'resources')

/** Fond sombre app — lisibilité aux petites tailles Windows */
const ICON_BG = '#0c0f12'

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const MASTER_SIZE = 512

function prepareSvg(raw) {
  // Injecte un fond opaque derrière le logo (sinon illisible en 16×16)
  if (/<rect[^>]*id="icon-bg"/i.test(raw)) return raw
  return raw.replace(
    /(<svg\b[^>]*>)/i,
    `$1\n  <rect id="icon-bg" width="900" height="900" rx="180" ry="180" fill="${ICON_BG}"/>`
  )
}

function renderPng(svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'transparent'
  })
  return Buffer.from(resvg.render().asPng())
}

async function main() {
  const raw = readFileSync(svgPath, 'utf8')
  const svg = prepareSvg(raw)

  mkdirSync(buildDir, { recursive: true })
  mkdirSync(resourcesDir, { recursive: true })

  const master = renderPng(svg, MASTER_SIZE)
  writeFileSync(join(buildDir, 'icon.png'), master)
  writeFileSync(join(resourcesDir, 'icon.png'), master)

  const icoPngs = []
  for (const size of ICO_SIZES) {
    const png = renderPng(svg, size)
    icoPngs.push(png)
    if (size === 16) {
      writeFileSync(join(resourcesDir, 'icon-16.png'), png)
    }
  }

  const ico = await pngToIco(icoPngs)
  writeFileSync(join(buildDir, 'icon.ico'), ico)

  console.log('Icônes générées depuis public/logo.svg :')
  console.log(`  build/icon.ico (${ICO_SIZES.join(', ')} px)`)
  console.log(`  build/icon.png (${MASTER_SIZE} px)`)
  console.log(`  resources/icon.png (${MASTER_SIZE} px)`)
  console.log('  resources/icon-16.png (16 px)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
