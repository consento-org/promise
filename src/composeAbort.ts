import AbortController, { AbortSignal } from 'abort-controller'
import { AbortError } from './AbortError'

class ComposedAbortController extends AbortController {
  constructor (signal?: AbortSignal) {
    super()
    if (signal === null || signal === undefined) {
      return
    }
    if (signal.aborted) {
      throw new AbortError()
    }
    const parentAborted = (): void => {
      this.abort()
    }
    const clear = (): void => {
      signal.removeEventListener('abort', parentAborted)
      this.signal.removeEventListener('abort', clear)
    }
    signal.addEventListener('abort', parentAborted)
    this.signal.addEventListener('abort', clear)
  }
}

/**
 * Creates a new AbortController-compatible instance
 * that can be aborted both with the `abort` operation and
 * a passed-in signal.
 *
 * Usage:
 * ```javascript
 * const { composeAbort } = require('@consento/promise/composeAbort')
 * const { AbortController } = require('abort-controller')
 *
 * const main = new AbortController()
 * const composed = composeAbort(main.signal)
 *
 * main.abort() // Will both abort main and composed
 * composed.abort() // Will abort only the composed
 *
 * const other = composeAbort(null) // The signal is optional, allows for flexibility of an abortsignal.
 * ```
 *
 * @param signal Optional Signal that can abort the controller
 */
export function composeAbort (signal?: AbortSignal): AbortController {
  return new ComposedAbortController(signal)
}
