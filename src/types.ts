import { AbortSignal } from 'abort-controller'
export { Buffer } from 'buffer'

export { AbortSignal, AbortController } from 'abort-controller'

export type IPromiseCleanup = () => void | PromiseLike<void>

export type TCheckPoint = <T extends Promise<any>> (input: T) => T

export interface IAbortController {
  signal: AbortSignal
  abort: () => void
}

export interface IAbortOptions {
  signal?: AbortSignal
}

export interface ITimeoutOptions extends IAbortOptions {
  timeout?: number
}
