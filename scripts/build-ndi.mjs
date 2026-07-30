import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'resources', 'ndi')
const nativeDir = join(root, 'native', 'ndi-helper')
const exePath = join(outDir, 'slideup-ndi.exe')

const runtimeCandidates = [
  process.env.NDI_RUNTIME_DLL,
  'C:\\Program Files\\NDI\\NDI 6 Runtime\\v6\\Processing.NDI.Lib.x64.dll',
  'C:\\Program Files\\NDI\\NDI 5 Runtime\\v5\\Processing.NDI.Lib.x64.dll'
].filter(Boolean)

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      ...options
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

async function findVcvars64() {
  const vswhere = join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  )
  if (!existsSync(vswhere)) return null

  const { stdout } = await run(vswhere, [
    '-latest',
    '-products',
    '*',
    '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property',
    'installationPath'
  ])
  const installPath = stdout.trim()
  if (!installPath) return null

  const vcvars = join(installPath, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat')
  return existsSync(vcvars) ? vcvars : null
}

function findRuntimeDll() {
  for (const candidate of runtimeCandidates) {
    if (candidate && existsSync(candidate)) return candidate
  }
  return null
}

async function main() {
  if (process.platform !== 'win32') {
    console.error('build:ndi est disponible uniquement sous Windows.')
    process.exit(1)
  }

  mkdirSync(outDir, { recursive: true })

  const vcvars = await findVcvars64()
  if (!vcvars) {
    console.error(
      'Outils C++ Visual Studio introuvables. Installez « Build Tools » avec le workload C++.'
    )
    process.exit(1)
  }

  const runtimeDll = findRuntimeDll()
  if (!runtimeDll) {
    console.error(
      'Processing.NDI.Lib.x64.dll introuvable. Installez NDI Runtime (NDI Tools) ou définissez NDI_RUNTIME_DLL.'
    )
    process.exit(1)
  }

  const batPath = join(tmpdir(), `slideup-build-ndi-${Date.now()}.bat`)
  const bat = [
    '@echo off',
    `call "${vcvars}"`,
    `cd /d "${nativeDir}"`,
    `cl /nologo /EHsc /O2 /W3 /Fe"${exePath}" main.cpp ole32.lib windowscodecs.lib`,
    'exit /b %ERRORLEVEL%'
  ].join('\r\n')

  writeFileSync(batPath, bat, 'utf8')

  console.log('Compilation de slideup-ndi.exe…')
  const build = spawn('cmd.exe', ['/c', batPath], {
    stdio: 'inherit',
    windowsHide: true
  })

  const code = await new Promise((resolve) => build.on('close', resolve))
  if (code !== 0) {
    console.error('Échec de la compilation du helper NDI.')
    process.exit(code ?? 1)
  }

  copyFileSync(runtimeDll, join(outDir, 'Processing.NDI.Lib.x64.dll'))
  console.log(`OK → ${exePath}`)
  console.log(`OK → ${join(outDir, 'Processing.NDI.Lib.x64.dll')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
