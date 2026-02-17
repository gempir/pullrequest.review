export class LruCache<K, V> {
    private readonly maxSize: number;
    private readonly map = new Map<K, V>();

    constructor(maxSize: number) {
        this.maxSize = Math.max(1, Math.floor(maxSize));
    }

    get size() {
        return this.map.size;
    }

    has(key: K) {
        return this.map.has(key);
    }

    get(key: K): V | undefined {
        const value = this.map.get(key);
        if (value === undefined) return undefined;
        this.map.delete(key);
        this.map.set(key, value);
        return value;
    }

    set(key: K, value: V): { evicted?: { key: K; value: V } } {
        if (this.map.has(key)) {
            this.map.delete(key);
        }
        this.map.set(key, value);

        if (this.map.size <= this.maxSize) {
            return {};
        }

        const oldestKey = this.map.keys().next().value as K | undefined;
        if (oldestKey === undefined) {
            return {};
        }
        const oldestValue = this.map.get(oldestKey);
        this.map.delete(oldestKey);
        if (oldestValue === undefined) {
            return {};
        }
        return { evicted: { key: oldestKey, value: oldestValue } };
    }

    delete(key: K) {
        return this.map.delete(key);
    }

    clear() {
        this.map.clear();
    }

    values() {
        return this.map.values();
    }
}
