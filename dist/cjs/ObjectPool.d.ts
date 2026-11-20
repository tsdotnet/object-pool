/*!
 * @author electricessence / https://github.com/electricessence/
 * Licensing: MIT https://github.com/electricessence/TypeScript.NET-Core/blob/master/LICENSE.md
 * Based upon ObjectPool from Parallel Extension Extras and other ObjectPool implementations.
 * Uses .add(T) and .take():T
 */
import { DisposableBase } from '@tsdotnet/disposable';
export type Recyclable = {
    recycle(): void;
};
export default class ObjectPool<T> extends DisposableBase {
    private _generator?;
    private _recycler?;
    private readonly _maxSize;
    private _toRecycle?;
    private _pool;
    private _reduceTimeoutId;
    constructor(_generator?: ((...args: any[]) => T) | undefined, _recycler?: ((o: T) => void) | undefined, _maxSize?: number);
    get maxSize(): number;
    get count(): number;
    static create<T>(generator?: (...args: any[]) => T, recycler?: (o: T) => void, max?: number): ObjectPool<T>;
    static createAutoRecycled<T extends Recyclable>(generator?: (...args: any[]) => T, max?: number): ObjectPool<T>;
    trim(max?: number): void;
    autoTrim(msLater?: number, max?: number): void;
    clear(): void;
    toArrayAndClear(): T[];
    dump(): T[];
    give(entry: T): void;
    tryTake(): T | undefined;
    take(factory?: () => T): T;
    rent(closure: (entry: T) => void): void;
    protected _recycle(): void;
    protected _cancelAutoTrim(): void;
    protected _onDispose(): void;
}
