import { AbortSignal } from 'abort-controller'

export interface AbortOptions {
  signal?: AbortSignal
}

export interface TimeoutOptions extends AbortOptions {
  timeout?: number
}
