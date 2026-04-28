<script setup lang="ts">
import {
  ElCard,
  ElInput,
  ElSelect,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElTable,
} from 'element-plus'
import { onBeforeMount, reactive, ref, useTemplateRef, watchEffect } from 'vue'
import { name2icon } from '@/utils/icons'
import { orderQueryApi, orderDeleteApi } from '@/apis/order'
import type { IOrderItem } from '@/types/order'
import { usePagination } from '@/composables/use-pagination'
import { ORDER_STATES, ORDER_STATE_2_TEXT_AND_TYPE } from '@/constants'
import { useToast2 } from '@/components/toast/toast'
import { useRouter } from 'vue-router'
import DraggableWindow from './components/draggable-window.vue'
import { getDate, getTime } from '@/utils'
import { tableData2xlsx } from '@/utils/to-xlsx'

const router = useRouter()
const toast = useToast2()

const formData = reactive<{
  startDate?: string
  endDate?: string
  // 订单号
  id?: string
  // 订单状态
  state?: 0 | 1 | 2 | 3
  // 机器人 ID
  robotId?: number
  // 机器人名字
  robotName?: string
}>({})

const date = ref<[startDate: string, endDate: string]>(['', ''])
const handleChange = (newDate: typeof date.value) => {
  formData.startDate = newDate /* date.value */[0]
  formData.endDate = newDate /* date.value */[1]
}

const orderList = ref<IOrderItem[]>()
const orderTable = useTemplateRef<InstanceType<typeof ElTable>>('orderTable')
const loading /** v-loading */ = ref(false)
const loadOrderList = async () => {
  loading.value = true
  const { list, total } = (
    await orderQueryApi({
      ...formData,
      ...pageInfo,
    })
  ).data
  orderList.value = list
  pageInfo.total = total!
  loading.value = false
}

const { handleCurrentChange, handleSizeChange, pageInfo } = usePagination(
  loadOrderList,
  10 /** initialPageSize */,
)

// const idList: number[] = []
const handleDelete = async (orderId: string) => {
  const { code, message } = await orderDeleteApi({ idList: [orderId] })
  if (code === 200) {
    ElMessage.success({
      message,
      grouping: true,
    })
    loadOrderList()
  }
}

const idList = ref<string[]>([])

const handleBatchDelete = () => {
  const doBatchDelete = async () => {
    const { code, message } = await orderDeleteApi({ idList: idList.value })
    if (code === 200) {
      toast.success(message)
      loadOrderList()
    }
  }

  ElMessageBox.confirm('确定批量删除订单吗?', 'Warning', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(doBatchDelete)
    .catch(() => {
      toast.warning('批量删除订单取消')
    })
    .finally(() => {
      orderTable?.value?.clearSelection()
      idList.value = []
    })
}

const handleSelectionChange = (selectedRows: IOrderItem[]) => {
  idList.value = selectedRows.map((item) => item.id)
}

const handleReset = () => {
  formData.startDate = undefined
  formData.endDate = undefined
  formData.id = undefined
  formData.state = undefined
  formData.robotId = undefined
  formData.robotName = undefined
  //! for (const key in formData) {}
  //! Object.keys(formData)
  //! Reflect.ownKeys(formData)
  loadOrderList()
}

const ctxMenuIsAlive = ref(false)
const ctxMenuX = ref<string>('0px')
const ctxMenuY = ref<string>('0px')

const orderData = ref<IOrderItem>()
const draggableWindowIsAlive = ref(false)
const handleCtxMenu = (ev: MouseEvent, rowData: IOrderItem) => {
  ctxMenuX.value = `${ev.pageX}px`
  ctxMenuY.value = `${ev.pageY}px`
  orderData.value = rowData
  ctxMenuIsAlive.value = true
}

const handleWindowClick = () => (ctxMenuIsAlive.value = false)
watchEffect(() => {
  if (ctxMenuIsAlive.value) {
    window.addEventListener('click', handleWindowClick)
  } else {
    window.removeEventListener('click', handleWindowClick)
  }
})
onBeforeMount(() => window.removeEventListener('click', handleWindowClick))

// 左键, 在悬浮窗中打开
const handleDetail = (rowData: IOrderItem) => {
  orderData.value = rowData
  draggableWindowIsAlive.value = true
}

// 右键, 在悬浮窗中打开
const handleDetail2 = () => {
  draggableWindowIsAlive.value = true
}

// 右键, 在新标签页中打开
const handleDetail3 = () => {
  if (!orderData.value) {
    return
  }
  // route.path === '/operations/detail'
  router.push({
    // path: `/operations/detail?orderId=${orderData.value.id}&robotId=${orderData.value.robotId}`,
    name: 'Detail',
    //! query: URL 查询参数 (URL query parameters), 使用 query 时不需要指定路由组件的名字
    //! params: URL 路径参数 (URL path parameters), 使用 params 时必须指定路由组件的名字
    query: {
      orderId: orderData.value.id,
      robotId: orderData.value.robotId,
    },
  })
}

const export2xlsx = () => {
  if (!orderList.value || !orderList.value.length) {
    return
  }
  const tableData = orderList.value.filter((item) => idList.value.includes(item.id))
  if (!tableData.length) {
    return
  }
  console.log(tableData)
  const filename = `订单数据__${getDate()}__${getTime().replace(/:/g, '-')}.xlsx`
  tableData2xlsx(tableData, filename)
}
</script>

<template>
  <main>
    <ElCard class="rounded-3xl!">
      <div class="grid-container">
        <ElInput
          class="grid-input w-75!"
          placeholder="请输入订单号"
          v-model="formData.id"
        ></ElInput>

        <ElSelect class="grid-select w-75!" placeholder="请选择订单状态" v-model="formData.state">
          <ElOption
            v-for="(state, idx) of ORDER_STATES.slice(1)"
            :label="state"
            :value="idx + 1"
            :key="state"
          >
            <ElTag size="large" :type="ORDER_STATE_2_TEXT_AND_TYPE.get(idx + 1)?.type">
              {{ state }}
            </ElTag>
          </ElOption>
        </ElSelect>

        <ElInputNumber
          class="grid-input-number w-75!"
          placeholder="请输入机器人 ID"
          controls-position="right"
          v-model="formData.robotId"
        />

        <ElInput
          class="grid-input2 w-75!"
          placeholder="请输入机器人名字"
          v-model="formData.robotName"
        ></ElInput>

        <ElDatePicker
          v-model="date"
          class="grid-date-picker w-75!"
          type="daterange"
          range-separator="/"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          @change="handleChange"
          value-format="YYYY-MM-DD"
        ></ElDatePicker>

        <div class="grid-buttons">
          <ElButton type="success" @click="loadOrderList">查询</ElButton>
          <ElButton type="default" @click="handleReset">重置</ElButton>
        </div>
      </div>
    </ElCard>

    <ElCard class="mt-5 rounded-3xl!">
      <ElRow>
        <ElButton
          type="success"
          :icon="name2icon.get('ExcelOne')"
          :disabled="!idList.length"
          @click="export2xlsx"
          >导出订单数据到 Excel</ElButton
        >
        <ElButton
          type="danger"
          :icon="name2icon.get('DeleteFive')"
          @click="handleBatchDelete"
          :disabled="!idList.length"
          >批量删除</ElButton
        >
      </ElRow>

      <ElRow class="mt-5" id="#order-table">
        <ElTable
          :data="orderList"
          class="w-full"
          highlight-current-row
          stripe
          v-loading="loading"
          table-layout="fixed"
          @selection-change="handleSelectionChange"
          ref="orderTable"
        >
          <!-- <ElTableColumn fixed="left" type="index" label="序号"></ElTableColumn> -->
          <ElTableColumn fixed="left" type="selection" label="序号"></ElTableColumn>
          <ElTableColumn label="订单号" prop="id"> </ElTableColumn>
          <ElTableColumn label="订单状态" prop="state">
            <template #default="tableData">
              <ElTag
                size="large"
                :type="ORDER_STATE_2_TEXT_AND_TYPE.get(tableData.row.state)?.type"
                class="text-[14px]!"
              >
                {{ ORDER_STATE_2_TEXT_AND_TYPE.get(tableData.row.state)?.text }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="机器人 ID" prop="robotId"> </ElTableColumn>
          <ElTableColumn label="机器人名字" prop="robotName"> </ElTableColumn>
          <!-- fixed="right" -->
          <ElTableColumn label="操作">
            <template #default="tableData">
              <ElButton
                type="success"
                @click="handleDetail(tableData.row /** rowData */)"
                @contextmenu.prevent="
                  (ev: MouseEvent) => handleCtxMenu(ev, tableData.row /** rowData */)
                "
              >
                详情
              </ElButton>
              <ElPopconfirm
                title="确定删除吗"
                @confirm="handleDelete(tableData.row.id /** orderId */)"
              >
                <template #reference>
                  <ElButton type="danger"> 删除 </ElButton>
                </template>
              </ElPopconfirm>
            </template>
          </ElTableColumn>
        </ElTable>

        <ElPagination
          v-model:current-page="pageInfo.pageNum"
          v-model:page-size="pageInfo.pageSize"
          :page-sizes="[10, 20, 30, 40]"
          size="default"
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="pageInfo.total"
          class="mt-5"
          @size-change="handleSizeChange /** (pageSize: number) => void */"
          @current-change="handleCurrentChange /** (pageNum: number) => void */"
        />
      </ElRow>
    </ElCard>

    <!-- <Teleport to="body"> -->
    <Transition
      enter-active-class="animate__animated animate__flipInX"
      leave-active-class="animate__animated animate__flipOutX"
    >
      <ul
        class="ctx-menu fixed z-10 rounded-lg bg-slate-100 text-slate-500 shadow-lg"
        v-if="ctxMenuIsAlive"
      >
        <li>选择打开方式</li>
        <li><hr /></li>
        <li @click="handleDetail2">在悬浮窗中打开</li>
        <li @click="handleDetail3">在新标签页中打开</li>
      </ul>
    </Transition>
    <!-- </Teleport> -->

    <DraggableWindow
      v-if="draggableWindowIsAlive"
      @close-window="draggableWindowIsAlive = false"
      :order-data="orderData!"
    >
      <template #header> 订单 {{ orderData?.id }} 详情 </template>
      <template #footer>
        <div>查询时间: {{ `${getDate()} ${getTime()}` }}</div>
      </template>
    </DraggableWindow>
  </main>
</template>

<style scoped lang="scss">
.grid-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  // 指定隐式网格的行高
  grid-auto-rows: auto;
  // 设置列间距
  column-gap: 20px;
  // 设置行间距
  row-gap: 10px;
  // 等价于 gap: 10px 20px;

  // 定义区域, 配合 grid-area 使用
  grid-template-areas:
    'input        select date-picker'
    'input-number input2 buttons';
  // 网格项目水平居中
  justify-items: center;
  .grid-input {
    // 指定网格项目放在哪一个区域
    grid-area: input;
  }

  // #region
  .grid-select {
    grid-area: select;
  }

  .grid-input-number {
    grid-area: input-number;
  }

  .grid-input2 {
    grid-area: input2;
  }

  .grid-date-picker {
    grid-area: date-picker;
    grid-column-start: span 3;
  }

  .grid-buttons {
    grid-area: buttons;
  }
  // #endregion
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
</style>
