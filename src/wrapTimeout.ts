import { TimeoutOptions } from './options'
import { AbortSignal } from 'abort-controller'
import is from '@sindresorhus/is'
import { bubbleAbort } from './bubbleAbort'
import { raceWithSignal } from './raceWithSignal'

const noop = (): void => {}

export class TimeoutError extends Error {
  timeout: number
  code = 'timeout'
  constructor (timeout: number) {
    super(`Timeout [t=${timeout}]`)
    this.timeout = timeout
  }
}

/**
 * Wraps an async operation and passes-in a signal that will be marked as
 * aborted when a given timeout set's in.
 *
 * Usage:
 * ```javascript
 * const { wrapTimeout } = require('@consento/promise/wrapTimeout')
 *
 * wrapTimeout(async (signal, resetTimeout) => {
 *   if (signal) { // Signal may be undefined if timeout=0 is specified.
 *     signal.addEventListener('abort', () => {
 *       // now we should abort our work.
 *     })
 *   }
 *   resetTimeout() // With reset-timeout you can reset a given input timeout, this may be useful to delay a timeout after user interaction.
 * }, { timeout: 500 })
 * ```
 *
 * @param command command to be executed; receives an AbortSignal if given or undefined and a function that can reset the timeout
 * @param opts.timeout Optional timeout specification, 0 means that the timeout is ignored.
 * @param opts.signal Optional parent signal that can abort the the async function as well.
 */
export async function wrapTimeout <T> (command: (signal: AbortSignal | undefined, resetTimeout: () => void) => Promise<T>, opts: TimeoutOptions = {}): Promise<T> {
  const { timeout, signal: inputSignal } = opts
  if (is.nullOrUndefined(timeout) || timeout === 0) {
    bubbleAbort(inputSignal)
    return await command(inputSignal, noop)
  }
  return await raceWithSignal <T>(signal => {
    let reset: () => void = noop
    const p = new Promise <T>((resolve, reject) => {
      let timer: any
      const clear = (): void => {
        reset = noop
        signal.removeEventListener('abort', clear)
      }
      reset = () => {
        if (timer !== undefined) {
          clearTimeout(timer)
        }
        timer = setTimeout(() => {
          reject(new TimeoutError(timeout))
          clear()
        }, timeout)
      }
      reset()
      signal.addEventListener('abort', clear)
    })
    return [
      command(signal, reset),
      p
    ]
  }, inputSignal)
}
