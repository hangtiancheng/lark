<script setup lang="ts">
import { useTabStore } from '@/stores/tab'
import { storeToRefs } from 'pinia'
import { ElTabs, ElTabPane, type TabsPaneContext, type TabPaneName } from 'element-plus'

import { name2icon } from '@/utils/icons'
import { useRoute, useRouter } from 'vue-router'
import { onBeforeMount, ref, watch } from 'vue'

const tabStore = useTabStore()
// actions 可以直接解构, 不需要 storeToRefs
// state, getters 不可以直接解构, 需要 storeToRefs
const { tabList } = storeToRefs(tabStore)
const router = useRouter()

const handleClick = (tab: TabsPaneContext) => {
  const { name: url } = tab.props
  // Number.parseInt('') === NaN
  router.push(url as string)
}

const handleRemove = (url: TabPaneName) => {
  const idx = tabStore.findTab(url as string)
  tabStore.removeTab(idx)
  if (tabList.value.length === 0) {
    router.push({ name: 'Home' })
    return
  }
  if (tabList.value.length === idx) {
    router.push(tabList.value[idx - 1].url)
    return
  }
  router.push(tabList.value[idx].url)
}

const route = useRoute()
const isAlive = ref<boolean>(false)
const handleWindowClick = () => (isAlive.value = false)
watch(
  () => isAlive.value,
  () => {
    if (isAlive.value) {
      window.addEventListener('click', handleWindowClick)
    } else {
      window.removeEventListener('click', handleWindowClick)
    }
  },
)
onBeforeMount(() => window.removeEventListener('click', handleWindowClick))

const ctxMenuX = ref<string>('0px')
const ctxMenuY = ref<string>('0px')
const handleCtxMenu = (ev: MouseEvent) => {
  if (tabList.value.length === 0) {
    return
  }
  ctxMenuX.value = `${ev.pageX}px`
  ctxMenuY.value = `${ev.pageY}px`
  isAlive.value = true
}

const removeAll = () => {
  tabList.value = []
  router.push({ name: 'Home' })
}
</script>

<template>
  <div>
    <!-- v-model="route.path" -->
    <ElTabs
      :model-value="route.path"
      class="tab-container"
      @tab-click="handleClick"
      type="card"
      closable
      @tab-remove="handleRemove"
      @contextmenu.prevent="handleCtxMenu"
    >
      <ElTabPane
        v-for="{ name, icon, url } of tabList"
        :key="url"
        :label="name"
        :name="url"
        class="rounded-lg"
      >
        <template #label>
          <div class="flex items-center gap-1.25">
            <component :is="name2icon.get(icon)"></component>
            <span>{{ name }}</span>
          </div>
        </template>

        <!--! 这里有 v-for, <RouterView> 不能写在这里
      否则打开多个页面时, 有多个 <RouterView>, 同一个页面会被挂载多次
      -->
        <!-- <RouterView></RouterView> -->
      </ElTabPane>
    </ElTabs>

    <Transition
      enter-active-class="animate__animated animate__flipInX"
      leave-active-class="animate__animated animate__flipOutX"
    >
      <ul
        class="ctx-menu fixed z-10 rounded-lg bg-slate-100 text-slate-500 shadow-lg"
        v-if="isAlive"
      >
        <li>选择关闭方式</li>
        <li><hr /></li>
        <li @click="removeAll">关闭所有标签页</li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.tab-container {
  :deep(.is-active) {
    background-color: var(--color-green) !important;
    color: #fff !important;
  }
}

:deep(.el-tabs__item) {
  &:hover {
    color: #000 !important;
  }
}

.ctx-menu {
  left: v-bind(ctxMenuX);
  top: v-bind(ctxMenuY);
  li {
    border-radius: 8px;
    cursor: pointer;
    padding: 5px 8px;
    &:hover {
      background-color: var(--color-green-light);
    }
  }
}

:deep(.el-tabs__nav),
:deep(.el-tabs__item) {
  border-radius: 20px !important;
}
:deep(.is-icon-close) {
  transform: scale(1.5) !important;
  margin-left: 10px;
  &:hover {
    background-color: var(--color-1st);
  }
}
</style>
