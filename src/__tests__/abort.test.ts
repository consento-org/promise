import { wrapTimeout } from '../abort'
import { AbortError } from '../AbortError'
import { AbortController, AbortSignal } from 'abort-controller'

describe('wrapTimeout(template, { timeout, signal })', () => {
  it('wrapping without timeout is a simple passthrough', async () => {
    const data = await wrapTimeout(async (opts) => {
      expect(opts).toBeUndefined()
      return 'hello world'
    }, {})
    expect(data).toBe('hello world')
  })
  it('wrapping with timeout to create a signal that causes no side effects', async () => {
    const data = await wrapTimeout(async (signal) => {
      expect(signal).toBeInstanceOf(AbortSignal)
      return 'hello world'
    }, { timeout: 100 })
    expect(data).toBe('hello world')
  })
  it('wrapping with timeout to trigger signal', async () => {
    let signalAborted = false
    await expect(
      wrapTimeout(async (signal) => {
        expect(signal).toBeInstanceOf(AbortSignal)
        return await new Promise((resolve, reject) => {
          signal?.addEventListener('abort', () => {
            signalAborted = true
            reject(new AbortError())
          })
        })
      }, { timeout: 10 })
    ).rejects.toMatchObject({
      code: 'timeout',
      timeout: 10
    })
    expect(signalAborted).toBeTruthy()
  })
  it('canceling with input signal but without timeout', async () => {
    const controller = new AbortController()
    const p = expect(
      wrapTimeout(async (signal) => {
        expect(signal).toBe(controller.signal)
        return await new Promise((resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new AbortError())
          })
        })
      }, { signal: controller.signal })
    ).rejects.toBeInstanceOf(AbortError)
    controller.abort()
    await p
  })
  it('canceling with input signal and timeout', async () => {
    const controller = new AbortController()
    const p = expect(
      wrapTimeout(async (signal) => {
        expect(signal).not.toBe(controller.signal)
        return await new Promise((resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new AbortError())
          })
        })
      }, { signal: controller.signal, timeout: 100 })
    ).rejects.toBeInstanceOf(AbortError)
    controller.abort()
    await p
  })
  it('timeout with input signal and timeout', async () => {
    let signalAborted = false
    const controller = new AbortController()
    await expect(
      wrapTimeout(async (signal) => {
        expect(signal).not.toBe(controller.signal)
        return await new Promise((resolve, reject) => {
          signal?.addEventListener('abort', () => {
            signalAborted = true
            reject(new AbortError())
          })
        })
      }, { timeout: 10, signal: controller.signal })
    ).rejects.toMatchObject({
      code: 'timeout',
      timeout: 10
    })
    expect(signalAborted).toBe(true)
  })
  it('aborted signal causes immediate rejection', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      wrapTimeout(async () => {
        fail('wrapper called')
      }, { signal: controller.signal })
    ).rejects.toBeInstanceOf(AbortError)
  })
  it('aborted signal with timeout also causes immediate rejection', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      wrapTimeout(async () => {
        fail('wrapper called')
      }, { timeout: 10, signal: controller.signal })
    ).rejects.toBeInstanceOf(AbortError)
  })
  it('allows for a reset of the timeout in case everything runs as planned', async () => {
    const result = await wrapTimeout(async (signal, reset) => {
      await new Promise(resolve => { setTimeout(resolve, 5) })
      reset()
      await new Promise(resolve => { setTimeout(resolve, 5) })
      return 'hello'
    }, { timeout: 7 })
    expect(result).toBe('hello')
  })
})
