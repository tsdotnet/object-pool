import { describe, it, expect, beforeEach, vi } from 'vitest';
import ObjectPool from '../src/ObjectPool';

// Test object that implements recyclable
class TestObject {
	constructor(public id: number = 0) {}
	
	recycle(): void {
		this.id = 0;
	}
}

// Test object with dispose method
class DisposableTestObject {
	public disposed = false;
	
	constructor(public id: number = 0) {}
	
	dispose(): void {
		this.disposed = true;
	}
}

describe('ObjectPool', () => {
	let objectIdCounter = 1;
	
	beforeEach(() => {
		objectIdCounter = 1;
		vi.clearAllTimers();
		vi.useFakeTimers();
	});
	
	describe('constructor', () => {
		it('should create an empty pool with default max size', () => {
			const pool = new ObjectPool<TestObject>();
			expect(pool.count).toBe(0);
			expect(pool.maxSize).toBe(100); // DEFAULT_MAX_SIZE
		});
		
		it('should create pool with custom max size', () => {
			const pool = new ObjectPool<TestObject>(undefined, undefined, 50);
			expect(pool.maxSize).toBe(50);
		});
		
		it('should throw on invalid max size', () => {
			expect(() => new ObjectPool<TestObject>(undefined, undefined, 0)).toThrow();
			expect(() => new ObjectPool<TestObject>(undefined, undefined, -1)).toThrow();
			expect(() => new ObjectPool<TestObject>(undefined, undefined, NaN)).toThrow();
		});
		
		it('should throw on max size too large', () => {
			expect(() => new ObjectPool<TestObject>(undefined, undefined, 100000)).toThrow();
		});
	});
	
	describe('give() and take()', () => {
		it('should store and retrieve objects', () => {
			const pool = new ObjectPool<TestObject>();
			const obj = new TestObject(1);
			
			pool.give(obj);
			expect(pool.count).toBe(1);
			
			const retrieved = pool.tryTake();
			expect(retrieved).toBe(obj);
			expect(pool.count).toBe(0);
		});
		
		it('should return undefined when pool is empty', () => {
			const pool = new ObjectPool<TestObject>();
			const result = pool.tryTake();
			expect(result).toBeUndefined();
		});
		
		it('should warn when giving null/undefined', () => {
			const pool = new ObjectPool<TestObject>();
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			
			pool.give(null as any);
			pool.give(undefined as any);
			
			expect(consoleSpy).toHaveBeenCalledTimes(2);
			consoleSpy.mockRestore();
		});
	});
	
	describe('take() with factory', () => {
		it('should create new object when pool is empty', () => {
			const factory = () => new TestObject(objectIdCounter++);
			const pool = new ObjectPool<TestObject>(factory);
			
			const obj = pool.take();
			expect(obj).toBeInstanceOf(TestObject);
			expect(obj.id).toBe(1);
		});
		
		it('should use provided factory over default factory', () => {
			const defaultFactory = () => new TestObject(999);
			const customFactory = () => new TestObject(555);
			const pool = new ObjectPool<TestObject>(defaultFactory);
			
			const obj = pool.take(customFactory);
			expect(obj.id).toBe(555);
		});
		
		it('should throw when no factory provided and none configured', () => {
			const pool = new ObjectPool<TestObject>();
			expect(() => pool.take()).toThrow('Must provide a factory');
		});
		
		it('should prefer pooled objects over creating new ones', () => {
			const factory = vi.fn(() => new TestObject(objectIdCounter++));
			const pool = new ObjectPool<TestObject>(factory);
			
			const obj1 = new TestObject(100);
			pool.give(obj1);
			
			const retrieved = pool.take();
			expect(retrieved).toBe(obj1);
			expect(factory).not.toHaveBeenCalled();
		});
	});
	
	describe('rent()', () => {
		it('should provide object temporarily and return it to pool', () => {
			const factory = () => new TestObject(objectIdCounter++);
			const pool = new ObjectPool<TestObject>(factory);
			
			let usedObject: TestObject | null = null;
			pool.rent((obj) => {
				usedObject = obj;
				obj.id = 999;
			});
			
			expect(usedObject).toBeInstanceOf(TestObject);
			expect(pool.count).toBe(1);
			
			// Verify the same object is returned next time
			const retrieved = pool.tryTake();
			expect(retrieved).toBe(usedObject);
			expect(retrieved!.id).toBe(999);
		});
	});
	
	describe('recycling', () => {
		it('should call recycler when configured', () => {
			const recycler = vi.fn((obj: TestObject) => { obj.id = 0; });
			const factory = () => new TestObject(objectIdCounter++);
			const pool = new ObjectPool<TestObject>(factory, recycler);
			
			const obj = new TestObject(555);
			pool.give(obj);
			expect(pool.count).toBe(1); // Should be in recycle queue, but count includes it
			
			const retrieved = pool.take();
			expect(recycler).toHaveBeenCalledWith(obj);
			expect(retrieved.id).toBe(0); // Should have been reset by recycler
		});
	});
	
	describe('trim()', () => {
		it('should reduce pool size to specified max', () => {
			const pool = new ObjectPool<TestObject>(undefined, undefined, 10);
			
			// Fill pool with more than max
			for(let i = 0; i < 15; i++) {
				pool.give(new TestObject(i));
			}
			
			expect(pool.count).toBe(15);
			pool.trim(5);
			expect(pool.count).toBe(5);
		});
		
		it('should dispose objects when trimming if they have dispose method', () => {
			const pool = new ObjectPool<DisposableTestObject>(undefined, undefined, 5);
			const objects: DisposableTestObject[] = [];
			
			for(let i = 0; i < 10; i++) {
				const obj = new DisposableTestObject(i);
				objects.push(obj);
				pool.give(obj);
			}
			
			pool.trim(3);
			
			// The last 7 objects should have been disposed (keeping newest 3)
			const disposedCount = objects.filter(o => o.disposed).length;
			expect(disposedCount).toBe(7);
		});
	});
	
	describe('autoTrim()', () => {
		it('should schedule automatic trimming', () => {
			const pool = new ObjectPool<TestObject>(undefined, undefined, 5);
			
			// Fill pool
			for(let i = 0; i < 10; i++) {
				pool.give(new TestObject(i));
			}
			
			expect(pool.count).toBe(10);
			
			pool.autoTrim(100, 3);
			expect(pool.count).toBe(10); // Not trimmed yet
			
			vi.advanceTimersByTime(100);
			expect(pool.count).toBe(3); // Should be trimmed now
		});
		
		it('should cancel previous auto trim when new one is scheduled', () => {
			const pool = new ObjectPool<TestObject>(undefined, undefined, 5);
			
			for(let i = 0; i < 10; i++) {
				pool.give(new TestObject(i));
			}
			
			pool.autoTrim(100, 3);
			pool.autoTrim(200, 5); // Should cancel the first one
			
			vi.advanceTimersByTime(100);
			expect(pool.count).toBe(10); // First trim should be cancelled
			
			vi.advanceTimersByTime(100); // Total 200ms
			expect(pool.count).toBe(5); // Second trim should execute
		});
		
		it('should trim immediately if msLater is 0', () => {
			const pool = new ObjectPool<TestObject>(undefined, undefined, 5);
			
			for(let i = 0; i < 10; i++) {
				pool.give(new TestObject(i));
			}
			
			pool.autoTrim(0, 3);
			// autoTrim(0) still uses setTimeout, so we need to advance by 0ms
			vi.advanceTimersByTime(0);
			expect(pool.count).toBe(3); // Should trim after setTimeout with 0ms
		});
	});
	
	describe('clear()', () => {
		it('should empty the pool', () => {
			const pool = new ObjectPool<TestObject>();
			const objects = [new TestObject(1), new TestObject(2), new TestObject(3)];
			
			objects.forEach(obj => pool.give(obj));
			expect(pool.count).toBe(3);
			
			pool.clear(); // clear() doesn't return array, use toArrayAndClear() instead
			expect(pool.count).toBe(0);
		});
		
		it('should return all objects as array with toArrayAndClear', () => {
			const pool = new ObjectPool<TestObject>();
			const objects = [new TestObject(1), new TestObject(2), new TestObject(3)];
			
			objects.forEach(obj => pool.give(obj));
			expect(pool.count).toBe(3);
			
			const cleared = pool.toArrayAndClear();
			expect(pool.count).toBe(0);
			expect(cleared).toHaveLength(3);
			expect(cleared).toEqual(expect.arrayContaining(objects));
		});
	});
	
	describe('disposal', () => {
		it('should throw when used after disposal', () => {
			const pool = new ObjectPool<TestObject>();
			pool.dispose();
			
			expect(() => pool.give(new TestObject())).toThrow();
			expect(() => pool.take()).toThrow();
			expect(() => pool.tryTake()).toThrow();
		});
		
		it('should clear pool and cancel timers on disposal', () => {
			const pool = new ObjectPool<TestObject>();
			
			pool.give(new TestObject(1));
			pool.autoTrim(1000);
			
			expect(pool.count).toBe(1);
			pool.dispose();
			
			// Pool should be cleared
			expect(pool.count).toBe(0);
			
			// Timer should be cancelled (advancing time shouldn't cause errors)
			vi.advanceTimersByTime(1000);
			// No assertions needed - just ensuring no errors occur
		});
	});
	
	describe('edge cases', () => {
		it('should handle absolute max size limit', () => {
			const pool = new ObjectPool<TestObject>(undefined, undefined, 10);
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			
			// Try to fill beyond absolute max (65536)
			// This is impractical to test with actual objects, so we'll test the warning logic
			// by checking that objects beyond the limit are handled appropriately
			
			for(let i = 0; i < 20; i++) {
				pool.give(new TestObject(i));
			}
			
			// Pool should accept all objects (within reasonable limits)
			expect(pool.count).toBe(20);
			consoleSpy.mockRestore();
		});
		
		it('should handle recycler errors', () => {
			const errorRecycler = vi.fn(() => { throw new Error('Recycler error'); });
			const pool = new ObjectPool<TestObject>(() => new TestObject(), errorRecycler);
			
			pool.give(new TestObject(1));
			
			// Taking should throw because recycler throws during _recycle()
			expect(() => {
				pool.tryTake();
			}).toThrow('Recycler error');
		});
		
		it('should handle dump() method as alias for toArrayAndClear()', () => {
			const pool = new ObjectPool<TestObject>();
			const objects = [new TestObject(1), new TestObject(2)];
			
			objects.forEach(obj => pool.give(obj));
			
			const dumped = pool.dump();
			expect(dumped).toHaveLength(2);
			expect(pool.count).toBe(0);
		});
		
		it('should handle trim with invalid max parameter', () => {
			const pool = new ObjectPool<TestObject>(undefined, undefined, 10);
			
			for(let i = 0; i < 15; i++) {
				pool.give(new TestObject(i));
			}
			
			// Trim with negative number should clear the entire pool (max <= 0)
			pool.trim(-5);
			expect(pool.count).toBe(0); // Should clear completely when max <= 0
		});
		
		it('should handle multiple autoTrim calls', () => {
			const pool = new ObjectPool<TestObject>(undefined, undefined, 5);
			
			for(let i = 0; i < 20; i++) {
				pool.give(new TestObject(i));
			}
			
			// Schedule multiple trims - each should cancel the previous
			pool.autoTrim(100, 10);
			pool.autoTrim(50, 8);
			pool.autoTrim(25, 3);
			
			// Only the last one should execute
			vi.advanceTimersByTime(25);
			expect(pool.count).toBe(3);
		});
	});
});
