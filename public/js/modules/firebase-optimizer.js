/**
 * Firebase Optimizer Module
 * Reduces Firebase reads/writes by implementing efficient patterns
 */

// Import performance monitor
import { performanceMonitor } from './firebase-performance-monitor.js';

export class FirebaseOptimizer {
    constructor(db) {
        this.db = db;
        this.cache = new Map();
        this.pendingBatch = null;
        this.batchOperations = [];
        this.listeners = new Map();
        this.queryCache = new Map();
        this.monitor = performanceMonitor;
        
        // Performance tracking
        this.stats = {
            reads: 0,
            writes: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // Auto-commit batch after delay
        this.batchTimer = null;
        this.BATCH_DELAY = 500; // 500ms
        this.MAX_BATCH_SIZE = 450; // Stay under Firestore's 500 limit
    }

    /**
     * Optimized document read with caching
     */
    async getDocument(collection, docId, options = {}) {
        const cacheKey = `${collection}/${docId}`;
        const cacheEntry = this.cache.get(cacheKey);
        
        // Check cache first unless force refresh
        if (cacheEntry && !options.forceRefresh) {
            const isExpired = Date.now() - cacheEntry.timestamp > (options.cacheDuration || 300000); // 5 min default
            if (!isExpired) {
                this.stats.cacheHits++;
                this.monitor.trackRead(collection, 'document', true);
                console.log(`[Firebase] Cache hit for ${cacheKey}`);
                return cacheEntry.data;
            }
        }
        
        // Fetch from Firestore with source preference
        const source = options.source || (cacheEntry ? 'default' : 'server');
        
        try {
            this.stats.reads++;
            this.monitor.trackRead(collection, 'document', false);
            console.log(`[Firebase] Reading document ${cacheKey} from ${source}`);
            
            const doc = await this.db.collection(collection).doc(docId).get({ source });
            
            if (doc.exists) {
                const data = { id: doc.id, ...doc.data() };
                
                // Cache the result
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
                
                this.stats.cacheMisses++;
                return data;
            } else {
                console.warn(`[Firebase] Document ${cacheKey} not found`);
                return null;
            }
        } catch (error) {
            console.error(`[Firebase] Error reading document ${cacheKey}:`, error);
            throw error;
        }
    }

    /**
     * Optimized collection query with caching and pagination
     */
    async getCollection(collection, options = {}) {
        const {
            where = [],
            orderBy = [],
            limit = 1000, // Increased default limit to handle larger collections
            startAfter = null,
            cacheDuration = 180000, // 3 minutes
            source = 'default'
        } = options;
        
        // Create cache key from query parameters
        const cacheKey = this.createQueryCacheKey(collection, { where, orderBy, limit, startAfter });
        const cacheEntry = this.queryCache.get(cacheKey);
        
        // Check cache first
        if (cacheEntry && !options.forceRefresh) {
            const isExpired = Date.now() - cacheEntry.timestamp > cacheDuration;
            if (!isExpired) {
                this.stats.cacheHits++;
                this.monitor.trackRead(collection, 'collection', true);
                console.log(`[Firebase] Query cache hit for ${collection}`);
                return cacheEntry.data;
            }
        }
        
        try {
            let query = this.db.collection(collection);
            
            // Apply where clauses
            where.forEach(([field, operator, value]) => {
                query = query.where(field, operator, value);
            });
            
            // Apply ordering
            orderBy.forEach(([field, direction = 'asc']) => {
                query = query.orderBy(field, direction);
            });
            
            // Apply pagination
            if (limit) query = query.limit(limit);
            if (startAfter) query = query.startAfter(startAfter);
            
            this.stats.reads++;
            this.monitor.trackRead(collection, 'collection', false);
            console.log(`[Firebase] Querying collection ${collection} (estimated ${limit} reads)`);
            
            const snapshot = await query.get({ source });
            const data = [];
            
            snapshot.forEach(doc => {
                const docData = { id: doc.id, ...doc.data() };
                data.push(docData);
                
                // Cache individual documents too
                this.cache.set(`${collection}/${doc.id}`, {
                    data: docData,
                    timestamp: Date.now()
                });
            });
            
            // Cache query result
            this.queryCache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            
            this.stats.cacheMisses++;
            return data;
            
        } catch (error) {
            console.error(`[Firebase] Error querying collection ${collection}:`, error);
            throw error;
        }
    }

    /**
     * Batched write operations
     */
    addToBatch(operation, collection, docId, data) {
        if (!this.pendingBatch) {
            this.pendingBatch = this.db.batch();
        }
        
        const docRef = docId ? 
            this.db.collection(collection).doc(docId) : 
            this.db.collection(collection).doc();
        
        switch (operation) {
            case 'set':
                this.pendingBatch.set(docRef, data);
                break;
            case 'update':
                this.pendingBatch.update(docRef, data);
                break;
            case 'delete':
                this.pendingBatch.delete(docRef);
                break;
        }
        
        this.batchOperations.push({ operation, collection, docId, data });
        
        // Track the write operation
        this.monitor.trackWrite(collection, operation);
        
        // Auto-commit if batch is getting large
        if (this.batchOperations.length >= this.MAX_BATCH_SIZE) {
            return this.commitBatch();
        }
        
        // Schedule auto-commit
        this.scheduleBatchCommit();
        
        return Promise.resolve(docRef);
    }

    /**
     * Commit pending batch operations
     */
    async commitBatch() {
        if (!this.pendingBatch || this.batchOperations.length === 0) {
            return;
        }
        
        const operationCount = this.batchOperations.length;
        
        try {
            console.log(`[Firebase] Committing batch with ${operationCount} operations`);
            await this.pendingBatch.commit();
            this.stats.writes += operationCount;
            
            // Track successful batch commit
            this.monitor.trackBatchCommit(operationCount);
            
            // Clear cache for affected documents
            this.batchOperations.forEach(({ collection, docId }) => {
                if (docId) {
                    this.cache.delete(`${collection}/${docId}`);
                }
                // Clear related query cache
                this.clearQueryCache(collection);
            });
            
            console.log(`[Firebase] Batch committed successfully`);
        } catch (error) {
            console.error('[Firebase] Batch commit failed:', error);
            throw error;
        } finally {
            this.pendingBatch = null;
            this.batchOperations = [];
            this.clearBatchTimer();
        }
    }

    /**
     * Optimized real-time listener with source awareness
     */
    createOptimizedListener(collection, callback, options = {}) {
        const listenerId = `${collection}_${Date.now()}`;
        
        let query = this.db.collection(collection);
        
        // Apply query options
        if (options.where) {
            options.where.forEach(([field, operator, value]) => {
                query = query.where(field, operator, value);
            });
        }
        
        if (options.orderBy) {
            options.orderBy.forEach(([field, direction = 'asc']) => {
                query = query.orderBy(field, direction);
            });
        }
        
        if (options.limit) {
            query = query.limit(options.limit);
        }
        
        // Create listener with metadata to detect source
        const unsubscribe = query.onSnapshot({
            includeMetadataChanges: true
        }, (snapshot) => {
            const fromCache = snapshot.metadata.fromCache;
            const hasPendingWrites = snapshot.metadata.hasPendingWrites;
            
            console.log(`[Firebase] Listener update for ${collection} (fromCache: ${fromCache}, pendingWrites: ${hasPendingWrites})`);
            
            // Only process server updates to avoid excessive UI updates
            if (!fromCache || !hasPendingWrites) {
                const data = [];
                snapshot.forEach(doc => {
                    data.push({ id: doc.id, ...doc.data() });
                });
                
                callback(data, { fromCache, hasPendingWrites });
            }
        }, (error) => {
            console.error(`[Firebase] Listener error for ${collection}:`, error);
        });
        
        this.listeners.set(listenerId, unsubscribe);
        return listenerId;
    }

    /**
     * Remove listener
     */
    removeListener(listenerId) {
        const unsubscribe = this.listeners.get(listenerId);
        if (unsubscribe) {
            unsubscribe();
            this.listeners.delete(listenerId);
            console.log(`[Firebase] Removed listener ${listenerId}`);
        }
    }

    /**
     * Helper methods
     */
    scheduleBatchCommit() {
        this.clearBatchTimer();
        this.batchTimer = setTimeout(() => {
            this.commitBatch();
        }, this.BATCH_DELAY);
    }

    clearBatchTimer() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
    }

    createQueryCacheKey(collection, options) {
        return `query_${collection}_${JSON.stringify(options)}`;
    }

    clearQueryCache(collection) {
        for (const [key] of this.queryCache) {
            if (key.startsWith(`query_${collection}_`)) {
                this.queryCache.delete(key);
            }
        }
    }

    clearCache() {
        this.cache.clear();
        this.queryCache.clear();
        console.log('[Firebase] Cache cleared');
    }

    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            queryCacheSize: this.queryCache.size,
            activeListeners: this.listeners.size
        };
    }

    printStats() {
        const stats = this.getStats();
        console.log('[Firebase] Performance Stats:', stats);
        return stats;
    }
}

// Usage helper for existing code
export function createFirebaseOptimizer(db) {
    return new FirebaseOptimizer(db);
}
