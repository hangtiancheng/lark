import type { IResData } from './dashboard'
export type { IResData }

export interface ITreeNode {
  label: string
  value?: string
  children?: ITreeNode[]
}

export type ITreeList = {
  data: {
    list: ITreeNode[]
  }
} & IResData
