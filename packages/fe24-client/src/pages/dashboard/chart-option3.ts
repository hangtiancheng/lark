/* eslint-disable @typescript-eslint/no-explicit-any */
import { chartDataApi3 } from '@/apis/dashboard'
import { ROBOT_STATES } from '@/constants'
import type { ECOption } from '@/utils/echarts'

const getChartOption3 = async () => {
  const res = await chartDataApi3()
  const chartOption: ECOption = {
    radar: {
      shape: 'circle',
      indicator: ROBOT_STATES.map((state) => ({ name: state, max: 100 })),
    },
    series: [
      {
        name: '机器人运行状态',
        type: 'radar',
        // --color-1st: #3d8d7a;
        color: '#3d8d7a',
        data: [
          {
            value: [],
            name: '机器人运行状态',
          },
        ],
      },
    ],
  }
  ;(chartOption.series as any)[0].data[0].value = res.data
  return chartOption
}

export default getChartOption3
