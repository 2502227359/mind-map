const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max))

export function placeContextMenu(point, size, bounds) {
  return {
    left: clamp(point.x, bounds.left + 8, bounds.right - size.width - 8) - bounds.left,
    top: clamp(point.y, bounds.top + 8, bounds.bottom - size.height - 8) - bounds.top
  }
}

export function placeSubmenu(anchor, size, viewport) {
  const right = anchor.right - 1
  const left = right + size.width <= viewport.width - 8 ? right : anchor.left - size.width + 1
  return placeContextMenu({ x: left, y: anchor.top - 6 }, size, {
    left: 0, top: 0, right: viewport.width, bottom: viewport.height
  })
}
