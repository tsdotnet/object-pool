"use strict";
/*!
 * @author electricessence / https://github.com/electricessence/
 * Licensing: MIT https://github.com/electricessence/TypeScript.NET-Core/blob/master/LICENSE.md
 * Based upon ObjectPool from Parallel Extension Extras and other ObjectPool implementations.
 * Uses .add(T) and .take():T
 */
Object.defineProperty(exports, "__esModule", { value: true });
const disposable_1 = require("@tsdotnet/disposable");
const exceptions_1 = require("@tsdotnet/exceptions");
const OBJECT_POOL = 'ObjectPool', DEFAULT_MAX_SIZE = 100, ABSOLUTE_MAX_SIZE = 65536, AUTO_REDUCE_DEFAULT_MS = 1000; // auto reduce milliseconds.
/**
 * A flexible Object Pool that trims the pool down to the specified max size after a specified delay.
 */
class ObjectPool extends disposable_1.DisposableBase {
    /**
     * A transient amount of object to exist over _maxSize until trim() is called.
     * But any added objects over _localAbsMaxSize will be disposed immediately.
     * @param _generator The delegate to create new items.
     * @param _recycler An optional delegate to clean/process items before returning to the pool.
     * @param _maxSize The soft ceiling by which the pool is trimmed. Default is 1000.
     */
    constructor(_generator, _recycler, _maxSize = DEFAULT_MAX_SIZE) {
        super(OBJECT_POOL);
        this._generator = _generator;
        this._recycler = _recycler;
        this._maxSize = _maxSize;
        this._reduceTimeoutId = 0; // possible differences between browser and NodeJS.  Keep as 'any'.
        if (isNaN(_maxSize) || _maxSize < 1)
            throw new exceptions_1.ArgumentOutOfRangeException('_maxSize', _maxSize, 'Must be at valid number least 1.');
        if (_maxSize > ABSOLUTE_MAX_SIZE)
            throw new exceptions_1.ArgumentOutOfRangeException('_maxSize', _maxSize, `Must be less than or equal to ${ABSOLUTE_MAX_SIZE}.`);
        this._toRecycle = _recycler ? [] : undefined;
        this._pool = [];
    }
    /**
     * The soft ceiling by which the pool is trimmed.
     * @returns {number}
     */
    get maxSize() {
        return this._maxSize;
    }
    /**
     * Current number of objects in the pool.
     * @returns {number}
     */
    get count() {
        const r = this._toRecycle;
        const p = this._pool;
        return (r ? r.length : 0) + (p ? p.length : 0);
    }
    /**
     * Creates a pool using the specified generator and optional recycler.
     * @param {(...args: any[]) => T} generator
     * @param {(o: T) => void} recycler
     * @param {number} max
     * @return {ObjectPool<T>}
     */
    static create(generator, recycler, max = DEFAULT_MAX_SIZE) {
        return new ObjectPool(generator, recycler, max);
    }
    /**
     * Creates an auto-recycled pool using the specified generator.
     * @param {(...args: any[]) => T} generator
     * @param {number} max
     * @return {ObjectPool<T>}
     */
    static createAutoRecycled(generator, max = DEFAULT_MAX_SIZE) {
        return new ObjectPool(generator, recycle, max);
    }
    /**
     * Trims the pool to the optional specified max (or the default).
     * @param {number} max
     */
    trim(max) {
        this._cancelAutoTrim();
        this._recycle();
        const pool = this._pool;
        if (!pool.length)
            return; // no trimming needed.
        if (typeof max != 'number' || isNaN(max)) {
            max = Math.min(this._maxSize, // Hold no more than the maximum.
            Math.floor(pool.length / 2) - 1); // continue to reduce to zero over time.
        }
        if (max <= 0) {
            disposable_1.dispose.these.unsafe(pool, true);
            pool.length = 0;
            return; // all clear.
        }
        // Can only be here if max is greater than and so is the length.
        while (pool.length > max) {
            disposable_1.dispose.single(pool.pop(), true);
        }
        // setup next default automatic trim.
        this.autoTrim();
    }
    /**
     * Signals the pool to trim after a delay.
     * @param {number} msLater
     * @param {number} max
     */
    autoTrim(msLater = AUTO_REDUCE_DEFAULT_MS, max = NaN) {
        if (this.wasDisposed) {
            this.trim(0);
            return;
        }
        this._cancelAutoTrim();
        this._reduceTimeoutId = setTimeout(trim, msLater, this, max);
    }
    /**
     * Clears out the pool.
     */
    clear() {
        this.trim(0);
    }
    /**
     * Empties the pool into an array and returns it.
     * @return {T[]}
     */
    toArrayAndClear() {
        this.throwIfDisposed();
        this._cancelAutoTrim();
        this._recycle();
        const p = this._pool;
        this._pool = [];
        return p;
    }
    /**
     * Shortcut for toArrayAndClear();
     */
    dump() {
        return this.toArrayAndClear();
    }
    /**
     * Gives an item to the pool.  If recyclable, will be added to the recycler.
     * @param {T} entry
     */
    give(entry) {
        const _ = this;
        _.throwIfDisposed();
        if (entry == null) {
            console.warn('Attempting to add', entry, 'to an ObjectPool.');
            return;
        }
        const destination = _._toRecycle || _._pool;
        if (destination.length < ABSOLUTE_MAX_SIZE) {
            destination.push(entry);
        }
        // => Destination is very large? Prevent adding to pool.
        else if (_._recycler) {
            _._recycler(entry);
        }
        if (_._toRecycle && _._toRecycle.length) {
            // If items need recycling do so immediately after.
            _.autoTrim(0, _._maxSize);
        }
        else {
            // No new recyclables? Just trim normally.
            _.autoTrim();
        }
    }
    /**
     * Attempts to get an item from the pool.
     * Returns undefined if none available.
     * @return {T | undefined}
     */
    tryTake() {
        const _ = this;
        _.throwIfDisposed();
        let entry = _._pool.pop();
        if (!entry && _._toRecycle && (entry = _._toRecycle.pop())) {
            _._recycler(entry);
        }
        return entry;
    }
    /**
     * Returns an item from the pool or creates one using the provided factory or the default factory configured with the pool.
     * @param {() => T} factory
     * @return {T}
     */
    take(factory) {
        const _ = this;
        _.throwIfDisposed();
        if (!_._generator && !factory)
            throw new exceptions_1.ArgumentException('factory', 'Must provide a factory if on was not provided at construction time.');
        return _.tryTake() || factory && factory() || _._generator();
    }
    /**
     * Short term renting of an item.
     * @param {(entry: T) => void} closure
     */
    rent(closure) {
        const e = this.take();
        closure(e);
        this.give(e);
    }
    _recycle() {
        const toRecycle = this._toRecycle;
        if (!toRecycle)
            return;
        const recycler = this._recycler, pool = this._pool;
        let item;
        while ((item = toRecycle.pop())) {
            recycler(item);
            pool.push(item);
        }
    }
    _cancelAutoTrim() {
        const tid = this._reduceTimeoutId;
        if (tid) {
            clearTimeout(tid);
            this._reduceTimeoutId = 0;
        }
    }
    _onDispose() {
        super._onDispose();
        const _ = this;
        _.clear();
        _._generator = undefined;
        _._recycler = undefined;
        _._toRecycle = undefined;
        _._pool = undefined;
    }
}
exports.default = ObjectPool;
function recycle(e) {
    e.recycle();
}
function trim(instance, max) {
    instance.trim(max);
}
//# sourceMappingURL=ObjectPool.js.map