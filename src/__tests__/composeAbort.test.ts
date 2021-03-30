import { AbortController, AbortSignal } from 'abort-controller'
import { AbortError } from '../AbortError'
import { composeAbort } from '../composeAbort'

describe('composeAbort(signal?)', () => {
  it('composing abort without signal', async () => {
    const controller = composeAbort()
    const { signal } = controller
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(controller).toBeInstanceOf(AbortController) // Without a parent signal, a simple controller will be returned
    expect(controller.abort).toBeInstanceOf(Function)
    let abortCalled = 0
    signal.addEventListener('abort', () => {
      abortCalled++
    })
    controller.abort()
    expect(abortCalled).toBe(1)
  })
  it('composing with signal: abort causes parent to not abort', async () => {
    const { signal: parentSignal } = new AbortController()
    const controller = composeAbort(parentSignal)
    const { signal } = controller
    expect(signal).toBeInstanceOf(AbortSignal)
    let parentCalled = 0
    parentSignal.addEventListener('abort', () => {
      parentCalled++
    })
    let abortCalled = 0
    signal.addEventListener('abort', () => {
      abortCalled++
    })
    controller.abort()
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
