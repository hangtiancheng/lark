<script setup lang="ts">
import MapContainer from '@/components/map/map-container.vue'
import { ElRow, ElCol, ElCard, type CascaderOption } from 'element-plus'
import { reactive, ref } from 'vue'
import { ROBOT_STATES, ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'

import { fetchLocation } from '@/utils/fetch-location'
import { AddOne, CloseOne, CheckOne } from '@icon-park/vue-next'
import type { IRobotItem } from '@/types/robot'
import bus from '@/utils/bus'
import { robotAddApi } from '@/apis'
import { fakerZH_CN as faker } from '@faker-js/faker'

const addressOptions: CascaderOption[] = Array.from({
  length: faker.number.int({ min: 5, max: 10 }),
}).map(() => {
  const province = faker.location.state()
  return {
    value: province,
    label: province,
    children: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }).map(() => {
      const city = faker.location.city()
      return {
        value: city,
        label: city,
      }
    }),
  }
})
const addressList = ref([])

const stateCounts = ref<number[] & { length: 6 }>([0, 0, 0, 0, 0, 0])
const minMaxAvg = ref<[number, number, number]>([0, 0, 0])
const handleStatData = (
  stateCounts_: number[] & { length: 6 },
  minMaxAvg_: [number, number, number],
) => {
  stateCounts.value = stateCounts_
  minMaxAvg.value = minMaxAvg_
}

const fixedDisabled = ref(true)

const addrLatLng: [addr: string, lat: number, lng: number] = ['', 0, 0] as const

const handleChange = async () => {
  addrLatLng[0] = addressList.value.join('')
  ;[addrLatLng[1], addrLatLng[2]] = await fetchLocation(addrLatLng[0])
}

const formData = reactive<Omit<IRobotItem, 'id' | 'address'>>({
  name: '',
  state: 1,
  failureNum: 0,
  admin: '',
  email: '',
})

const resetFormData = () => {
  formData.name = ''
  formData.state = 1
  formData.failureNum = 0
  formData.admin = ''
  formData.email = ''
}

const handleClick = () => {
  fixedDisabled.value = !fixedDisabled.value
}

const handleClose = () => {
  fixedDisabled.value = !fixedDisabled.value
  resetFormData()
}
// 是否持久化
const persistent = ref(false)

const handleSubmit = async () => {
  if (
    formData.name.length === 0 ||
    formData.state === undefined ||
    formData.admin.length === 0 ||
    formData.email.length === 0
  ) {
    return
  }
  bus.publish('add-marker', {
    lat: addrLatLng[1],
    lng: addrLatLng[2],
    address: addrLatLng[0],
    ...formData,
  })
  if (!persistent.value) {
    resetFormData()
    return
  }
  await robotAddApi({
    lat: addrLatLng[1],
    lng: addrLatLng[2],
    address: addrLatLng[0],
    ...formData,
  })
  resetFormData()
}
</script>

<template>
  <main>
    <ElRow :gutter="20">
      <ElCol :span="18">
        <ElCard class="rounded-3xl!">
          <MapContainer @stat-data="handleStatData"></MapContainer>
        </ElCard>
      </ElCol>
      <ElCol :span="6">
        <ElCard class="truncate rounded-3xl! leading-7.5">
          <template #header>
            <h1 class="text-[20px]">统计数据</h1>
          </template>
          <p>机器人数量: {{ stateCounts[0] }}</p>
          <p>闲置机器人数量: {{ stateCounts[1] }}</p>
          <p>使用机器人数量: {{ stateCounts[2] }}</p>
          <p>故障机器人数量: {{ stateCounts[3] }}</p>
          <p>维修机器人数量: {{ stateCounts[4] }}</p>
          <p>报废机器人数量: {{ stateCounts[5] }}</p>
          <p>零件故障数最小值: {{ minMaxAvg[0] }}</p>
          <p>零件故障数最大值: {{ minMaxAvg[1] }}</p>
          <p>零件故障数平均值: {{ minMaxAvg[2] }}</p>
        </ElCard>

        <!-- <Teleport to="body" :disabled="fixedDisabled"> -->
        <ElCard
          class="mt-5 rounded-3xl! duration-700!"
          :class="fixedDisabled ? 'hover:scale-110' : 'fixed-enabled'"
        >
          <template #header>
            <div v-if="fixedDisabled" class="flex justify-between text-[20px]">
              <h1 @click="handleClick" class="cursor-pointer">放大新增地图标记窗口</h1>
            </div>

            <div v-else class="flex justify-between text-[20px]">
              <h1 @click="handleClick" class="cursor-pointer">缩小新增地图标记窗口</h1>
              <div class="flex justify-center gap-2.5">
                <!-- 点击以提交表单 -->
                <CheckOne
                  theme="filled"
                  size="24"
                  fill="#7ed321"
                  :strokeWidth="3"
                  class="cursor-pointer duration-500 hover:scale-150"
                  @click="handleSubmit"
                />
                <!-- 点击以清空表单 -->
                <CloseOne
                  theme="filled"
                  size="24"
                  fill="#fb2c36"
                  :strokeWidth="3"
                  class="cursor-pointer duration-500 hover:scale-150"
                  @click="handleClose"
                />
              </div>
            </div>
          </template>

          <template v-if="fixedDisabled">
            <div class="flex items-center justify-center">
              <AddOne
                theme="filled"
                size="48"
                fill="#b8e986"
                :strokeWidth="3"
                class="cursor-pointer"
                @click="handleClick"
              />
            </div>
          </template>

          <template v-else>
            <div class="overflow-hidden">
              是否持久化
              <ElSwitch v-model="persistent" class="ml-2.5"></ElSwitch>

              <ElCascaderPanel
                :options="addressOptions"
                v-model="addressList"
                @change="handleChange"
                class="mt-2.5 rounded-lg!"
              >
              </ElCascaderPanel>

              <ElForm class="pt-5">
                <ElFormItem label="机器人名字" prop="name">
                  <ElInput placeholder="请输入机器人名字" v-model="formData.name"></ElInput>
                </ElFormItem>

                <ElFormItem label="机器人状态" prop="state">
                  <ElSelect placeholder="请选择机器人状态" v-model="formData.state">
                    <ElOption
                      v-for="(state, idx) of ROBOT_STATES.slice(1)"
                      :key="state"
                      :value="idx + 1"
                      :label="state"
                    >
                      <ElTag size="large" :type="ROBOT_STATE_2_TEXT_AND_TYPE.get(idx + 1)?.type">
                        {{ state }}
                      </ElTag>
                    </ElOption>
                  </ElSelect>
                </ElFormItem>

                <ElFormItem label="零件故障数" prop="failureNum">
                  <!-- <ElInputNumber
                    placeholder="请输入零件故障数"
                    :min="0"
                    :max="100"
                    controls-position="right"
                    v-model="formData.failureNum"
                  /> -->
                  <ElSlider class="mx-5" v-model="formData.failureNum" :min="0" :max="100" />
                </ElFormItem>

                <ElFormItem label="管理员名字" prop="admin">
                  <ElInput placeholder="请输入管理员名字" v-model="formData.admin"></ElInput>
                </ElFormItem>

                <ElFormItem label="管理员邮箱" prop="email">
                  <ElInput placeholder="请输入管理员邮箱" v-model="formData.email"></ElInput>
                </ElFormItem>
              </ElForm>
            </div>
          </template>
        </ElCard>
        <!-- </Teleport> -->
      </ElCol>
    </ElRow>
  </main>
</template>

<style scoped lang="scss">
// 后代选择器 空格
// 子代选择器 >
// 邻接兄弟选择器 +
// 通用兄弟选择器 ~
.fixed-enabled {
  position: fixed;
  // left: 0;
  // top: 0;
  width: 400px;
  height: 600px;
  z-index: 10;
  transform: translate(-444px, -444px);
}
</style>
