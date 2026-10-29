import { Notice, Platform, TFile } from 'obsidian'
import { formatFileName } from '../reference/ob/utils.js'
import { createHoverLinkPayload } from './link-hover.js'

// 独立导图与代码块共用宿主能力，文档的读取、保存由各自生命周期负责。
export function createEditorApi({ app, plugin, getFile, assetStore, saveFileToVault, documentApi }) {
  const hoverParent = { hoverPopover: null }
  const findFile = path => app.vault.getFileByPath(path)
    || app.vault.getFileByPath(path + '.md')
    || app.metadataCache.getFirstLinkpathDest(path, getFile()?.path || '')
  return {
      showFilePreview: (event, targetEl, linktext) => {
        app.workspace.trigger('hover-link', {
          ...createHoverLinkPayload({ event, targetEl, linktext, sourcePath: getFile()?.path || '' }),
          source: 'personal-mindmap',
          hoverParent
        })
      },
      getMindMapConfig: () => {
        return plugin.settings.mindMapConfig || {}
      },
      saveMindMapConfig: newConfig => {
        plugin.settings.mindMapConfig = newConfig
        plugin._saveSettings()
      },
      getMindMapLocalConfig: () => {
        const { mindMapLocalConfig, themeMode } = plugin.settings
        const config = { ...(mindMapLocalConfig || {}) }
        config.isDark =
          themeMode === 'follow'
            ? plugin._getObIsDark()
            : themeMode === 'dark'
        return config
      },
      saveMindMapLocalConfig: newConfig => {
        plugin.settings.mindMapLocalConfig = newConfig
        plugin._saveSettings()
      },
      getSettings: () => {
        return plugin.settings || {}
      },
      getKatexOutputType: () => plugin.settings.formulaRenderMode || 'mathml',
      updateSettings: data => {
        plugin.settings = {
          ...plugin.settings,
          ...data
        }
        plugin._saveSettings()
      },
      getObAllFiles: (extraSelf = true) => {
        const fileList = app.vault.getFiles()
        if (extraSelf && getFile()) {
          return fileList.filter(item => {
            return item.path !== getFile().path
          })
        }
        return fileList
      },
      createLinkInfoFromFilePath: (filePath, subpath = '', alias = '') => {
        const file = findFile(filePath)
        if (!file) {
          return null
        }
        const linkText = app.fileManager.generateMarkdownLink(
          file,
          getFile()?.path || '',
          subpath,
          alias
        )
        return {
          link: file.path,
          linkText
        }
      },
      openFile: (filePath, isNewTab = false, createOnNoExist = false) => {
        if (!filePath) return
        const arr = filePath.split(/(#|^|\|)/)
        filePath = arr[0]
        let postfix = ''
        if (arr.length > 1 && arr[1] !== '|') {
          postfix = arr.slice(1).join('')
        }
        const file = findFile(filePath)
        if (file && file instanceof TFile) {
          app.workspace.openLinkText(
            file.path + postfix,
            getFile()?.path || '',
            isNewTab
          )
        } else if (createOnNoExist) {
          app.workspace.openLinkText(
            /\.md$/.test(filePath) ? filePath : filePath + '.md',
            getFile()?.path || '',
            isNewTab
          )
        }
      },
      openWebLink: url => {
        if (app.openExternal) {
          app.openExternal(url)
          return
        }
        try {
          if (window.require) {
            const { shell } = window.require('electron')
            shell.openExternal(url)
            return
          }
        } catch (e) {}
        window.open(url, '_blank', 'noopener,noreferrer')
      },
      saveFileToVault: async (...args) => {
        const res = await saveFileToVault(...args)
        return res
      },
      getResourcePath: vaultPath => {
        return assetStore.getResourcePath(vaultPath, getFile()?.path || '')
      },
      getObInternalLink: (...args) => {
        return app.fileManager.generateMarkdownLink(getFile(), '', ...args)
      },
      showTip: tip => {
        new Notice(tip)
      },
      getFileFromUri: uri => {
        const params = new URLSearchParams(uri.split('?')[1])
        const vault = decodeURIComponent(params.get('vault') || '')
        const filePath = decodeURIComponent(params.get('file') || '')
        if (!vault || !filePath) return null
        if (app.vault.getName() !== vault) {
          new Notice(plugin._t('tip.onlyEnableSelectCurrentVaultFile'))
          return null
        }
        return findFile(filePath)
      },
      isMobile: () => {
        return Platform.isMobile
      },
      getObsidianApp: () => {
        return app
      },
      getFormatFileName: (str, ignores = []) => {
        return formatFileName(str, {
          notename: getFile()?.basename.split('.')[0],
          ignores
        })
      },
    ...documentApi
  }
}
