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
  it('composing will not add an unnecessary event listener', async () => {
    const parent = new AbortController()
    const listeners: { [key in string]: Set<any>} = {}
    parent.signal.addEventListener = function (...[type, listener]: Parameters<typeof AbortSignal.prototype.addEventListener>) {
      AbortSignal.prototype.addEventListener.call(this, type, listener)
      if (listener === null) return
      let forEvent = listeners[type]
      if (forEvent === undefined) {
        forEvent = new Set()
        listeners[type] = forEvent
      }
      forEvent.add(listener)
    }
    parent.signal.removeEventListener = function (...[type, listener]: Parameters<typeof AbortSignal.prototype.removeEventListener>) {
      AbortSignal.prototype.removeEventListener.call(this, type, listener)
      if (listener === null) return
      const forEvent = listeners[type]
      if (forEvent === undefined) return
      forEvent.delete(listener)
      if (forEvent.size === 0) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete listeners[type]
      }
    }
    const child = composeAbort(parent.signal)
    expect(child.signal.aborted).toBe(false)
    expect(listeners).toEqual({})
    const listener = (): void => {}
    child.signal.addEventListener('otherEvent', listener)
    expect(listeners).toEqual({})
    child.signal.addEventListener('abort', listener)
    expect(listeners.abort?.size).toEqual(1)
    child.signal.removeEventListener('abort', listener)
    expect(listeners).toEqual({})
    child.signal.addEventListener('abort', listener)
    expect(listeners.abort?.size).toEqual(1)
    child.abort()
    expect(listeners).toEqual({})
    child.signal.addEventListener('abort', listener)
    expect(listeners).toEqual({})
  })
})
