const htmlEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '\r': '&#13;',
  '\n': '&#10;',
  '\t': '&#9;'
}

const escapeHtmlText = value => {
  return String(value == null ? '' : value).replace(
    /[&<>"'\r\n\t]/g,
    char => htmlEntities[char]
  )
}

const decodeXmlEntities = value => {
  return String(value)
    .replace(/&(?:amp|#38);/gi, '&')
    .replace(/&(?:lt|#60);/gi, '<')
    .replace(/&(?:gt|#62);/gi, '>')
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      return String.fromCodePoint(parseInt(hex, 16))
    })
    .replace(/&#([0-9]+);/g, (_, code) => {
      return String.fromCodePoint(Number(code))
    })
}

const decodeSvgDataUrl = svgDataUrl => {
  const match = /^data:image\/svg\+xml(?:;([^,]*))?,([\s\S]*)$/i.exec(
    svgDataUrl
  )
  if (!match) throw new TypeError('svgDataUrl 必须是非空 SVG data URL')
  const metadata = match[1] || ''
  const payload = match[2]
  try {
    if (!/\bbase64\b/i.test(metadata)) return decodeURIComponent(payload)
    if (typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(payload)
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
      if (typeof globalThis.TextDecoder === 'function') {
        return new globalThis.TextDecoder().decode(bytes)
      }
      return decodeURIComponent(
        Array.from(bytes, byte => `%${byte.toString(16).padStart(2, '0')}`).join('')
      )
    }
    if (typeof globalThis.Buffer !== 'undefined') {
      return globalThis.Buffer.from(payload, 'base64').toString('utf8')
    }
  } catch (error) {
    throw new TypeError('SVG data URL 内容无法解码')
  }
  throw new TypeError('当前环境不支持 SVG data URL 解码')
}

const isSafeUrl = (value, attribute) => {
  const url = decodeXmlEntities(value)
    .trim()
    .replace(/[\u0000-\u0020]+/g, '')
  if (!url) return true
  if (/^(?:javascript|vbscript):/i.test(url)) return false
  if (/^data:/i.test(url)) {
    return /^data:image\/(?:png|gif|jpe?g|webp|avif)(?:;[^,]*)?,/i.test(
      url
    )
  }
  if (/^#/i.test(url)) return true
  if (attribute === 'src') return false
  if (/^(?:https?|mailto|obsidian):/i.test(url)) return true
  return !/^[a-z][a-z0-9+.-]*:/i.test(url)
}

const validateSvgUrlAttributes = svg => {
  return svg.replace(
    /\s+(href|xlink:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (match, attribute, doubleQuoted, singleQuoted, unquoted) => {
      const value = doubleQuoted === undefined
        ? singleQuoted === undefined
          ? unquoted
          : singleQuoted
        : doubleQuoted
      if (!isSafeUrl(value, attribute.toLowerCase())) {
        throw new Error(`HTML 导出包含不安全的 SVG ${attribute} 链接`)
      }
      return match
    }
  )
}

const validateCssUrls = value => {
  if (/@import\b/i.test(String(value))) {
    throw new Error('HTML 导出不允许 CSS 外部导入')
  }
  const urls = String(value).matchAll(/url\(\s*(["']?)([\s\S]*?)\1\s*\)/gi)
  for (const [, , url] of urls) {
    if (!isSafeUrl(url, 'src')) {
      throw new Error('HTML 导出包含不安全的 CSS 资源链接')
    }
  }
}

const removeUnsafeSvgContent = svg => {
  let result = svg
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\/\s*script\s*>/gi, '')
    .replace(/<\s*script\b[^>]*\/?>/gi, '')
  if (/<\s*(?:iframe|object|embed|base|link|meta)\b/i.test(result)) {
    throw new Error('HTML 导出包含不安全的 SVG 元素')
  }
  return result.replace(
    /\s+on[a-z0-9:_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    ''
  )
}

const validateSvgStyles = svg => {
  return svg
    .replace(
      /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi,
      (match, css) => {
        validateCssUrls(css)
        return match
      }
    )
    .replace(
      /\s+style\s*=\s*(["'])([\s\S]*?)\1/gi,
      (match, quote, css) => {
        validateCssUrls(css)
        return match
      }
    )
}

const sanitizeSvg = svg => {
  if (
    typeof svg !== 'string' ||
    !/<svg\b[^>]*>[\s\S]*<\/svg\s*>/i.test(svg) ||
    /<!\s*(?:doctype|entity)\b/i.test(svg)
  ) {
    throw new TypeError('SVG data URL 内容不是有效的 SVG 文档')
  }
  let result = removeUnsafeSvgContent(svg)
  result = validateSvgUrlAttributes(result)
  result = validateSvgStyles(result)
  if (/<\s*script\b|\bon[a-z0-9:_-]+\s*=/i.test(result)) {
    throw new Error('HTML 导出包含不安全的 SVG 脚本或事件属性')
  }
  return result
}

// 创建离线 HTML 导出文档。SVG 直接内嵌，以保留 SVG 内的链接交互。
export const createHtmlDocument = (svgDataUrl, title = '') => {
  if (
    typeof svgDataUrl !== 'string' ||
    svgDataUrl.length === 0 ||
    !/^data:image\/svg\+xml(?:;[^,]*)?,/i.test(svgDataUrl)
  ) {
    throw new TypeError('svgDataUrl 必须是非空 SVG data URL')
  }
  const svg = sanitizeSvg(decodeSvgDataUrl(svgDataUrl))
  const safeTitle = escapeHtmlText(title)
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';">
  <title>${safeTitle}</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #fff; }
    body { display: flex; justify-content: center; align-items: flex-start; padding: 24px; box-sizing: border-box; }
    main { width: 100%; display: flex; justify-content: center; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <main>${svg}</main>
</body>
</html>`
}

export { sanitizeSvg }
