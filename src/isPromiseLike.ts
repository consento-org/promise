/**
 * TypeScript util that helps to identify if a promise is a `PromiseLike` instance.
 *
 * @param arg an object that may be a promise
 * @see https://github.com/microsoft/TypeScript/blob/1bd8e388aeda1df0f1dbc2a1a0ef9361a0d43d6f/src/lib/es5.d.ts#L1401-L1409
 */
// Adapted from https://github.com/typestack/routing-controllers/blob/4a56d176db77bc081dfcd3d8550e8433b5bc476e/src/util/isPromiseLike.ts#L1-L6
export function isPromiseLike <T> (arg: any): arg is PromiseLike<T> {
  return typeof arg?.then === 'function'
}
