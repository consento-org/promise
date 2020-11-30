import is from '@sindresorhus/is'
import { AbortSignal } from 'abort-controller'
import { AbortError } from './AbortError'
import { composeAbort } from './composeAbort'

/**
 * Similar to `Promise.race` but aborts all promises that don't win the race.
 *
 * Usage:
 * ```javascript
 * const { raceWithSignal } = require('@consento/promise/raceWithSignal')
 *
 * // Here the request to google will be aborted if the timeout of 500ms is reached.
 * await raceWithSignal(signal => {
 *   return [
 *     fetch('http://google.com', { signal }),
 *     new Promise((resolve, reject) => setTimeout(reject, 500, new Error('timeout')))
 *   ]
 * })
 *
 * await raceWithSignal(..., inputSignal) // You can also pass-in a signal that you maintain.
 * ```
 *
 * @param command (signal) => Promise[] - template that returns all the promises that should be raced for.
 * @param inputSignal Optional inputSignal that will also trigger an abort of all other promises if aborted.
 */
export async function raceWithSignal <TReturn = unknown> (command: (signal: AbortSignal) => Iterable<Promise<TReturn>>, inputSignal?: AbortSignal): Promise<TReturn> {
  const { signal, abort } = composeAbort(inputSignal)
  const promises = Array.from(command(signal))
  if (!is.nullOrUndefined(inputSignal)) {
    promises.push(new Promise((resolve, reject) => {
      const abortHandler = (): void => {
        clear()
        reject(new AbortError())
      }
      inputSignal.addEventListener('abort', abortHandler)
      const clear = (): void => {
        inputSignal.removeEventListener('abort', abortHandler)
        signal.removeEventListener('abort', clear)
      }
      signal.addEventListener('abort', clear)
    }))
  }
  return await Promise.race(promises).finally(abort)
}
