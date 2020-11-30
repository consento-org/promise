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

export async function wrapTimeout <T> (command: (signal: AbortSignal | undefined, resetTimeout: () => void) => Promise<T>, { timeout, signal: inputSignal }: TimeoutOptions = {}): Promise<T> {
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
