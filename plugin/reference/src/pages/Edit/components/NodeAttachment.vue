<template>
  <div class="nodeAttachment" :class="{ isDark: isDark }" @click.stop>
    <input
      ref="fileInput"
      class="fileInput"
      type="file"
      @change="onFileChange"
    />
    <div
      v-if="contextMenu.visible"
      class="attachmentContextMenu"
      :style="{
        left: contextMenu.left + 'px',
        top: contextMenu.top + 'px'
      }"
      @mousedown.stop
    >
      <div class="item" @click="removeAttachment">
        {{ $t('attachment.deleteAttachment') }}
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  props: {
    mindMap: {
      type: Object
    }
  },
  data() {
    return {
      activeNodes: [],
      contextNode: null,
      contextMenu: {
        visible: false,
        left: 0,
        top: 0
      }
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark,
      isReadonly: state => state.isReadonly
    })
  },
  created() {
    this.$root.$bus.$on('selectAttachment', this.selectAttachment)
    this.$root.$bus.$on('node_attachmentClick', this.openAttachment)
    this.$root.$bus.$on(
      'node_attachmentContextmenu',
      this.showContextMenu
    )
    this.$root.$bus.$on('draw_click', this.hideContextMenu)
    this.$root.$bus.$on('svg_mousedown', this.hideContextMenu)
    this.$root.$bus.$on('setData', this.hideContextMenu)
  },
  mounted() {
    const parent = this.mindMap?.el?.parentNode
    if (parent && this.$el.parentNode !== parent) parent.appendChild(this.$el)
  },
  beforeDestroy() {
    this.$root.$bus.$off('selectAttachment', this.selectAttachment)
    this.$root.$bus.$off('node_attachmentClick', this.openAttachment)
    this.$root.$bus.$off(
      'node_attachmentContextmenu',
      this.showContextMenu
    )
    this.$root.$bus.$off('draw_click', this.hideContextMenu)
    this.$root.$bus.$off('svg_mousedown', this.hideContextMenu)
    this.$root.$bus.$off('setData', this.hideContextMenu)
  },
  methods: {
    selectAttachment(nodes = []) {
      if (this.isReadonly) return
      this.activeNodes = Array.isArray(nodes) ? nodes : []
      if (this.activeNodes.length === 0 || !this.$refs.fileInput) return
      this.$refs.fileInput.value = ''
      this.$refs.fileInput.click()
    },

    async onFileChange(event) {
      const file = event.target.files && event.target.files[0]
      if (!file || this.activeNodes.length === 0) return
      const api = this.$root.$obsidianAPI || {}
      if (typeof api.saveFileToVault !== 'function') {
        api.showTip?.(this.$t('attachment.tip'))
        return
      }
      try {
        const result = await api.saveFileToVault(file, false)
        const path = typeof result === 'string' ? result : result?.path
        if (!path) throw new Error('attachment path is empty')
        this.activeNodes.forEach(node => node.setAttachment(path, file.name))
      } catch (error) {
        api.showTip?.(error?.message || this.$t('attachment.tip'))
      }
    },

    openAttachment(node) {
      if (!node) return
      this.hideContextMenu()
      const url = node.getData('attachmentUrl')
      if (!url) return
      const api = this.$root.$obsidianAPI || {}
      if (/^(?:https?:|data:|blob:)/i.test(url)) {
        if (typeof api.openWebLink === 'function') api.openWebLink(url)
        else window.open(url, '_blank')
      } else if (typeof api.openFile === 'function') {
        api.openFile(url, false)
      } else if (typeof api.openWebLink === 'function') {
        const resource = api.getResourcePath?.(url) || url
        api.openWebLink(resource)
      }
    },

    showContextMenu(node, event, icon) {
      if (!node || this.isReadonly) return
      event?.preventDefault?.()
      event?.stopPropagation?.()
      this.contextNode = node
      const rect = icon?.rbox?.() || icon?.bbox?.()
      const mapRect = this.mindMap?.elRect
      this.contextMenu.left = rect && mapRect ? rect.x - mapRect.left : 0
      this.contextMenu.top = rect && mapRect ? rect.y - mapRect.top : 0
      this.contextMenu.visible = true
    },

    removeAttachment() {
      if (this.contextNode) this.contextNode.setAttachment('', '')
      this.hideContextMenu()
    },

    hideContextMenu() {
      this.contextMenu.visible = false
      this.contextNode = null
    }
  }
}
</script>

<style lang="less" scoped>
.nodeAttachment {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2001;

  &.isDark {
    .attachmentContextMenu {
      background: #363b3f;
    }
  }

  .fileInput {
    display: none;
  }

  .attachmentContextMenu {
    position: absolute;
    min-width: 120px;
    padding: 6px 0;
    pointer-events: auto;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);

    .item {
      padding: 6px 12px;
      cursor: pointer;
      white-space: nowrap;

      &:hover {
        background: var(--background-modifier-hover, #f5f5f5);
      }
    }
  }
}
</style>
