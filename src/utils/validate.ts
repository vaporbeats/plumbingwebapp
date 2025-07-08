export function validateNumber(val: string | number | undefined | null): number {
  if (val == null) return 0
  if (typeof(val) === 'number') {
    if (isNaN(val)) return 0
    return val
  }
  const cleaned = val.replace(/,/g, '')
  const parsed = parseFloat(cleaned)
  if (isNaN(parsed)) return 0
  return parsed
}

export function validateInteger(val: string | number | undefined | null): number {
  const num = validateNumber(val)
  return Math.floor(num)
}