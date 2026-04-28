/**
 *
 * @param address 地址字符串
 * @returns [lat, lng]
 */
export async function fetchLocation(address: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    fetch(
      `https://restapi.amap.com/v3/geocode/geo?key=${import.meta.env.VITE_AMAP_WEB_KEY}&address=${address}`,
    )
      .then((res) => res.json())
      .then((jsonData) =>
        resolve(
          (jsonData.geocodes[0].location as string)
            .split(',')
            .map((item) => Number.parseFloat(item) /** Number.parseFloat */),
        ),
      )
      .catch((err) => {
        reject(err)
      })
  })
}
