import {
  bfsWalk,
  getTextFromHtml,
  isUndef,
  replaceHtmlText,
  formatGetNodeGeneralization
} from '../utils/index'
import MindMapNode from '../core/render/node/MindMapNode'
import { CONSTANTS } from '../constants/constant'

const defaultSearchOptions = {
  caseSensitive: false,
  wholeWord: false,
  regex: false
}

const searchText = (text, query, options = {}) => {
  if (typeof text !== 'string' || typeof query !== 'string') return false
  if (query === '') return true
  const { caseSensitive = false, wholeWord = false, regex = false } = options
  try {
    const flags = caseSensitive ? '' : 'i'
    if (regex) return new RegExp(query, flags).test(text)
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = wholeWord ? `\\b${escaped}\\b` : escaped
    return new RegExp(pattern, flags).test(text)
  } catch (error) {
    return false
  }
}

const replaceTextValue = (text, query, replacement, options = {}) => {
  if (typeof text !== 'string' || typeof query !== 'string' || query === '') {
    return text
  }
  const { caseSensitive = false, wholeWord = false, regex = false } = options
  try {
    const flags = (caseSensitive ? '' : 'i') + 'g'
    if (regex) return text.replace(new RegExp(query, flags), replacement)
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = wholeWord ? `\\b${escaped}\\b` : escaped
    return text.replace(new RegExp(pattern, flags), replacement)
  } catch (error) {
    return text
  }
}

// 搜索插件
class Search {
  //  构造函数
  constructor({ mindMap }) {
    this.mindMap = mindMap
    // 是否正在搜索
    this.isSearching = false
    // 搜索文本
    this.searchText = ''
    this.searchOptions = { ...defaultSearchOptions }
    this.searchNode = null
    // 匹配的节点列表
    this.matchNodeList = []
    // 当前所在的节点列表索引
    this.currentIndex = -1
    // 不要复位搜索文本
    this.notResetSearchText = false
    // 是否自动跳转下一个匹配节点
    this.isJumpNext = false

    this.bindEvent()
  }

  bindEvent() {
    this.onDataChange = this.onDataChange.bind(this)
    this.onModeChange = this.onModeChange.bind(this)
    this.mindMap.on('data_change', this.onDataChange)
    this.mindMap.on('mode_change', this.onModeChange)
  }

  unBindEvent() {
    this.mindMap.off('data_change', this.onDataChange)
    this.mindMap.off('mode_change', this.onModeChange)
  }

  // 节点数据改变了，需要重新搜索
  onDataChange() {
    if (this.isJumpNext) {
      this.isJumpNext = false
      this.search(
        this.searchText,
        undefined,
        this.searchNode,
        this.searchOptions
      )
      return
    }
    if (this.notResetSearchText) {
      this.notResetSearchText = false
      return
    }
    this.searchText = ''
  }

  // 监听只读模式切换
  onModeChange(mode) {
    const isReadonly = mode === CONSTANTS.MODE.READONLY
    // 如果是由只读模式切换为非只读模式，需要清除只读模式下的节点高亮
    if (
      !isReadonly &&
      this.isSearching &&
      this.matchNodeList[this.currentIndex]
    ) {
      this.matchNodeList[this.currentIndex].closeHighlight()
    }
  }

  // 搜索
  search(text, callback = () => {}, node = null, options = {}) {
    if (isUndef(text)) return this.endSearch()
    text = String(text)
    options = { ...defaultSearchOptions, ...options }
    this.isSearching = true
    if (this.checkIsChange(text, options, node)) {
      // 和上一次搜索文本一样，那么搜索下一个
      this.searchNext(callback)
    } else {
      // 和上次搜索文本不一样，那么重新开始
      this.searchText = text
      this.searchOptions = options
      this.searchNode = node
      this.doSearch(node)
      this.searchNext(callback)
    }
    this.emitEvent()
  }

  checkIsChange(text, options, node) {
    return (
      this.searchText === text &&
      this.searchNode === node &&
      this.searchOptions.caseSensitive === options.caseSensitive &&
      this.searchOptions.wholeWord === options.wholeWord &&
      this.searchOptions.regex === options.regex
    )
  }

  // 更新匹配节点列表
  updateMatchNodeList(list) {
    this.matchNodeList = list
    this.mindMap.emit('search_match_node_list_change', list)
  }

  // 结束搜索
  endSearch() {
    if (!this.isSearching) return
    if (this.mindMap.opt.readonly && this.matchNodeList[this.currentIndex]) {
      this.matchNodeList[this.currentIndex].closeHighlight()
    }
    this.searchText = ''
    this.searchOptions = { ...defaultSearchOptions }
    this.searchNode = null
    this.updateMatchNodeList([])
    this.currentIndex = -1
    this.notResetSearchText = false
    this.isSearching = false
    this.emitEvent()
  }

  // 搜索匹配的节点
  doSearch(node = null) {
    this.clearHighlightOnReadonly()
    this.updateMatchNodeList([])
    this.currentIndex = -1
    const { isOnlySearchCurrentRenderNodes } = this.mindMap.opt
    // 如果要搜索收起来的节点，那么要遍历渲染树而不是节点树
    let roots
    if (isOnlySearchCurrentRenderNodes) {
      roots = node ? [node] : [this.mindMap.renderer.root]
    } else {
      const root = node && node.nodeData ? node.nodeData : node
      roots = root ? [root] : [this.mindMap.renderer.renderTree]
    }
    roots = roots.filter(Boolean)
    if (roots.length <= 0) return
    const matchList = []
    roots.forEach(root => {
      bfsWalk(root, currentNode => {
        const data =
          isOnlySearchCurrentRenderNodes &&
          typeof currentNode.getData === 'function'
            ? currentNode.getData()
            : currentNode.data || currentNode
        let { richText, text, generalization } = data
        if (richText) text = getTextFromHtml(text)
        if (searchText(text, this.searchText, this.searchOptions)) {
          matchList.push(currentNode)
        }
        // 概要节点
        const generalizationList = formatGetNodeGeneralization({
          generalization
        })
        generalizationList.forEach(gNode => {
        let { richText, text, uid } = gNode
        if (
          isOnlySearchCurrentRenderNodes &&
          !this.mindMap.renderer.findNodeByUid(uid)
        ) {
          return
        }
        if (richText) {
          text = getTextFromHtml(text)
        }
        if (searchText(text, this.searchText, this.searchOptions)) {
          matchList.push({
            data: gNode
          })
        }
        })
      })
    })
    this.updateMatchNodeList(matchList)
  }

  // 判断对象是否是节点实例
  isNodeInstance(node) {
    return node instanceof MindMapNode
  }

  // 搜索下一个或指定索引，定位到下一个匹配节点
  searchNext(callback, index) {
    if (!this.isSearching || this.matchNodeList.length <= 0) return
    if (
      index !== undefined &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < this.matchNodeList.length
    ) {
      this.currentIndex = index
    } else {
      if (this.currentIndex < this.matchNodeList.length - 1) {
        this.currentIndex++
      } else {
        this.currentIndex = 0
      }
    }
    const { readonly } = this.mindMap.opt
    // 只读模式下需要清除之前节点的高亮
    this.clearHighlightOnReadonly()
    const currentNode = this.matchNodeList[this.currentIndex]
    this.notResetSearchText = true
    const uid = this.isNodeInstance(currentNode)
      ? currentNode.getData('uid')
      : currentNode.data.uid
    if (!uid) {
      callback()
      return
    }
    const targetNode = this.mindMap.renderer.findNodeByUid(uid)
    this.mindMap.execCommand('GO_TARGET_NODE', uid, node => {
      if (!this.isNodeInstance(currentNode)) {
        this.matchNodeList[this.currentIndex] = node
        this.updateMatchNodeList(this.matchNodeList)
      }
      callback()
      // 只读模式下节点无法激活，所以通过高亮的方式
      if (readonly) {
        node.highlight()
      }
      // 如果当前节点实例已经存在，则不会触发data_change事件，那么需要手动把标志复位
      if (targetNode) {
        this.notResetSearchText = false
      }
    })
  }

  // 只读模式下清除现有匹配节点的高亮
  clearHighlightOnReadonly() {
    const { readonly } = this.mindMap.opt
    if (readonly) {
      this.matchNodeList.forEach(node => {
        if (this.isNodeInstance(node)) {
          node.closeHighlight()
        }
      })
    }
  }

  // 定位到指定搜索结果索引的节点
  jump(index, callback = () => {}) {
    this.searchNext(callback, index)
  }

  // 替换当前节点
  replace(replaceText, jumpNext = false) {
    if (
      replaceText === null ||
      replaceText === undefined ||
      !this.isSearching ||
      this.matchNodeList.length <= 0
    )
      return
    // 自动跳转下一个匹配节点
    this.isJumpNext = jumpNext
    replaceText = String(replaceText)
    let currentNode = this.matchNodeList[this.currentIndex]
    if (!currentNode) return
    // 如果当前搜索文本是替换文本的子串，那么该节点还是符合搜索结果的
    const keep = searchText(replaceText, this.searchText, this.searchOptions)
    const text = this.getReplacedText(currentNode, this.searchText, replaceText)
    this.notResetSearchText = true
    currentNode.setText(text, currentNode.getData('richText'))
    if (keep) {
      this.updateMatchNodeList(this.matchNodeList)
      return
    }
    const newList = this.matchNodeList.filter(node => {
      return currentNode !== node
    })
    this.updateMatchNodeList(newList)
    if (this.currentIndex > this.matchNodeList.length - 1) {
      this.currentIndex = -1
    } else {
      this.currentIndex--
    }
    this.emitEvent()
  }

  // 替换所有
  replaceAll(replaceText) {
    if (
      replaceText === null ||
      replaceText === undefined ||
      !this.isSearching ||
      this.matchNodeList.length <= 0
    )
      return
    replaceText = String(replaceText)
    // 如果当前搜索文本是替换文本的子串，那么该节点还是符合搜索结果的
    const keep = searchText(replaceText, this.searchText, this.searchOptions)
    this.notResetSearchText = true
    this.matchNodeList.forEach(node => {
      const text = this.getReplacedText(node, this.searchText, replaceText)
      if (this.isNodeInstance(node)) {
        const data = {
          text
        }
        this.mindMap.renderer.setNodeDataRender(node, data, true)
      } else {
        node.data.text = text
      }
    })
    this.mindMap.render()
    this.mindMap.command.addHistory()
    if (keep) {
      this.updateMatchNodeList(this.matchNodeList)
    } else {
      this.endSearch()
    }
  }

  // 获取某个节点替换后的文本
  getReplacedText(node, searchText, replaceText) {
    let { richText, text } = this.isNodeInstance(node)
      ? node.getData()
      : node.data
    if (richText) {
      return replaceHtmlText(text, searchText, replaceText)
    } else {
      return replaceTextValue(text, searchText, replaceText, this.searchOptions)
    }
  }

  // 发送事件
  emitEvent() {
    this.mindMap.emit('search_info_change', {
      currentIndex: this.currentIndex,
      total: this.matchNodeList.length
    })
  }

  // 插件被移除前做的事情
  beforePluginRemove() {
    this.unBindEvent()
  }

  // 插件被卸载前做的事情
  beforePluginDestroy() {
    this.unBindEvent()
  }
}

Search.instanceName = 'search'

export default Search
