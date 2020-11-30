import { AbortSignal } from 'abort-controller'

export { AbortSignal, AbortController } from 'abort-controller'

export type IPromiseCleanup = () => void | PromiseLike<void>

export interface IAbortOptions {
  signal?: AbortSignal
}

export interface ITimeoutOptions extends IAbortOptions {
  timeout?: number
}
