import { useEffect, useRef, useCallback } from 'react'
import echarts, { type ECOption } from '@/utils/echarts'

interface IEvent {
  axesInfo?: { value: number }[]
}

export interface ICustomEventOption {
  evName: string
  handler: (ev: IEvent, chartInstance: echarts.ECharts | null) => void
}

export function useChart(
  getChartOption: () => Promise<ECOption>,
  customEventOptions?: ICustomEventOption[],
) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  const initChart = useCallback(async () => {
    if (chartRef.current) {
      if (!chartInstanceRef.current) {
        chartInstanceRef.current = echarts.init(chartRef.current)
      }
      chartInstanceRef.current.setOption(await getChartOption())
      customEventOptions?.forEach(({ evName, handler }) => {
        chartInstanceRef.current?.off(evName)
        chartInstanceRef.current?.on(evName, (...args: unknown[]) => {
          handler(args[0] as IEvent, chartInstanceRef.current)
        })
      })
    }
  }, [getChartOption, customEventOptions])

  const resizeChart = useCallback(() => {
    chartInstanceRef.current?.resize()
  }, [])

  const updateChart = useCallback(async () => {
    chartInstanceRef.current?.setOption(await getChartOption())
  }, [getChartOption])

  useEffect(() => {
    initChart()
    window.addEventListener('resize', resizeChart)

    return () => {
      window.removeEventListener('resize', resizeChart)
      chartInstanceRef.current?.dispose()
      chartInstanceRef.current = null
    }
  }, [initChart, resizeChart])

  return { chartRef, updateChart }
}
