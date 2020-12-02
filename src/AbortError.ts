/**
 * To be thrown when a Signal is aborted.
 *
 * Equal to Node.JS's AbortError
 *
 * @see https://github.com/nodejs/node/blob/1ed72f67f5ea82b36b8589e447619e98c004fa12/lib/internal/errors.js#L735-L741
 */
export class AbortError extends Error {
  code = 'ABORT_ERR'
  name = 'AbortError'
  constructor () {
    super('The operation was aborted')
  }
}
