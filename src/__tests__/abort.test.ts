import { wrapTimeout, cleanupPromise } from '../abort'
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

describe('cleanupPromise(template, { timeout, signal }', () => {
  it('cleans up after direct resolve', async () => {
    let cleanupCalled = false
    const data = await cleanupPromise(resolve => {
      resolve(1)
      return () => {
        cleanupCalled = true
      }
    })
    expect(data).toBe(1)
    expect(cleanupCalled).toBeTruthy()
  })
  it('cleans up after delayed resolve', async () => {
    let cleanupCalled = false
    const data = await cleanupPromise(resolve => {
      setTimeout(resolve, 1, 'a')
      return () => {
        cleanupCalled = true
      }
    })
    expect(data).toBe('a')
    expect(cleanupCalled).toBeTruthy()
  })
  it('cleans up after direct reject', async () => {
    let cleanupCalled = false
    const error = new Error()
    await expect(
      cleanupPromise((resolve, reject) => {
        reject(error)
        return () => {
          cleanupCalled = true
        }
      })
    ).rejects.toBe(error)
    expect(cleanupCalled).toBeTruthy()
  })
  it('cleans up after delayed reject', async () => {
    let cleanupCalled = false
    const error = new Error()
    await expect(
      cleanupPromise((resolve, reject) => {
        setTimeout(reject, 1, error)
        return () => {
          cleanupCalled = true
        }
      })
    ).rejects.toBe(error)
    expect(cleanupCalled).toBeTruthy()
  })
  it('cleans up before timeouts', async () => {
    let cleanupCalled = false
    await expect(
      cleanupPromise(() => {
        return () => {
          cleanupCalled = true
        }
      }, { timeout: 10 })
    ).rejects.toMatchObject({
      code: 'timeout',
      timeout: 10
    })
    expect(cleanupCalled).toBe(true)
  })
  it('cleans up on abort signal', async () => {
    const controller = new AbortController()
    let cleanupCalled = false
    const p = expect(
      cleanupPromise(() => {
        return () => {
          cleanupCalled = true
        }
      }, { signal: controller.signal })
    ).rejects.toBeInstanceOf(AbortError)
    controller.abort()
    await p
    expect(cleanupCalled).toBe(true)
  })
  it('no setup if already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      cleanupPromise(
        () => fail('unexpected call'),
        { signal: controller.signal }
      )
    ).rejects.toBeInstanceOf(AbortError)
  })
  it('fails as rejecting if the command immediately throws', async () => {
    const err = new Error('any-error')
    await expect(cleanupPromise(() => {
      throw err
    })).rejects.toBe(err)
  })
  it('allows for cleanup to be returned async', async () => {
    let cleanupCalled = false
    const p = cleanupPromise(async (resolve) => {
      resolve(null)
      return () => {
        cleanupCalled = true
      }
    })
    await p
    expect(cleanupCalled).toBe(true)
  })
  it('fails as rejecting if the command returns a rejection', async () => {
    const err = new Error('any-error')
    await expect(
      cleanupPromise(async () => { throw err })
    ).rejects.toBe(err)
  })
  it('allows async cleanup with direct error', async () => {
    let cleanupCalled = false
    const err = new Error('quick')
    await expect(cleanupPromise(async (_, reject) => {
      reject(err)
      return () => {
        cleanupCalled = true
      }
    })).rejects.toBe(err)
    expect(cleanupCalled).toBe(true)
  })
  it('may use a third signal parameter for aborts', async () => {
    const controller = new AbortController()
    let cleanupCalled = false
    const p = cleanupPromise(
      async (_, __, signal) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        expect(signal?.aborted).toBe(true)
        return () => {
          cleanupCalled = true
        }
      },
      { signal: controller.signal }
    )
    controller.abort()
    await expect(p).rejects.toBeInstanceOf(AbortError)
    expect(cleanupCalled).toBe(true)
  })
  it('can reset a timeout same like wrapTimeout', async () => {
    let cleanupCalled = false
    const result = await cleanupPromise(
      (resolve, reject, _, reset) => {
        setTimeout(() => {
          reset()
          setTimeout(() => {
            resolve('hello')
          }, 5)
        }, 5)
        return () => {
          cleanupCalled = true
        }
      },
      { timeout: 7 }
    )
    expect(result).toBe('hello')
    expect(cleanupCalled).toBe(true)
  })
  it('bubbles error in cleanup', async () => {
    const error = new Error()
    await expect(cleanupPromise(
      resolve => {
        setTimeout(resolve, 1, 'hello')
        return () => {
          throw error
        }
      }
    )).rejects.toBe(error)
  })
  it('bubbles error in quick cleanup', async () => {
    const error = new Error()
    await expect(cleanupPromise(
      resolve => {
        resolve('hello')
        return () => {
          throw error
        }
      }
    )).rejects.toBe(error)
  })
  it('prioritizes regular error before cleanup error', async () => {
    const errorA = new Error('a')
    const errorB = new Error('b')
    await expect(cleanupPromise(
      (_, reject) => {
        reject(errorA)
        return () => {
          throw errorB
        }
      }
    )).rejects.toBe(errorA)
  })
  it('prioritizes regular error before async cleanup error', async () => {
    const errorA = new Error('a')
    const errorB = new Error('b')
    let cleanupCalled = false
    await expect(cleanupPromise(
      (_, reject) => {
        reject(errorA)
        return async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          cleanupCalled = true
          throw errorB
        }
      }
    )).rejects.toBe(errorA)
    expect(cleanupCalled).toBe(true)
  })
  it('awaits for cleanup to finish before returning', async () => {
    let cleanupFinished = false
    const result = await cleanupPromise(
      resolve => {
        setTimeout(resolve, 1, 'hello')
        return async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          cleanupFinished = true
        }
      }
    )
    expect(result).toBe('hello')
    expect(cleanupFinished).toBe(true)
  })
  it('awaits for cleanup to finish before returning quickly', async () => {
    let cleanupFinished = false
    const result = await cleanupPromise(
      resolve => {
        resolve('hello')
        return async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          cleanupFinished = true
        }
      }
    )
    expect(result).toBe('hello')
    expect(cleanupFinished).toBe(true)
  })
  it('bubbles async error in cleanup', async () => {
    const error = new Error()
    await expect(cleanupPromise(
      resolve => {
        setTimeout(resolve, 1, 'hello')
        return async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          throw error
        }
      }
    )).rejects.toBe(error)
  })
  it('bubbles async error in quick cleanup', async () => {
    const error = new Error()
    await expect(cleanupPromise(
      resolve => {
        resolve('hello')
        return async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          throw error
        }
      }
    )).rejects.toBe(error)
  })
  it('cleanup doesnt override rejection', async () => {
    const error = new Error()
    await expect(cleanupPromise(
      (_, reject) => {
        reject(error)
        return async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
    )).rejects.toBe(error)
  })
  it('cleanup doesnt override async rejection', async () => {
    const error = new Error()
    await expect(cleanupPromise(
      (_, reject) => {
        setTimeout(reject, 10, error)
        return async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
    )).rejects.toBe(error)
  })
})
