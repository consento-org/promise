export class ExtPromise <T> extends Promise <T> {
  resolve!: (data: T) => void
  reject!: (error: Error) => void
  constructor () {
    super((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export function extPromise <T> (): ExtPromise<T> {
  return new ExtPromise<T>()
}
