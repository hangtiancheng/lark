import React, { useEffect, useState, useCallback } from 'react'
import { Card, Input, Select, Button, Table, Tag, Popconfirm, message, Space } from 'antd'
import { AddOne } from '@icon-park/react'
import { robotDeleteApi, robotQueryApi } from '@/apis'
import { ROBOT_STATES, ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'
import type { IRobotItem } from '@/types/robot'
import { useRobotStore } from '@/stores/robot'
import { usePagination } from '@/hooks/use-pagination'
import FeDialog from './components/fe-dialog'
import type { ColumnsType } from 'antd/es/table'

const INFO_COLOR: Record<string, string> = {
  danger: 'red',
  warning: 'orange',
  success: 'green',
}

const FeMain: React.FC = () => {
  const { setRowData, resetRowData } = useRobotStore()
  const [nameOrAddress, setNameOrAddress] = useState('name')
  const [formData, setFormData] = useState<{
    nameOrAddress: string
    state?: 0 | 1 | 2 | 3 | 4 | 5
  }>({
    nameOrAddress: '',
    state: undefined,
  })

  const [robotList, setRobotList] = useState<IRobotItem[]>([])
  const [loading, setLoading] = useState(false)

  const [dialogVisible, setDialogVisible] = useState(false)
  const [isUpdate, setIsUpdate] = useState(false)

  const fetchList = useCallback(
    async (pageNum: number, pageSize: number) => {
      setLoading(true)
      try {
        const res = await robotQueryApi({
          [nameOrAddress]: formData.nameOrAddress,
          state: formData.state,
          pageNum,
          pageSize,
        })
        setRobotList(res.data.list)
        return res.data.total || 0
      } finally {
        setLoading(false)
      }
    },
    [nameOrAddress, formData.nameOrAddress, formData.state],
  )

  const { pageInfo, handleSizeChange, handleCurrentChange, setTotal, resetPagination } =
    usePagination(async () => {}, 10)

  const loadData = useCallback(async () => {
    const total = await fetchList(pageInfo.pageNum, pageInfo.pageSize)
    setTotal(total)
  }, [fetchList, pageInfo.pageNum, pageInfo.pageSize, setTotal])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleReset = () => {
    setFormData({ nameOrAddress: '', state: undefined })
    resetPagination()
  }

  const handleAdd = () => {
    resetRowData()
    setIsUpdate(false)
    setDialogVisible(true)
  }

  const handleUpdate = (rowData: IRobotItem) => {
    setRowData(rowData)
    setIsUpdate(true)
    setDialogVisible(true)
  }

  const handleDelete = async (id: number) => {
    const { code, message: msg } = await robotDeleteApi({ id })
    if (code === 200) {
      message.success(msg)
      loadData()
    }
  }

  const columns: ColumnsType<IRobotItem> = [
    { title: '序号', dataIndex: 'id', width: 60, fixed: 'left' },
    { title: '机器人名字', dataIndex: 'name', width: 150 },
    { title: '机器人地址', dataIndex: 'address', ellipsis: true },
    {
      title: '机器人状态',
      dataIndex: 'state',
      width: 150,
      render: (state: number) => {
        const info = ROBOT_STATE_2_TEXT_AND_TYPE.get(state)
        const color =
          info?.type === 'danger'
            ? 'red'
            : info?.type === 'success'
              ? 'green'
              : info?.type === 'warning'
                ? 'orange'
                : 'blue'
        return <Tag color={color}>{info?.text}</Tag>
      },
    },
    {
      title: '零件故障数',
      dataIndex: 'failureNum',
      width: 150,
      sorter: (a, b) => a.failureNum - b.failureNum,
    },
    { title: '管理员名字', dataIndex: 'admin', width: 150 },
    { title: '管理员邮箱', dataIndex: 'email', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            className="bg-(--color-green)"
            onClick={() => handleUpdate(record)}
          >
            更新
          </Button>
          <Popconfirm title="确定删除吗" onConfirm={() => handleDelete(record.id)}>
            <Button danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const searchOptions = [
    { label: '按名字查询', value: 'name' },
    { label: '按地址查询', value: 'address' },
  ]

  const selectBefore = (
    <Select
      value={nameOrAddress}
      onChange={setNameOrAddress}
      className="w-30"
      options={searchOptions}
    />
  )

  return (
    <main>
      <Card className="rounded-3xl!">
        <div className="flex gap-5">
          <Space.Compact>
            {selectBefore}
            <Input
              value={formData.nameOrAddress}
              onChange={(e) => setFormData({ ...formData, nameOrAddress: e.target.value })}
              placeholder="请输入机器人名字或地址"
              className="w-75"
            />
          </Space.Compact>

          <Select
            placeholder="请选择机器人状态"
            value={formData.state}
            onChange={(val) => setFormData({ ...formData, state: val })}
            className="w-50"
            allowClear
            options={ROBOT_STATES.slice(1).map((state, idx) => {
              const info = ROBOT_STATE_2_TEXT_AND_TYPE.get(idx + 1)
              const color = INFO_COLOR[info?.type || 'info'] ?? 'blue'
              return {
                label: <Tag color={color}>{state}</Tag>,
                value: idx + 1,
              }
            })}
          />

          <Button type="primary" className="bg-(--color-green)" onClick={loadData}>
            查询
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </div>
      </Card>

      <Card className="mt-5 rounded-3xl!">
        <div className="mb-5">
          <Button onClick={handleAdd}>
            <div className="flex items-center justify-center gap-1.25">
              <AddOne theme="outline" size={16} fill="#333" strokeWidth={3} />
              新增机器人
            </div>
          </Button>
        </div>

        <FeDialog
          dialogVisible={dialogVisible}
          isUpdate={isUpdate}
          onCloseDialog={() => setDialogVisible(false)}
          onUpdateRobotList={loadData}
        />

        <Table
          columns={columns}
          dataSource={robotList}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pageInfo.pageNum,
            pageSize: pageInfo.pageSize,
            total: pageInfo.total,
            onChange: handleCurrentChange,
            onShowSizeChange: (_, size) => handleSizeChange(size),
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </main>
  )
}

export default FeMain
