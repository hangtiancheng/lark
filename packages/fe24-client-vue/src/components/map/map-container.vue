<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import AMapLoader from '@amap/amap-jsapi-loader'
import { onMounted, onUnmounted, ref } from 'vue'
import { markerListApi } from '@/apis/map'
import type { IRobotItem } from '@/types/robot'
import bus from '@/utils/bus'

const emit = defineEmits<{
  statData: [stateCounts: number[] & { length: 6 }, minMaxAvg: [number, number, number]] // 具名元组
}>()

//! import.meta.glob
// const imgList: Record<string, { default: string }> = import.meta.glob(
//   ['@/assets/*.png', '@/assets/*.jpg', '@/assets/*.svg'],
//   {
//     eager: true,
//   },
// )
import localSvg /** string */ from '@/assets/local.svg'
import { ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'

let map: any = null

const robotList = ref<IRobotItem[]>()
onMounted(() => {
  AMapLoader.load({
    key: import.meta.env.VITE_AMAP_JS_KEY,
    version: '2.0',
    plugins: [
      /** 'AMap.Scale' */
    ],
  })
    .then((AMap) => {
      map = new AMap.Map('map-container', {
        viewMode: '3D',
        zoom: 11,
        center: [121.391229 /** lat */, 31.251326 /** lng */],
      })

      markerListApi().then(({ data: { list } }) => {
        // web worker
        const worker = new Worker('@/assets/web-worker.ts?worker')
        worker.postMessage(list) // 深拷贝 list
        // worker.postMessage(list, [list]) // 转移所有权

        worker.onmessage = function (ev) {
          const { stateCounts, minMaxAvg } = ev.data as {
            stateCounts: number[] & { length: 6 }
            minMaxAvg: [number, number, number]
          }
          // 主线程终止子线程
          worker.terminate()
          emit('statData', stateCounts, minMaxAvg)
        }

        // 创建地图标记信息窗口 infoWindow
        const infoWindow = new AMap.InfoWindow({
          offset: new AMap.Pixel(0, -30),
        })

        robotList.value = list

        // flex: 0 1 auto;
        // 不能拉伸, 可以压缩, 伸缩项目初始长度 = 盒子宽度

        // flex: auto; 等价于 flex: 1 1 auto;
        // 可以拉伸, 可以压缩, 伸缩项目初始长度 = 盒子宽度

        // flex: none; 等价于 flex: 0 0 auto;
        // 不能拉伸, 不能压缩, 伸缩项目初始长度 = 盒子宽度

        // flex: 1; 或 flex: 0%; 等价于 flex: 1 1 0%;
        // 可以拉伸, 可以压缩, 伸缩项目初始长度 = 0

        // flex: 24px; 等价于 flex: 1 1 24px;
        // 可以拉伸, 可以压缩, 伸缩项目初始长度 = 24px

        const addMarker = (item: {
          lng?: number
          lat?: number
          name: string
          address: string
          state: 0 | 1 | 2 | 3 | 4 | 5
          failureNum: number
          admin: string
          email: string
        }) => {
          const { lng, lat, name, state, failureNum, admin, email } = item
          const marker = new AMap.Marker({
            position: [lat, lng],
            title: item.address,
            icon: localSvg,
          })
          // 为 marker 添加点击事件
          marker.on('click', () => {
            infoWindow.setContent(
              `
              <div class="flex h-[125px] w-[250px] items-center justify-center">
                <ul class="w-full">
                  <li class="truncate">机器人名字: ${name}</li>
                  <li class="truncate">机器人状态: ${ROBOT_STATE_2_TEXT_AND_TYPE.get(state)!.text}</li>
                  <li class="truncate">零件故障数: ${failureNum}</li>
                  <li class="truncate">管理员名字: ${admin}</li>
                  <li class="truncate">管理员邮箱: ${email}</li>
                </ul>
              </div>
              `,
            )
            infoWindow.open(map, marker.getPosition())
          })
          map.add(marker)
        }
        // 订阅
        bus.subscribe('add-marker', addMarker)
        robotList.value?.forEach(addMarker)
      })
    })
    .catch(
      /** (err) => {
      console.error(err)
    } */ console.error,
    )
})

onUnmounted(() => {
  map?.destroy()
})
</script>

<template>
  <div id="map-container" class="h-[80vh] w-full"></div>
</template>
