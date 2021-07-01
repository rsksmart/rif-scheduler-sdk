import { time } from '@openzeppelin/test-helpers'

/**
 * This module gets the timestamp of the current block (only for test proposes).
 */
export const timeLatest = async () => {
  const timestamp = await time.latest()

  return new Date(+timestamp * 1000)
}
