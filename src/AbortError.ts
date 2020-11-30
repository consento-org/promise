export class AbortError extends Error {
  code = 'aborted'
  constructor () {
    super('aborted')
  }
}
