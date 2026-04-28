<script setup lang="ts">
import { Remind, User, Power } from '@icon-park/vue-next'
import { ElBadge, ElDropdown, ElDropdownMenu, ElDropdownItem, ElSwitch } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { onBeforeUnmount, ref } from 'vue'
import HeaderTabs from './header-tabs.vue'

const userStore = useUserStore()
const { username } = storeToRefs(userStore)
const router = useRouter()
const isAlive = ref(false)

const emit = defineEmits<{
  (ev: 'switchWatermark', isAlive: boolean): void
}>()

// const emit = defineEmits<{
//   switchWatermark: [isAlive: boolean]
// }>()

const animated = ref<boolean>(false)
let timer: number | null = null

// 资源清理
onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
})

/**
 * @description 节流 throttle
 */
const handleClick = () => {
  if (timer) {
    return
  }
  animated.value = true
  timer = setTimeout(() => {
    animated.value = false
    timer = null
  }, 1000)
}

const enum Command {
  User = 'user',
  Logout = 'Logout',
}

const handleCommand = async (command: Command) => {
  switch (command) {
    case Command.User:
      // router.push({ name: 'User' })
      break

    case Command.Logout:
      userStore.logout()
      router.replace({ name: 'Login' })
  }
}
</script>

<template>
  <main class="mt-2.5">
    <div class="flex flex-row-reverse items-center">
      <div class="mr-5 flex gap-5">
        <ElSwitch
          v-model="isAlive"
          inline-prompt
          style="--el-switch-on-color: var(--color-green); --el-switch-off-color: var(--color-1st)"
          active-text="水印开"
          inactive-text="水印关"
          @change="emit('switchWatermark', isAlive)"
        />

        <ElBadge
          :is-dot="true"
          class="mt-1.25 cursor-pointer duration-1000"
          :class="{ animate__animated: animated, animate__swing: animated }"
          ><Remind theme="filled" size="25" fill="#b8e986" :strokeWidth="3" @click="handleClick"
        /></ElBadge>

        <ElDropdown @command="handleCommand">
          <span class="cursor-pointer text-lg outline-none"> 欢迎: {{ username }} </span>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem :icon="User" :command="Command.User">我的账号</ElDropdownItem>
              <ElDropdownItem :icon="Power" :command="Command.Logout">退出登录</ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </div>
    </div>

    <HeaderTabs></HeaderTabs>
  </main>
</template>
