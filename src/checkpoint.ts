import { AbortError } from './AbortError'

const cache = new WeakMap<AbortSignal, CheckPoint>()
const passthrough: CheckPoint = <T> (input?: T): T | undefined => input

export interface CheckPoint {
  (): void
  <T> (input: T): T
}

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
 *     result += cp(data) // An AbortError will be thrown if the passed-in signal happens to be aborted.
 *     cp() // You don't need to pass in data, you can also use it as-is
 *     const foo = await cp(Promise.resolve('bar')) // the return type is equal to the input type,
 *                                                  // if a promise, you need to await it.
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
    cp = <T> (input?: T): T | undefined => {
      if (signal.aborted) {
        throw new AbortError()
      }
      return input
    }
    cache.set(signal, cp)
  }
  return cp
}
