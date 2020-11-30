/* eslint-disable @typescript-eslint/return-await */
import { isPromiseLike } from './isPromiseLike'
import is from '@sindresorhus/is'

const cache = new WeakMap<any, Promise<any>>()

/**
 * For when you need to make sure that you have a promise at hand.
 *
 * Turns any given js object into a Promise. It will also cache the
 * Promises to save memory and instantiation time.
 *
 * There are several legacy promise implementations that are similar
 * but different from the `Promise` javascript standard, this method
 * will turn those promises into actual Promises.
 *
 * Usage:
 * ```javascript
 * const { toPromise } = require('@consento/promise/toPromise')
 *
 * toPromise(1) // Promise<1>
 * toPromise(Promise.resolve(1)) // same promise as input
 * toPromise({ then: (resolve, reject) => { ... } }) // returns a standard Promise
 *
 * const obj = { hello: 'world' }
 * toPromise(obj) // Returns a promise for `obj`
 * toPromise(obj) // Returns exactly the same promise as the previous call.
 * ```
 *
 * @param input PromiseLike or data to be turned into Promise
 */
// eslint-disable-next-line @typescript-eslint/promise-function-async
export function toPromise<T> (input: T | PromiseLike<T>): Promise<T> {
  if (input instanceof Promise) {
    return input
  }
  if (isPromiseLike(input)) {
    let promise = cache.get(input)
    if (promise === undefined) {
      promise = new Promise((resolve, reject) => { input.then(resolve, reject) })
      cache.set(input, promise)
    }
    return promise
  }
  if (is.object(input)) {
    let promise = cache.get(input)
    if (promise === undefined) {
      promise = Promise.resolve(input)
      cache.set(input, promise)
    }
    return promise
  }
  return Promise.resolve(input)
}
