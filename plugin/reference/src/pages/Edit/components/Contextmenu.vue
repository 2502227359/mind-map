<template>
  <div
    class="contextmenuContainer contextmenuListBox smmCustomScrollbar"
    v-if="isShow"
    ref="contextmenuRef"
    :style="styleObj"
    :class="{ isDark: isDark, isMobile: isMobile }"
  >
    <template v-if="type === 'node'">
      <div class="item">
        <span class="name">{{ $t('contextmenu.insertNode') }}</span>
        <span class="el-icon-arrow-right"></span>
        <div
          class="subItems listBox"
          :class="{ isDark: isDark }"
          style="width: 200px; top: -10px;"
          :style="{ left: subItemsShowLeft ? '-200px' : '100%' }"
        >
          <div
            class="item"
            @click="exec('INSERT_NODE', insertNodeBtnDisabled)"
            :class="{ disabled: insertNodeBtnDisabled }"
          >
            <span class="name">{{ $t('contextmenu.insertSiblingNode') }}</span>
            <span class="desc">Enter</span>
          </div>
          <div
            class="item"
            @click="exec('INSERT_NODE_UP', insertNodeBtnDisabled)"
            :class="{ disabled: insertNodeBtnDisabled }"
          >
            <span class="name">{{ $t('contextmenu.insertSiblingNodeAbove') }}</span>
          </div>
          <div
            class="item"
            @click="exec('INSERT_CHILD_NODE')"
            :class="{ disabled: isGeneralization }"
          >
            <span class="name">{{ $t('contextmenu.insertChildNode') }}</span>
            <span class="desc">Tab</span>
          </div>
          <div
            class="item"
            @click="exec('INSERT_PARENT_NODE')"
            :class="{ disabled: insertNodeBtnDisabled }"
          >
            <span class="name">{{ $t('contextmenu.insertParentNode') }}</span>
            <span class="desc">Shift + Tab</span>
          </div>
          <div
            class="item"
            @click="exec('ADD_GENERALIZATION')"
            :class="{ disabled: insertNodeBtnDisabled }"
          >
            <span class="name">{{ $t('contextmenu.insertSummary') }}</span>
            <span class="desc">Ctrl + G</span>
          </div>
        </div>
      </div>
      <div
        class="item"
        @click="exec('UP_NODE')"
        :class="{ disabled: upNodeBtnDisabled }"
      >
        <span class="name">{{ $t('contextmenu.moveUpNode') }}</span>
        <span class="desc">Ctrl + ↑</span>
      </div>
      <div
        class="item"
        @click="exec('DOWN_NODE')"
        :class="{ disabled: downNodeBtnDisabled }"
      >
        <span class="name">{{ $t('contextmenu.moveDownNode') }}</span>
        <span class="desc">Ctrl + ↓</span>
      </div>
      <div class="item" @click="exec('UNEXPAND_ALL')">
        <span class="name">{{ $t('contextmenu.unExpandNodeChild') }}</span>
      </div>
      <div class="item" @click="exec('EXPAND_ALL')">
        <span class="name">{{ $t('contextmenu.expandNodeChild') }}</span>
      </div>
      <div class="item">
        <span class="name">选择</span>
        <span class="el-icon-arrow-right"></span>
        <div
          class="subItems listBox"
          :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
          style="top: -10px"
        >
          <div class="item" @click="selectNodes('brother')">同层级所有节点</div>
          <div class="item" @click="selectNodes('selfAll')">自身及下级节点</div>
          <div class="item" @click="selectNodes('children')">子节点</div>
        </div>
      </div>
      <div class="item withSubItems">
        <div class="itemRow">
          <span class="name">节点功能</span>
          <span class="el-icon-arrow-right"></span>
        </div>
        <div
          class="subItems contextmenuListBox featureMenu"
          :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
          style="top: -10px"
        >
          <div class="item" @click="toggleTodo">
            <span class="name">{{ hasCheckbox ? '删除待办' : '添加待办' }}</span>
          </div>
          <div class="item" @click="setTodoDone(true)">
            <span class="name">标记待办完成</span>
          </div>
          <div class="item" @click="setTodoDone(false)">
            <span class="name">标记待办未完成</span>
          </div>
          <div class="item withSubItems">
            <div class="itemRow">
              <span class="name">子节点待办</span>
              <span class="el-icon-arrow-right"></span>
            </div>
            <div
              class="subItems contextmenuListBox featureMenu"
              :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
              style="top: -10px"
            >
              <div class="item" @click="setChildrenTodo('add')">添加待办</div>
              <div class="item" @click="setChildrenTodo('complete')">
                全部标记完成
              </div>
              <div class="item" @click="setChildrenTodo('unComplete')">
                全部标记未完成
              </div>
              <div class="item" @click="setChildrenTodo('delete')">
                删除子节点待办
              </div>
            </div>
          </div>
          <div class="item withSubItems">
            <div class="itemRow">
              <span class="name">子节点编号</span>
              <span class="el-icon-arrow-right"></span>
            </div>
            <div
              class="subItems contextmenuListBox featureMenu numberMenu"
              :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
              style="top: -10px"
            >
              <div
                class="item"
                v-for="item in numberTypes"
                :key="'node-number-' + item.value"
                @click="setNodeNumber(item.value)"
              >
                {{ item.name }}
              </div>
              <div class="item withSubItems">
                <div class="itemRow">
                  <span class="name">编号层级</span>
                  <span class="el-icon-arrow-right"></span>
                </div>
                <div
                  class="subItems contextmenuListBox featureMenu"
                  :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
                  style="top: -10px"
                >
                  <div
                    class="item"
                    v-for="item in numberLevels"
                    :key="'node-number-level-' + item.value"
                    @click="setNodeNumber(numberType || 1, item.value)"
                  >
                    {{ item.name }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="item withSubItems">
            <div class="itemRow">
              <span class="name">节点内段落编号</span>
              <span class="el-icon-arrow-right"></span>
            </div>
            <div
              class="subItems contextmenuListBox featureMenu numberMenu"
              :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
              style="top: -10px"
            >
              <div
                class="item"
                v-for="item in paragraphNumberTypes"
                :key="'paragraph-number-' + item.value"
                @click="setParagraphNumber(item.value)"
              >
                {{ item.name }}
              </div>
            </div>
          </div>
          <div class="item" @click="openDescriptionDialog">
            <span class="name">编辑节点描述</span>
          </div>
          <div class="item" @click="toggleHideText">
            <span class="name">{{ isTextHidden ? '显示节点正文' : '隐藏节点正文' }}</span>
          </div>
          <div class="item" @click="openCalloutDialog">
            <span class="name">{{ hasCallout ? '编辑标注气泡' : '添加标注气泡' }}</span>
          </div>
          <div class="item" v-if="hasCallout" @click="removeCallout">
            <span class="name">删除标注气泡</span>
          </div>
          <div class="item withSubItems">
            <div class="itemRow">
              <span class="name">圈画标记</span>
              <span class="el-icon-arrow-right"></span>
            </div>
            <div
              class="subItems contextmenuListBox featureMenu"
              :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
              style="top: -10px"
            >
              <div class="item" @click="openNotationDialog">添加/编辑圈画</div>
              <div class="item" v-if="hasNotation" @click="removeNotation">
                删除圈画标记
              </div>
            </div>
          </div>
          <div class="item" @click="openNodeLinkDialog">
            <span class="name">{{ hasNodeLink ? '修改节点跳转' : '链接到指定节点' }}</span>
          </div>
          <div class="item" v-if="hasNodeLink" @click="jumpToNodeLink">
            <span class="name">跳转到链接节点</span>
          </div>
          <div class="item" v-if="hasNodeLink" @click="removeNodeLink">
            <span class="name">删除节点跳转</span>
          </div>
          <div
            class="item"
            :class="{ disabled: isReadonly }"
            @click="exec('TO_SAME_LAYERINDEX_NODE_ALIGN', isReadonly)"
          >
            <span class="name">一键同级节点对齐</span>
          </div>
          <div
            class="item"
            :class="{ disabled: isReadonly }"
            @click="exec('REMOVE_SAME_LAYERINDEX_NODE_ALIGN', isReadonly)"
          >
            <span class="name">取消同级节点自动宽度</span>
          </div>
          <div class="item" @click="exec('TO_FREE_NODE')">
            <span class="name">转为游离主题</span>
          </div>
        </div>
      </div>
      <div class="splitLine"></div>
      <div class="item danger" @click="exec('REMOVE_NODE')">
        <span class="name">{{ $t('contextmenu.deleteNode') }}</span>
        <span class="desc">Delete</span>
      </div>
      <div class="item danger" @click="exec('REMOVE_CURRENT_NODE')">
        <span class="name">{{ $t('contextmenu.deleteCurrentNode') }}</span>
        <span class="desc">Shift + Backspace</span>
      </div>
      <div class="splitLine"></div>
      <div class="item">
        <span class="name">复制粘贴</span>
        <span class="el-icon-arrow-right"></span>
        <div
          class="subItems listBox"
          :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
          style="top: -10px"
        >
          <div
            class="item"
            @click="exec('COPY_NODE')"
            :class="{ disabled: isGeneralization }"
          >
            <span class="name">{{ $t('contextmenu.copyNode') }}</span>
            <span class="desc">Ctrl + C</span>
          </div>
          <div
            class="item"
            @click="exec('CUT_NODE')"
            :class="{ disabled: isGeneralization }"
          >
            <span class="name">{{ $t('contextmenu.cutNode') }}</span>
            <span class="desc">Ctrl + X</span>
          </div>
          <div class="item" @click="exec('PASTE_NODE')">
            <span class="name">{{ $t('contextmenu.pasteNode') }}</span>
            <span class="desc">Ctrl + V</span>
          </div>
        </div>
      </div>
      <div class="item" @click="copyNodeToTxt">
        <span class="name">{{ $t('contextmenu.copyNodeToTxt') }}</span>
      </div>
      <div class="splitLine"></div>
      <div class="item" @click="exec('REMOVE_HYPERLINK')" v-if="hasHyperlink">
        <span class="name">{{ $t('contextmenu.removeHyperlink') }}</span>
      </div>
      <div class="item" @click="exec('REMOVE_NOTE')" v-if="hasNote">
        <span class="name">{{ $t('contextmenu.removeNote') }}</span>
      </div>
      <div class="item" @click="exec('REMOVE_CUSTOM_STYLES')">
        <span class="name">{{ $t('contextmenu.removeCustomStyles') }}</span>
      </div>
      <div
        class="item"
        @click="exec('REMOVE_NODE_CUSTOM_TEXT_WIDTH')"
        v-if="hasCustomTextWidth"
      >
        <span class="name">{{ $t('contextmenu.removeCustomWidth') }}</span>
      </div>
      <div class="item withSubItems">
        <div class="itemRow">
          <span class="name">{{ $t('contextmenu.exportNodeToPng') }}</span>
          <span class="el-icon-arrow-right"></span>
        </div>
        <div
          class="subItems contextmenuListBox"
          :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
          style="top: -17px"
        >
          <div class="item" @click="copyCurNodeAsPng">
            {{ $t('contextmenu.copyToClipboard') }}
          </div>
          <div class="item" @click="exec('EXPORT_CUR_NODE_TO_PNG')">
            {{ $t('contextmenu.download') }}
          </div>
        </div>
      </div>
      <div class="item" @click="searchOnNode">
        <span class="name">{{ $t('contextmenu.searchInNode') }}</span>
      </div>
      <div class="item" @click="exec('COPY_NODE_TO_OB_LINK')" v-if="!isCodeBlock">
        <span class="name">{{ $t('contextmenu.copyAsInternalUrl') }}</span>
      </div>
    </template>
    <template v-if="type === 'svg'">
      <div class="item" @click="exec('RETURN_CENTER')">
        <span class="name">{{ $t('contextmenu.backCenter') }}</span>
        <span class="desc">Ctrl + Enter</span>
      </div>
      <div class="splitLine"></div>
      <div class="item" @click="exec('EXPAND_ALL')">
        <span class="name">{{ $t('contextmenu.expandAll') }}</span>
      </div>
      <div class="item" @click="exec('UNEXPAND_ALL')">
        <span class="name">{{ $t('contextmenu.unExpandAll') }}</span>
      </div>
      <div class="item" @click="exec('INSERT_FREE_NODE', false, {}, {})">
        <span class="name">插入游离主题</span>
      </div>
      <div class="item withSubItems">
        <div class="itemRow">
          <span class="name">{{ $t('contextmenu.expandTo') }}</span>
          <span class="el-icon-arrow-right"></span>
        </div>
        <div
          class="subItems contextmenuListBox"
          :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
          style="top: -10px"
        >
          <div
            class="item"
            v-for="(item, index) in expandList"
            :key="item"
            @click="exec('UNEXPAND_TO_LEVEL', false, index + 1)"
          >
            {{ item }}
          </div>
        </div>
      </div>
      <div class="item">
        <span class="name">选择</span>
        <span class="el-icon-arrow-right"></span>
        <div
          class="subItems listBox"
          :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
          style="top: -10px"
        >
          <div class="item" @click="selectNodes('all')">所有节点</div>
          <div class="item" @click="selectNodes('second')">二级节点</div>
          <div class="item" @click="selectNodes('third')">三级节点</div>
        </div>
      </div>
      <div class="splitLine"></div>
      <div class="item" @click="exec('RESET_LAYOUT')" v-if="!isReadonly">
        <span class="name">{{ $t('contextmenu.arrangeLayout') }}</span>
        <span class="desc">Ctrl + R</span>
      </div>
      <div class="item" @click="exec('FIT_CANVAS')">
        <span class="name">{{ $t('contextmenu.fitCanvas') }}</span>
        <span class="desc">Ctrl + Shift + i</span>
      </div>
      <div class="item" @click="exec('TOGGLE_ZEN_MODE')">
        <span class="name">{{ $t('contextmenu.zenMode') }}</span>
        <span class="el-icon-check" v-if="isZenMode"></span>
      </div>
      <div class="item" v-if="canToggleLines" @click="toggleLines">
        <span class="name">{{
          $t(
            linesHidden
              ? 'contextmenu.showAssociativeLines'
              : 'contextmenu.hideAssociativeLines'
          )
        }}</span>
      </div>
      <div class="splitLine"></div>
      <div
        class="item"
        @click="exec('REMOVE_ALL_NODE_CUSTOM_STYLES')"
        v-if="!isReadonly"
      >
        <span class="name">{{
          $t('contextmenu.removeAllNodeCustomStyles')
        }}</span>
      </div>
      <div
        class="item"
        @click="exec('REMOVE_ALL_NODE_CUSTOM_TEXT_WIDTH')"
        v-if="!isReadonly"
      >
        <span class="name" :title="$t('contextmenu.removeAllCustomWidth')">{{
          $t('contextmenu.removeAllCustomWidth')
        }}</span>
      </div>
      <div class="item withSubItems">
        <div class="itemRow">
          <span class="name">{{ $t('contextmenu.copyToClipboard') }}</span>
          <span class="el-icon-arrow-right"></span>
        </div>
        <div
          class="subItems contextmenuListBox"
          :class="{ isDark: isDark, showLeft: subItemsShowLeft }"
          style="top: -130px"
        >
          <div
            class="item"
            v-for="item in copyList"
            :key="item.value"
            @click="copyToClipboard(item.value)"
          >
            {{ item.name }}
          </div>
        </div>
      </div>
      <div class="item" @click="exec('COPY_TO_OB_LINK')">
        <span class="name">{{ $t('contextmenu.copyAsInternalUrl') }}</span>
      </div>
    </template>
    <NodeFeatures
      v-if="type === 'node' && node"
      ref="nodeFeatures"
      :mind-map="mindMap"
      :node="node"
      :is-dark="isDark"
      @close="hide"
    ></NodeFeatures>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex'
import {
  getTextFromHtml,
  imgToDataUrl,
  copyNodeTree
} from 'simple-mind-map/src/utils'
import { transformToMarkdown } from 'simple-mind-map/src/parse/toMarkdown'
import txt from '@/utils/txt'
import { setDataToClipboard, setImgToClipboard, copy } from '@/utils'
import NodeFeatures from './NodeFeatures.vue'

export default {
  components: {
    NodeFeatures
  },
  props: {
    mindMap: {
      type: Object
    }
  },
  data() {
    return {
      isShow: false,
      left: 0,
      top: 0,
      node: null,
      type: '',
      isMousedown: false,
      mosuedownX: 0,
      mosuedownY: 0,
      enableCopyToClipboardApi: navigator.clipboard,
      numberType: '',
      numberLevel: '',
      subItemsShowLeft: false,
      isNodeMousedown: false,
      linesHidden: false,
      listBoxWidth: '250px',
      numberTypes: [
        { name: '无编号', value: '' },
        { name: '1, 2, 3', value: 1 },
        { name: '1., 2., 3.', value: 2 },
        { name: '(1), (2), (3)', value: 3 },
        { name: 'a., b., c.', value: 4 },
        { name: 'A., B., C.', value: 5 },
        { name: 'i., ii., iii.', value: 6 },
        { name: 'I., II., III.', value: 7 },
        { name: '一、, 二、, 三、', value: 8 }
      ],
      numberLevels: [
        { name: '编号首层', value: 1 },
        { name: '编号前两层', value: 2 },
        { name: '编号前三层', value: 3 },
        { name: '编号所有层', value: 0 }
      ],
    }
  },
  computed: {
    ...mapState({
      isZenMode: state => state.localConfig.isZenMode,
      isDark: state => state.localConfig.isDark,
      isReadonly: state => state.isReadonly,
      isMobile: state => state.isMobile
    }),
    expandList() {
      return [
        this.$t('contextmenu.level1'),
        this.$t('contextmenu.level2'),
        this.$t('contextmenu.level3'),
        this.$t('contextmenu.level4'),
        this.$t('contextmenu.level5'),
        this.$t('contextmenu.level6')
      ]
    },
    copyList() {
      const list = [
        {
          name: this.$t('contextmenu.copyToSmm'),
          value: 'smm'
        },
        {
          name: this.$t('contextmenu.copyToJson'),
          value: 'json'
        },
        {
          name: this.$t('contextmenu.copyToMarkdown'),
          value: 'md'
        },
        {
          name: this.$t('contextmenu.copyToTxt'),
          value: 'txt'
        }
      ]
      if (this.enableCopyToClipboardApi) {
        list.push({
          name: this.$t('contextmenu.copyToPng'),
          value: 'png'
        })
      }
      return list
    },
    paragraphNumberTypes() {
      return [
        { name: '取消编号', value: '' },
        ...this.numberTypes.filter(item => item.value !== '')
      ]
    },
    insertNodeBtnDisabled() {
      return !this.node || this.node.isRoot || this.node.isGeneralization
    },
    upNodeBtnDisabled() {
      if (!this.node || this.node.isRoot || this.node.isGeneralization) {
        return true
      }
      let isFirst =
        this.node.parent.children.findIndex(item => {
          return item === this.node
        }) === 0
      return isFirst
    },
    downNodeBtnDisabled() {
      if (!this.node || this.node.isRoot || this.node.isGeneralization) {
        return true
      }
      let children = this.node.parent.children
      let isLast =
        children.findIndex(item => {
          return item === this.node
        }) ===
        children.length - 1
      return isLast
    },
    isGeneralization() {
      return this.node.isGeneralization
    },
    hasHyperlink() {
      return !!this.node.getData('hyperlink')
    },
    hasNote() {
      return !!this.node.getData('note')
    },
    hasCheckbox() {
      return !!this.node.getData('checkbox')
    },
    hasCallout() {
      return !!this.node.getData('chatDialog')
    },
    hasNodeLink() {
      return !!this.node.getData('nodeLink')
    },
    hasNotation() {
      const notation = this.node.getData('notation')
      return Boolean(notation && notation.show)
    },
    isTextHidden() {
      return Boolean(this.node.getData('hideText'))
    },
    hasCustomTextWidth() {
      return this.node.hasCustomWidth()
    },
    isCodeBlock() {
      return Boolean(this.$root.$obsidianAPI?.getIsCodeBlock?.())
    },
    canToggleLines() {
      return Boolean(
        this.mindMap.associativeLine &&
          typeof this.mindMap.associativeLine.setLinesVisibility === 'function'
      )
    },
    styleObj() {
      const res = {
        left: this.left + 'px',
        top: this.top + 'px',
        width: this.listBoxWidth
      }
      if (this.isMobile) {
        res.bottom = '37px'
      }
      return res
    }
  },
  created() {
    if (this.mindMap) {
      this.mindMap.on('chat_dialog_dblclick', this.onChatDialogDblclick)
      this.mindMap.on('node_link_not_find', this.onNodeLinkNotFind)
    }
    this.$root.$bus.$on('node_contextmenu', this.show)
    this.$root.$bus.$on('node_click', this.hide)
    this.$root.$bus.$on('draw_click', this.hide)
    this.$root.$bus.$on('expand_btn_click', this.hide)
    this.$root.$bus.$on('svg_mousedown', this.onMousedown)
    this.$root.$bus.$on('mouseup', this.onMouseup)
    this.$root.$bus.$on('translate', this.hide)
    this.$root.$bus.$on('node_mousedown', this.onNodeMousedown)
    if (this.isMobile) {
      this.$root.$bus.$on('show_node_context_menu', this.show)
      this.$root.$bus.$on('show_canvas_context_menu', this.show2)
    }
  },
  beforeDestroy() {
    if (this.mindMap) {
      this.mindMap.off('chat_dialog_dblclick', this.onChatDialogDblclick)
      this.mindMap.off('node_link_not_find', this.onNodeLinkNotFind)
    }
    this.$root.$bus.$off('node_contextmenu', this.show)
    this.$root.$bus.$off('node_click', this.hide)
    this.$root.$bus.$off('draw_click', this.hide)
    this.$root.$bus.$off('expand_btn_click', this.hide)
    this.$root.$bus.$off('svg_mousedown', this.onMousedown)
    this.$root.$bus.$off('mouseup', this.onMouseup)
    this.$root.$bus.$off('translate', this.hide)
    this.$root.$bus.$off('node_mousedown', this.onNodeMousedown)
    if (this.isMobile) {
      this.$root.$bus.$off('show_node_context_menu', this.show)
      this.$root.$bus.$off('show_canvas_context_menu', this.show2)
    }
  },
  methods: {
    ...mapMutations(['setLocalConfig']),

    getShowPosition(x, y) {
      if (this.isMobile) {
        this.listBoxWidth =
          Math.min(250, this.mindMap.width - 42 - 50 - 20) + 'px'
        return {
          x: 52,
          y: 60
        }
      }
      const elRect = this.mindMap.elRect
      x -= elRect.left
      y -= elRect.top
      const rect = this.$refs.contextmenuRef.getBoundingClientRect()
      if (x + rect.width > elRect.width) {
        x = x - rect.width - 20
      }
      this.subItemsShowLeft = x + rect.width + 150 > elRect.right
      if (y + rect.height > elRect.height) {
        y = elRect.height - rect.height - 10
      }
      return { x, y }
    },

    show(e, node) {
      this.type = 'node'
      this.isShow = true
      this.node = node
      const number = this.node.getData('number')
      this.numberType = number ? number.type || 1 : ''
      this.numberLevel = number
        ? number.level === ''
          ? 1
          : number.level
        : ''
      this.$nextTick(() => {
        const { x, y } = this.getShowPosition(e.clientX + 10, e.clientY + 10)
        this.left = x
        this.top = y
      })
    },

    onChatDialogDblclick(e, node) {
      if (
        !node ||
        this.isReadonly ||
        (this.mindMap && this.mindMap.opt && this.mindMap.opt.readonly)
      ) {
        return
      }
      const event = e || {}
      this.show(
        {
          clientX: Number.isFinite(event.clientX) ? event.clientX : 10,
          clientY: Number.isFinite(event.clientY) ? event.clientY : 10
        },
        node
      )
      this.$nextTick(() => {
        if (this.$refs.nodeFeatures) {
          this.$refs.nodeFeatures.openCalloutDialog()
        }
      })
    },

    onNodeLinkNotFind(node, uid) {
      const targetUid =
        uid ||
        (node && typeof node.getData === 'function'
          ? node.getData('nodeLink')
          : '')
      const target = targetUid ? `：${targetUid}` : ''
      if (
        this.$root.$obsidianAPI &&
        typeof this.$root.$obsidianAPI.showTip === 'function'
      ) {
        this.$root.$obsidianAPI.showTip(`未找到目标节点${target}`)
      }
    },

    onNodeMousedown() {
      this.isNodeMousedown = true
    },

    onMousedown(e) {
      if (!e || e.which !== 3) {
        return
      }
      this.mosuedownX = e.clientX
      this.mosuedownY = e.clientY
      this.isMousedown = true
    },

    onMouseup(e) {
      if (!this.isMousedown) {
        return
      }
      if (this.isNodeMousedown) {
        this.isNodeMousedown = false
        return
      }
      this.isMousedown = false
      if (
        Math.abs(this.mosuedownX - e.clientX) > 3 ||
        Math.abs(this.mosuedownY - e.clientY) > 3
      ) {
        this.hide()
        return
      }
      this.show2(e)
    },

    show2(e) {
      this.type = 'svg'
      this.isShow = true
      this.$nextTick(() => {
        const { x, y } = this.getShowPosition(e.clientX + 10, e.clientY + 10)
        this.left = x
        this.top = y
      })
    },

    hide() {
      this.isShow = false
      this.left = -9999
      this.top = -9999
      this.type = ''
      this.node = ''
      this.numberType = ''
      this.numberLevel = ''
      if (this.$refs.nodeFeatures) this.$refs.nodeFeatures.closeAll()
    },

    exec(key, disabled, ...args) {
      if (disabled) {
        return
      }
      switch (key) {
        case 'COPY_NODE':
          this.mindMap.renderer.copy()
          break
        case 'CUT_NODE':
          this.mindMap.renderer.cut()
          break
        case 'PASTE_NODE':
          this.mindMap.renderer.paste()
          break
        case 'RETURN_CENTER':
          this.mindMap.renderer.setRootNodeCenter()
          break
        case 'TOGGLE_ZEN_MODE':
          this.setLocalConfig({
            isZenMode: !this.isZenMode
          })
          break
        case 'FIT_CANVAS':
          this.mindMap.view.fit()
          break
        case 'REMOVE_HYPERLINK':
          this.$root.$bus.$emit('remove_node_hyperlink', this.node)
          break
        case 'REMOVE_NOTE':
          this.node.setNote('')
          break
        case 'EXPORT_CUR_NODE_TO_PNG':
          this.mindMap.export(
            'png',
            true,
            getTextFromHtml(this.node.getData('text')),
            false,
            this.node
          )
          break
        case 'UNEXPAND_ALL':
          const uid = this.node ? this.node.uid : ''
          this.$root.$bus.$emit('execCommand', key, !uid, uid)
          break
        case 'EXPAND_ALL':
          this.$root.$bus.$emit(
            'execCommand',
            key,
            this.node ? this.node.uid : ''
          )
          break
        case 'REMOVE_NODE_CUSTOM_TEXT_WIDTH':
          this.mindMap.execCommand('SET_NODE_DATA', this.node, {
            customTextWidth: undefined
          })
          break
        case 'COPY_TO_OB_LINK':
          const link = this.$root.$obsidianAPI.getObInternalLink()
          copy(link)
          this.$root.$obsidianAPI.showTip(this.$t('contextmenu.copySuccess'))
          break
        case 'COPY_NODE_TO_OB_LINK':
          const link2 = this.$root.$obsidianAPI.getObInternalLink(
            '#^' + this.node.getData('uid')
          )
          copy(link2)
          this.$root.$obsidianAPI.showTip(this.$t('contextmenu.copySuccess'))
          break
        default:
          this.$root.$bus.$emit('execCommand', key, ...args)
          break
      }
      this.hide()
    },

    toggleTodo() {
      this.$root.$bus.$emit(
        'execCommand',
        'SET_CHECKBOX',
        [this.node],
        this.hasCheckbox ? null : { done: false }
      )
      this.hide()
    },

    setTodoDone(done) {
      this.$root.$bus.$emit('execCommand', 'SET_CHECKBOX', [this.node], { done })
      this.hide()
    },

    setChildrenTodo(action) {
      this.$root.$bus.$emit('execCommand', 'SET_CHILDREN_TODO', [this.node], action)
      this.hide()
    },

    setNodeNumber(type, level) {
      const value = type === '' ? null : {
        type,
        level: level === undefined
          ? this.numberLevel === ''
            ? 1
            : this.numberLevel
          : level
      }
      this.$root.$bus.$emit('execCommand', 'SET_NUMBER', [this.node], value)
      this.hide()
    },

    setParagraphNumber(type) {
      this.$root.$bus.$emit('execCommand', 'SET_NODE_TEXT_NUMBER', [this.node], type)
      this.hide()
    },

    openDescriptionDialog() {
      if (this.$refs.nodeFeatures) this.$refs.nodeFeatures.openDescriptionDialog()
    },

    toggleHideText() {
      this.$root.$bus.$emit(
        'execCommand',
        'SET_NODE_HIDE_TEXT',
        [this.node],
        !this.isTextHidden
      )
      this.hide()
    },

    openCalloutDialog() {
      if (this.$refs.nodeFeatures) this.$refs.nodeFeatures.openCalloutDialog()
    },

    removeCallout() {
      this.$root.$bus.$emit('execCommand', 'REMOVE_CHAT_DIALOG', [this.node])
      this.hide()
    },

    openNotationDialog() {
      if (this.$refs.nodeFeatures) this.$refs.nodeFeatures.openNotationDialog()
    },

    removeNotation() {
      this.$root.$bus.$emit('execCommand', 'SET_NOTATION', [this.node], false, {})
      this.hide()
    },

    openNodeLinkDialog() {
      if (this.$refs.nodeFeatures) this.$refs.nodeFeatures.openNodeLinkDialog()
    },

    jumpToNodeLink() {
      if (!this.node) return
      const targetUid = this.node.getData('nodeLink')
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
      if (!targetUid || (!target && !targetData)) {
        this.onNodeLinkNotFind(this.node, targetUid)
        this.hide()
        return
      }
      this.mindMap.execCommand('GO_TARGET_NODE', targetUid)
      this.hide()
    },

    removeNodeLink() {
      this.$root.$bus.$emit('execCommand', 'SET_NODE_LINK', [this.node], null, false)
      this.hide()
    },

    searchOnNode() {
      if (!this.node) return
      this.$root.$bus.$emit('show_search', this.node)
      this.hide()
    },

    toggleLines() {
      if (!this.canToggleLines) return
      this.linesHidden = !this.linesHidden
      this.mindMap.associativeLine.setLinesVisibility(!this.linesHidden)
      this.hide()
    },

    async copyCurNodeAsPng() {
      try {
        const res = await this.mindMap.export(
          'png',
          false,
          getTextFromHtml(this.node.getData('text')),
          false,
          this.node
        )
        const blob = await imgToDataUrl(res, true)
        setImgToClipboard(blob)
        this.$root.$obsidianAPI.showTip(this.$t('contextmenu.copySuccess'))
        this.hide()
      } catch (error) {
        this.$root.$obsidianAPI.showTip(this.$t('contextmenu.copyFail'))
      }
    },

    copyNodeToTxt() {
      const text = txt.toTxt(
        copyNodeTree({
          tree: {},
          root: this.node,
          removeActiveState: true
        })
      )
      if (text) {
        if (this.enableCopyToClipboardApi) {
          setDataToClipboard(text)
        } else {
          copy(text)
        }
      }
      this.hide()
    },

    async copyToClipboard(type) {
      try {
        this.hide()
        let data
        let str
        switch (type) {
          case 'smm':
          case 'json':
            data = this.mindMap.getData(true)
            str = JSON.stringify(data)
            break
          case 'md':
            const {
              nodeTextToMarkdownTitleMaxLevel
            } = this.$root.$obsidianAPI.getSettings()
            data = this.mindMap.getData()
            str = transformToMarkdown(data, nodeTextToMarkdownTitleMaxLevel)
            break
          case 'txt':
            data = this.mindMap.getData()
            str = txt.toTxt(data)
            break
          case 'png':
            const png = await this.mindMap.export('png', false)
            const blob = await imgToDataUrl(png, true)
            setImgToClipboard(blob)
            break
          default:
            break
        }
        if (str) {
          if (this.enableCopyToClipboardApi) {
            setDataToClipboard(str)
          } else {
            copy(str)
          }
        }
        this.$root.$obsidianAPI.showTip(this.$t('contextmenu.copySuccess'))
      } catch (error) {
        this.$root.$obsidianAPI.showTip(this.$t('contextmenu.copyFail'))
      }
    },

    aiCreate() {
      this.$root.$bus.$emit('ai_create_part', this.node)
      this.hide()
    },

    selectNodes(type) {
      if (type === 'all') {
        this.mindMap.execCommand('SELECT_ALL')
      } else if (type === 'second') {
        this.mindMap.execCommand('SELECT_ONE_LEVEL', 2)
      } else if (type === 'third') {
        this.mindMap.execCommand('SELECT_ONE_LEVEL', 3)
      } else if (type === 'brother') {
        this.mindMap.execCommand('SELECT_ONE_LEVEL', this.node.layerIndex + 1)
      } else if (type === 'selfAll') {
        this.mindMap.execCommand('SELECT_SELF_AND_CHILDREN')
      } else if (type === 'children') {
        this.mindMap.execCommand('SELECT_CHILDREN')
      }
      this.hide()
    }
  }
}
</script>

<style lang="less" scoped>
.contextmenuListBox {
  background: #fff;
  box-shadow: 0 4px 12px 0 hsla(0, 0%, 69%, 0.5);
  border-radius: 4px;
  padding-top: 16px;
  padding-bottom: 16px;

  &.isDark {
    background: #363b3f;
  }

  &.subItems {
    width: 250px;
  }
}
.listBox {
  width: 250px;
  background: #fff;
  box-shadow: 0 4px 12px 0 hsla(0, 0%, 69%, 0.5);
  border-radius: 4px;
  padding-top: 16px;
  padding-bottom: 16px;

  &.isDark {
    background: #363b3f;
  }
}
.contextmenuContainer {
  position: absolute;
  max-height: calc(100vh - 20px);
  overflow-y: auto;
  font-size: 14px;
  font-family: PingFangSC-Regular, PingFang SC;
  font-weight: 400;
  color: #1a1a1a;
  z-index: 2;

  &.isMobile {
    overflow-y: auto;

    .item {
      &.withSubItems {
        width: 100%;
        flex-direction: column;
        min-height: 28px;
        height: max-content;
      }

      .subItems {
        margin: 10px 0;
        margin-left: auto;
        width: 90%;
        position: static;
        visibility: visible;
        background-color: transparent;
        box-shadow: none;
        border-radius: 0;
        border-left: 2px solid #999;
        padding: 0;
      }
    }
  }

  &.isDark {
    color: #fff;

    .item {
      &:hover {
        background: hsla(0, 0%, 100%, 0.05);
      }
    }
  }

  .splitLine {
    width: 95%;
    height: 1px;
    background-color: #e9edf2;
    margin: 2px auto;
  }

  .item {
    position: relative;
    height: 28px;
    padding: 0 16px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;

    &.danger {
      color: #f56c6c;
    }

    &:hover {
      background: #f5f5f5;

      .subItems {
        visibility: visible;
      }
    }

    &.disabled {
      color: grey;
      cursor: not-allowed;
      pointer-events: none;

      &:hover {
        background: #fff;
      }
    }

    .itemRow {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .desc {
      color: #999;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: none;
    }

    .subItems {
      position: absolute;
      left: 100%;
      visibility: hidden;
      width: 150px;
      cursor: auto;

      &.showLeft {
        left: -150px;
      }
    }
  }
}

.featureMenu {
  width: 230px !important;

  &.numberMenu {
    width: 210px !important;
  }
}
</style>
