import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const shopRoot = path.resolve(testDir, '../..')
const standaloneRoot = path.join(shopRoot, '.next/standalone/apps/shop')

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    return
  }

  fs.rmSync(target, { recursive: true, force: true })
  fs.cpSync(source, target, { recursive: true })
}

copyDirectory(
  path.join(shopRoot, '.next/static'),
  path.join(standaloneRoot, '.next/static'),
)
copyDirectory(path.join(shopRoot, 'public'), path.join(standaloneRoot, 'public'))

const require = createRequire(import.meta.url)
require(path.join(standaloneRoot, 'server.js'))
