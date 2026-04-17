onmessage = function (ev) {
  /**
   * @type Array<{ state: 0 | 1 | 2 | 3 | 4 | 5, failureNum: number }>
   */
  const list = ev.data
  const stateCounts = [0, 0, 0, 0, 0, 0]
  const minMaxAvg = [Infinity, 0, 0]

  // list === undefined; list.length === undefined; list.length === 0;
  if (!list || !list.length) {
    postMessage({ stateCounts, minMaxAvg })
    return
  }

  stateCounts[0] = list.length
  for (const item of list) {
    stateCounts[item.state]++
    minMaxAvg[0] = Math.min(minMaxAvg[0], item.failureNum)
    minMaxAvg[1] = Math.max(minMaxAvg[1], item.failureNum)
    minMaxAvg[2] += item.failureNum
  }
  minMaxAvg[2] = Number.parseInt((minMaxAvg[2] / list.length).toFixed(0))
  postMessage({ stateCounts, minMaxAvg })

  // worker 子线程可以自我关闭
  /** this. */ close()
}
