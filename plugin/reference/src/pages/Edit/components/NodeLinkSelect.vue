<template>
  <div class="nodeLinkSelect" :class="{ isDark: isDark }">
    <el-input
      v-model="filterText"
      size="small"
      clearable
      prefix-icon="el-icon-search"
      placeholder="搜索节点名称或 UID"
      @keyup.native.stop
      @keydown.native.stop
    ></el-input>
    <div class="nodeLinkTree" v-if="treeData.length">
      <el-tree
        ref="tree"
        :data="treeData"
        node-key="uid"
        :props="treeProps"
        :filter-node-method="filterNode"
        highlight-current
        :expand-on-click-node="false"
        :default-expand-all="false"
        @node-click="selectNode"
      >
        <span slot-scope="{ data }" class="nodeLinkTreeNode">
          <span class="nodeLinkTreeLabel" :title="data.uid" :style="{ opacity: data.disabled ? 0.45 : 1 }">{{ data.label }}{{ data.disabled ? '（当前节点）' : '' }}</span>
          <span class="nodeLinkTreeUid">{{ data.uid }}</span>
        </span>
      </el-tree>
    </div>
    <div v-else class="nodeLinkEmpty">没有可跳转的节点</div>
  </div>
</template>

<script>
import { buildNodeLinkTree, filterNodeLinkTree } from './nodeLinkTree'

export default {
  props: {
    mindMap: {
      type: Object,
      required: true
    },
    value: {
      type: String,
      default: ''
    },
    excludeUid: {
      type: String,
      default: ''
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      treeData: [],
      filterText: '',
      treeProps: {
        label: 'label',
        children: 'children',
        disabled: 'disabled'
      }
    }
  },
  watch: {
    mindMap: {
      handler() {
        this.refresh()
      },
      immediate: true
    },
    excludeUid() {
      this.refresh()
    },
    value(value) {
      this.setCurrentKey(value)
    },
    filterText(value) {
      if (this.$refs.tree) this.$refs.tree.filter(value)
    }
  },
  methods: {
    refresh() {
      this.treeData = buildNodeLinkTree(
        this.mindMap && this.mindMap.renderer,
        this.excludeUid
      )
      this.$nextTick(() => {
        if (this.$refs.tree) {
          this.$refs.tree.filter(this.filterText)
          this.setCurrentKey(this.value)
        }
      })
    },

    setCurrentKey(value) {
      if (!this.$refs.tree) return
      this.$refs.tree.setCurrentKey(value || null)
    },

    filterNode(value, data) {
      return filterNodeLinkTree(value, data)
    },

    selectNode(data) {
      if (!data) return
      if (data.disabled) {
        this.setCurrentKey(this.value)
        return
      }
      this.$emit('input', data.uid)
      this.$emit('change', data.uid)
    }
  }
}
</script>

<style lang="less" scoped>
.nodeLinkSelect {
  .nodeLinkTree {
    max-height: 220px;
    margin-top: 8px;
    overflow-y: auto;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    padding: 4px 0;
  }

  .nodeLinkTreeNode {
    display: flex;
    align-items: center;
    min-width: 0;
    width: 100%;
    line-height: 24px;
  }

  .nodeLinkTreeLabel {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nodeLinkTreeUid {
    flex: 0 0 auto;
    margin-left: 6px;
    color: #909399;
    font-size: 11px;
  }

  .nodeLinkEmpty {
    margin-top: 8px;
    padding: 12px;
    color: #909399;
    text-align: center;
    border: 1px dashed #dcdfe6;
    border-radius: 4px;
  }

  &.isDark {
    .nodeLinkTree {
      border-color: hsla(0, 0%, 100%, 0.12);
    }

    .nodeLinkEmpty,
    .nodeLinkTreeUid {
      color: hsla(0, 0%, 100%, 0.55);
    }
  }
}
</style>
