import React, { useEffect } from 'react'
import { Modal, Form, Input, Select, InputNumber, message, Tag } from 'antd'
import { ROBOT_STATES, ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'
import type { IRobotItem } from '@/types/robot'
import { useRobotStore } from '@/stores/robot'
import { robotAddApi, robotUpdateApi } from '@/apis'

interface FeDialogProps {
  dialogVisible: boolean
  isUpdate: boolean
  onCloseDialog: () => void
  onUpdateRobotList: () => void
}

const STATE_COLOR: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'orange',
  danger: 'red',
}

const FeDialog: React.FC<FeDialogProps> = ({
  dialogVisible,
  isUpdate,
  onCloseDialog,
  onUpdateRobotList,
}) => {
  const [form] = Form.useForm<IRobotItem>()
  const { rowData, setRowData } = useRobotStore()

  useEffect(() => {
    if (dialogVisible) {
      form.setFieldsValue(rowData)
    } else {
      form.resetFields()
    }
  }, [dialogVisible, rowData, form])

  const handleValuesChange = (_: unknown, allValues: IRobotItem) => {
    setRowData({ ...rowData, ...allValues })
  }

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields()
      const data = { ...rowData, ...values }

      if (isUpdate) {
        const { code, message: msg } = await robotUpdateApi(data)
        if (code === 200) {
          message.success(msg)
          onCloseDialog()
          onUpdateRobotList()
        }
      } else {
        const { code, message: msg } = await robotAddApi(data)
        if (code === 200) {
          message.success(msg)
          onCloseDialog()
          onUpdateRobotList()
        }
      }
    } catch {
      // Form validation failed
    }
  }

  return (
    <Modal
      title={isUpdate ? '更新机器人' : '新增机器人'}
      open={dialogVisible}
      onCancel={onCloseDialog}
      onOk={handleConfirm}
      okText="确定"
      cancelText="取消"
      width={800}
    >
      <Form form={form} layout="vertical" onValuesChange={handleValuesChange} className="pt-5">
        <div className="grid grid-cols-2 gap-x-5">
          <Form.Item
            label="机器人名字"
            name="name"
            rules={[{ required: true, message: '机器人名字不能为空' }]}
          >
            <Input placeholder="请输入机器人名字" />
          </Form.Item>

          <Form.Item
            label="机器人地址"
            name="address"
            rules={[{ required: true, message: '机器人地址不能为空' }]}
          >
            <Input placeholder="请输入机器人地址" />
          </Form.Item>

          <Form.Item label="机器人状态" name="state" initialValue={1}>
            <Select
              placeholder="请选择"
              options={ROBOT_STATES.slice(1).map((state, idx) => {
                const stateInfo = ROBOT_STATE_2_TEXT_AND_TYPE.get(idx + 1)
                const color = STATE_COLOR[stateInfo?.type || 'info'] ?? 'blue'
                return {
                  label: <Tag color={color}>{state}</Tag>,
                  value: idx + 1,
                }
              })}
            />
          </Form.Item>

          <Form.Item label="零件故障数" name="failureNum" initialValue={0}>
            <InputNumber className="w-full" min={0} max={200} placeholder="请输入零件故障数" />
          </Form.Item>

          <Form.Item
            label="管理员名字"
            name="admin"
            rules={[{ required: true, message: '管理员名字不能为空' }]}
          >
            <Input placeholder="请输入管理员名字" />
          </Form.Item>

          <Form.Item
            label="管理员邮箱"
            name="email"
            rules={[{ required: true, message: '管理员邮箱不能为空' }]}
          >
            <Input placeholder="请输入管理员邮箱" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default FeDialog
