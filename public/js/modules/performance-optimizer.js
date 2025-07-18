/**
 * Performance Optimizer Module
 * Optimizes Firebase operations and reduces redundant calls to improve cost effectiveness
 */

export class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.listeners = new Map();
        this.throttleTimers = new Map();
        this.lastUpdates = new Map();
        this.batchOperations = new Map();
        this.pendingWrites = new Set();
        
        // Configuration
        this.config = {
            CACHE_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
            THROTTLE_DELAY_MS: 1000, // 1 second throttle for UI updates
            BATCH_DELAY_MS: 500, // 500ms delay for batching operations
            MAX_LISTENERS: 3, // Maximum concurrent listeners
            ENABLE_CACHING: true,
            ENABLE_THROTTLING: true,
            ENABLE_BATCHING: true
        };
        
        console.log('[PerformanceOptimizer] Initialized with config:', this.config);
    }

    /**
     * Optimized data loader with caching
     */
    async loadDataWithCache(collection, cacheKey, forceRefresh = false) {
        if (!forceRefresh && this.config.ENABLE_CACHING) {
            const cached = this.cache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < this.config.CACHE_EXPIRY_MS) {
                console.log(`[PerformanceOptimizer] Using cached data for ${cacheKey}`);
                
                // Track cache hit
                if (window.app && window.app.performanceMonitor) {
                    window.app.performanceMonitor.trackCacheHit();
                }
                
                return cached.data;
            }
        }

        try {
            console.log(`[PerformanceOptimizer] Loading fresh data for ${cacheKey}`);
            
            // Track cache miss and Firebase read
            if (window.app && window.app.performanceMonitor) {
                window.app.performanceMonitor.trackCacheMiss();
                window.app.performanceMonitor.trackFirebaseRead();
            }
            
            const snapshot = await window.db.collection(collection).get();
            const data = [];
            
            snapshot.forEach(doc => {
                data.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Cache the result
            if (this.config.ENABLE_CACHING) {
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
            }

            return data;
        } catch (error) {
            console.error(`[PerformanceOptimizer] Error loading ${cacheKey}:`, error);
            
            // Return cached data as fallback if available
            const cached = this.cache.get(cacheKey);
            if (cached) {
                console.log(`[PerformanceOptimizer] Using stale cached data for ${cacheKey}`);
                return cached.data;
            }
            
            throw error;
        }
    }

    /**
     * Throttled UI update function
     */
    throttledUpdate(key, updateFunction, delay = null) {
        if (!this.config.ENABLE_THROTTLING) {
            updateFunction();
            return;
        }

        const throttleDelay = delay || this.config.THROTTLE_DELAY_MS;
        
        // Clear existing timer
        if (this.throttleTimers.has(key)) {
            clearTimeout(this.throttleTimers.get(key));
        }

        // Set new timer
        const timer = setTimeout(() => {
            updateFunction();
            this.throttleTimers.delete(key);
            this.lastUpdates.set(key, Date.now());
        }, throttleDelay);

        this.throttleTimers.set(key, timer);
    }

    /**
     * Smart real-time listener management
     */
    optimizedListener(collection, key, callback, conditions = null) {
        // Check if we already have too many listeners
        if (this.listeners.size >= this.config.MAX_LISTENERS) {
            console.warn(`[PerformanceOptimizer] Maximum listeners (${this.config.MAX_LISTENERS}) reached. Skipping ${key}`);
            return null;
        }

        // Check if listener already exists for this key
        if (this.listeners.has(key)) {
            console.log(`[PerformanceOptimizer] Listener ${key} already exists, skipping`);
            return this.listeners.get(key);
        }

        console.log(`[PerformanceOptimizer] Creating optimized listener for ${key}`);

        let query = window.db.collection(collection);
        
        // Apply conditions if provided
        if (conditions) {
            conditions.forEach(condition => {
                query = query.where(condition.field, condition.operator, condition.value);
            });
        }

        const unsubscribe = query.onSnapshot(
            (snapshot) => {
                console.log(`[PerformanceOptimizer] ${key} data changed (${snapshot.size} items)`);
                
                // Track real-time update
                if (window.app && window.app.performanceMonitor) {
                    window.app.performanceMonitor.trackRealtimeUpdate();
                }
                
                // Throttle the callback to prevent excessive updates
                this.throttledUpdate(`listener_${key}`, () => {
                    const data = [];
                    snapshot.forEach(doc => {
                        data.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });
                    
                    // Update cache
                    if (this.config.ENABLE_CACHING) {
                        this.cache.set(key, {
                            data: data,
                            timestamp: Date.now()
                        });
                    }
                    
                    callback(data, snapshot.metadata);
                });
            },
            (error) => {
                console.error(`[PerformanceOptimizer] Listener error for ${key}:`, error);
                this.listeners.delete(key);
            }
        );

        this.listeners.set(key, unsubscribe);
        return unsubscribe;
    }

    /**
     * Batch write operations to reduce Firebase calls
     */
    batchWrite(collection, docId, data, operationType = 'update') {
        if (!this.config.ENABLE_BATCHING) {
            // Immediate write if batching disabled
            return this.performWrite(collection, docId, data, operationType);
        }

        const batchKey = `${collection}_${operationType}`;
        
        if (!this.batchOperations.has(batchKey)) {
            this.batchOperations.set(batchKey, []);
        }

        this.batchOperations.get(batchKey).push({
            collection,
            docId,
            data,
            operationType,
            timestamp: Date.now()
        });

        // Schedule batch execution
        this.scheduleBatchExecution(batchKey);
        
        return Promise.resolve(); // Return resolved promise for immediate operations
    }

    /**
     * Schedule batch execution
     */
    scheduleBatchExecution(batchKey) {
        if (this.throttleTimers.has(`batch_${batchKey}`)) {
            return; // Already scheduled
        }

        const timer = setTimeout(async () => {
            await this.executeBatch(batchKey);
            this.throttleTimers.delete(`batch_${batchKey}`);
        }, this.config.BATCH_DELAY_MS);

        this.throttleTimers.set(`batch_${batchKey}`, timer);
    }

    /**
     * Execute batched operations
     */
    async executeBatch(batchKey) {
        const operations = this.batchOperations.get(batchKey);
        if (!operations || operations.length === 0) {
            return;
        }

        console.log(`[PerformanceOptimizer] Executing batch ${batchKey} with ${operations.length} operations`);

        try {
            const batch = window.db.batch();
            let batchCount = 0;

            for (const op of operations) {
                const docRef = window.db.collection(op.collection).doc(op.docId);
                
                switch (op.operationType) {
                    case 'set':
                        batch.set(docRef, op.data);
                        break;
                    case 'update':
                        batch.update(docRef, op.data);
                        break;
                    case 'delete':
                        batch.delete(docRef);
                        break;
                }
                
                batchCount++;
                
                // Firestore batch limit is 500 operations
                if (batchCount >= 500) {
                    await batch.commit();
                    
                    // Track Firebase write for the committed batch
                    if (window.app && window.app.performanceMonitor) {
                        window.app.performanceMonitor.trackFirebaseWrite();
                    }
                    
                    batch = window.db.batch();
                    batchCount = 0;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
                
                // Track Firebase write for the final batch
                if (window.app && window.app.performanceMonitor) {
                    window.app.performanceMonitor.trackFirebaseWrite();
                }
            }

            console.log(`[PerformanceOptimizer] Batch ${batchKey} completed successfully`);
        } catch (error) {
            console.error(`[PerformanceOptimizer] Batch ${batchKey} failed:`, error);
            // Fallback to individual operations
            for (const op of operations) {
                try {
                    await this.performWrite(op.collection, op.docId, op.data, op.operationType);
                } catch (individualError) {
                    console.error(`[PerformanceOptimizer] Individual operation failed:`, individualError);
                }
            }
        } finally {
            this.batchOperations.delete(batchKey);
        }
    }

    /**
     * Perform individual write operation
     */
    async performWrite(collection, docId, data, operationType) {
        const docRef = window.db.collection(collection).doc(docId);
        
        switch (operationType) {
            case 'set':
                return await docRef.set(data);
            case 'update':
                return await docRef.update(data);
            case 'delete':
                return await docRef.delete();
            default:
                throw new Error(`Unknown operation type: ${operationType}`);
        }
    }

    /**
     * Intelligent UI refresh - only updates visible components
     */
    smartUIRefresh(component) {
        const refreshStrategies = {
            dashboard: () => {
                const dashboardEl = document.getElementById('dashboardViewContainer');
                if (dashboardEl && !dashboardEl.classList.contains('hidden')) {
                    this.throttledUpdate('dashboard_refresh', () => {
                        if (window.app && window.app.updateDashboard) {
                            window.app.updateDashboard();
                        }
                    });
                }
            },
            
            inventory: () => {
                const inventoryEl = document.getElementById('inventoryViewContainer');
                if (inventoryEl && !inventoryEl.classList.contains('hidden')) {
                    this.throttledUpdate('inventory_refresh', () => {
                        if (window.app && window.app.displayInventory) {
                            window.app.displayInventory();
                        }
                    });
                }
            },
            
            orders: () => {
                const ordersEl = document.getElementById('ordersSectionContainer');
                if (ordersEl && !ordersEl.classList.contains('hidden')) {
                    this.throttledUpdate('orders_refresh', () => {
                        if (window.app && window.app.ordersManager && window.app.ordersManager.displayOrders) {
                            window.app.ordersManager.displayOrders();
                        }
                    });
                }
            }
        };

        if (refreshStrategies[component]) {
            refreshStrategies[component]();
        } else {
            console.warn(`[PerformanceOptimizer] Unknown component for refresh: ${component}`);
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        console.log('[PerformanceOptimizer] Cleaning up resources...');
        
        // Clear all timers
        this.throttleTimers.forEach(timer => clearTimeout(timer));
        this.throttleTimers.clear();
        
        // Unsubscribe all listeners
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners.clear();
        
        // Execute any pending batches
        const pendingBatches = Array.from(this.batchOperations.keys());
        pendingBatches.forEach(batchKey => {
            this.executeBatch(batchKey);
        });
        
        // Clear cache
        this.cache.clear();
        
        console.log('[PerformanceOptimizer] Cleanup completed');
    }

    /**
     * Get performance statistics
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            activeListeners: this.listeners.size,
            pendingThrottles: this.throttleTimers.size,
            pendingBatches: this.batchOperations.size,
            lastUpdates: Object.fromEntries(this.lastUpdates),
            config: this.config
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[PerformanceOptimizer] Configuration updated:', this.config);
    }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();
