import { IAbortController, ITimeoutOptions, IPromiseCleanup } from './types'
import { AbortController, AbortSignal } from 'abort-controller'
import { isPromiseLike } from '.'
import is from '@sindresorhus/is'
import { AbortError } from './AbortError'
import { bubbleAbort } from './bubbleAbort'

export function composeAbort (signal?: AbortSignal): IAbortController {
  const controller = new AbortController()
  let aborted = false
  const abort = (): void => {
    if (aborted) return
    aborted = true
    if (!is.nullOrUndefined(signal)) {
      signal.removeEventListener('abort', abort)
    }
    controller.abort()
  }
  if (!is.nullOrUndefined(signal)) {
    if (signal.aborted) {
      throw new AbortError()
    }
    signal.addEventListener('abort', abort)
  }
  return {
    signal: controller.signal,
    abort
  }
}

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

const noop = (): void => {}

export async function cleanupPromise <T> (
  command: (
    resolve: (result: T) => void,
    reject: (error: Error) => void,
    signal: AbortSignal | null | undefined,
    resetTimeout: () => void
  ) => (IPromiseCleanup | Promise<IPromiseCleanup>),
  opts: ITimeoutOptions = {}
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
      const withCleanup = (cleanup: IPromiseCleanup): void => {
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

export class TimeoutError extends Error {
  timeout: number
  code = 'timeout'
  constructor (timeout: number) {
    super(`Timeout [t=${timeout}]`)
    this.timeout = timeout
  }
}

export async function wrapTimeout <T> (command: (signal: AbortSignal | undefined, resetTimeout: () => void) => Promise<T>, { timeout, signal: inputSignal }: ITimeoutOptions = {}): Promise<T> {
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
