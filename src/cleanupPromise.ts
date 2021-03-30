import { AbortSignal } from 'abort-controller'
import { TimeoutOptions } from './options'
import { AbortError } from './AbortError'
import { wrapTimeout } from './wrapTimeout'
import { isPromiseLike } from './isPromiseLike'

const noop = (): void => {}

export type PromiseCleanup = () => void | PromiseLike<void>
export type CleanupCommand<T> = (
  (
    resolve: (result: T) => void,
    reject: (error: Error) => void,
    signal: AbortSignal | null | undefined,
    resetTimeout: () => void
  ) => (PromiseCleanup | Promise<PromiseCleanup>)
) | (
  (
    resolve: (result: T) => void,
    reject: (error: Error) => void,
    signal: AbortSignal | null | undefined,
    resetTimeout: () => void
  ) => void
)

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
 *   // If no signal is necessary, the signal will not be provided.
 *   signal?.addEventListener('abort', abortHandler)
 *   return () => {
 *     // Executed after resolve or reject is called.
 *     signal?.removeEventListener('abort', abortHandler)
 *   }
 * })
 *
 * cleanupPromise(..., { timeout: 500, signal }) // You can also pass-in a parent signal or a timeout!
 *
 * cleanupPromise((resolve, reject): void => {}) // You can also use it like a regular promise
 * ```
 *
 * @param command Async command that will be executed with additional signal
 * @see wrapTimeout for the timeout details
 */
export async function cleanupPromise <T = unknown> (
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
      const withCleanup = (cleanup: any): void => {
        const hasSignal = signal !== null && signal !== undefined
        // @ts-expect-error 2532 - signal is certainly not undefined with hasSignal
        if (hasSignal && signal.aborted) {
          earlyFinish = earlyFinish ?? { error: new AbortError() }
        }
        if (earlyFinish !== undefined) {
          const finish = earlyFinish
          const close = (cleanupError?: Error): void => {
            if ('error' in finish) {
              return reject(finish.error)
            }
            if (cleanupError !== null && cleanupError !== undefined) {
              return reject(cleanupError)
            }
            return resolve(finish.result)
          }
          if (typeof cleanup !== 'function') {
            close()
            return
          }
          let finalP
          try {
            finalP = cleanup()
          } catch (cleanupError) {
            reject('error' in finish ? finish.error : cleanupError)
            return
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
          const close = (cleanupError?: Error): void => {
            if ('error' in finish) {
              return reject(finish.error)
            }
            if (cleanupError !== null && cleanupError !== undefined) {
              return reject(cleanupError)
            }
            return resolve(finish.result)
          }
          if (typeof cleanup !== 'function') {
            close()
            return
          }
          let finalP
          try {
            finalP = cleanup()
          } catch (cleanupError) {
            reject('error' in finish ? finish.error : cleanupError)
            return
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
