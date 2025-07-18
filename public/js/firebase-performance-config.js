/**
 * Firebase Performance Configuration
 * Optimized settings for cost-effective Firebase usage
 */

export const firebasePerformanceConfig = {
    // Real-time listener configuration
    realtime: {
        // Limit concurrent listeners to reduce costs
        maxConcurrentListeners: 3,
        
        // Use source: 'cache' first, then 'server' if needed
        preferCachedData: true,
        
        // Throttle listener updates to prevent excessive triggers
        throttleUpdatesMs: 1000,
        
        // Enable metadata to check if data is from cache
        includeMetadataChanges: true,
        
        // Collections to monitor
        collections: ['orders', 'inventory'], // Remove 'suppliers', 'locations' from real-time
    },
    
    // Caching strategy
    cache: {
        // Cache duration for different data types
        durations: {
            inventory: 5 * 60 * 1000,     // 5 minutes
            orders: 2 * 60 * 1000,        // 2 minutes  
            suppliers: 30 * 60 * 1000,    // 30 minutes (rarely changes)
            locations: 30 * 60 * 1000,    // 30 minutes (rarely changes)
            users: 15 * 60 * 1000,        // 15 minutes
        },
        
        // Maximum cache size (number of items)
        maxSize: 1000,
        
        // Enable aggressive caching
        enabled: true
    },
    
    // Batch operations configuration
    batching: {
        // Batch write delay
        writeDelayMs: 500,
        
        // Maximum operations per batch
        maxOperationsPerBatch: 450, // Stay under Firestore's 500 limit
        
        // Auto-execute batch after this many operations
        autoExecuteThreshold: 100,
        
        enabled: true
    },
    
    // Query optimization
    queries: {
        // Use pagination for large datasets
        pageSize: 50,
        
        // Limit query results
        maxResults: 500,
        
        // Prefer simple queries over complex ones
        avoidComplexFiltering: true,
        
        // Cache query results
        cacheResults: true
    },
    
    // UI update optimization
    ui: {
        // Throttle UI updates to reduce processing
        updateThrottleMs: 300,
        
        // Only update visible components
        updateOnlyVisible: true,
        
        // Batch DOM updates
        batchDOMUpdates: true,
        
        // Debounce search inputs
        searchDebounceMs: 300
    },
    
    // Network optimization
    network: {
        // Retry failed operations
        retryFailedOperations: true,
        maxRetries: 3,
        retryDelayMs: 1000,
        
        // Use compression
        enableCompression: true,
        
        // Prefer offline data when available
        preferOffline: false
    },
    
    // Monitoring and analytics
    monitoring: {
        // Log performance metrics
        enabled: true,
        
        // Track Firebase usage
        trackUsage: true,
        
        // Log expensive operations
        logExpensiveOps: true,
        
        // Sample rate for logging (0.1 = 10%)
        sampleRate: 0.1
    }
};

/**
 * Apply performance optimizations to Firebase
 */
export function applyFirebaseOptimizations() {
    if (!window.db) {
        console.warn('[FirebaseOptimization] Firestore not initialized');
        return;
    }

    console.log('[FirebaseOptimization] Applying performance optimizations...');

    // Enable network usage logging
    if (firebasePerformanceConfig.monitoring.enabled) {
        console.log('[FirebaseOptimization] Performance monitoring enabled');
    }

    // Set up offline persistence with size limit
    try {
        window.db.enablePersistence({
            synchronizeTabs: false // Disable multi-tab sync to reduce overhead
        }).then(() => {
            console.log('[FirebaseOptimization] Offline persistence enabled');
        }).catch(err => {
            if (err.code === 'failed-precondition') {
                console.log('[FirebaseOptimization] Persistence failed - multiple tabs open');
            } else if (err.code === 'unimplemented') {
                console.log('[FirebaseOptimization] Persistence not supported');
            }
        });
    } catch (error) {
        console.log('[FirebaseOptimization] Persistence error:', error.message);
    }

    // Configure Firestore settings for performance
    const settings = {
        cacheSizeBytes: 40 * 1024 * 1024, // 40MB cache
        ignoreUndefinedProperties: true,
    };

    try {
        window.db.settings(settings);
        console.log('[FirebaseOptimization] Firestore settings applied');
    } catch (error) {
        console.log('[FirebaseOptimization] Settings already applied');
    }

    return firebasePerformanceConfig;
}

/**
 * Get Firebase usage statistics
 */
export function getFirebaseUsageStats() {
    return {
        timestamp: new Date().toISOString(),
        config: firebasePerformanceConfig,
        runtime: {
            cacheSize: window.app?.performanceOptimizer?.cache?.size || 0,
            activeListeners: window.app?.performanceOptimizer?.listeners?.size || 0,
            pendingBatches: window.app?.performanceOptimizer?.batchOperations?.size || 0
        }
    };
}

/**
 * Optimize Firebase queries for cost efficiency
 */
export function optimizeQuery(collection, constraints = []) {
    let query = window.db.collection(collection);
    
    // Apply constraints
    constraints.forEach(constraint => {
        if (constraint.type === 'where') {
            query = query.where(constraint.field, constraint.operator, constraint.value);
        } else if (constraint.type === 'orderBy') {
            query = query.orderBy(constraint.field, constraint.direction);
        } else if (constraint.type === 'limit') {
            query = query.limit(Math.min(constraint.value, firebasePerformanceConfig.queries.maxResults));
        }
    });
    
    // Apply default limit if not specified
    const hasLimit = constraints.some(c => c.type === 'limit');
    if (!hasLimit) {
        query = query.limit(firebasePerformanceConfig.queries.pageSize);
    }
    
    return query;
}

export default firebasePerformanceConfig;
