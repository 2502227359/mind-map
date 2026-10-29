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
      layoutNames: { rightFishbone: '右鱼骨', rightFishbone2: '右鱼骨 2', table: '表格' },
      layout: ''
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
  methods: {
    useLayout(layout) {
      const selected = this.mindMap.renderer.activeNodeList
      if (selected.length && selected.some(node => {
        while (node.parent) node = node.parent
        return node !== this.mindMap.renderer.root
      })) {
        this.mindMap.execCommand('SET_FREE_NODE_TREE_LAYOUT', selected, layout)
        this.layout = layout
        return
      }
      this.layout = layout
      this.mindMap.setLayout(layout)
      this.$root.$bus.$emit('storeData', {
        layout
      })
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
</style>
