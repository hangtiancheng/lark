import React from 'react'
import { useNavigate } from 'react-router-dom'
import { name2icon } from '@/utils/icons'
import type { IMenuItem } from '@/types/user'

interface RecursiveChildProps {
  item: IMenuItem
}

const RecursiveChild: React.FC<RecursiveChildProps> = ({ item }) => {
  const navigate = useNavigate()

  if (item.children?.length) {
    return (
      <div className="flex justify-between gap-17.5">
        {item.children.map((child) => (
          <RecursiveChild key={child.url} item={child} />
        ))}
      </div>
    )
  }

  const IconComponent = name2icon.get(item.icon)
  if (!IconComponent) {
    return null
  }

  return (
    <div
      className="text-[25px] transition-all duration-500 hover:scale-[2] hover:cursor-pointer"
      onClick={() => navigate(item.url)}
    >
      <IconComponent />
    </div>
  )
}

export default RecursiveChild
