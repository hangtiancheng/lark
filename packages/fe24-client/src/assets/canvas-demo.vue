<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const windowSize = ref({
  width: window.innerWidth,
  height: window.innerHeight,
})

const len = computed(() => Math.min(windowSize.value.width, windowSize.value.height) * 0.5)

interface Point {
  x: number // -→
  y: number // ↓
}

interface Branch {
  startPoint: Point
  length: number
  angle: number
  // -→ 0°
  // ↓ 90°
}

const handleResize = () => {
  windowSize.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

const canvasInit = () => {
  const canvas = canvasRef.value!
  const ctx: CanvasRenderingContext2D = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  pendingTasks.length = 0
  ctx.strokeStyle = '#ccc'

  step(ctx, {
    startPoint: { x: 0, y: len.value },
    length: len.value / 12,
    angle: -Math.PI / 4,
  })
}

const pendingTasks: (() => void)[] = []

const step = (ctx: CanvasRenderingContext2D, branch: Branch, depth = 0) => {
  drawBranch(ctx, branch)
  const endPoint = getEndPoint(branch)
  drawFlower(ctx, endPoint.x, endPoint.y)
  if (depth === 10) {
    return
  }

  if (depth < 3 || Math.random() < 0.5) {
    pendingTasks.push(() =>
      step(
        ctx,
        {
          startPoint: endPoint,
          length: branch.length * (1 + Math.random() * 0.2),
          angle: branch.angle - (Math.PI / 7) * Math.random(),
        },
        depth + 1,
      ),
    )
  }
  if (depth < 3 || Math.random() < 0.5) {
    pendingTasks.push(() =>
      step(
        ctx,
        {
          startPoint: endPoint,
          length: branch.length * (1 + Math.random() * 0.2),
          angle: branch.angle + (Math.PI / 7) * Math.random(),
        },
        depth + 1,
      ),
    )
  }
}

const frame = () => {
  const tasksSnapshot = [...pendingTasks]
  pendingTasks.length = 0
  tasksSnapshot.forEach((fn) => fn())
}

let framesCnt = 0
let rafId = 0
const startFrame = () => {
  rafId = requestAnimationFrame(() => {
    framesCnt += 1
    if (framesCnt % 100 === 0) {
      frame()
    }
    startFrame()
  })
}

startFrame()

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', handleResize)
})

const getEndPoint = (branch: Branch): Point => {
  const {
    startPoint: { x, y },
    length,
    angle,
  } = branch
  return {
    x: x + length * Math.cos(angle),
    y: y + length * Math.sin(angle),
  }
}

const drawBranch = (ctx: CanvasRenderingContext2D, branch: Branch) => {
  const endPoint = getEndPoint(branch)
  drawBranch2(ctx, branch.startPoint, endPoint)
}

const drawBranch2 = (ctx: CanvasRenderingContext2D, startPoint: Point, endPoint: Point) => {
  ctx.beginPath()
  ctx.moveTo(startPoint.x, startPoint.y)
  ctx.lineTo(endPoint.x, endPoint.y)
  ctx.stroke()
}

const canvasRef = ref<HTMLCanvasElement>()
onMounted(() => {
  canvasInit()
  window.addEventListener('resize', handleResize)
})

watch(len, () => {
  if (canvasRef.value) {
    canvasInit()
  }
})

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'red'
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.rotate((Math.PI * 2) / 5)
    ctx.ellipse(4, 0, 3, 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.fillStyle = 'white'
  ctx.arc(0, 0, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
</script>

<template>
  <div class="flex h-[80vh] w-full items-center justify-center">
    <canvas ref="canvasRef" :width="len" :height="len" class="rounded-3xl border" />
  </div>
</template>

<style scoped lang="scss"></style>
