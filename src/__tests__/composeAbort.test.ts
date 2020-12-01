import { AbortController } from 'abort-controller'
import { AbortError } from '../AbortError'
import { composeAbort } from '../composeAbort'

describe('composeAbort(signal?)', () => {
  it('composing abort without signal', async () => {
    const { signal, abort } = composeAbort()
    expect(signal).toBeDefined()
    expect(abort).toBeInstanceOf(Function)
    let abortCalled = 0
    signal.addEventListener('abort', () => {
      abortCalled++
    })
    abort()
    expect(abortCalled).toBe(1)
  })
  it('composing with signal: abort causes parent to not abort', async () => {
    const { signal: parentSignal } = new AbortController()
    const { signal, abort } = composeAbort(parentSignal)
    let parentCalled = 0
    parentSignal.addEventListener('abort', () => {
      parentCalled++
    })
    let abortCalled = 0
    signal.addEventListener('abort', () => {
      abortCalled++
    })
    abort()
    expect(parentCalled).toBe(0)
    expect(abortCalled).toBe(1)
  })
  it('composing with signal: abort of parent causes child abort', async () => {
    const parent = new AbortController()
    const { signal } = composeAbort(parent.signal)
    let parentCalled = 0
    parent.signal.addEventListener('abort', () => {
      parentCalled++
    })
    let abortCalled = 0
    signal.addEventListener('abort', () => {
      abortCalled++
    })
    parent.abort()
    expect(parentCalled).toBe(1)
    expect(abortCalled).toBe(1)
  })
  it('composing an aborted signal causes an exception', async () => {
    const parent = new AbortController()
    parent.abort()
    expect(() => {
      composeAbort(parent.signal)
    }).toThrowError(AbortError)
  })
})
