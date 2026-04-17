import { create } from 'zustand'
import { loginApi } from '@/apis/user'
import type { ILoginReqData, IMenuItem } from '@/types/user'

interface IUserStore {
  username: string
  menuList: IMenuItem[]
  token: string
  auth: string
  login: (data: ILoginReqData) => Promise<void>
  logout: () => void
}

const getSessionItem = (key: string, defaultValue: string) => {
  return sessionStorage.getItem(key) ?? defaultValue
}

export const useUserStore = create<IUserStore>((set) => ({
  username: getSessionItem('username', ''),
  menuList: JSON.parse(getSessionItem('menuList', '[]')),
  token: getSessionItem('token', ''),
  auth: getSessionItem('auth', ''),

  login: async (data: ILoginReqData) => {
    try {
      const resData = await loginApi(data)
      const {
        data: { menuList: menuList_, token: token_, auth: auth_ },
      } = resData

      set({
        username: data.username,
        menuList: menuList_,
        token: token_,
        auth: auth_,
      })

      sessionStorage.setItem('username', data.username)
      sessionStorage.setItem('menuList', JSON.stringify(menuList_))
      sessionStorage.setItem('token', token_)
      sessionStorage.setItem('auth', auth_)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error(err)
      }
    }
  },

  logout: () => {
    set({
      username: '',
      menuList: [],
      token: '',
      auth: '',
    })
    sessionStorage.clear()
  },
}))
