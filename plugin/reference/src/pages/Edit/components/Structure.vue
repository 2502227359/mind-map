<template>
  <Sidebar ref="sidebar" :title="$t('strusture.title')">
    <div class="layoutGroupList" :class="{ isDark: isDark }">
      <div
        class="laytouGroup"
        v-for="group in layoutGroupList"
        :key="group.name"
      >
        <div class="groupName">{{ group.name }}</div>
        <div class="layoutList">
          <div
            class="layoutItem"
            v-for="item in group.list"
            :key="item"
            @click="useLayout(item)"
            :class="{ active: item === layout }"
          >
            <img v-if="layoutImgMap[item]" :src="layoutImgMap[item]" :alt="layoutNames[item] || item" :class="{ mirror: item.startsWith('rightFishbone') }" />
            <span v-else class="tablePreview">▦</span>
            <span class="layoutLabel">{{ layoutNames[item] || '' }}</span>
          </div>
        </div>
      </div>
    </div>
    <el-dialog
      class="freeLayoutDialog smmElDialog"
      :class="{ isDark: isDark }"
      title="游离树布局"
      :visible.sync="freeLayoutDialogVisible"
      width="360px"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
    >
      <div class="freeLayoutHint">
        当前选中的是游离树。可单独设置布局，也可以跟随主结构布局。
      </div>
      <el-radio-group v-model="freeLayoutMode">
        <el-radio label="layout">独立布局</el-radio>
        <el-radio label="main">跟随主结构</el-radio>
      </el-radio-group>
      <el-select
        v-if="freeLayoutMode === 'layout'"
        v-model="pendingFreeLayout"
        size="small"
        style="width: 100%; margin-top: 14px;"
      >
        <el-option
          v-for="item in freeLayoutOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        ></el-option>
      </el-select>
      <span slot="footer" class="dialog-footer">
        <el-button size="small" @click="freeLayoutDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirmFreeLayout">确定</el-button>
      </span>
    </el-dialog>
  </Sidebar>
</template>

<script>
import Sidebar from './Sidebar.vue'
import { mapState } from 'vuex'
import { layoutImgMap } from '@/config/constant.js'
import { layoutGroupList } from '@/config'

export default {
  components: {
    Sidebar
  },
  props: {
    mindMap: {
      type: Object
    }
  },
  data() {
    return {
      layoutImgMap,
      layoutNames: {
        logicalStructure: '逻辑结构图',
        logicalStructureLeft: '逻辑结构图（左）',
        mindMap: '思维导图',
        organizationStructure: '组织结构图',
        catalogOrganization: '目录组织图',
        timeline: '时间轴',
        timeline2: '时间轴 2',
        verticalTimeline: '垂直时间轴',
        verticalTimeline2: '垂直时间轴 2',
        verticalTimeline3: '垂直时间轴 3',
        fishbone: '鱼骨图',
        fishbone2: '鱼骨图 2',
        rightFishbone: '右鱼骨',
        rightFishbone2: '右鱼骨 2',
        table: '表格'
      },
      layout: '',
      freeLayoutDialogVisible: false,
      freeLayoutMode: 'layout',
      pendingFreeLayout: '',
      freeSelectedNodes: []
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark,
      activeSidebar: state => state.activeSidebar
    }),

    layoutGroupList() {
      const groupList = layoutGroupList[this.$i18n.locale] || layoutGroupList.en
      const groups = groupList.map(group => {
        return {
          name: group.name,
          list: group.list.includes('fishbone') ? [...group.list, 'rightFishbone', 'rightFishbone2'] : [...group.list]
        }
      })
      return [...groups, { name: '表格', list: ['table'] }]
    },

    freeLayoutOptions() {
      const options = []
      this.layoutGroupList.forEach(group => {
        group.list.forEach(value => {
          if (!options.some(item => item.value === value)) {
            options.push({ value, label: this.layoutNames[value] || value })
          }
        })
      })
      return options
    }
  },
  watch: {
    activeSidebar(val) {
      if (val === 'structure') {
        let node = this.mindMap.renderer.activeNodeList[0]
        while (node?.parent) node = node.parent
        this.layout = node && node !== this.mindMap.renderer.root
          ? node.getData('layout') || this.mindMap.getLayout()
          : this.mindMap.getLayout()
        this.$refs.sidebar.show = true
      } else {
        this.$refs.sidebar.show = false
      }
    }
  },
  mounted() {
    this.$root.$bus.$on('show_change_freenodetree_layout', this.openFreeLayout)
  },
  beforeDestroy() {
    this.$root.$bus.$off('show_change_freenodetree_layout', this.openFreeLayout)
  },
  methods: {
    openFreeLayout(nodes) {
      if (this.mindMap.opt.readonly) return
      const free = (nodes || []).filter(node => {
        if (!node) return false
        while (node.parent) node = node.parent
        return node !== this.mindMap.renderer.root
      })
      if (!free.length) {
        this.$root.$obsidianAPI.showTip('请选择游离树中的节点')
        return
      }
      this.freeSelectedNodes = free
      let root = free[0]
      while (root.parent) root = root.parent
      this.pendingFreeLayout = root.getData('layout') || this.mindMap.getLayout()
      this.freeLayoutMode = root.getData('layout') ? 'layout' : 'main'
      this.freeLayoutDialogVisible = true
    },
    getSelectedFreeNodes() {
      const renderer = this.mindMap && this.mindMap.renderer
      const root = renderer && renderer.root
      return (renderer && renderer.activeNodeList ? renderer.activeNodeList : []).filter(node => {
        let current = node
        while (current && current.parent) current = current.parent
        return current && current !== root
      })
    },

    useLayout(layout) {
      const selectedFreeNodes = this.getSelectedFreeNodes()
      if (selectedFreeNodes.length) {
        this.freeSelectedNodes = selectedFreeNodes
        this.pendingFreeLayout = layout
        this.freeLayoutMode = 'layout'
        this.freeLayoutDialogVisible = true
        return
      }
      this.layout = layout
      this.mindMap.setLayout(layout)
      this.$root.$bus.$emit('storeData', {
        layout
      })
    },

    confirmFreeLayout() {
      if (!this.freeSelectedNodes.length) {
        this.freeLayoutDialogVisible = false
        return
      }
      const layout = this.freeLayoutMode === 'main' ? null : this.pendingFreeLayout
      this.mindMap.execCommand(
        'SET_FREE_NODE_TREE_LAYOUT',
        this.freeSelectedNodes,
        layout
      )
      this.layout = layout || this.mindMap.getLayout()
      this.freeLayoutDialogVisible = false
      this.freeSelectedNodes = []
    }
  }
}
</script>

<style lang="less" scoped>
.layoutGroupList {
  width: 100%;
  padding: 12px;

  &.isDark {
    .laytouGroup {
      .groupName {
        color: #fff;
      }
    }
  }

  .laytouGroup {
    width: 100%;
    margin-bottom: 12px;

    .groupName {
      font-weight: 500;
      color: #303133;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .layoutList {
      width: 100%;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;

      .layoutItem {
        width: 120px;
        height: 70px;
        cursor: pointer;
        border: 1px solid #e9e9e9;
        transition: all 0.2s;
        overflow: hidden;
        margin-bottom: 12px;
        padding: 5px;
        border-radius: 5px;

        &:hover {
          box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.16),
            0 3px 6px 0 rgba(0, 0, 0, 0.12), 0 5px 12px 4px rgba(0, 0, 0, 0.09);
        }

        &.active {
          border: 1px solid var(--color-accent);
        }

        position: relative;
        .layoutLabel { position: absolute; bottom: 2px; left: 5px; font-size: 11px; background: var(--background-primary); }
        .tablePreview { display: block; font-size: 52px; text-align: center; line-height: 52px; }
        img.mirror { transform: scaleX(-1); }
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }
    }
  }
}

.freeLayoutDialog {
  .freeLayoutHint {
    margin-bottom: 14px;
    color: #606266;
    line-height: 1.6;
  }

  &.isDark .freeLayoutHint {
    color: hsla(0, 0%, 100%, 0.65);
  }
}
</style>
