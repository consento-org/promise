# `@consento/promise`

A set of utilities for working with [Promises]() with particular focus
on abort-ability using [`AbortSignal`s][AbortSignal].

[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
[AbortSignal]: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal

## Goal

Provide sturdy `Promise` utils that make it easier to write asynchronous code that is both performant
and saves on unnecessary operations by making it easier to use AbortSignals.

The library has a partial focus on `Typescript` utility as `TypeScript` comes with its own
set of problems.

## Contributions

Additionally to the common Consento contribution guidelines, this repository is eager to be dissolved
into standard projects. If you find one of the utils presented here useful in a more common context (e.g.
Node.js repo, TypeScript or w3c) then we would find it awesome if you could promote it to find its way there so
we can remove it from this library.

We also appreciate pointers to projects that may offer a better solution than the solutions presented
in this repo!

## Utils

- [`bubbleAbort()`](#bubble-abort) - tiny helper for dealing with abort signals
- [`checkpoint()`](#checkpoint) - comfortable helper for dealing with abort signals
- [`cbPromise()`](#cb-promise) - tiny helper for asynchronous code
- [`cleanupPromise()`](#cleanup-promise) - versatily promise variant that allows react-style hook cleanups
- [`composeAbort()`](#compose-abort) - compose an abort-signal into sub-variants.
- [`isPromiseLike()`](#is-promise-like) - typescript type-check helper
- [`raceWithSignal()`](#race-with-signal) - races several promises, all but the first will be aborted
- [`toPromise()`](#to-promise) - turns a value into a promise, cleverly
- [`wrapTimeout()`](#wrap-timeout) - wraps an async function to have an optional timeout

#### `bubbleAbort()`

Simple function that throws an AbortError if an AbortSignal
happens to be aborted.

_Usage:_

```javascript
const { bubbleAbort } = require('@consento/promise/bubbleAbort')

async function longRunning ({ signal } = {}) {
  let result = ''
  for await (const data of internalIterator()) {
    bubbleAbort(signal) // Will throw an error if the signal is aborted
    result += data
  }
  return result
}
```

#### `cbPromise()`

Extended Promise that has the `resolve` and `reject` methods
on the class instance instead of a template function.

```javascript
const { CBPromise } = require('@consento/promise/cbPromise')

const p = new CBPromise()
p.cb(new Error(), 'result') // traditional callback API
p.resolve('result') // or use traditional resolve
p.reject(new Error()) // and reject
```

This may come in handy when you need a callback but want to await
the promise.

```javascript
async function test () {
  const p = new CBPromise()
  setTimeout(p.resolve, 500)
  await p
}
```

#### `checkpoint()`

Allows the creation of a checkpoint function that aborts
an async script if a signal is aborted.

_Usage:_

```javascript
const { checkpoint } = require('@consento/promise/checkpoint')

async function longRunning ({ signal }: {}) {
  const cp = checkpoint(signal)
  let result
  for (const data of internalIterator()) {
    result += await cp(data) // An AbortError will be thrown if the passed-in signal happens to be aborted.
  }
  return result
}
```

#### `cleanupPromise()`

Versatile custom Promise implementation that allows to execute an async
cleanup operation after a promise is resolved or rejected.

_Usage:_

```javascript
import { cleanupPromise } = require('@consento/promise/cleanupPromise')

const result = await cleanupPromise((resolve, reject, signal) => {
  setTimeout(resolve, Math.random() * 500) // Resolve & reject work like in regular promises
  setTimeout(reject, Math.random() * 500)
  const abortHandler = () => {
    reject(new Error('aborted'))
  }
  signal.addEventListener('abort', abortHandler)
  return () => {
    // Executed after resolve or reject is called.
    signal.removeEventListener('abort, abortHandler)
  }
})

cleanupPromise(..., { timeout: 500, signal }) // You can also pass-in a parent signal or a timeout!
```

#### `isPromiseLike()`

TypeScript util that helps to identify if a promise is a [`PromiseLike`][PromiseLike] instance.

[PromiseLike]: https://github.com/microsoft/TypeScript/blob/1bd8e388aeda1df0f1dbc2a1a0ef9361a0d43d6f/src/lib/es5.d.ts#L1401-L1409

#### `raceWithSignal()`

Similar to `Promise.race` but aborts all promises that don't win the race.

_Usage:_

```javascript
const { raceWithSignal } = require('@consento/promise/raceWithSignal')

// Here the request to google will be aborted if the timeout of 500ms is reached.
await raceWithSignal(signal => {
  return [
    fetch('http://google.com', { signal }),
    new Promise((resolve, reject) => setTimeout(reject, 500, new Error('timeout')))
  ]
})

await raceWithSignal(..., inputSignal) // You can also pass-in a signal that you maintain.
```

#### `toPromise()`

For when you need to make sure that you have a promise at hand.

Turns any given js object into a Promise. It will also cache the
Promises to save memory and instantiation time.

There are several legacy promise implementations that are similar
but different from the `Promise` javascript standard, this method
will turn those promises into actual Promises.

_Usage:_

```javascript
const { toPromise } = require('@consento/promise/toPromise')

toPromise(1) // Promise<1>
toPromise(Promise.resolve(1)) // same promise as input
toPromise({ then: (resolve, reject) => { ... } }) // returns a standard Promise

const obj = { hello: 'world' }
toPromise(obj) // Returns a promise for `obj`
toPromise(obj) // Returns exactly the same promise as the previous call.
```

#### `wrapTimeout()`

Wraps an async operation and passes-in a signal that will be marked as aborted when a given timeout set's in.

_Usage:_

```javascript
const { wrapTimeout } = require('@consento/promise/wrapTimeout')

wrapTimeout(async (signal, resetTimeout) => {
  if (signal) { // Signal may be undefined if timeout=0 is specified.
    signal.addEventListener('abort', () => {
      // now we should abort our work.
    })
  }
  resetTimeout() // With reset-timeout you can reset a given input timeout, this may be useful to delay a timeout after user interaction.
}, { timeout: 500 })
```

## License

[MIT](./LICENSE)
