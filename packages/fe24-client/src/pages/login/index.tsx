import React from 'react'
import { Form, Input, Button, message } from 'antd'
import { Lock, Rice, User } from '@icon-park/react'
import { useUserStore } from '@/stores/user'
import { useNavigate } from 'react-router-dom'
import type { ILoginReqData } from '@/types/user'

const LoginMain: React.FC = () => {
  const [form] = Form.useForm()
  const { login } = useUserStore()
  const navigate = useNavigate()

  const handleLogin = async () => {
    try {
      const values = await form.validateFields()
      await login(values as ILoginReqData)
      message.success('登录成功')
      navigate('/', { replace: true })
    } catch (err) {
      console.error(err)
      // validation failed
      message.error('登录失败')
    }
  }

  return (
    <main
      className="h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundColor: 'var(--color-green-light)' }}
    >
      <div className="glass-container absolute top-[50%] left-[10%] h-75 w-114 translate-y-[-50%] rounded-3xl p-12.5">
        <div className="mb-5 flex items-center justify-center gap-2.5">
          <Rice theme="filled" size={48} fill="#b8e986" strokeWidth={3} />
          <h1 className="m-0 text-3xl text-slate-700">机器人管理</h1>
        </div>

        <Form
          form={form}
          initialValues={{ username: 'admin', password: '1111' }}
          labelCol={{ span: 4 }}
          wrapperCol={{ span: 20 }}
        >
          <Form.Item
            label="账号"
            name="username"
            rules={[
              { required: true, message: '账号是必填项' },
              { min: 4, max: 16, message: '账号是4到16个字符' },
              { pattern: /^[a-zA-Z0-9_]{4,16}$/, message: '账号格式错误' },
            ]}
          >
            <Input placeholder="请输入账号" prefix={<User />} />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '密码是必填项' },
              { min: 4, max: 16, message: '密码是4到16个字符' },
              { pattern: /^[a-zA-Z0-9_]{4,16}$/, message: '密码格式错误' },
            ]}
          >
            <Input.Password placeholder="请输入密码" prefix={<Lock />} />
          </Form.Item>

          <div className="flex flex-row-reverse gap-5">
            <Button
              type="primary"
              onClick={handleLogin}
              className="w-25 border-none bg-(--color-green) hover:bg-(--color-green-light)"
            >
              登录
            </Button>
            <Button className="w-25 border-none bg-white">注册</Button>
          </div>
        </Form>
      </div>
    </main>
  )
}

export default LoginMain
