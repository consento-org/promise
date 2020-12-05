import is from '@sindresorhus/is'
import { AbortController, AbortSignal } from 'abort-controller'
import ShimEventTarget from 'event-target-shim'
import { AbortError } from './AbortError'

const EventTarget = global.EventTarget ?? ShimEventTarget
const Event: new (type: string) => any = global.Event ?? class {
  type: string
  constructor (type: string) {
    this.type = type
  }
}

export interface AbortControllerLike {
  readonly signal: AbortSignal
  abort: () => void
}

const { addEventListener, removeEventListener } = AbortSignal.prototype

interface IComposedAbortSignal extends AbortSignal {
  _parent: AbortSignal
  _signal: AbortSignal
  _handlers: Map<any, true> | undefined
  _onAbort: () => void
  _clear: () => void
}

function onAbort (this: IComposedAbortSignal): void {
  this._clear()
  this.dispatchEvent(new Event('abort'))
}

/**
 * AbortSignal's constructor throws an error
 */
function ComposedAbortSignal (this: IComposedAbortSignal, signal: AbortSignal, parent: AbortSignal): void {
  EventTarget.apply(this)
  this._signal = signal
  this._parent = parent
}
ComposedAbortSignal.prototype = Object.defineProperties(Object.create(AbortSignal.prototype), {
  aborted: {
    get (this: IComposedAbortSignal) {
      return this._parent.aborted || this._signal.aborted
    }
  },
  _clear: {
    value (this: IComposedAbortSignal): void {
      this._handlers = undefined
      if (this._onAbort !== undefined) {
        this._signal.removeEventListener('abort', this._onAbort)
        this._parent.removeEventListener('abort', this._onAbort)
      }
    }
  },
  addEventListener: {
    value (this: IComposedAbortSignal, ...[type, listener]: Parameters<typeof addEventListener>): void {
      addEventListener.call(this, type, listener)
      if (this.aborted || type !== 'abort' || is.nullOrUndefined(listener)) {
        return
      }
      if (this._handlers === undefined) {
        this._handlers = new Map()
        this._onAbort = onAbort.bind(this)
        this._signal.addEventListener('abort', this._onAbort)
        this._parent.addEventListener('abort', this._onAbort)
      }
      this._handlers.set(listener, true)
    }
  },
  removeEventListener: {
    value (this: IComposedAbortSignal, ...[type, listener]: Parameters<typeof removeEventListener>): void {
      removeEventListener.call(this, type, listener)
      if (this._handlers === undefined || type !== 'abort' || is.nullOrUndefined(listener)) {
        return
      }
      this._handlers.delete(listener)
      if (this._handlers.size === 0) {
        this._clear()
      }
    }
  }
})

/**
 * Creates a new AbortController-compatible instance
 * that can be aborted both with the `abort` operation and
 * a passed-in signal.
 *
 * Usage:
 * ```javascript
 * const { composeAbort } = require('@consento/promise/composeAbort')
 * const { AbortController } = require('abort-controller')
 *
 * const main = new AbortController()
 * const composed = composeAbort(main.signal)
 *
 * main.abort() // Will both abort main and composed
 * composed.abort() // Will abort only the composed
 *
 * const other = composeAbort(null) // The signal is optional, allows for flexibility of an abortsignal.
 * ```
 *
 * @param signal Optional Signal that can abort the controller
 */
export function composeAbort (signal?: AbortSignal): AbortControllerLike {
  const controller = new AbortController()
  if (is.nullOrUndefined(signal)) {
    return controller
  }
  if (signal.aborted) {
    throw new AbortError()
  }
  return {
    // @ts-expect-error - ComposedAbortSignal is hacked together as AbortSignal is not easily extendable.
    signal: new ComposedAbortSignal(controller.signal, signal),
    abort: controller.abort.bind(controller)
  }
}
