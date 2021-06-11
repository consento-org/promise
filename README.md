# `@consento/promise`

A set of utilities for working with [Promises]() with particular focus
on abort-ability using [`AbortSignal`s][AbortSignal].

For more about this library, you can look at an in-depth article in [english](https://qiita.com/martinheidegger/items/3e6355e96e85fc1c841e).

詳しい説明のために[このライブラリについての記事](https://qiita.com/martinheidegger/items/6e8275d2de88174bc7e6)を読んでください。

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

- [`bubbleAbort()`](#bubbleabortsignal-abortsignal-void) - tiny helper for dealing with abort signals
- [`checkpoint()`](#checkpointsignal-abortsignal-input-any--input) - comfortable helper for dealing with abort signals
- [`cleanupPromise()`](#cleanuppromiseresolvet-reject-signal-resettimeout----void--timeout-number-signal-abortsignal-promiset) - versatile promise variant that allows react-style hook cleanups
- [`composeAbort()`](#composeabortsignal-signal--abort---void-signal-abortsignal-) - compose an abort-signal into sub-variants.
- [`isPromiseLike()`](#ispromiselikeinput-input-is-promiselike) - typescript type-check helper
- [`raceWithSignal()`](#racewithsignalsignal-abortsignal--promiset-signal-abortsignal-promiset) - races several promises, all but the first will be aborted
- [`wrapTimeout()`](#wraptimeoutsignal-abortsignal-resettimeout---void--promiset--timeout-number-signal-abortsignal-promiset) - wraps an async function to have an optional timeout

#### `bubbleAbort([signal: AbortSignal]): void`

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

#### `checkpoint([signal: AbortSignal]): ([input: () => T]) => T`

Allows the creation of a checkpoint function that aborts
an async script if a signal is aborted.

_Usage:_

```javascript
const { checkpoint } = require('@consento/promise/checkpoint')

async function longRunning ({ signal }: {}) {
  const cp = checkpoint(signal)
  let result
  for (const data of internalIterator()) {
    cp() // you can use the checkpoint as-is
    result += data

    // passing-in a template function is going to execute that
    // template function only it the signal is not aborted.
    const foo = await cp(async () => 'bar')
  }
  return result
}
```

#### `cleanupPromise((resolve<T>, reject, signal, resetTimeout) => () => void, [{ timeout?: number, signal?: AbortSignal}]): Promise<T>`

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
  // If no signal is necessary, the signal will not be provided.
  signal?.addEventListener('abort', abortHandler)
  return () => {
    // Executed after resolve or reject is called.
    signal?.removeEventListener('abort', abortHandler)
  }
})

cleanupPromise(..., { timeout: 500, signal }) // You can also pass-in a parent signal or a timeout!

cleanupPromise((resolve, reject): void => {}) // You can also use it like a regular promise
```

#### `composeAbort([signal: Signal]): { abort: () => void, signal: AbortSignal }`

Creates a new AbortController-compatible instance
that can be aborted both with the `abort` operation and
a passed-in signal.

_Usage:_

```javascript
const { composeAbort } = require('@consento/promise/composeAbort')
const { AbortController } = require('abort-controller')

const main = new AbortController()
const composed = composeAbort(main.signal)

main.abort() // Will both abort main and composed
composed.abort() // Will abort only the composed

const other = composeAbort(null) // The signal is optional, allows for flexibility of an abortsignal.
```

#### `isPromiseLike(input): input is PromiseLike`

TypeScript util that helps to identify if a promise is a [`PromiseLike`][PromiseLike] instance.

[PromiseLike]: https://github.com/microsoft/TypeScript/blob/1bd8e388aeda1df0f1dbc2a1a0ef9361a0d43d6f/src/lib/es5.d.ts#L1401-L1409

_Usage:_

```typescript
import { isPromiseLike } from '@consento/promise/isPromiseLike'

async function foo (input: any) {
  if (isPromiseLike(input)) {
    // do something async
  } else {
    // just sync away
  }
}
```

#### `raceWithSignal((signal: AbortSignal) => Promise<T>[], [signal: AbortSignal]): Promise<T>`

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

#### `wrapTimeout((signal?: AbortSignal, resetTimeout: () => void) => Promise<T>, [{ timeout?: number, signal?: AbortSignal}]): Promise<T>`

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
