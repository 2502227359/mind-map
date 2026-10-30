// 宿主设置是主题模式和保存间隔的唯一来源，本地界面缓存不覆盖它们。
export function getMindMapLocalConfig(settings, obIsDark) {
  const interval = Number(settings.autoSaveTime)
  return {
    ...(settings.mindMapLocalConfig || {}),
    autoSaveTime: Number.isInteger(interval) && interval > 0 ? interval : 5,
    isDark: settings.themeMode === 'follow' ? Boolean(obIsDark) : settings.themeMode === 'dark'
  }
}
