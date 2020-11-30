import { AbortController } from 'abort-controller'
import { AbortError } from '../AbortError'
import { raceWithSignal } from '../raceWithSignal'

describe('raceWithSignal(template, signal?)', () => {
  it('will always have signal', async () => {
    const result = await raceWithSignal(signal => [
      (async () => {
        expect(signal).toBeDefined()
        return 'hello'
      })()
    ])
    expect(result).toBe('hello')
  })
  it('will call abort on result', async () => {
    let abortCalled = false
    let finished = false
    const result = raceWithSignal(signal => [
      new Promise((resolve) => {
        finished = true
        resolve('hi')
      }),
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          abortCalled = true
          reject(new AbortError())
        })
      })
    ])
    expect(abortCalled).toBe(false)
    expect(finished).toBe(true)
    expect(await result).toBe('hi')
    expect(abortCalled).toBe(true)
  })
  it('will cancel all races if the input signal is cancelled', async () => {
    const controller = new AbortController()
    let abortCalled = false
    const p = expect(
      raceWithSignal(signal => [
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            abortCalled = true
          })
        })
      ], controller.signal)
    ).rejects.toBeInstanceOf(AbortError)
    controller.abort()
    await p
    expect(abortCalled).toBe(true)
  })
  it('aborted signal causes immediate rejection', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      raceWithSignal(() => {
        fail('wrapper called')
      }, controller.signal)
    ).rejects.toBeInstanceOf(AbortError)
  })
})
