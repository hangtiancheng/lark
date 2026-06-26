<script setup lang="ts">
import type { IOrderItem } from '@/types/order'
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getDate, getTime } from '@/utils'
import type { IRobotItem } from '@/types/robot'
import { orderQueryApi } from '@/apis/order'
import { robotQueryApi } from '@/apis'
import { ElCard, ElDescriptions, ElDescriptionsItem, ElDivider, ElImage, ElTag } from 'element-plus'
import robotSvg from '@/assets/robot.svg'
import { ORDER_STATE_2_TEXT_AND_TYPE, ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'
import { ListNumbers, Order, Time } from '@icon-park/vue-next'

const route = useRoute()
const { orderId, robotId } = route.query

const orderData = ref<IOrderItem>({
  id: '',
  state: 1,
  robotId: 0,
  robotName: '',
  date: getDate(),
})

const robotData = ref<IRobotItem>({
  id: 0,
  state: 1,
  name: '',
  failureNum: 0,
  admin: '',
  email: '',
  address: '',
})

onMounted(async () => {
  if (!orderId || !robotId) {
    return
  }
  try {
    const p1 = orderQueryApi({ id: orderId as string }).then((res) => res.data.list)
    const p2 = robotQueryApi({ id: Number.parseInt(robotId as string) }).then(
      (res) => res.data.list,
    )
    const [orderData_, robotData_] = await Promise.all([p1, p2])
    orderData.value = orderData_[0]
    robotData.value = robotData_[0]
  } catch (err) {
    console.error(err)
  }
})

// const slots = {
//   header: () => <div class="text-[20px]">订单详情</div>,
//   footer: () => <p class="text-slate-500">{`查询时间 ${getDate()} ${getTime()}`}</p>,
// }

if (import.meta.env.DEV) {
  watch(
    () => route.path,
    (newVal, oldVal) => {
      console.log(newVal, '<==', oldVal)
    },
  )
}
</script>

<template>
  <main>
    <ElCard class="rounded-3xl!">
      <!-- v-slot:header, 或 #header -->
      <template v-slot:header>
        <div class="text-[20px]">订单详情</div>
      </template>

      <!-- v-slot:default, 或 v-slot, 或 #default, 或省略默认插槽的 template 标签  -->
      <template v-slot:default>
        <ElCard class="rounded-3xl!">
          <ElDescriptions :title="`订单 ${orderData.id} 详情`" :column="3" border>
            <ElDescriptionsItem align="center">
              <!-- v-slot:label, 或 #label -->
              <template #label>
                <div class="flex items-center justify-center gap-2.5">
                  <ListNumbers theme="outline" size="20" fill="#7ed321" :strokeWidth="3" />
                  订单号
                </div>
              </template>
              <!-- v-slot:default, 或 v-slot, 或 #default, 或省略默认插槽的 template 标签  -->
              <template v-slot>
                {{ orderData.id }}
              </template>
            </ElDescriptionsItem>

            <ElDescriptionsItem align="center">
              <template #label>
                <div class="flex items-center justify-center gap-2.5">
                  <Order theme="outline" size="20" fill="#7ed321" :strokeWidth="3" />
                  订单状态
                </div>
              </template>

              <!-- v-slot:default, 或 v-slot, 或 #default, 或省略默认插槽的 template 标签  -->
              <template #default>
                <ElTag
                  size="large"
                  :type="ORDER_STATE_2_TEXT_AND_TYPE.get(orderData.state)?.type"
                  class="text-[14px]!"
                >
                  {{ ORDER_STATE_2_TEXT_AND_TYPE.get(orderData.state)?.text }}
                </ElTag>
              </template>
            </ElDescriptionsItem>

            <ElDescriptionsItem align="center">
              <template #label>
                <div class="flex-center flex items-center justify-center gap-2.5">
                  <Time theme="outline" size="20" fill="#7ed321" :strokeWidth="3" />
                  订单日期
                </div>
              </template>
              <!-- v-slot:default, 或 v-slot, 或 #default, 或省略默认插槽的 template 标签  -->
              {{ orderData.date }}
            </ElDescriptionsItem>
          </ElDescriptions>

          <ElDivider />

          <ElDescriptions
            :title="`处理订单 ${orderData.id} 的机器人详情`"
            direction="vertical"
            border
            :column="4"
          >
            <ElDescriptionsItem :rowSpan="2" :width="140" label="机器人图像" align="center">
              <ElImage class="w-25" :src="robotSvg" />
            </ElDescriptionsItem>

            <ElDescriptionsItem label="机器人名字" align="center">
              <ElTag
                size="large"
                :type="ROBOT_STATE_2_TEXT_AND_TYPE.get(robotData.state)?.type"
                class="text-[14px]!"
              >
                {{ ROBOT_STATE_2_TEXT_AND_TYPE.get(robotData.state)?.text }}
              </ElTag>
            </ElDescriptionsItem>

            <ElDescriptionsItem label="零件故障数" align="center">
              {{ robotData.failureNum }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="管理员名字" align="center">
              {{ robotData.admin }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="管理员邮箱" align="center">
              {{ robotData.email }}
            </ElDescriptionsItem>
          </ElDescriptions>
        </ElCard>
      </template>

      <template #footer>
        <p class="text-slate-500">{{ `查询时间 ${getDate()} ${getTime()}` }}</p>
      </template>
    </ElCard>
  </main>
</template>
