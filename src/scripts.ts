export const insensitiveIsEqualTo = (value: string) => (compareWith: string) =>
  value.toLowerCase().trim() === compareWith.toLowerCase().trim()

export function groupBy<K, V> (list: Array<V>, keyGetter: (input: V) => K): Map<K, Array<V>> {
  const map = new Map()
  list.forEach((item) => {
    const key = keyGetter(item)
    const collection = map.get(key)
    if (!collection) {
      map.set(key, [item])
    } else {
      collection.push(item)
    }
  })
  return map
}
