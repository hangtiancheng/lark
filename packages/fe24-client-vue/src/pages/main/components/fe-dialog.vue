<script setup lang="ts">
import {
  ElButton,
  ElDialog,
  ElRow,
  ElCol,
  ElForm,
  type FormRules,
  type FormInstance,
  ElMessage,
  ElInputNumber,
} from 'element-plus'
import { reactive, toRef, computed, useTemplateRef } from 'vue'
import { ROBOT_STATES, ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'
import type { IRobotItem } from '@/types/robot'
import { useRobotStore } from '@/stores/robot'
import { storeToRefs } from 'pinia'
import { robotAddApi, robotUpdateApi } from '@/apis'

const robotStore = useRobotStore()
//! useAttrs: 不是响应式的, 不支持 camelCase 转 dashed, 不支持类型检查
// const { ROBOT_STATE2TEXT_AND_TYPE } = useAttrs() as {
//   ROBOT_STATE2TEXT_AND_TYPE: Map<
//     number,
//     { text: RobotState; type: 'primary' | 'success' | 'info' | 'warning' | 'danger' }
//   >
// }

const props = defineProps<{
  dialogVisible: boolean
  isUpdate: boolean
}>()

// defineProps: 不可以修改 props 中的只读属性
//! [Vue warn] Set operation on key "dialogVisible" failed: target is readonly.
const dialogVisible = toRef(props, 'dialogVisible')
const isUpdate = toRef(props, 'isUpdate')

// const title = isUpdate.value ? '更新机器人' : '新增机器人'
const title = computed(() => (isUpdate.value ? '更新机器人' : '新增机器人'))
const rules = reactive<FormRules<IRobotItem>>({
  name: [{ required: true, message: '机器人名字不能为空', trigger: 'blur' }],
  address: [{ required: true, message: '机器人地址不能为空', trigger: 'blur' }],
  admin: [{ required: true, message: '管理员名字不能为空', trigger: 'blur' }],
  email: [{ required: true, message: '管理员邮箱不能为空', trigger: 'blur' }],
})

const emit = defineEmits<{
  closeDialog: [
    /** 具名元组 */
  ]
  updateRobotList: []
}>()

// const formRef = ref<InstanceType<typeof ElForm>>()
const formRef = useTemplateRef<FormInstance>('formRef')
defineExpose({
  resetFields: () => formRef.value?.resetFields(),
})

const { rowData: formData } = storeToRefs(robotStore)

// const { setRowData } = robotStore
// 点击 x 关闭对话框时, 调用 handleClose
const handleClose = () => {
  emit('closeDialog')
}

const handleCancel = () => {
  // defineProps: 不可以修改 props 中的只读属性
  // props.dialogVisible = false
  // 解决: 使用 defineEmits 派发 "关闭对话框 close-dialog" 事件给父组件, 父组件可以修改 props
  emit('closeDialog')
}

const handleUpdate = async () => {
  const { code, message } = await robotUpdateApi(formData.value)
  if (code === 200) {
    ElMessage.success({
      message,
      grouping: true,
    })
    emit('closeDialog')
    emit('updateRobotList')
  }
}

const handleAdd = async () => {
  const { code, message } = await robotAddApi(formData.value)
  if (code === 200) {
    ElMessage.success({
      message,
      grouping: true,
    })
    emit('closeDialog')
    emit('updateRobotList')
  }
}

const handelConfirm = () => {
  formRef.value?.validate((valid: boolean) => {
    if (!valid) {
      ElMessage.error({
        message: '表单校验失败',
        grouping: true,
      })
      return
    }
    if (isUpdate.value) {
      handleUpdate()
    } else {
      handleAdd()
    }
  })
}
</script>

<template>
  <main>
    <!--! 这里不能使用 v-model="dialogVisible", 不可以修改 props 中的只读属性 -->
    <ElDialog
      :model-value="dialogVisible"
      :title="title"
      width="700"
      class="rounded-3xl!"
      @close="handleClose"
    >
      <ElForm label-width="100" :rules="rules" :model="formData" ref="formRef">
        <ElRow>
          <ElCol :span="12">
            <ElFormItem label="机器人名字" prop="name">
              <ElInput
                placeholder="请输入机器人名字"
                v-model="formData.name"
                :disabled="isUpdate"
              />
              <!-- 如果不是新增 (是更新), 则禁用 -->
            </ElFormItem>

            <ElFormItem label="机器人地址" prop="address">
              <ElInput placeholder="请输入机器人地址" v-model="formData.address" />
            </ElFormItem>

            <ElFormItem label="机器人状态" prop="state">
              <ElSelect placeholder="请选择机器人状态" v-model="formData.state">
                <ElOption
                  v-for="(state, idx) of ROBOT_STATES.slice(1)"
                  :key="state"
                  :value="idx + 1"
                  :label="state"
                >
                  <ElTag size="large" :type="ROBOT_STATE_2_TEXT_AND_TYPE.get(idx)?.type">
                    {{ state }}
                  </ElTag>
                </ElOption>
              </ElSelect>
            </ElFormItem>
          </ElCol>

          <ElCol :span="12">
            <ElFormItem label="零件故障数" prop="failureNum">
              <ElInputNumber
                placeholder="请输入零件故障数"
                v-model="formData.failureNum"
                :min="0"
                :max="100"
                controls-position="right"
              />
            </ElFormItem>

            <ElFormItem label="管理员名字" prop="admin">
              <ElInput
                placeholder="请输入管理员名字"
                v-model="formData.admin"
                :disabled="isUpdate"
              />
              <!-- 如果不是新增 (是更新), 则禁用 -->
            </ElFormItem>

            <ElFormItem label="管理员邮箱" prop="email">
              <ElInput placeholder="请输入管理员邮箱" v-model="formData.email" />
            </ElFormItem>
          </ElCol>
        </ElRow>
      </ElForm>

      <template #footer>
        <div class="dialog-footer">
          <ElButton type="default" @click="handleCancel">取消</ElButton>
          <ElButton type="success" @click="handelConfirm">确定</ElButton>
        </div>
      </template>
    </ElDialog>
  </main>
</template>
