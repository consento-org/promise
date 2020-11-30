import is from '@sindresorhus/is'

/**
 * Extended Promise that has the `resolve` and `reject` methods
 * on the class instance instead of a template function.
 *
 * ```javascript
 * const { CBPromise } = require('@consento/promise/cbPromise')
 *
 * const p = new CBPromise()
 * p.cb(new Error(), 'result') // traditional callback API
 * p.resolve('result') // or use traditional resolve
 * p.reject(new Error()) // and reject
 * ```
 *
 * This may come in handy when you need a callback but want to await
 * the promise.
 *
 * ```javascript
 * async function test () {
 *   const p = new CBPromise()
 *   setTimeout(p.resolve, 500)
 *   await p
 * }
 * ```
 */
export class CBPromise <T> extends Promise <T> {
  resolve!: (data: T) => void
  reject!: (error: Error) => void
  _cb?: (error: Error | null, data?: T) => void
  constructor () {
    super((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }

  get cb (): (error: Error | null, data?: T) => void {
    if (this._cb === undefined) {
      this._cb = (error, data) => {
        if (is.nullOrUndefined(error)) {
          return this.resolve(data as T)
        }
        this.reject(error)
      }
    }
    return this._cb
  }
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export function cbPromise <T> (): CBPromise<T> {
  return new CBPromise<T>()
}
