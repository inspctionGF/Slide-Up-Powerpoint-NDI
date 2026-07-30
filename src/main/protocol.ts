import { protocol, net } from 'electron'
import { pathToFileURL } from 'url'

export function registerSlideupScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'slideup',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

export function handleSlideupProtocol(): void {
  protocol.handle('slideup', (request) => {
    try {
      const url = new URL(request.url)
      const filePath = url.searchParams.get('path')
      if (!filePath) {
        return new Response('Chemin manquant', { status: 400 })
      }
      return net.fetch(pathToFileURL(filePath).href)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur protocole'
      return new Response(message, { status: 500 })
    }
  })
}

export function toSlideupUrl(absolutePath: string): string {
  return `slideup://asset/?path=${encodeURIComponent(absolutePath)}`
}
