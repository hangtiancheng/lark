self.onmessage = function (ev: MessageEvent) {
  const list = ev.data as { state: 0 | 1 | 2 | 3 | 4 | 5; failureNum: number }[]
  const stateCounts = [0, 0, 0, 0, 0, 0]
  const minMaxAvg = [Infinity, 0, 0]

  if (!list || list.length === 0) {
    postMessage({ stateCounts, minMaxAvg })
    return
  }

  stateCounts[0] = list.length

  list.forEach((item) => {
    stateCounts[item.state] += 1
    minMaxAvg[0] = Math.min(minMaxAvg[0], item.failureNum)
    minMaxAvg[1] = Math.max(minMaxAvg[1], item.failureNum)
    minMaxAvg[2] += item.failureNum
  })

  minMaxAvg[2] = Number.parseInt((minMaxAvg[2] / list.length).toFixed(0), 10)
  postMessage({ stateCounts, minMaxAvg })
  self.close()
}
