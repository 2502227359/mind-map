export function normalizeHoverLink(href, text = '') {
  const wiki = String(text).match(/^!?\[\[([^\]]+)\]\]$/)
  return (wiki ? wiki[1].split('|')[0] : String(href || '')).trim()
}

export function isPreviewableLink(href, text) {
  const link = normalizeHoverLink(href, text)
  return Boolean(link) && !/^[a-z][\w+.-]*:/i.test(link) && !link.startsWith('//')
}

export function createHoverLinkPayload({ event, targetEl, linktext, sourcePath }) {
  return { event, source: 'preview', hoverParent: { hoverPopover: null }, targetEl, linktext, sourcePath }
}

// 事件委托同时覆盖富文本链接和节点的 SVG 链接图标，重绘不必重复绑定。
export function bindLinkHover(container, api) {
  let timer = null
  let target = null
  const cancel = () => { clearTimeout(timer); target = null }
  const over = event => {
    const anchor = event.target.closest?.('a')
    if (!anchor || !container.contains(anchor) || anchor === target) return
    cancel()
    target = anchor
    const href = anchor.getAttribute('href') || anchor.getAttribute('xlink:href')
    if (!isPreviewableLink(href, anchor.textContent)) return
    timer = setTimeout(() => {
      if (anchor.isConnected) api?.showFilePreview?.(event, anchor, normalizeHoverLink(href, anchor.textContent))
    }, 500)
  }
  const out = event => {
    if (target && !target.contains(event.relatedTarget)) cancel()
  }
  container.addEventListener('mouseover', over)
  container.addEventListener('mouseout', out)
  return () => {
    cancel()
    container.removeEventListener('mouseover', over)
    container.removeEventListener('mouseout', out)
  }
}
