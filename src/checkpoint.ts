import { AbortError } from './AbortError'
import { isPromiseLike } from './isPromiseLike'

const cache = new WeakMap<AbortSignal, CheckPoint>()
const passthrough: CheckPoint = <T> (input: T): T => input

export type CheckPoint = <T extends Promise<any>> (input: T) => T

/**
 * Allows the creation of a checkpoint function that aborts
 * an async script if a signal is aborted.
 *
 * Usage:
 *
 * ```javascript
 * const { checkpoint } = require('@consento/promise/checkpoint')
 *
 * async function longRunning ({ signal }: {}) {
 *   const cp = checkpoint(signal)
 *   let result
 *   for (const data of internalIterator()) {
 *     result += await cp(data) // An AbortError will be thrown if the passed-in signal happens to be aborted.
 *   }
 *   return result
 * }
 * ```
 *
 * @param signal Optional, AbortSignal to listen to.
 * @returns passthrough function that may thrown an error if the optional signal is aborted, else it will simply return the input
 * @see bubbleAbort for a simpler variant that requires more typing.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
 */
export function checkpoint (signal?: AbortSignal): CheckPoint {
  if (signal === undefined || signal === null) {
    return passthrough
  }
  let cp = cache.get(signal)
  if (cp === undefined) {
    cp = <T> (input: T): T => {
      if (isPromiseLike(input)) {
        return input.then(data => {
          if (signal.aborted) {
            throw new AbortError()
          }
          return data
        }) as unknown as T
      }
      if (signal.aborted) {
        throw new AbortError()
      }
      return input
    }
    cache.set(signal, cp)
  }
  return cp
}
