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
    /**
     * Creates a pool using the specified generator and optional recycler.
     * @param {(...args: any[]) => T} generator
     * @param {(o: T) => void} recycler
     * @param {number} max
     * @return {ObjectPool<T>}
     */
    static create<T>(generator?: (...args: any[]) => T, recycler?: (o: T) => void, max?: number): ObjectPool<T>;
    /**
     * Creates an auto-recycled pool using the specified generator.
     * @param {(...args: any[]) => T} generator
     * @param {number} max
     * @return {ObjectPool<T>}
     */
    static createAutoRecycled<T extends Recyclable>(generator?: (...args: any[]) => T, max?: number): ObjectPool<T>;
    /**
     * Trims the pool to the optional specified max (or the default).
     * @param {number} max
     */
    trim(max?: number): void;
    /**
     * Signals the pool to trim after a delay.
     * @param {number} msLater
     * @param {number} max
     */
    autoTrim(msLater?: number, max?: number): void;
    /**
     * Clears out the pool.
     */
    clear(): void;
    /**
     * Empties the pool into an array and returns it.
     * @return {T[]}
     */
    toArrayAndClear(): T[];
    /**
     * Shortcut for toArrayAndClear();
     */
    dump(): T[];
    /**
     * Gives an item to the pool.  If recyclable, will be added to the recycler.
     * @param {T} entry
     */
    give(entry: T): void;
    /**
     * Attempts to get an item from the pool.
     * Returns undefined if none available.
     * @return {T | undefined}
     */
    tryTake(): T | undefined;
    /**
     * Returns an item from the pool or creates one using the provided factory or the default factory configured with the pool.
     * @param {() => T} factory
     * @return {T}
     */
    take(factory?: () => T): T;
    /**
     * Short term renting of an item.
     * @param {(entry: T) => void} closure
     */
    rent(closure: (entry: T) => void): void;
    protected _recycle(): void;
    protected _cancelAutoTrim(): void;
    protected _onDispose(): void;
}
