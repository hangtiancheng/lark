import React, { useState, useEffect, useCallback } from 'react'
import { Flag, Skull } from '@icon-park/react'

interface ICeilState {
  x: number
  y: number
  flipped: boolean // 是否被翻开
  flagged: boolean // 是否被标记
  mine: boolean // 是否为炸弹
  adjacentMines: number // 相邻的炸弹数
}

const WIDTH = 10
const HEIGHT = 10
const BG_COLORS = [
  'bg-transparent', // 0
  'bg-orange-300', // 1
  'bg-yellow-300', // 2
  'bg-green-300', // 3
  'bg-teal-300', // 4
  'bg-sky-300', // 5
  'bg-indigo-300', // 6
  'bg-purple-300', // 7
  'bg-pink-300', // 8
]

const DIRECTIONS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
]

const EmptyMain: React.FC = () => {
  const [ceilsGrid, setCeilsGrid] = useState<ICeilState[][]>(() =>
    Array.from({ length: HEIGHT }, (_, y) =>
      Array.from({ length: WIDTH }, (_, x): ICeilState => {
        return {
          x,
          y,
          flipped: false,
          flagged: false,
          mine: false,
          adjacentMines: 0,
        }
      }),
    ),
  )
  const [mineGenerated, setMineGenerated] = useState(false)

  const getSiblings = useCallback((grid: ICeilState[][], ceil: ICeilState): ICeilState[] => {
    return DIRECTIONS.map(([dx, dy]) => {
      const x2 = ceil.x + dx
      const y2 = ceil.y + dy
      if (x2 < 0 || x2 >= WIDTH || y2 < 0 || y2 >= HEIGHT) {
        return null
      }
      return grid[y2][x2]
    }).filter(Boolean) as ICeilState[]
  }, [])

  const setAdjacentMines = useCallback(
    (grid: ICeilState[][]) => {
      grid.forEach((ceilsRow) => {
        ceilsRow.forEach((ceil) => {
          if (ceil.mine) {
            return
          }
          ceil.adjacentMines = getSiblings(grid, ceil).filter((item) => item.mine).length
        })
      })
    },
    [getSiblings],
  )

  const generateMines = useCallback(
    (grid: ICeilState[][], initialCeil: ICeilState) => {
      for (const ceilsRow of grid) {
        for (const ceil of ceilsRow) {
          if (initialCeil.x === ceil.x && initialCeil.y === ceil.y) {
            continue
          }
          ceil.mine = Math.random() < 0.2
        }
      }
      setAdjacentMines(grid)
    },
    [setAdjacentMines],
  )

  const expandZero = useCallback(
    (grid: ICeilState[][], ceil: ICeilState) => {
      if (ceil.adjacentMines > 0) {
        return
      }
      getSiblings(grid, ceil).forEach((item) => {
        if (item.flipped) {
          return
        }
        item.flipped = true
        expandZero(grid, item)
      })
    },
    [getSiblings],
  )

  const handleClick = (clickedCeil: ICeilState) => {
    setCeilsGrid((prevGrid) => {
      // Deep copy to ensure state update triggers re-render properly
      const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell })))
      const targetCeil = newGrid[clickedCeil.y][clickedCeil.x]

      targetCeil.flagged = false

      let isFirstClick = false
      if (!mineGenerated) {
        generateMines(newGrid, targetCeil)
        setMineGenerated(true)
        isFirstClick = true
      }

      targetCeil.flipped = true

      if (targetCeil.mine && !isFirstClick) {
        setTimeout(() => alert('You lose'), 100)
        return newGrid
      }

      expandZero(newGrid, targetCeil)
      return newGrid
    })
  }

  const handleContextMenu = (e: React.MouseEvent, clickedCeil: ICeilState) => {
    e.preventDefault()
    if (clickedCeil.flipped) {
      return
    }

    setCeilsGrid((prevGrid) => {
      const newGrid = prevGrid.map((row) => row.map((cell) => ({ ...cell })))
      const targetCeil = newGrid[clickedCeil.y][clickedCeil.x]
      targetCeil.flagged = !targetCeil.flagged
      return newGrid
    })
  }

  const getCeilClass = (ceil: ICeilState) => {
    if (ceil.flagged) {
      return 'bg-slate-100/50'
    }
    if (!ceil.flipped) {
      return 'hover:bg-slate-300/50 bg-slate-100/50'
    }
    return ceil.mine ? 'bg-red-300' : BG_COLORS[ceil.adjacentMines]
  }

  useEffect(() => {
    if (!mineGenerated) {
      return
    }

    const ceils = ceilsGrid.flat()
    if (ceils.every((ceil) => ceil.flipped || ceil.flagged)) {
      if (ceils.some((ceil) => ceil.flagged && !ceil.mine)) {
        setTimeout(() => alert('You lose'), 100)
      } else {
        setTimeout(() => alert('You win'), 100)
      }
    }
  }, [ceilsGrid, mineGenerated])

  return (
    <main className="flex flex-col items-center justify-center pt-10">
      <h1 className="text-3xl text-slate-700">扫雷</h1>
      <div className="mt-5 border border-slate-700">
        {ceilsGrid.map((ceilsRow, y) => (
          <div key={y} className="flex">
            {ceilsRow.map((ceil, x) => (
              <button
                key={x}
                className={`flex h-12.5 w-12.5 cursor-pointer items-center justify-center border border-slate-700 ${getCeilClass(ceil)}`}
                style={{ verticalAlign: 'top' }}
                onClick={() => handleClick(ceil)}
                onContextMenu={(e) => handleContextMenu(e, ceil)}
              >
                {ceil.flagged ? (
                  <Flag className="text-red-500" />
                ) : ceil.flipped ? (
                  ceil.mine ? (
                    <Skull className="text-slate-500" />
                  ) : (
                    <div>{ceil.adjacentMines > 0 ? ceil.adjacentMines : ''}</div>
                  )
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </div>
    </main>
  )
}

export default EmptyMain
