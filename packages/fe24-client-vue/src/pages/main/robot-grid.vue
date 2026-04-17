<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ElCard, ElSelect } from 'element-plus'
import RobotCard from './components/robot-card.vue'
import { robotQueryApi } from '@/apis'
import type { IRobotItem } from '@/types/robot'
import { computed, onActivated, onDeactivated, onMounted, reactive, ref, watch } from 'vue'
import bus from '@/utils/bus'

const stateId2list = reactive(
  new Map<number, IRobotItem[]>(
    Array.from({
      length: 6,
    })
      .fill({})
      .map((item, idx) => [idx, []]),
  ),
)
const stateId = ref<number>(0) // 响应式
const stateCnt = reactive<number[]>(new Array<number>(6).fill(0)) // 响应式
const totalList = computed(() => stateId2list.get(stateId.value)) // 响应式
const robotList = ref<IRobotItem[]>([]) // 响应式

onMounted(async () => {
  const dataList = (await robotQueryApi({ pageNum: 0, pageSize: -1 })).data.list
  robotList.value = dataList
  stateCnt[0] = dataList.length
  stateId2list.set(0, dataList)
  for (const robot of dataList) {
    stateCnt[robot.state]++
    stateId2list.get(robot.state)!.push(robot)
  }
})

onDeactivated(() => bus.publish('store-scrollTop'))
onActivated(() => bus.publish('set-scrollTop'))

const handleChange = () => {
  checkedName.value = ''
  robotList.value = stateId2list.get(stateId.value)!
}

const checkedName = ref<string>('')
watch(
  () => checkedName.value,
  () => {
    if (!checkedName.value) {
      robotList.value = stateId2list.get(stateId.value)!
      return
    }
    robotList.value = stateId2list
      .get(stateId.value)!
      .filter((robot) => robot.name === checkedName.value)
  },
)
</script>

<template>
  <main>
    <ElCard class="rounded-3xl!">
      <div class="flex flex-col gap-5">
        <ElRadioGroup v-model="stateId" @change="handleChange">
          <ElRadioButton :label="`全部 (${stateCnt[0]})`" :value="0"></ElRadioButton>
          <ElRadioButton :label="`闲置 (${stateCnt[1]})`" :value="1"></ElRadioButton>
          <ElRadioButton :label="`使用 (${stateCnt[2]})`" :value="2"></ElRadioButton>
          <ElRadioButton :label="`故障 (${stateCnt[3]})`" :value="3"></ElRadioButton>
          <ElRadioButton :label="`维修 (${stateCnt[4]})`" :value="4"></ElRadioButton>
          <ElRadioButton :label="`报废 (${stateCnt[5]})`" :value="5"></ElRadioButton>
        </ElRadioGroup>

        <ElSelect
          v-model="checkedName"
          clearable
          filterable
          placeholder="请选择机器人名字"
          class="w-75!"
        >
          <ElOption
            v-for="robot in totalList"
            :key="robot.id"
            :label="robot.name"
            :value="robot.name"
          />
        </ElSelect>
      </div>
    </ElCard>

    <ElCard class="mt-5 rounded-3xl!">
      <!-- flex h-[100%] flex-wrap justify-between gap-y-[20px] -->
      <div class="grid-container">
        <RobotCard
          v-for="robot of robotList"
          :key="robot.id"
          :state-id="robot.state"
          :failure-num="robot.failureNum"
        >
          <template #default>
            <!-- .truncate {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              } -->
            <div>
              <p class="truncate!">机器人名字: {{ robot.name }}</p>
              <p class="truncate!">机器人地址: {{ robot.address }}</p>
              <p class="truncate!">管理员名字: {{ robot.admin }}</p>
              <p class="truncate!">管理员邮箱: {{ robot.email }}</p>
            </div>
          </template>
        </RobotCard>
      </div>
    </ElCard>
  </main>
</template>

<style scoped lang="scss">
.grid-container {
  // 开启网格布局
  display: grid;
  // 各列的列宽
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  // 指定隐式网格的行高
  grid-auto-rows: 250px;
  // 行/列间距
  gap: 10px;
  // 网格项目的水平位置
  justify-items: center;
  // 网格项目的垂直位置
  align-items: center;
}
</style>
