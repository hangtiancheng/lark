import * as echarts from 'echarts/core'

import { BarChart, LineChart, PieChart, RadarChart } from 'echarts/charts'

import type {
  // 系列类型的定义后缀都为 SeriesOption
  BarSeriesOption,
  LineSeriesOption,
  PieSeriesOption,
  RadarSeriesOption,
} from 'echarts/charts'

import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
  GraphicComponent,
} from 'echarts/components'

import type {
  // 组件类型的定义后缀都为 ComponentOption
  TitleComponentOption,
  TooltipComponentOption,
  GridComponentOption,
  DatasetComponentOption,
  // TransformComponentOption,
  LegendComponentOption,
  GraphicComponentOption,
} from 'echarts/components'

import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'

import type { ComposeOption } from 'echarts/core'

export type ECOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | RadarSeriesOption
  | TitleComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | DatasetComponentOption
  | LegendComponentOption
  | GraphicComponentOption
>

echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
  GraphicComponent,

  BarChart,
  LineChart,
  PieChart,
  RadarChart,

  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
])

export default echarts
