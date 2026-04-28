import { Api } from '@/constants/apis'
import type { ILoginReqData, ILoginResData } from '@/types/user'
import { get } from '@/utils/http'

async function loginApi(data: ILoginReqData): Promise<ILoginResData> {
  // return post(Api.Login, data)
  return get(Api.Login, data)
}

async function _loginApi(data: ILoginReqData) {
  return fetch(`${Api.Login}?username=${data.username}&password=${data.password}`).then((res) =>
    res.json(),
  )
}

export { _loginApi, loginApi }
