import { AbortError } from './AbortError'
import { AbortSignal } from 'abort-controller'

const cache = new WeakMap<AbortSignal, CheckPoint>()
const passthrough: CheckPoint = <T> (input?: () => T): T | undefined => {
  if (typeof input === 'function') {
    return input()
  }
}

export interface CheckPoint {
  (): void
  <T> (input: () => T): T
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
 *     cp() // you can use the checkpoint as-is
 *     result += data
 *
 *     // passing-in a template function is going to execute that
 *     // template function only it the signal is not aborted.
 *     const foo = await cp(async () => 'bar')
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
  if (signal.aborted) {
    throw new AbortError()
  }
  let cp = cache.get(signal)
  if (cp === undefined) {
    cp = <T> (input?: () => T): T | undefined => {
      if (signal.aborted) {
        throw new AbortError()
      }
      if (typeof input === 'function') {
        return input()
      }
    }
    cache.set(signal, cp)
  }
  return cp
}
