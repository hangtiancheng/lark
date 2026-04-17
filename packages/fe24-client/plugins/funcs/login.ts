import type { Request, Response } from 'express'
import { adminMenu, userMenu } from '../constants/index.js'
import { ILoginResData, IResData } from '../types/index.js'
import url from 'node:url'

const loginFn = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json')
  const parseUrl = url.parse(req.originalUrl!, true /* parseQueryString */).query
  const { username, password } = parseUrl
  let resData: ILoginResData & IResData
  if (username === 'admin' && password === '1111') {
    resData = {
      code: 200,
      message: '登录成功',
      data: {
        token: 'token',
        auth: 'admin',
        menuList: adminMenu,
      },
    }
  } else if (username === 'user' && password === '1111') {
    resData = {
      code: 200,
      message: '登录成功',
      data: {
        token: 'token',
        auth: 'user',
        menuList: userMenu,
      },
    }
  } else {
    resData = {
      code: 400,
      message: '账号或密码错误',
    }
  }
  res.end(JSON.stringify(resData))
}

export default loginFn
