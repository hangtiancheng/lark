/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'
import { markerListApi } from '@/apis/map'
import type { IRobotItem } from '@/types/robot'
import bus from '@/utils/bus'
import localSvg from '@/assets/local.svg'
import { ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'

interface MapContainerProps {
  onStatData: (stateCounts: number[], minMaxAvg: [number, number, number]) => void
}

const MapContainer: React.FC<MapContainerProps> = ({ onStatData }) => {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let map: any = null
    let worker: Worker | null = null
    const amapKey = process.env.AMAP_JS_KEY || ''

    if (!mapRef.current) {
      AMapLoader.load({
        key: amapKey,
        version: '2.0',
        plugins: [],
      })
        .then((AMap) => {
          if (!containerRef.current) return

          map = new AMap.Map(containerRef.current, {
            viewMode: '3D',
            zoom: 11,
            center: [121.391229, 31.251326],
          })
          mapRef.current = map

          markerListApi().then(({ data: { list } }) => {
            try {
              worker = new Worker('/web-worker.js')
              worker.postMessage(list)

              worker.onmessage = function (ev) {
                const { stateCounts, minMaxAvg } = ev.data as {
                  stateCounts: number[]
                  minMaxAvg: [number, number, number]
                }
                worker?.terminate()
                onStatData(stateCounts, minMaxAvg)
              }
            } catch (e) {
              console.error('Worker failed', e)
            }

            const infoWindow = new AMap.InfoWindow({
              offset: new AMap.Pixel(0, -30),
            })

            const addMarker = (item: IRobotItem) => {
              const { lng, lat, name, state, failureNum, admin, email } = item
              const marker = new AMap.Marker({
                position: [lat, lng],
                title: item.address,
                icon: localSvg,
              })

              marker.on('click', () => {
                infoWindow.setContent(`
                <div class="flex h-31.25 w-62.5 items-center justify-center">
                  <ul class="w-full list-none p-0 m-0 text-left">
                    <li class="truncate">机器人名字: ${name}</li>
                    <li class="truncate">机器人状态: ${ROBOT_STATE_2_TEXT_AND_TYPE.get(state)?.text || ''}</li>
                    <li class="truncate">零件故障数: ${failureNum}</li>
                    <li class="truncate">管理员名字: ${admin}</li>
                    <li class="truncate">管理员邮箱: ${email}</li>
                  </ul>
                </div>
              `)
                infoWindow.open(mapRef.current, marker.getPosition())
              })
              mapRef.current.add(marker)
            }

            bus.subscribe('add-marker', addMarker)
            list.forEach(addMarker)
          })
        })
        .catch(console.error)
    }

    return () => {
      if (worker) {
        worker.terminate()
      }
    }
  }, [])

  const onStatDataRef = useRef(onStatData)
  useEffect(() => {
    onStatDataRef.current = onStatData
  }, [onStatData])

  // 组件卸载时销毁地图
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} className="h-[80vh] w-full" />
}

export default MapContainer
