const obsidian = require('obsidian')

const normalizePath =
  typeof obsidian.normalizePath === 'function'
    ? obsidian.normalizePath
    : value => String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
const parseLinktext = obsidian.parseLinktext

const MIME_BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif'
}
const EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg'
}
const COMPRESSIBLE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

function safeVaultPath(value, allowEmpty = true) {
  if (value === undefined || value === null) return allowEmpty ? '' : null
  const raw = String(value).trim().replace(/\\/g, '/')
  if (!raw) return allowEmpty ? '' : null
  if (raw.startsWith('/') || raw.startsWith('//') || /^[A-Za-z]:/.test(raw)) return null
  const parts = raw.split('/')
  if (parts.some(part => part === '..')) return null
  const result = normalizePath(parts.filter(part => part && part !== '.').join('/'))
  if (!result || result.startsWith('/') || result.split('/').includes('..')) {
    return allowEmpty && !result ? '' : null
  }
  return result
}

function requireVaultPath(value, label = '路径') {
  const result = safeVaultPath(value)
  if (result === null) throw new Error(`${label}必须是库内相对路径`)
  return result
}

function isAlreadyExistsError(error) {
  if (error?.code === 'EEXIST') return true
  return /(?:already exists|already present|file exists|folder exists|directory exists)/i.test(
    String(error?.message || error)
  )
}

function joinVaultPath(...parts) {
  const value = parts.filter(Boolean).join('/')
  return requireVaultPath(value)
}

function sourceFolder(sourceFile) {
  if (sourceFile?.parent?.path === '/') return ''
  if (sourceFile?.parent?.path) return requireVaultPath(sourceFile.parent.path, '源文件目录')
  const sourcePath = sourceFile?.path || ''
  const slash = sourcePath.lastIndexOf('/')
  return slash < 0 ? '' : requireVaultPath(sourcePath.slice(0, slash), '源文件目录')
}

function extensionOf(name) {
  const value = String(name || '').split('/').pop()
  const match = value.match(/\.([^.]+)$/)
  return match ? match[1].toLowerCase() : ''
}

function stripExtension(name) {
  const value = String(name || '').split('/').pop()
  return value.replace(/\.[^.]+$/, '')
}

function sanitizeFileName(value, fallback = 'asset') {
  const result = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  if (!result || result === '.' || result === '..') return fallback
  return result
}

function getFileMime(file) {
  const fromType = String(file?.type || '').toLowerCase()
  if (fromType) return fromType
  return MIME_BY_EXTENSION[extensionOf(file?.name)] || ''
}

function getFileExtension(file, content) {
  const fromName = extensionOf(file?.name)
  if (fromName) return fromName
  return EXTENSION_BY_MIME[getFileMime(content)] || 'bin'
}

function sourceNoteName(sourceFile) {
  const name = sourceFile?.basename || sourceFile?.name || sourceFile?.path || 'mindmap'
  return String(name).replace(/\.(?:smm|mindmap)\.md$/i, '').replace(/\.md$/i, '').replace(/\.(?:smm|mindmap)$/i, '')
}

function pad(value, size = 2) {
  return String(value).padStart(size, '0')
}

function formatDate(date, pattern) {
  const values = {
    YYYY: date.getFullYear(),
    YY: String(date.getFullYear()).slice(-2),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    SSS: pad(date.getMilliseconds(), 3),
    M: date.getMonth() + 1,
    D: date.getDate(),
    H: date.getHours(),
    m: date.getMinutes(),
    s: date.getSeconds()
  }
  return String(pattern).replace(/YYYY|SSS|YY|MM|DD|HH|mm|ss|M|D|H|m|s/g, token => values[token])
}

function formatMomentDate(pattern, date) {
  if (typeof globalThis.moment === 'function') return globalThis.moment(date).format(pattern)
  return formatDate(date, pattern)
}

function toArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return Promise.resolve(value)
  if (ArrayBuffer.isView(value)) {
    return Promise.resolve(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
  }
  if (value && typeof value.arrayBuffer === 'function') return value.arrayBuffer()
  return Promise.reject(new Error('附件内容不是可写入的二进制数据'))
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    if (typeof Image !== 'function') return reject(new Error('当前环境不支持图片解码'))
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败'))
    image.src = url
  })
}

async function compressImage(file, options) {
  const mime = getFileMime(file)
  if (!COMPRESSIBLE_MIME.has(mime) || typeof document === 'undefined') return file
  const maxWidth = Math.max(1, Number(options.maxWidth) || 1200)
  const maxHeight = Math.max(1, Number(options.maxHeight) || 1200)
  const quality = Math.min(1, Math.max(0.1, Number(options.quality) || 0.8))
  let bitmap
  let objectUrl = ''
  try {
    if (typeof globalThis.createImageBitmap === 'function') {
      try {
        bitmap = await globalThis.createImageBitmap(file)
      } catch (error) {
        bitmap = null
      }
    }
    if (!bitmap) {
      if (!globalThis.URL || typeof globalThis.URL.createObjectURL !== 'function') {
        throw new Error('当前环境无法创建图片临时地址')
      }
      objectUrl = globalThis.URL.createObjectURL(file)
      bitmap = await loadImage(objectUrl)
    }
    const width = bitmap.width || bitmap.naturalWidth
    const height = bitmap.height || bitmap.naturalHeight
    if (!width || !height) throw new Error('图片尺寸无效')
    const ratio = Math.min(1, maxWidth / width, maxHeight / height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前环境无法创建图片画布')
    if (mime === 'image/jpeg' && !options.transparent) {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => {
        if (result) resolve(result)
        else reject(new Error('图片压缩失败'))
      }, mime, quality)
    })
    return blob
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close()
    if (objectUrl && globalThis.URL?.revokeObjectURL) globalThis.URL.revokeObjectURL(objectUrl)
  }
}

class AssetStore {
  constructor(app, settingsProvider) {
    if (!app?.vault?.adapter) throw new Error('附件存储需要有效的 Obsidian vault')
    this.app = app
    this.settingsProvider = typeof settingsProvider === 'function' ? settingsProvider : () => ({})
  }

  get settings() {
    return this.settingsProvider() || {}
  }

  resolveDirectory(kind, sourceFile) {
    const prefix = kind === 'image' ? 'image' : 'attachment'
    const type = this.settings[`${prefix}PathType`] || 'currentFileFolder'
    const folder = sourceFolder(sourceFile)
    if (type === 'root') return ''
    if (type === 'custom') return requireVaultPath(this.settings[`${prefix}Path`] || '')
    if (type === 'currentFileFolderSubFolder') {
      return joinVaultPath(folder, requireVaultPath(this.settings[`${prefix}SubPath`] || ''))
    }
    return folder
  }

  async pathExists(path) {
    return (await this.pathInfo(path)).exists
  }

  async pathInfo(path) {
    const indexed = this.app.vault.getAbstractFileByPath?.(path)
    if (indexed) return { exists: true, isDirectory: Array.isArray(indexed.children), indexed }
    const adapter = this.app.vault.adapter
    if (typeof adapter.stat === 'function') {
      const stat = await adapter.stat(path)
      if (stat) return { exists: true, isDirectory: stat.type === 'folder', indexed: null }
    }
    if (typeof adapter.exists === 'function' && await adapter.exists(path)) {
      return { exists: true, isDirectory: null, indexed: null }
    }
    return { exists: false, isDirectory: null, indexed: null }
  }

  async ensureDirectory(path) {
    const normalized = requireVaultPath(path)
    if (!normalized) return
    const parts = normalized.split('/')
    let current = ''
    for (const part of parts) {
      current = current ? `${current}/${part}` : part
      const info = await this.pathInfo(current)
      if (info.exists) {
        if (info.isDirectory === false) throw new Error(`目录路径被文件占用：${current}`)
        continue
      }
      if (typeof this.app.vault.createFolder !== 'function') throw new Error('当前 Obsidian 版本不支持创建目录')
      try {
        await this.app.vault.createFolder(current)
      } catch (error) {
        const after = await this.pathInfo(current)
        if (!after.exists || after.isDirectory === false || !isAlreadyExistsError(error)) throw error
      }
    }
  }

  async writeBinary(path, data) {
    if (typeof this.app.vault.createBinary === 'function') return this.app.vault.createBinary(path, data)
    if (typeof this.app.vault.adapter.writeBinary === 'function') return this.app.vault.adapter.writeBinary(path, data)
    throw new Error('当前 Obsidian 版本不支持写入二进制附件')
  }

  async writeText(path, value) {
    const info = await this.pathInfo(path)
    if (info.exists && info.isDirectory === true) throw new Error(`文件路径被目录占用：${path}`)
    if (info.exists && info.indexed && typeof this.app.vault.modify === 'function') {
      return this.app.vault.modify(info.indexed, value)
    }
    if (info.exists && typeof this.app.vault.adapter.write === 'function') {
      return this.app.vault.adapter.write(path, value)
    }
    if (typeof this.app.vault.create === 'function') {
      try {
        return await this.app.vault.create(path, value)
      } catch (error) {
        const after = await this.pathInfo(path)
        if (after.isDirectory === true) throw new Error(`文件路径被目录占用：${path}`)
        if (isAlreadyExistsError(error) && after.exists && typeof this.app.vault.adapter.write === 'function') {
          return this.app.vault.adapter.write(path, value)
        }
        throw error
      }
    }
    if (typeof this.app.vault.adapter.write === 'function') return this.app.vault.adapter.write(path, value)
    throw new Error('当前 Obsidian 版本不支持写入文本附件')
  }

  async uniquePath(directory, baseName, extension) {
    let index = 0
    while (index < 10000) {
      const suffix = index ? `_${index}` : ''
      const fileName = `${baseName}${suffix}${extension ? `.${extension}` : ''}`
      const path = joinVaultPath(directory, fileName)
      if (!(await this.pathExists(path))) return path
      index += 1
    }
    throw new Error('附件重名次数过多，无法生成安全文件名')
  }

  formatFileName(template, sourceFile) {
    const value = String(template || '').trim()
    if (!value) return ''
    const noteName = sourceNoteName(sourceFile)
    const now = new Date()
    const result = value.replace(/\{([^{}]+)\}/g, (whole, token) => {
      const name = String(token).trim()
      if (name === 'notename') return noteName || whole
      if (name === 'date') return formatDate(now, 'YYYY-MM-DD')
      if (name === 'time') return formatDate(now, 'HH:mm:ss')
      if (name === 'datetime') return formatDate(now, 'YYYY-MM-DD HH:mm:ss')
      if (name === 'random') return Math.random().toString(36).substring(2, 8)
      if (name.startsWith('date:') && name.slice(5).trim()) return formatMomentDate(name.slice(5).trim(), now)
      return whole
    })
    return sanitizeFileName(result)
  }

  async saveFile(file, sourceFile, kind = 'image') {
    if (!file || typeof file.arrayBuffer !== 'function') throw new Error('附件必须是 File 或 Blob')
    const directory = this.resolveDirectory(kind, sourceFile)
    await this.ensureDirectory(directory)
    const originalExtension = getFileExtension(file, file)
    const originalBase = sanitizeFileName(stripExtension(file.name), 'asset')
    const path = await this.uniquePath(directory, originalBase, originalExtension)
    let content = file
    if (kind === 'image' && this.settings.compressImage) {
      content = await compressImage(file, {
        maxWidth: this.settings.compressImageOptionsMaxWidth,
        maxHeight: this.settings.compressImageOptionsMaxHeight,
        quality: this.settings.compressImageOptionsQuality,
        transparent: this.settings.compressImageIsTransparent
      })
    }
    await this.writeBinary(path, await toArrayBuffer(content))
    return path
  }

  async saveSvg(svg, sourceFile) {
    if (typeof svg !== 'string' || !svg.trim()) throw new Error('SVG 内容不能为空')
    const folder = requireVaultPath(this.settings.embedImageIsSeparateFileFolder || '.smm-embed-image-files', false)
    const source = String(sourceFile?.path || sourceFile?.name || 'mindmap')
      .replace(/\.(?:smm|mindmap)\.md$/i, '')
      .replace(/\.md$/i, '')
    const sourcePath = requireVaultPath(source || 'mindmap', '源文件路径')
    const sourceParts = sourcePath.split('/').map(part => sanitizeFileName(part, 'mindmap'))
    const baseName = sourceParts.pop() || 'mindmap'
    const sourceDirectory = sourceParts.join('/')
    const targetDirectory = joinVaultPath(folder, sourceDirectory)
    const stablePath = joinVaultPath(targetDirectory, `${baseName}.svg`)
    await this.ensureDirectory(targetDirectory)
    if (await this.pathExists(stablePath)) {
      await this.writeText(stablePath, svg)
      return stablePath
    }
    await this.writeText(stablePath, svg)
    return stablePath
  }

  getResourcePath(link, sourcePath = '') {
    const original = String(link || '')
    const trimmed = original.trim()
    if (/^(?:https?:|data:|blob:)/i.test(trimmed)) return trimmed
    let linkPath = trimmed
    if (linkPath.startsWith('![[') || linkPath.startsWith('[[')) {
      linkPath = linkPath.replace(/^!?\[\[/, '').replace(/\]\]$/, '')
    }
    if (typeof parseLinktext === 'function') {
      const parsed = parseLinktext(linkPath)
      if (parsed?.path) linkPath = parsed.path
    }
    linkPath = linkPath.split('|')[0].trim()
    const destination = this.app.metadataCache?.getFirstLinkpathDest?.(linkPath, sourcePath)
    let path = destination?.path
    if (!path) {
      try {
        path = requireVaultPath(linkPath)
      } catch (error) {
        return original
      }
    }
    const adapter = this.app.vault.adapter
    if (typeof adapter.getResourcePath === 'function') return adapter.getResourcePath(path)
    if (typeof this.app.vault.getResourcePath === 'function') return this.app.vault.getResourcePath(path)
    return path
  }
}

module.exports = { AssetStore }
