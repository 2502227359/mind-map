<template>
  <Sidebar ref="sidebar" title="标注气泡样式">
    <div class="nodeChatDialogContent smmCommonSidebarContent smmCustomScrollbar">
      <div v-if="!currentNode" class="emptyTip">请先选择一个标注气泡。</div>
      <template v-else>
        <div class="sectionTitle">内容与位置</div>
        <div class="field full">
          <span class="label">内容</span>
          <el-input
            v-model="form.text"
            type="textarea"
            :rows="4"
            @keyup.native.stop
            @keydown.native.stop
          ></el-input>
        </div>
        <div class="fieldPair">
          <div class="field">
            <span class="label">水平偏移</span>
            <el-input-number v-model="form.offsetX" size="mini" :step="1"></el-input-number>
          </div>
          <div class="field">
            <span class="label">垂直偏移</span>
            <el-input-number v-model="form.offsetY" size="mini" :step="1"></el-input-number>
          </div>
        </div>

        <div class="sectionTitle">盒子样式</div>
        <div class="fieldPair">
          <div class="field">
            <span class="label">水平内边距</span>
            <el-input-number v-model="form.paddingX" size="mini" :min="0" :step="1"></el-input-number>
          </div>
          <div class="field">
            <span class="label">垂直内边距</span>
            <el-input-number v-model="form.paddingY" size="mini" :min="0" :step="1"></el-input-number>
          </div>
        </div>
        <div class="fieldPair">
          <div class="field">
            <span class="label">圆角</span>
            <el-input-number v-model="form.radius" size="mini" :min="0" :step="1"></el-input-number>
          </div>
          <div class="field">
            <span class="label">最大宽度</span>
            <el-input-number v-model="form.maxWidth" size="mini" :min="1" :step="10"></el-input-number>
          </div>
        </div>
        <div class="fieldPair">
          <div class="field">
            <span class="label">边框宽度</span>
            <el-input-number v-model="form.strokeWidth" size="mini" :min="0" :step="1"></el-input-number>
          </div>
          <div class="field">
            <span class="label">边框虚线</span>
            <el-input v-model="form.strokeDasharray" size="mini" placeholder="none 或 5 5"></el-input>
          </div>
        </div>
        <div class="fieldPair colorPair">
          <div class="field">
            <span class="label">填充颜色</span>
            <el-color-picker v-model="form.fill" show-alpha size="small"></el-color-picker>
          </div>
          <div class="field">
            <span class="label">边框颜色</span>
            <el-color-picker v-model="form.strokeColor" size="small"></el-color-picker>
          </div>
        </div>

        <div class="sectionTitle">文字样式</div>
        <div class="fieldPair">
          <div class="field">
            <span class="label">字号</span>
            <el-input-number v-model="form.fontSize" size="mini" :min="1" :step="1"></el-input-number>
          </div>
          <div class="field">
            <span class="label">行高</span>
            <el-input-number v-model="form.lineHeight" size="mini" :min="0.1" :step="0.1"></el-input-number>
          </div>
        </div>
        <div class="field full">
          <span class="label">字体</span>
          <el-input v-model="form.fontFamily" size="mini" placeholder="留空使用主题字体"></el-input>
        </div>
        <div class="fieldPair">
          <div class="field">
            <span class="label">字重</span>
            <el-select v-model="form.fontWeight" size="mini">
              <el-option label="常规" value="normal"></el-option>
              <el-option label="粗体" value="bold"></el-option>
            </el-select>
          </div>
          <div class="field">
            <span class="label">字形</span>
            <el-select v-model="form.fontStyle" size="mini">
              <el-option label="常规" value="normal"></el-option>
              <el-option label="斜体" value="italic"></el-option>
            </el-select>
          </div>
        </div>
        <div class="fieldPair colorPair">
          <div class="field">
            <span class="label">文字颜色</span>
            <el-color-picker v-model="form.color" size="small"></el-color-picker>
          </div>
        </div>
        <div class="actions">
          <el-button size="small" @click="close">取消</el-button>
          <el-button size="small" type="danger" @click="remove">删除气泡</el-button>
          <el-button size="small" type="primary" @click="save">保存</el-button>
        </div>
      </template>
    </div>
  </Sidebar>
</template>

<script>
import Sidebar from './Sidebar'

const fallbackStyle = {
  offsetX: 0,
  offsetY: 0,
  paddingX: 10,
  paddingY: 5,
  radius: 5,
  maxWidth: 260,
  strokeWidth: 1,
  strokeDasharray: 'none',
  fill: 'rgba(9,132,227,0.05)',
  strokeColor: '#0984e3',
  fontSize: 14,
  fontFamily: '',
  fontWeight: 'normal',
  fontStyle: 'normal',
  lineHeight: 1.2,
  color: '#0984e3'
}

export default {
  name: 'NodeChatDialog',
  components: { Sidebar },
  props: {
    mindMap: {
      type: Object,
      required: true
    },
    node: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      currentNode: this.node,
      form: { ...fallbackStyle, text: '' }
    }
  },
  watch: {
    node(value) {
      if (value) this.load(value)
    }
  },
  created() {
    this.mindMap.on('chat_dialog_contextmenu', this.onContextmenu)
    this.mindMap.on('chat_dialog_style', this.openForNode)
    this.mindMap.on('before_set_data', this.reset)
    this.mindMap.on('before_update_data', this.reset)
  },
  beforeDestroy() {
    this.mindMap.off('chat_dialog_contextmenu', this.onContextmenu)
    this.mindMap.off('chat_dialog_style', this.openForNode)
    this.mindMap.off('before_set_data', this.reset)
    this.mindMap.off('before_update_data', this.reset)
  },
  methods: {
    reset() {
      this.close()
      this.currentNode = null
    },
    getDefaults() {
      const plugin = this.mindMap.chatDialog
      return {
        ...fallbackStyle,
        ...((plugin && plugin.pluginOpt) || {})
      }
    },

    load(node) {
      if (!node || typeof node.getData !== 'function') return
      const data = node.getData('chatDialog') || {}
      this.currentNode = node
      this.form = {
        ...this.getDefaults(),
        ...data,
        text: data.text || data.content || ''
      }
    },

    onContextmenu(event, payload) {
      const node = payload && payload.node ? payload.node : payload
      if (!node || this.mindMap.opt.readonly) return
      this.openForNode(node)
      if (event && event.preventDefault) event.preventDefault()
    },

    openForNode(node) {
      const target = node && node.node ? node.node : node
      if (!target || this.mindMap.opt.readonly) return
      this.load(target)
      this.$nextTick(() => {
        if (this.$refs.sidebar) this.$refs.sidebar.show = true
      })
    },

    close() {
      if (this.$refs.sidebar) this.$refs.sidebar.show = false
    },

    save() {
      if (!this.currentNode || this.mindMap.opt.readonly) return
      const text = String(this.form.text || '')
      if (!text.trim()) {
        this.$root.$obsidianAPI?.showTip?.('气泡内容不能为空')
        return
      }
      const config = { ...this.form, text }
      this.mindMap.execCommand('UPDATE_CHAT_DIALOG', [this.currentNode], config)
      this.close()
    },

    remove() {
      if (!this.currentNode || this.mindMap.opt.readonly) return
      this.mindMap.execCommand('REMOVE_CHAT_DIALOG', [this.currentNode])
      this.close()
    }
  }
}
</script>

<style lang="less" scoped>
.nodeChatDialogContent {
  padding: 14px;
  color: var(--text-normal, #333);
}

.emptyTip {
  color: var(--text-muted, #999);
  text-align: center;
  padding: 30px 10px;
}

.sectionTitle {
  font-size: 14px;
  font-weight: 600;
  margin: 4px 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--background-modifier-border, #e8e8e8);
}

.fieldPair {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.field {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.field.full {
  display: block;
  margin-bottom: 10px;
}

.field.full .label {
  display: block;
  margin-bottom: 5px;
}

.label {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 12px;
}

.field .el-input,
.field .el-select {
  min-width: 0;
  flex: 1;
}

.colorPair .field {
  justify-content: space-between;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  margin-top: 4px;
  border-top: 1px solid var(--background-modifier-border, #e8e8e8);
}
</style>
