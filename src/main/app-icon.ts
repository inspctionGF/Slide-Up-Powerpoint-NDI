import { app, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

function candidatePaths(): string[] {
  const packaged = app.isPackaged
    ? [join(process.resourcesPath, 'icon.png'), join(process.resourcesPath, 'icon-16.png')]
    : []

  // Dev : depuis out/main → ../../resources
  const devRoot = join(__dirname, '../../resources')
  return [
    ...packaged,
    join(devRoot, 'icon.png'),
    join(devRoot, 'icon-16.png'),
    join(devRoot, '../build/icon.png')
  ]
}

/** Chemin vers l’icône PNG packagée / dev. */
export function resolveAppIconPath(preferSmall = false): string | null {
  const paths = candidatePaths()
  if (preferSmall) {
    const small = paths.find((p) => p.endsWith('icon-16.png') && existsSync(p))
    if (small) return small
  }
  const found = paths.find((p) => existsSync(p))
  return found ?? null
}

export function loadAppIcon(preferSmall = false): NativeImage | null {
  const path = resolveAppIconPath(preferSmall)
  if (!path) return null
  const img = nativeImage.createFromPath(path)
  return img.isEmpty() ? null : img
}

/** Chemin éventuel vers une icône packagée (compat). */
export function packagedIconPath(): string {
  return resolveAppIconPath() ?? join(__dirname, '../../resources/icon.png')
}
