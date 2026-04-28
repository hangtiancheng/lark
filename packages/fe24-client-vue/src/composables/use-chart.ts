import { onMounted, onUnmounted, type Ref } from 'vue'
import echarts, { type ECOption } from '@/utils/echarts'

interface IEvent {
  axesInfo?: { value: number }[]
}

export interface ICustomEventOption {
  evName: string
  handler: (ev: IEvent, chartInstance: echarts.ECharts | null) => void
}

export function useChart(
  elemRef: Ref<HTMLElement | null>,
  getChartOption: () => Promise<ECOption>,
  customEventOptions?: ICustomEventOption[],
) {
  let chartInstance: echarts.ECharts | null = null
  const initChart = async () => {
    if (elemRef.value) {
      chartInstance = echarts.init(elemRef.value)
      chartInstance.setOption(await getChartOption())
      customEventOptions?.forEach(({ evName, handler }) => {
        chartInstance?.on(evName, (...args: unknown[]) => {
          handler(args[0] as IEvent, chartInstance)
        })
      })
    }
  }

  const resizeChart = () => {
    chartInstance?.resize()
  }

  const updateChart = async () => {
    chartInstance?.setOption(await getChartOption())
  }

  onMounted(() => {
    initChart()
    window.addEventListener('resize', resizeChart)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', resizeChart)
    chartInstance?.dispose() // 释放图表实例占用的资源
  })

  return updateChart
}
