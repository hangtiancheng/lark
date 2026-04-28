import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Input,
  Select,
  Button,
  Table,
  Tag,
  DatePicker,
  Popconfirm,
  message,
  Space,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { orderQueryApi, orderDeleteApi } from '@/apis/order'
import type { IOrderItem } from '@/types/order'
import { usePagination } from '@/hooks/use-pagination'
import { ORDER_STATES, ORDER_STATE_2_TEXT_AND_TYPE } from '@/constants'
import { getDate, getTime } from '@/utils'
import { tableData2xlsx } from '@/utils/to-xlsx'

const { RangePicker } = DatePicker

const STATE_COLOR: Record<string, string> = {
  danger: 'red',
  success: 'green',
  warning: 'orange',
  info: 'blue',
}

const OrderMain: React.FC = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<{
    startDate?: string
    endDate?: string
    id?: string
    state?: 0 | 1 | 2 | 3
    robotId?: number
    robotName?: string
  }>({})

  const [orderList, setOrderList] = useState<IOrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const fetchList = useCallback(
    async (pageNum: number, pageSize: number) => {
      setLoading(true)
      try {
        const res = await orderQueryApi({
          ...formData,
          pageNum,
          pageSize,
        })
        setOrderList(res.data.list)
        return res.data.total || 0
      } finally {
        setLoading(false)
      }
    },
    [formData],
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

  const handleDelete = async (orderId: string) => {
    const { code, message: msg } = await orderDeleteApi({ idList: [orderId] })
    if (code === 200) {
      message.success(msg)
      loadData()
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return
    const { code, message: msg } = await orderDeleteApi({ idList: selectedRowKeys as string[] })
    if (code === 200) {
      message.success(msg)
      setSelectedRowKeys([])
      loadData()
    }
  }

  const handleReset = () => {
    setFormData({})
    resetPagination()
  }

  const handleDetail = (rowData: IOrderItem) => {
    // Left click detail logic is now handled in a new tab since draggable window is removed
    navigate(`/order/detail?orderId=${rowData.id}&robotId=${rowData.robotId}`)
  }

  const export2xlsx = () => {
    if (!orderList || !orderList.length) return
    const tableData = orderList.filter((item) => selectedRowKeys.includes(item.id))
    if (!tableData.length) return
    const filename = `订单数据__${getDate()}__${getTime().replace(/:/g, '-')}.xlsx`
    tableData2xlsx(tableData, filename)
  }

  const columns: ColumnsType<IOrderItem> = [
    { title: '订单号', dataIndex: 'id', width: 120 },
    { title: '机器人 ID', dataIndex: 'robotId', width: 100 },
    { title: '机器人名字', dataIndex: 'robotName', width: 150 },
    {
      title: '订单状态',
      dataIndex: 'state',
      width: 120,
      render: (state: number) => {
        const info = ORDER_STATE_2_TEXT_AND_TYPE.get(state)
        const color = STATE_COLOR[info?.type || 'info'] ?? 'blue'
        return <Tag color={color}>{info?.text}</Tag>
      },
    },
    { title: '订单日期', dataIndex: 'date', width: 150 },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            className="bg-(--color-green)"
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <Popconfirm title="确定删除吗?" onConfirm={() => handleDelete(record.id)}>
            <Button type="primary" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }

  return (
    <main>
      <Card className="mb-5 rounded-3xl!">
        <div className="grid grid-cols-3 justify-items-center gap-4">
          <Input
            placeholder="请输入订单号"
            value={formData.id}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            className="w-[70%]!"
          />
          <Select
            placeholder="请选择订单状态"
            value={formData.state}
            onChange={(val) => setFormData({ ...formData, state: val })}
            className="w-[70%]"
            allowClear
            options={ORDER_STATES.slice(1).map((state, idx) => {
              const info = ORDER_STATE_2_TEXT_AND_TYPE.get(idx + 1)
              const color = STATE_COLOR[info?.type || 'info'] ?? 'blue'
              return {
                label: <Tag color={color}>{state}</Tag>,
                value: idx + 1,
              }
            })}
          />
          <RangePicker
            className="w-[70%]"
            onChange={(_, dateStrings) => {
              setFormData({
                ...formData,
                startDate: dateStrings[0],
                endDate: dateStrings[1],
              })
            }}
          />
          <Input
            placeholder="请输入机器人 ID"
            value={formData.robotId}
            onChange={(e) =>
              setFormData({ ...formData, robotId: Number(e.target.value) || undefined })
            }
            className="w-[70%]!"
          />
          <Input
            placeholder="请输入机器人名字"
            value={formData.robotName}
            onChange={(e) => setFormData({ ...formData, robotName: e.target.value })}
            className="w-[70%]!"
          />
          <div className="flex gap-4">
            <Button type="primary" className="bg-(--color-green)" onClick={loadData}>
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </div>
        </div>
      </Card>

      <Card className="mt-5 rounded-3xl!">
        <div className="mb-4 flex gap-4">
          <Popconfirm title="确定批量删除订单吗?" onConfirm={handleBatchDelete}>
            <Button danger disabled={selectedRowKeys.length === 0}>
              批量删除
            </Button>
          </Popconfirm>
          <Button type="primary" onClick={export2xlsx} disabled={selectedRowKeys.length === 0}>
            导出勾选项
          </Button>
        </div>

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={orderList}
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

export default OrderMain
