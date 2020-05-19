/*!
 * @author electricessence / https://github.com/electricessence/
 * Licensing: MIT https://github.com/electricessence/TypeScript.NET-Core/blob/master/LICENSE.md
 * Based upon ObjectPool from Parallel Extension Extras and other ObjectPool implementations.
 * Uses .add(T) and .take():T
 */
import DisposableBase from '@tsdotnet/disposable';
export declare type Recyclable = {
    recycle(): void;
};
/**
 * A flexible Object Pool that trims the pool down to the specified max size after a specified delay.
 */
export default class ObjectPool<T> extends DisposableBase {
    private _generator?;
    private _recycler?;
    private readonly _maxSize;
    private _toRecycle?;
    private _pool;
    private _reduceTimeoutId;
    /**
     * A transient amount of object to exist over _maxSize until trim() is called.
     * But any added objects over _localAbsMaxSize will be disposed immediately.
     * @param _generator The delegate to create new items.
     * @param _recycler An optional delegate to clean/process items before returning to the pool.
     * @param _maxSize The soft ceiling by which the pool is trimmed. Default is 1000.
     */
    constructor(_generator?: ((...args: any[]) => T) | undefined, _recycler?: ((o: T) => void) | undefined, _maxSize?: number);
    /**
     * The soft ceiling by which the pool is trimmed.
     * @returns {number}
     */
    get maxSize(): number;
    /**
     * Current number of objects in the pool.
     * @returns {number}
     */
    get count(): number;
    protected _recycle(): void;
    trim(max?: number): void;
    protected _cancelAutoTrim(): void;
    autoTrim(msLater?: number, max?: number): void;
    /**
     * Clears out the pool.
     */
    clear(): void;
    toArrayAndClear(): T[];
    /**
     * Shortcut for toArrayAndClear();
     */
    dump(): T[];
    protected _onDispose(): void;
    give(entry: T): void;
    tryTake(): T | undefined;
    take(factory?: () => T): T;
    static create<T>(generator?: (...args: any[]) => T, recycler?: (o: T) => void, max?: number): ObjectPool<T>;
    static createAutoRecycled<T extends Recyclable>(generator?: (...args: any[]) => T, max?: number): ObjectPool<T>;
}
