import { checkpoint } from '../checkpoint'
import { AbortController } from 'abort-controller'
import { AbortError } from '../AbortError'

describe('checkpoint', () => {
  it('doing nothing', async () => {
    const cp = checkpoint()
    expect(cp()).toBe(undefined)
  })
  it('returning the input value as is', async () => {
    const cp = checkpoint()
    expect(cp(1)).toBe(1)
    expect(cp(null)).toBe(null)
    expect(cp(undefined)).toBe(undefined)
    const obj = {}
    expect(cp(obj)).toBe(obj)
  })
  it('accepts a signal', async () => {
    const cp = checkpoint((new AbortController()).signal)
    expect(cp(1)).toBe(1) // nothing to { abort, signal } here :-)
  })
  it('will thrown an error if the signal is aborted', async () => {
    const controller = new AbortController()
    const cp = checkpoint(controller.signal)
    expect(cp(1)).toBe(1)
    controller.abort()
    expect(() => {
      cp(1)
    }).toThrow(new AbortError())
  })
})
