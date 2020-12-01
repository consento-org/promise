import is from '@sindresorhus/is'
import { TimeoutOptions } from './options'
import { AbortError } from './AbortError'
import { wrapTimeout } from './wrapTimeout'
import { isPromiseLike } from './isPromiseLike'

const noop = (): void => {}

export type PromiseCleanup = () => void | PromiseLike<void>
export type CleanupCommand<T> = (
  resolve: (result: T) => void,
  reject: (error: Error) => void,
  signal: AbortSignal | null | undefined,
  resetTimeout: () => void
) => (PromiseCleanup | Promise<PromiseCleanup>)

/**
 * Versatile custom Promise implementation that allows to execute an async
 * cleanup operation after a promise is resolved or rejected.
 *
 * Usage:
 *
 * ```javascript
 * import { cleanupPromise } = require('@consento/promise/cleanupPromise')
 *
 * const result = await cleanupPromise((resolve, reject, signal) => {
 *   setTimeout(resolve, Math.random() * 500) // Resolve & reject work like in regular promises
 *   setTimeout(reject, Math.random() * 500)
 *   const abortHandler = () => {
 *     reject(new Error('aborted'))
 *   }
 *   signal.addEventListener('abort', abortHandler)
 *   return () => {
 *     // Executed after resolve or reject is called.
 *     signal.removeEventListener('abort', abortHandler)
 *   }
 * })
 *
 * cleanupPromise(..., { timeout: 500, signal }) // You can also pass-in a parent signal or a timeout!
 * ```
 *
 * @param command Async command that will be executed with additional signal
 * @see wrapTimeout for the timeout details
 */
export async function cleanupPromise <T> (
  command: CleanupCommand<T>,
  opts: TimeoutOptions = {}
): Promise<T> {
  const abortError = new AbortError()
  return await wrapTimeout <T>(
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    (signal, resetTimeout): Promise<T> => new Promise((resolve, reject) => {
      type Finish = { error: Error } | { result: T }
      let earlyFinish: Finish | undefined
      let process = (finish: Finish): void => {
        process = noop
        earlyFinish = finish
      }
      let cleanupP
      try {
        cleanupP = command(
          result => process({ result }),
          error => process({ error }),
          signal,
          resetTimeout
        )
      } catch (error) {
        reject(error)
        return
      }
      const withCleanup = (cleanup: PromiseCleanup): void => {
        const hasSignal = !is.nullOrUndefined(signal)
        // @ts-expect-error 2532 - signal is certainly not undefined with hasSignal
        if (hasSignal && signal.aborted) {
          earlyFinish = earlyFinish ?? { error: new AbortError() }
        }
        if (earlyFinish !== undefined) {
          const finish = earlyFinish
          let finalP
          try {
            finalP = cleanup()
          } catch (cleanupError) {
            reject('error' in finish ? finish.error : cleanupError)
            return
          }
          const close = (cleanupError?: Error): void => {
            if ('error' in finish) {
              return reject(finish.error)
            }
            if (!is.nullOrUndefined(cleanupError)) {
              return reject(cleanupError)
            }
            return resolve(finish.result)
          }
          if (isPromiseLike(finalP)) {
            finalP.then(() => close(), close)
            return
          }
          close()
          return
        }
        const abort = (): void => process({ error: abortError })
        if (hasSignal) {
          // @ts-expect-error 2532 - signal is certainly not undefined with hasSignal
          signal.addEventListener('abort', abort)
        }
        process = finish => {
          process = noop
          if (hasSignal) {
            // @ts-expect-error 2532 - signal is certainly not undefined with hasSignal
            signal.removeEventListener('abort', abort)
          }

          let finalP
          try {
            finalP = cleanup()
          } catch (cleanupError) {
            reject('error' in finish ? finish.error : cleanupError)
            return
          }
          const close = (cleanupError?: Error): void => {
            if ('error' in finish) {
              return reject(finish.error)
            }
            if (!is.nullOrUndefined(cleanupError)) {
              return reject(cleanupError)
            }
            return resolve(finish.result)
          }
          if (isPromiseLike(finalP)) {
            finalP.then(() => close(), close)
            return
          }
          close()
        }
      }
      if (isPromiseLike(cleanupP)) {
        cleanupP.then(
          withCleanup,
          reject
        )
      } else {
        withCleanup(cleanupP)
      }
    }),
    opts
  )
}
