<template>
  <div class="nodeFeatures" v-if="node">
    <el-dialog
      class="nodeFeatureDialog smmElDialog"
      :class="{ isDark: isDark }"
      :title="textDialogMode === 'desc' ? '节点描述' : '标注气泡'"
      :visible.sync="textDialogVisible"
      width="420px"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      @close="cancelTextDialog"
    >
      <el-input
        v-model="textDialogValue"
        type="textarea"
        :rows="textDialogMode === 'desc' ? 5 : 4"
        :placeholder="textDialogMode === 'desc' ? '输入节点描述' : '输入气泡内容'"
        @keyup.native.stop
        @keydown.native.stop
      ></el-input>
      <div v-if="textDialogMode === 'desc'" class="featureDialogRow">
        <span>字号</span>
        <el-input-number
          v-model="descFontSize"
          :min="10"
          :max="72"
          :step="1"
          size="mini"
        ></el-input-number>
        <span>颜色</span>
        <el-color-picker v-model="descColor" size="small"></el-color-picker>
      </div>
      <div v-if="textDialogMode === 'callout'" class="featureDialogRow">
        <span>水平偏移</span>
        <el-input-number v-model="calloutOffsetX" :step="5" size="mini"></el-input-number>
        <span>垂直偏移</span>
        <el-input-number v-model="calloutOffsetY" :step="5" size="mini"></el-input-number>
      </div>
      <template v-if="textDialogMode === 'callout'">
        <div class="featureDialogRow">
          <span>字号</span>
          <el-input-number
            v-model="calloutFontSize"
            :min="8"
            :max="72"
            :step="1"
            size="mini"
          ></el-input-number>
          <span>文字</span>
          <el-color-picker v-model="calloutColor" size="small"></el-color-picker>
        </div>
        <div class="featureDialogRow">
          <span>填充</span>
          <el-color-picker
            v-model="calloutFill"
            show-alpha
            size="small"
          ></el-color-picker>
          <span>边框</span>
          <el-color-picker
            v-model="calloutStrokeColor"
            size="small"
          ></el-color-picker>
          <el-input-number
            v-model="calloutStrokeWidth"
            :min="0"
            :max="20"
            :step="1"
            size="mini"
          ></el-input-number>
        </div>
      </template>
      <span slot="footer" class="dialog-footer">
        <el-button size="small" @click="cancelTextDialog">取消</el-button>
        <el-button size="small" type="primary" @click="confirmTextDialog">确定</el-button>
      </span>
    </el-dialog>
    <el-dialog
      class="nodeFeatureDialog smmElDialog"
      :class="{ isDark: isDark }"
      title="节点跳转"
      :visible.sync="nodeLinkDialogVisible"
      @open="$nextTick(() => $refs.nodeLinkSelect && $refs.nodeLinkSelect.refresh())"
      width="420px"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      @close="cancelNodeLinkDialog"
    >
      <div class="featureDialogHint">从主结构、游离树或折叠节点中选择目标。</div>
      <NodeLinkSelect
        ref="nodeLinkSelect"
        v-model="nodeLinkTargetUid"
        :mind-map="mindMap"
        :exclude-uid="node ? String(node.uid) : ''"
        :is-dark="isDark"
      ></NodeLinkSelect>
      <el-checkbox v-model="nodeLinkBidirectional">同时建立反向跳转</el-checkbox>
      <span slot="footer" class="dialog-footer">
        <el-button size="small" @click="cancelNodeLinkDialog">取消</el-button>
        <el-button size="small" type="primary" @click="confirmNodeLinkDialog">确定</el-button>
      </span>
    </el-dialog>
    <el-dialog
      class="nodeFeatureDialog smmElDialog"
      :class="{ isDark: isDark }"
      title="圈画标记"
      :visible.sync="notationDialogVisible"
      width="420px"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      @close="cancelNotationDialog"
    >
      <div class="featureDialogRow">
        <span>类型</span>
        <el-select v-model="notationType" size="small" style="width: 160px">
          <el-option
            v-for="item in notationTypes"
            :key="item.value"
            :label="item.name"
            :value="item.value"
          ></el-option>
        </el-select>
      </div>
      <div class="featureDialogRow">
        <span>颜色</span>
        <el-color-picker v-model="notationColor" size="small"></el-color-picker>
        <span>边距</span>
        <el-input-number
          v-model="notationPadding"
          :min="0"
          :max="40"
          :step="1"
          size="mini"
        ></el-input-number>
      </div>
      <div class="featureDialogRow">
        <span>线宽</span>
        <el-input-number
          v-model="notationStrokeWidth"
          :min="1"
          :max="20"
          :step="1"
          size="mini"
        ></el-input-number>
        <el-checkbox v-model="notationAnimate">开启动画</el-checkbox>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button size="small" @click="cancelNotationDialog">取消</el-button>
        <el-button size="small" type="primary" @click="confirmNotationDialog">确定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import NodeLinkSelect from './NodeLinkSelect.vue'

export default {
  components: {
    NodeLinkSelect
  },
  props: {
    mindMap: {
      type: Object,
      required: true
    },
    node: {
      type: Object,
      default: null
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      notationTypes: [
        { name: '圆圈', value: 'circle' },
        { name: '下划线', value: 'underline' },
        { name: '方框', value: 'box' },
        { name: '括号', value: 'bracket' },
        { name: '删除线', value: 'strike-through' },
        { name: '荧光笔', value: 'highlight' },
        { name: '叉除', value: 'crossed-off' }
      ],
      textDialogVisible: false,
      textDialogMode: '',
      textDialogValue: '',
      descFontSize: 12,
      descColor: '#888',
      calloutOffsetX: 0,
      calloutOffsetY: 0,
      calloutFontSize: 14,
      calloutColor: '#0984e3',
      calloutFill: 'rgba(9,132,227,0.05)',
      calloutStrokeColor: '#0984e3',
      calloutStrokeWidth: 1,
      nodeLinkDialogVisible: false,
      nodeLinkTargetUid: '',
      nodeLinkBidirectional: false,
      notationDialogVisible: false,
      notationType: 'circle',
      notationColor: '#3f9cfc',
      notationPadding: 12,
      notationStrokeWidth: 1,
      notationAnimate: true
    }
  },
  methods: {
    runNodeCommand(command, ...args) {
      if (!this.node || !this.mindMap || this.mindMap.opt?.readonly) return false
      this.mindMap.execCommand(command, [this.node], ...args)
      this.$emit('close')
      return true
    },

    showTip(message) {
      const api = this.$root.$obsidianAPI
      if (api && typeof api.showTip === 'function') api.showTip(message)
    },

    openDescriptionDialog() {
      if (!this.node) return
      this.textDialogMode = 'desc'
      this.textDialogValue = this.node.getData('desc') || ''
      const style = this.node.getData('descStyle') || {}
      this.descFontSize = Number(style.fontSize)
      if (!Number.isFinite(this.descFontSize)) this.descFontSize = 12
      this.descColor = style.color || '#888'
      this.textDialogVisible = true
    },

    openCalloutDialog() {
      if (!this.node) return
      const data = this.node.getData('chatDialog') || {}
      this.textDialogMode = 'callout'
      this.textDialogValue = data.text || ''
      this.calloutOffsetX = Number(data.offsetX) || 0
      this.calloutOffsetY = Number(data.offsetY) || 0
      this.calloutFontSize = Number(data.fontSize)
      if (!Number.isFinite(this.calloutFontSize)) this.calloutFontSize = 14
      this.calloutColor = data.color || '#0984e3'
      this.calloutFill = data.fill || 'rgba(9,132,227,0.05)'
      this.calloutStrokeColor = data.strokeColor || '#0984e3'
      this.calloutStrokeWidth = Number(data.strokeWidth)
      if (!Number.isFinite(this.calloutStrokeWidth)) this.calloutStrokeWidth = 1
      this.textDialogVisible = true
    },

    confirmTextDialog() {
      if (this.textDialogMode === 'desc') {
        this.runNodeCommand('SET_NODE_DESC', this.textDialogValue, {
          fontSize: Number(this.descFontSize) || 12,
          color: this.descColor || '#888'
        })
        return
      }
      const text = String(this.textDialogValue || '')
      if (!text.trim()) {
        this.showTip('气泡内容不能为空')
        return
      }
      this.runNodeCommand('ADD_CHAT_DIALOG', {
        text,
        offsetX: Number(this.calloutOffsetX) || 0,
        offsetY: Number(this.calloutOffsetY) || 0,
        fontSize: Number(this.calloutFontSize) || 14,
        color: this.calloutColor || '#0984e3',
        fill: this.calloutFill || 'rgba(9,132,227,0.05)',
        strokeColor: this.calloutStrokeColor || '#0984e3',
        strokeWidth: Number(this.calloutStrokeWidth) || 0
      })
    },

    cancelTextDialog() {
      this.textDialogVisible = false
      this.textDialogMode = ''
      this.textDialogValue = ''
      this.descFontSize = 12
      this.descColor = '#888'
      this.calloutOffsetX = 0
      this.calloutOffsetY = 0
      this.calloutFontSize = 14
      this.calloutColor = '#0984e3'
      this.calloutFill = 'rgba(9,132,227,0.05)'
      this.calloutStrokeColor = '#0984e3'
      this.calloutStrokeWidth = 1
    },

    openNotationDialog() {
      if (!this.node) return
      const notation = this.node.getData('notation') || {}
      const config = notation.config || {}
      this.notationType = config.type || 'circle'
      this.notationColor = config.color || '#3f9cfc'
      this.notationPadding = Number(config.padding)
      if (!Number.isFinite(this.notationPadding)) this.notationPadding = 12
      this.notationStrokeWidth = Number(config.strokeWidth)
      if (!Number.isFinite(this.notationStrokeWidth)) this.notationStrokeWidth = 1
      this.notationAnimate = config.animate !== false
      this.notationDialogVisible = true
    },

    confirmNotationDialog() {
      const config = {
        type: this.notationType,
        color: this.notationColor,
        padding: Number(this.notationPadding) || 0,
        strokeWidth: Number(this.notationStrokeWidth) || 1,
        animate: this.notationAnimate
      }
      if (this.notationType === 'bracket') {
        config.brackets = ['left', 'right']
      }
      this.runNodeCommand('SET_NOTATION', true, config)
    },

    cancelNotationDialog() {
      this.notationDialogVisible = false
      this.notationType = 'circle'
      this.notationColor = '#3f9cfc'
      this.notationPadding = 12
      this.notationStrokeWidth = 1
      this.notationAnimate = true
    },

    removeNotation() {
      this.runNodeCommand('SET_NOTATION', false, {})
    },

    openNodeLinkDialog() {
      if (!this.node) return
      this.nodeLinkTargetUid = this.node.getData('nodeLink') || ''
      this.nodeLinkBidirectional = false
      this.nodeLinkDialogVisible = true
    },

    confirmNodeLinkDialog() {
      const targetUid = String(this.nodeLinkTargetUid || '').trim()
      if (!targetUid) {
        this.showTip('请选择目标节点')
        return
      }
      if (this.node && String(this.node.uid) === targetUid) {
        this.showTip('不能跳转到当前节点')
        return
      }
      const renderer = this.mindMap && this.mindMap.renderer
      const target =
        renderer && typeof renderer.findNodeByUid === 'function'
          ? renderer.findNodeByUid(targetUid)
          : null
      const targetData =
        this.mindMap &&
        this.mindMap.nodeLink &&
        typeof this.mindMap.nodeLink.findNodeData === 'function'
          ? this.mindMap.nodeLink.findNodeData(targetUid)
          : null
      if (!target && !targetData) {
        this.showTip('未找到目标节点，请刷新后重新选择')
        return
      }
      this.runNodeCommand(
        'SET_NODE_LINK',
        targetUid,
        Boolean(this.nodeLinkBidirectional)
      )
    },

    cancelNodeLinkDialog() {
      this.nodeLinkDialogVisible = false
      this.nodeLinkTargetUid = ''
      this.nodeLinkBidirectional = false
    },

    removeCallout() {
      this.runNodeCommand('REMOVE_CHAT_DIALOG')
    },

    removeNodeLink() {
      this.runNodeCommand('SET_NODE_LINK', null, false)
    },

    closeAll() {
      this.cancelTextDialog()
      this.cancelNodeLinkDialog()
      this.cancelNotationDialog()
    }
  }
}
</script>

<style lang="less" scoped>
.featureDialogRow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: #606266;
}

.featureDialogHint {
  margin-bottom: 10px;
  color: #909399;
  font-size: 12px;
}

.nodeFeatureDialog {
  .el-checkbox {
    margin-top: 12px;
  }

  &.isDark {
    .featureDialogRow,
    .featureDialogHint {
      color: hsla(0, 0%, 100%, 0.65);
    }
  }
}
</style>
