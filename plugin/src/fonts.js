'use strict'

function normalizeFontFamily(value) {
  const text = String(value == null ? '' : value)
    .replace(/[\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 200)
}

function getFontOptions(baseFonts = [], addedFonts = []) {
  const options = []
  const seen = new Set()
  const append = item => {
    const source = typeof item === 'string' ? { name: item, value: item } : item
    const value = normalizeFontFamily(source?.value || source?.name)
    if (!value) return
    const key = value.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    options.push({
      name: normalizeFontFamily(source?.name || value) || value,
      value
    })
  }

  baseFonts.forEach(append)
  addedFonts.forEach(append)
  return options
}

function normalizeAddedFonts(values) {
  const result = []
  const seen = new Set()
  for (const value of Array.isArray(values) ? values : []) {
    const font = normalizeFontFamily(value)
    const key = font.toLowerCase()
    if (!font || seen.has(key)) continue
    seen.add(key)
    result.push(font)
  }
  return result
}

async function queryInstalledFonts(queryLocalFontsFn = globalThis.queryLocalFonts) {
  if (typeof queryLocalFontsFn !== 'function') return []
  const descriptors = await queryLocalFontsFn()
  const names = descriptors.map(font => font?.family || font?.fullName)
  return normalizeAddedFonts(names)
}

module.exports = {
  getFontOptions,
  normalizeAddedFonts,
  normalizeFontFamily,
  queryInstalledFonts
}
