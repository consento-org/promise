import is from '@sindresorhus/is'

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
