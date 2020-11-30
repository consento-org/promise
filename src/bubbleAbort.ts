import { AbortError } from './AbortError'

/**
 * Simple function that throws an AbortError if an AbortSignal
 * happens to be aborted.
 *
 * Usage:
 * ```javascript
 * const { bubbleAbort } = require('@consento/promise/bubbleAbort')
 *
 * async function longRunning ({ signal } = {}) {
 *   let result = ''
 *   for await (const data of internalIterator()) {
 *     bubbleAbort(signal) // Will throw an error if the signal is aborted
 *     result += data
 *   }
 *   return result
 * }
 * ```
 *
 * @param signal Optional signal that may be aborted.
 * @see checkpoint for an alternative syntax that requires less typing.
 * @see AbortError
 */
export function bubbleAbort (signal?: AbortSignal | null): void {
  if (signal === undefined || signal === null) {
    return
  }
  if (signal.aborted) {
    throw new AbortError()
  }
}
