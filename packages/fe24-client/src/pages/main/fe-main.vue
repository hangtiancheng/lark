<script setup lang="ts">
import { robotDeleteApi, robotQueryApi } from '@/apis'
import { ROBOT_STATES, ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'
import type { IRobotItem } from '@/types/robot'
import { AddOne } from '@icon-park/vue-next'
import FeDialog from './components/fe-dialog.vue'
import {
  ElCard,
  ElRow,
  ElCol,
  ElSelect,
  ElOption,
  ElButton,
  ElTable,
  ElTableColumn,
  ElPagination,
  ElPopconfirm,
  ElMessage,
} from 'element-plus'
import { reactive, ref } from 'vue'
import { useRobotStore } from '@/stores/robot'
import { usePagination } from '@/composables/use-pagination'

const robotStore = useRobotStore()
const nameOrAddress = ref('name')

const formData = reactive({
  nameOrAddress: '',
  state: undefined,
})

// const pageInfo = reactive({
//   pageNum: 1,
//   pageSize: 10,
//   total: 0,
// })

const robotList = ref<IRobotItem[]>([])
const loading /** v-loading */ = ref(false)

const loadRobotList = async () => {
  loading.value = true
  const { list, total } = (
    await robotQueryApi({
      [nameOrAddress.value]: formData.nameOrAddress,
      state: formData.state,
      // pageNum: pageInfo.pageNum,
      // pageSize: pageInfo.pageSize,
      ...pageInfo,
    })
  ).data
  robotList.value = list
  pageInfo.total = total!
  loading.value = false
}
// onMounted(loadRobotList /** () => getRobotList() */)

const { handleCurrentChange, handleSizeChange, pageInfo } = usePagination(
  loadRobotList,
  10 /** initialPageSize */,
)

//! 类型体操
// type TupleToUnion<T extends readonly unknown[]> = T[number]
// type RobotState = TupleToUnion<typeof ROBOT_STATES>
// type RobotState = (typeof ROBOT_STATES)[number] // 也可以

const handleReset = () => {
  formData.nameOrAddress = ''
  formData.state = undefined
  loadRobotList()
}

const isUpdate = ref(false)
const dialogVisible = ref(false)

const handleAdd = () => {
  robotStore.resetRowData()
  isUpdate.value = false // 是新增
  dialogVisible.value = true
}

const handleUpdate = (rowData: IRobotItem) => {
  robotStore.setRowData(rowData)
  isUpdate.value = true // 是更新
  dialogVisible.value = true
}

const handleDelete = async (id: number) => {
  const { code, message } = await robotDeleteApi({ id })
  if (code === 200) {
    ElMessage.success({
      message,
      grouping: true,
    })
    loadRobotList()
  }
}

const robotFormRef = ref<InstanceType<typeof FeDialog>>()
// const robotFormRef = useTemplateRef<InstanceType<typeof RobotDialog>>('robotFormRef')
const handleClose = () => {
  dialogVisible.value = false
  robotFormRef.value?.resetFields()
}
</script>

<template>
  <main>
    <ElCard class="rounded-3xl!">
      <ElRow :gutter="20">
        <ElCol :span="7">
          <ElInput
            v-model.trim="formData.nameOrAddress"
            placeholder="请输入机器人名字或地址"
            class="input-with-select"
          >
            <template #append>
              <ElSelect v-model.trim="nameOrAddress" class="w-30!">
                <ElOption label="按名字查询" value="name" />
                <ElOption label="按地址查询" value="address" />
              </ElSelect>
            </template>
          </ElInput>
        </ElCol>

        <ElCol :span="5">
          <ElSelect placeholder="请选择机器人状态" v-model="formData.state">
            <ElOption
              v-for="(state, idx) of ROBOT_STATES.slice(1)"
              :label="state"
              :value="idx + 1"
              :key="state"
            >
              <ElTag size="large" :type="ROBOT_STATE_2_TEXT_AND_TYPE.get(idx + 1)?.type">
                {{ state }}
              </ElTag>
            </ElOption>
          </ElSelect>
        </ElCol>

        <ElButton type="success" @click="loadRobotList">查询</ElButton>
        <ElButton type="default" @click="handleReset">重置</ElButton>
      </ElRow>
    </ElCard>

    <ElCard class="mt-5 rounded-3xl!">
      <ElRow>
        <ElButton type="default">
          <div class="flex items-center justify-center gap-1.25" @click="handleAdd">
            <AddOne theme="outline" size="16" fill="#333" :strokeWidth="3" />
            新增机器人
          </div>
        </ElButton>
      </ElRow>

      <!--! useAttrs: 不是响应式的, 不支持 camelCase 转 dashed, 不支持类型检查 -->
      <FeDialog
        :dialog-visible="dialogVisible"
        :is-update="isUpdate"
        @close-dialog="handleClose"
        @update-robot-list="loadRobotList"
        ref="robotFormRef"
      />

      <ElTable
        :data="robotList"
        class="mt-5 w-full"
        highlight-current-row
        stripe
        v-loading="loading"
        table-layout="fixed"
      >
        <!-- 两个字: 60px
        五个字: 150px -->
        <!-- <ElTableColumn width="60" type="index" label="序号" /> -->
        <ElTableColumn fixed="left" width="60" prop="id" label="序号" />
        <ElTableColumn width="150" prop="name" label="机器人名字" />
        <ElTableColumn show-overflow-tooltip prop="address" label="机器人地址" />

        <!-- state: stateId -->
        <ElTableColumn width="150" prop="state" label="机器人状态">
          <template #default="tableData">
            <ElTag
              size="large"
              :type="ROBOT_STATE_2_TEXT_AND_TYPE.get(tableData.row.state)?.type"
              >{{ ROBOT_STATE_2_TEXT_AND_TYPE.get(tableData.row.state)?.text }}</ElTag
            >
          </template>
        </ElTableColumn>

        <ElTableColumn width="150" prop="failureNum" label="零件故障数" sortable />
        <ElTableColumn width="150" prop="admin" label="管理员名字" />
        <ElTableColumn show-overflow-tooltip prop="email" label="管理员邮箱" />

        <ElTableColumn width="180" fixed="right" label="操作">
          <template #default="tableData">
            <ElButton type="success" @click="handleUpdate(tableData.row)"> 更新 </ElButton>
            <ElPopconfirm title="确定删除吗" @confirm="handleDelete(tableData.row.id)">
              <template #reference>
                <ElButton type="danger"> 删除 </ElButton>
              </template>
            </ElPopconfirm>
          </template>
        </ElTableColumn>
      </ElTable>

      <!-- total: 总记录数
      sizes: 页面大小
      prev: 上一页
      pager: 页面序号列表
      next: 下一页
      jumper: 跳转到第 ? 页 -->
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
    </ElCard>
  </main>
</template>
