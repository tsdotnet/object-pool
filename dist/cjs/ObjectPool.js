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
const OBJECT_POOL = 'ObjectPool', DEFAULT_MAX_SIZE = 100, ABSOLUTE_MAX_SIZE = 65536, AUTO_REDUCE_DEFAULT_MS = 1000;
class ObjectPool extends disposable_1.DisposableBase {
    constructor(_generator, _recycler, _maxSize = DEFAULT_MAX_SIZE) {
        super(OBJECT_POOL);
        this._generator = _generator;
        this._recycler = _recycler;
        this._maxSize = _maxSize;
        this._reduceTimeoutId = 0;
        if (isNaN(_maxSize) || _maxSize < 1)
            throw new exceptions_1.ArgumentOutOfRangeException('_maxSize', _maxSize, 'Must be at valid number least 1.');
        if (_maxSize > ABSOLUTE_MAX_SIZE)
            throw new exceptions_1.ArgumentOutOfRangeException('_maxSize', _maxSize, `Must be less than or equal to ${ABSOLUTE_MAX_SIZE}.`);
        this._toRecycle = _recycler ? [] : undefined;
        this._pool = [];
    }
    get maxSize() {
        return this._maxSize;
    }
    get count() {
        const r = this._toRecycle;
        const p = this._pool;
        return (r ? r.length : 0) + (p ? p.length : 0);
    }
    static create(generator, recycler, max = DEFAULT_MAX_SIZE) {
        return new ObjectPool(generator, recycler, max);
    }
    static createAutoRecycled(generator, max = DEFAULT_MAX_SIZE) {
        return new ObjectPool(generator, recycle, max);
    }
    trim(max) {
        this._cancelAutoTrim();
        this._recycle();
        const pool = this._pool;
        if (!pool.length)
            return;
        if (typeof max != 'number' || isNaN(max)) {
            max = Math.min(this._maxSize, Math.floor(pool.length / 2) - 1);
        }
        if (max <= 0) {
            disposable_1.dispose.these.unsafe(pool, true);
            pool.length = 0;
            return;
        }
        while (pool.length > max) {
            disposable_1.dispose.single(pool.pop(), true);
        }
        this.autoTrim();
    }
    autoTrim(msLater = AUTO_REDUCE_DEFAULT_MS, max = NaN) {
        if (this.wasDisposed) {
            this.trim(0);
            return;
        }
        this._cancelAutoTrim();
        this._reduceTimeoutId = setTimeout(trim, msLater, this, max);
    }
    clear() {
        this.trim(0);
    }
    toArrayAndClear() {
        this.throwIfDisposed();
        this._cancelAutoTrim();
        this._recycle();
        const p = this._pool;
        this._pool = [];
        return p;
    }
    dump() {
        return this.toArrayAndClear();
    }
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
        else if (_._recycler) {
            _._recycler(entry);
        }
        if (_._toRecycle && _._toRecycle.length) {
            _.autoTrim(0, _._maxSize);
        }
        else {
            _.autoTrim();
        }
    }
    tryTake() {
        const _ = this;
        _.throwIfDisposed();
        let entry = _._pool.pop();
        if (!entry && _._toRecycle && (entry = _._toRecycle.pop())) {
            _._recycler(entry);
        }
        return entry;
    }
    take(factory) {
        const _ = this;
        _.throwIfDisposed();
        if (!_._generator && !factory)
            throw new exceptions_1.ArgumentException('factory', 'Must provide a factory if on was not provided at construction time.');
        return _.tryTake() || factory && factory() || _._generator();
    }
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