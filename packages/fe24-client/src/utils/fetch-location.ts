/**
 *
 * @param address 地址字符串
 * @returns [lat, lng]
 */
export async function fetchLocation(address: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    fetch(
      `https://restapi.amap.com/v3/geocode/geo?key=${process.env.AMAP_WEB_KEY || '22d05f3b745408a2870428df1c3f58a9'}&address=${address}`,
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
