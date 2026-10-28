<template>
  <div class="smm-obsidian-root" :class="{ isDark: isDark }">
    <Toolbar v-if="!isZenMode" :obsidian="true"></Toolbar>
    <Edit ref="editor" :obsidian="true" :core-mode="true"></Edit>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import Toolbar from '@/pages/Edit/components/Toolbar.vue'
import Edit from '@/pages/Edit/components/Edit.vue'

export default {
  name: 'ObsidianEditor',
  components: {
    Toolbar,
    Edit
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark,
      isZenMode: state => state.localConfig.isZenMode
    })
  }
}
</script>

<style lang="less">
.smm-obsidian-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--text-normal, #1a1a1a);
  font-family: var(--font-text, sans-serif);

  &.isDark {
    color: var(--text-normal, #fff);

    .el-button,
    .el-input__inner {
      background-color: #363b3f;
      border-color: hsla(0, 0%, 100%, 0.1);
      color: hsla(0, 0%, 100%, 0.9);
    }

    .el-dialog,
    .el-popper {
      background-color: #262a2e;
      border-color: hsla(0, 0%, 100%, 0.1);
    }

    .el-dialog__title,
    .el-dialog__body {
      color: hsla(0, 0%, 100%, 0.9);
    }
  }

  .editContainer {
    position: absolute;
    inset: 0;
  }

  .mindMapContainer {
    position: absolute;
    inset: 0;
  }

  .toolbarContainer .toolbar {
    position: absolute !important;
    top: 12px !important;
  }

  .navigatorContainer,
  .searchContainer {
    position: absolute !important;
  }

  .sidebarContainer {
    position: absolute;
    top: 72px;
    bottom: 0;
  }

  .sidebarTriggerContainer {
    position: absolute;
    top: 72px;
    bottom: 20px;
  }

  .contextmenuContainer,
  .countContainer,
  .noteContentViewer,
  .nodeIconToolbar,
  .nodeImgPlacementToolbar,
  .nodeTagStyleContainer,
  .richTextToolbar,
  .outlineEditContainer {
    position: absolute;
  }
}
</style>
