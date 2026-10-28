const htmlAttributeEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '\r': '&#13;',
  '\n': '&#10;',
  '\t': '&#9;'
}

const escapeHtmlAttribute = value => {
  return String(value == null ? '' : value).replace(
    /[&<>"'\r\n\t]/g,
    char => htmlAttributeEntities[char]
  )
}

// 创建不依赖 CDN、脚本或内联 SVG 的静态 HTML 导出文档。
export const createHtmlDocument = (svgDataUrl, title = '') => {
  if (
    typeof svgDataUrl !== 'string' ||
    svgDataUrl.length === 0 ||
    !/^data:image\/svg\+xml(?:;[^,]*)?,/i.test(svgDataUrl)
  ) {
    throw new TypeError('svgDataUrl 必须是非空 SVG data URL')
  }
  const safeTitle = escapeHtmlAttribute(title)
  const safeSvgDataUrl = escapeHtmlAttribute(svgDataUrl)
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #fff; }
    body { display: flex; justify-content: center; align-items: flex-start; padding: 24px; box-sizing: border-box; }
    main { width: 100%; display: flex; justify-content: center; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <main><img src="${safeSvgDataUrl}" alt="${safeTitle}"></main>
</body>
</html>`
}
