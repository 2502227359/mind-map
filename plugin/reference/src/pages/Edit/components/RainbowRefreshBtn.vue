<template>
  <div
    v-if="show"
    class="rainbowRefreshBtn"
    :class="{ isDark: isDark }"
    :aria-label="$t('baseStyle.rainbowLines')"
    data-tooltip-position="left"
    @click.stop="refresh"
  >
    <span class="el-icon-refresh"></span>
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
      show: false
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark,
      isReadonly: state => state.isReadonly
    })
  },
  created() {
    this.mindMap.on('data_change', this.updateVisibility)
    this.mindMap.on('view_theme_change', this.updateVisibility)
    this.$root.$bus.$on('setData', this.updateVisibility)
    this.$root.$bus.$on('storeData', this.updateVisibility)
    this.$root.$bus.$on('toggleReadonly', this.updateVisibility)
    this.updateVisibility()
  },
  beforeDestroy() {
    this.mindMap.off('data_change', this.updateVisibility)
    this.mindMap.off('view_theme_change', this.updateVisibility)
    this.$root.$bus.$off('setData', this.updateVisibility)
    this.$root.$bus.$off('storeData', this.updateVisibility)
    this.$root.$bus.$off('toggleReadonly', this.updateVisibility)
  },
  methods: {
    updateVisibility() {
      const theme = this.mindMap.getThemeConfig?.() || {}
      const rainbow = this.mindMap.opt?.rainbowLinesConfig || {}
      this.show = !this.isReadonly && Boolean(theme.lineRainbow || rainbow.open)
    },

    refresh() {
      const rainbowLines = this.mindMap.rainbowLines
      if (typeof rainbowLines?.updateRainLinesRender === 'function') {
        rainbowLines.updateRainLinesRender()
      } else {
        this.mindMap.render()
      }
      this.show = false
    }
  }
}
</script>

<style lang="less" scoped>
.rainbowRefreshBtn {
  position: absolute;
  right: 20px;
  bottom: 70px;
  width: 30px;
  height: 30px;
  z-index: 1999;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #606266;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  cursor: pointer;

  &.isDark {
    color: #fff;
    background: #363b3f;
  }

  &:hover {
    color: var(--text-accent, #7b61ff);
  }
}
</style>
