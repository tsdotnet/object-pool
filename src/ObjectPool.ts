/*!
 * @author electricessence / https://github.com/electricessence/
 * Licensing: MIT https://github.com/electricessence/TypeScript.NET-Core/blob/master/LICENSE.md
 * Based upon ObjectPool from Parallel Extension Extras and other ObjectPool implementations.
 * Uses .add(T) and .take():T
 */

import DisposableBase from '@tsdotnet/disposable';
import dispose from '@tsdotnet/disposable/dist/dispose';
import ArgumentException from '@tsdotnet/exceptions/dist/ArgumentException';
import ArgumentOutOfRangeException from '@tsdotnet/exceptions/dist/ArgumentOutOfRangeException';

const
	OBJECT_POOL            = 'ObjectPool',
	DEFAULT_MAX_SIZE       = 100,
	ABSOLUTE_MAX_SIZE      = 65536,
	AUTO_REDUCE_DEFAULT_MS = 1000; // auto reduce milliseconds.

export type Recyclable = { recycle (): void };

/**
 * A flexible Object Pool that trims the pool down to the specified max size after a specified delay.
 */
export default class ObjectPool<T>
	extends DisposableBase
{

	// noinspection TypeScriptFieldCanBeMadeReadonly
	private _toRecycle?: T[];
	private _pool: T[];
	private _reduceTimeoutId: any = 0; // possible differences between browser and NodeJS.  Keep as 'any'.

	/**
	 * A transient amount of object to exist over _maxSize until trim() is called.
	 * But any added objects over _localAbsMaxSize will be disposed immediately.
	 * @param _generator The delegate to create new items.
	 * @param _recycler An optional delegate to clean/process items before returning to the pool.
	 * @param _maxSize The soft ceiling by which the pool is trimmed. Default is 1000.
	 */

	constructor (
		private _generator?: (...args: any[]) => T,
		private _recycler?: (o: T) => void,
		private readonly _maxSize: number = DEFAULT_MAX_SIZE)
	{
		super(OBJECT_POOL);
		if(isNaN(_maxSize) || _maxSize<1)
			throw new ArgumentOutOfRangeException('_maxSize', _maxSize, 'Must be at valid number least 1.');
		if(_maxSize>ABSOLUTE_MAX_SIZE)
			throw new ArgumentOutOfRangeException('_maxSize', _maxSize, `Must be less than or equal to ${ABSOLUTE_MAX_SIZE}.`);

		this._toRecycle = _recycler ? [] : undefined;
		this._pool = [];
	}

	/**
	 * The soft ceiling by which the pool is trimmed.
	 * @returns {number}
	 */
	get maxSize (): number
	{
		return this._maxSize;
	}

	/**
	 * Current number of objects in the pool.
	 * @returns {number}
	 */
	get count (): number
	{
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
	static create<T> (
		generator?: (...args: any[]) => T,
		recycler?: (o: T) => void,
		max: number = DEFAULT_MAX_SIZE): ObjectPool<T>
	{
		return new ObjectPool<T>(generator, recycler, max);
	}

	/**
	 * Creates an auto-recycled pool using the specified generator.
	 * @param {(...args: any[]) => T} generator
	 * @param {number} max
	 * @return {ObjectPool<T>}
	 */
	static createAutoRecycled<T extends Recyclable> (
		generator?: (...args: any[]) => T,
		max: number = DEFAULT_MAX_SIZE): ObjectPool<T>
	{
		return new ObjectPool<T>(generator, recycle, max);
	}

	/**
	 * Trims the pool to the optional specified max (or the default).
	 * @param {number} max
	 */
	trim (max?: number): void
	{
		this._cancelAutoTrim();
		this._recycle();
		const pool = this._pool;
		if(!pool.length) return; // no trimming needed.

		if(typeof max!='number' || isNaN(max))
		{
			max = Math.min(
				this._maxSize, // Hold no more than the maximum.
				Math.floor(pool.length/2) - 1); // continue to reduce to zero over time.
		}

		if(max<=0)
		{
			dispose.these.unsafe(pool as any, true);
			pool.length = 0;
			return; // all clear.
		}

		// Can only be here if max is greater than and so is the length.
		while(pool.length>max)
		{
			dispose.single(pool.pop() as any, true);
		}

		// setup next default automatic trim.
		this.autoTrim();
	}

	/**
	 * Signals the pool to trim after a delay.
	 * @param {number} msLater
	 * @param {number} max
	 */
	autoTrim (msLater: number = AUTO_REDUCE_DEFAULT_MS, max: number = NaN): void
	{
		if(this.wasDisposed)
		{
			this.trim(0);
			return;
		}

		this._cancelAutoTrim();
		this._reduceTimeoutId = setTimeout(trim, msLater, this, max);
	}

	/**
	 * Clears out the pool.
	 */
	clear (): void
	{
		this.trim(0);
	}

	/**
	 * Empties the pool into an array and returns it.
	 * @return {T[]}
	 */
	toArrayAndClear (): T[]
	{
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
	dump (): T[]
	{
		return this.toArrayAndClear();
	}

	/**
	 * Gives an item to the pool.  If recyclable, will be added to the recycler.
	 * @param {T} entry
	 */
	give (entry: T): void
	{
		const _ = this;
		_.throwIfDisposed();
		if(entry==null)
		{
			console.warn('Attempting to add', entry, 'to an ObjectPool.');
			return;
		}

		const destination = _._toRecycle || _._pool;
		if(destination.length<ABSOLUTE_MAX_SIZE)
		{
			destination.push(entry);
		}
		// => Destination is very large? Prevent adding to pool.
		else if(_._recycler)
		{
			_._recycler(entry);
		}

		if(_._toRecycle && _._toRecycle.length)
		{
			// If items need recycling do so immediately after.
			_.autoTrim(0, _._maxSize);
		}
		else
		{
			// No new recyclables? Just trim normally.
			_.autoTrim();
		}
	}

	/**
	 * Attempts to get an item from the pool.
	 * Returns undefined if none available.
	 * @return {T | undefined}
	 */
	tryTake (): T | undefined
	{
		const _ = this;
		_.throwIfDisposed();

		let entry = _._pool.pop();
		if(!entry && _._toRecycle && (entry = _._toRecycle.pop()))
		{
			_._recycler!(entry);
		}
		return entry;
	}

	/**
	 * Returns an item from the pool or creates one using the provided factory or the default factory configured with the pool.
	 * @param {() => T} factory
	 * @return {T}
	 */
	take (factory?: () => T): T
	{
		const _ = this;
		_.throwIfDisposed();
		if(!_._generator && !factory)
			throw new ArgumentException('factory', 'Must provide a factory if on was not provided at construction time.');

		return _.tryTake() || factory && factory() || _._generator!();
	}

	/**
	 * Short term renting of an item.
	 * @param {(entry: T) => void} closure
	 */
	rent (closure: (entry: T) => void): void
	{
		const e = this.take();
		closure(e);
		this.give(e);
	}

	protected _recycle (): void
	{
		const toRecycle = this._toRecycle;
		if(!toRecycle) return;
		const recycler = this._recycler!, pool = this._pool;
		let item: T | undefined;
		while((item = toRecycle.pop()))
		{
			recycler(item);
			pool.push(item);
		}
	}

	protected _cancelAutoTrim (): void
	{
		const tid = this._reduceTimeoutId;
		if(tid)
		{
			clearTimeout(tid);
			this._reduceTimeoutId = 0;
		}
	}

	protected _onDispose (): void
	{
		super._onDispose();
		const _ = this;
		_.clear();
		_._generator = undefined;
		_._recycler = undefined;

		_._toRecycle = undefined;
		_._pool = undefined as any;
	}
}

function recycle (e: Recyclable): void
{
	e.recycle();
}

function trim<T> (instance: ObjectPool<T>, max: number): void
{
	instance.trim(max);
}
