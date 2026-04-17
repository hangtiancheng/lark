import { redirect, LoaderFunctionArgs } from 'react-router-dom'
import { useUserStore } from '@/stores/user'
import { WHITE_LIST } from '@/constants'

export const authLoader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const pathname = url.pathname

  const { token } = useUserStore.getState()

  if (!WHITE_LIST.has(pathname) && !token) {
    return redirect('/login')
  }

  if (token && pathname === '/login') {
    return redirect('/')
  }

  return null
}
