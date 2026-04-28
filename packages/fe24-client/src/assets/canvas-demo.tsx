import React, { useEffect, useRef, useState, useMemo } from 'react'

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

const CanvasDemo: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const len = useMemo(() => Math.min(windowSize.width, windowSize.height) * 0.5, [windowSize])

  const pendingTasksRef = useRef<(() => void)[]>([])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // clear canvas when size changes before re-drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    pendingTasksRef.current = []

    ctx.strokeStyle = '#ccc'

    const drawFlower = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
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

    const drawBranch2 = (ctx: CanvasRenderingContext2D, startPoint: Point, endPoint: Point) => {
      ctx.beginPath()
      ctx.moveTo(startPoint.x, startPoint.y)
      ctx.lineTo(endPoint.x, endPoint.y)
      ctx.stroke()
    }

    const drawBranch = (ctx: CanvasRenderingContext2D, branch: Branch) => {
      const endPoint = getEndPoint(branch)
      drawBranch2(ctx, branch.startPoint, endPoint)
    }

    const step = (ctx: CanvasRenderingContext2D, branch: Branch, depth = 0) => {
      drawBranch(ctx, branch)
      const endPoint = getEndPoint(branch)
      drawFlower(ctx, endPoint.x, endPoint.y)
      if (depth === 10) {
        return
      }

      if (depth < 3 || Math.random() < 0.5) {
        pendingTasksRef.current.push(() =>
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
        pendingTasksRef.current.push(() =>
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

    step(ctx, {
      startPoint: { x: 0, y: len },
      length: len / 12,
      angle: -Math.PI / 4,
    })

    const frame = () => {
      const tasksSnapshot = [...pendingTasksRef.current]
      pendingTasksRef.current.length = 0
      tasksSnapshot.forEach((fn) => fn())
    }

    let framesCnt = 0
    let animationFrameId: number

    const startFrame = () => {
      animationFrameId = requestAnimationFrame(() => {
        framesCnt += 1
        if (framesCnt % 100 === 0) {
          frame()
        }
        startFrame()
      })
    }

    startFrame()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [len])

  return (
    <div className="flex h-[80vh] w-full items-center justify-center">
      <canvas ref={canvasRef} width={len} height={len} className="rounded-3xl border" />
    </div>
  )
}

export default CanvasDemo
