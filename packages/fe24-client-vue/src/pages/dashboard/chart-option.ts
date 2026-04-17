/* eslint-disable @typescript-eslint/no-explicit-any */
import { chartDataApi } from '@/apis/dashboard'
import type { ECOption } from '@/utils/echarts'

const getChartOption = async () => {
  const res = await chartDataApi()
  const chartOption: ECOption = {
    legend: {
      top: 'bottom',
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a}<br />{b}:{c}',
    },
    series: [
      {
        name: '机器人营收比例',
        type: 'pie',
        // --color-4th: #a3d1c6;
        // --color-2nd: #b3d8a8;
        // --color-1st: #3d8d7a;
        color: ['#a3d1c6', '#b3d8a8', '#3d8d7a'],
        radius: ['50', '70'],
        center: ['50%', '50%'],
        roseType: 'area',
        itemStyle: {
          borderRadius: 10,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '16',
          },
        },
        data: [],
      },
    ],
    graphic: {
      type: 'text',
      left: 'center',
      top: 'center',
      style: {
        text: '营收比例',
        fontSize: '16',
        fill: '#333',
      },
    },
  }
  //// chartOption.series[0].data = Array.from({ length: 3 }, () => ({ value: 0, name: '' }))
  for (let i = 0; i < res.data.length; i++) {
    ;(chartOption.series as any)[0].data = res.data
  }
  return chartOption
}

export default getChartOption
