/**
 * To be thrown when a Signal is aborted.
 */
export class AbortError extends Error {
  code = 'aborted'
  constructor () {
    super('aborted')
  }
}
