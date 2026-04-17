// 1234.5678 -> "1,234.5,678"
export function commaSep(num: number): string {
  if (Number.isNaN(num) || typeof num !== 'number') {
    throw new TypeError('Expect a number')
  }
  const [integerPart, decimalPart] = num.toString().split('.')
  const sep = integerPart.split('')
  for (let i = integerPart.length - 3; i > 0; i -= 3) {
    sep.splice(i, 0, ',')
  }
  return decimalPart ? sep.join('') + '.' + decimalPart : sep.join('')
}
