<template>
  <div
    v-if="show"
    class="nodeTagFilterListContainer"
    :class="{ isDark: isDark }"
    @click.stop
  >
    <div class="header">
      <span>{{ $t('nodeTagFilter.title') }}</span>
      <span class="close el-icon-close" @click="hide"></span>
    </div>
    <div class="tagInfo">#{{ tagText }}</div>
    <div
      v-for="item in nodeList"
      :key="item.uid"
      class="nodeItem"
      :title="item.text"
      @click="jumpToNode(item.uid)"
    >
      {{ item.text }}
    </div>
    <div v-if="nodeList.length === 0" class="empty">
      {{ $t('nodeTagFilter.empty') }}
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { getTextFromHtml } from 'simple-mind-map/src/utils'

export default {
  props: {
    mindMap: {
      type: Object
    }
  },
  data() {
    return {
      show: false,
      tagText: '',
      nodeList: []
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark
    })
  },
  created() {
    this.mindMap.on('node_tag_dblclick', this.onNodeTagDblclick)
    this.mindMap.on('node_click', this.hide)
    this.mindMap.on('draw_click', this.hide)
    this.mindMap.on('scale', this.hide)
    this.mindMap.on('translate', this.hide)
    this.$root.$bus.$on('setData', this.hide)
  },
  beforeDestroy() {
    this.mindMap.off('node_tag_dblclick', this.onNodeTagDblclick)
    this.mindMap.off('node_click', this.hide)
    this.mindMap.off('draw_click', this.hide)
    this.mindMap.off('scale', this.hide)
    this.mindMap.off('translate', this.hide)
    this.$root.$bus.$off('setData', this.hide)
  },
  methods: {
    onNodeTagDblclick(node, tag) {
      const text = this.getTagText(tag)
      if (!node || !text) return
      this.tagText = text
      this.nodeList = this.findNodesByTag(text)
      this.show = true
      this.$root.$bus.$emit('closeSideBar')
    },

    getTagText(tag) {
      if (typeof tag === 'string') return tag.trim()
      if (tag && typeof tag === 'object') {
        return String(tag.text || tag.name || tag.value || '').trim()
      }
      return ''
    },

    getNodeTags(node) {
      const tags = node?.getData?.('tag')
      return Array.isArray(tags) ? tags : []
    },

    findNodesByTag(text) {
      const roots = this.mindMap.renderer.getAllRenderRoot?.() || [
        this.mindMap.renderer.root || this.mindMap.renderer.renderTree
      ]
      const result = []
      const seen = new Set()
      const walk = node => {
        if (!node || seen.has(node.uid)) return
        seen.add(node.uid)
        if (this.getNodeTags(node).some(item => this.getTagText(item) === text)) {
          const rawText = String(node.getData('text') || node.uid)
          result.push({
            uid: node.uid,
            text: node.getData('richText')
              ? getTextFromHtml(rawText)
              : rawText
          })
        }
        ;(node.children || []).forEach(walk)
      }
      roots.filter(Boolean).forEach(walk)
      return result
    },

    jumpToNode(uid) {
      this.mindMap.execCommand('GO_TARGET_NODE', uid)
      this.hide()
    },

    hide() {
      this.show = false
    }
  }
}
</script>

<style lang="less" scoped>
.nodeTagFilterListContainer {
  position: absolute;
  right: 20px;
  top: 70px;
  width: 260px;
  max-height: 360px;
  overflow-y: auto;
  padding: 12px;
  z-index: 2000;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);

  &.isDark {
    color: #fff;
    background: #363b3f;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .close {
    cursor: pointer;
  }

  .tagInfo {
    color: var(--text-accent, #7b61ff);
    margin-bottom: 6px;
  }

  .nodeItem {
    padding: 6px 4px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      background: var(--background-modifier-hover, #f5f5f5);
    }
  }

  .empty {
    color: var(--text-muted, #888);
    padding: 10px 4px;
  }
}
</style>
