export interface IMenuItem {
  name: string
  url: string
  icon: string
  children?: IMenuItem[]
}

export interface ILoginReqData {
  username: string
  password: string
}

export interface ILoginResData {
  code: number
  message: string
  data: {
    token: string
    auth: string
    menuList: IMenuItem[]
  }
}
