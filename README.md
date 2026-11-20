<a href="https://tsdotnet.github.io/object-pool/"><img src="https://cdn.jsdelivr.net/gh/tsdotnet/object-pool@master/assets/banner.svg" alt="@tsdotnet/object-pool: Reuse, don’t reallocate. A pool for objects that are costly."></a>

[![npm version](https://img.shields.io/npm/v/@tsdotnet/object-pool.svg?style=flat-square)](https://www.npmjs.com/package/@tsdotnet/object-pool)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://github.com/tsdotnet/object-pool/blob/master/LICENSE)

A pool that hands out reusable objects and takes them back, avoiding repeated allocation.

## Install

```sh
npm install @tsdotnet/object-pool
```

## Usage

```ts
import ObjectPool from '@tsdotnet/object-pool';

const pool = new ObjectPool(() => new Uint8Array(1024), buf => buf.fill(0));

const buf = pool.take(); // a pooled one, or a new one
pool.give(buf);          // kept for reuse; cleared shortly after
pool.rent(b => b.set([1, 2, 3])); // take, use, give back
```

Past `maxSize` the pool trims itself, and `autoTrim()` schedules that.

## Use it from

ESM (`import ObjectPool from '@tsdotnet/object-pool';`) or CommonJS (`const ObjectPool = require('@tsdotnet/object-pool').default;`).

<details><summary>In a browser, without a bundler</summary>

```html
<script src="https://cdn.jsdelivr.net/npm/@tsdotnet/disposable@2/dist/umd/disposable.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tsdotnet/exceptions@1/dist/umd/exceptions.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tsdotnet/object-pool@2/dist/umd/object-pool.min.js"></script>
<script>
  const ObjectPool = tsdotnet.objectPool.default;
</script>
```

</details>

## Docs

[tsdotnet.github.io/object-pool](https://tsdotnet.github.io/object-pool/)
