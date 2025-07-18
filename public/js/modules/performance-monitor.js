/**
 * Performance Monitor Component
 * Displays Firebase usage statistics and performance metrics
 */

export class PerformanceMonitor {
    constructor() {
        this.isVisible = false;
        this.updateInterval = null;
        this.stats = {
            firebaseReads: 0,
            firebaseWrites: 0,
            cacheHits: 0,
            cacheMisses: 0,
            realtimeUpdates: 0,
            lastUpdate: new Date()
        };
    }

    /**
     * Create and show performance monitor UI
     */
    show() {
        if (this.isVisible) return;

        this.createMonitorUI();
        this.startTracking();
        this.isVisible = true;
    }

    /**
     * Hide performance monitor
     */
    hide() {
        if (!this.isVisible) return;

        const monitor = document.getElementById('performanceMonitor');
        if (monitor) {
            monitor.remove();
        }

        this.stopTracking();
        this.isVisible = false;
    }

    /**
     * Toggle performance monitor visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Create the performance monitor UI
     */
    createMonitorUI() {
        // Remove existing monitor if present
        const existing = document.getElementById('performanceMonitor');
        if (existing) {
            existing.remove();
        }

        const monitor = document.createElement('div');
        monitor.id = 'performanceMonitor';
        monitor.className = 'fixed top-4 right-4 z-50 bg-base-100 border border-base-300 rounded-lg shadow-lg p-4 w-80 max-h-96 overflow-y-auto';
        
        monitor.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-bold text-lg text-primary">Performance Monitor</h3>
                <div class="flex gap-2">
                    <button id="perfMonitorRefresh" class="btn btn-xs btn-ghost" title="Refresh">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                    </button>
                    <button id="perfMonitorClose" class="btn btn-xs btn-ghost" title="Close">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="space-y-4">
                <!-- Firebase Usage -->
                <div class="card bg-base-200 p-3">
                    <h4 class="font-semibold text-sm mb-2 text-secondary">Firebase Usage</h4>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div class="stat">
                            <div class="stat-title">Reads</div>
                            <div id="firebaseReads" class="stat-value text-lg">0</div>
                        </div>
                        <div class="stat">
                            <div class="stat-title">Writes</div>
                            <div id="firebaseWrites" class="stat-value text-lg">0</div>
                        </div>
                    </div>
                </div>

                <!-- Cache Performance -->
                <div class="card bg-base-200 p-3">
                    <h4 class="font-semibold text-sm mb-2 text-secondary">Cache Performance</h4>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div class="stat">
                            <div class="stat-title">Hits</div>
                            <div id="cacheHits" class="stat-value text-lg text-success">0</div>
                        </div>
                        <div class="stat">
                            <div class="stat-title">Misses</div>
                            <div id="cacheMisses" class="stat-value text-lg text-warning">0</div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <div class="stat-title">Hit Rate</div>
                        <div id="cacheHitRate" class="stat-value text-sm">0%</div>
                    </div>
                </div>

                <!-- Real-time Updates -->
                <div class="card bg-base-200 p-3">
                    <h4 class="font-semibold text-sm mb-2 text-secondary">Real-time</h4>
                    <div class="text-xs">
                        <div class="stat">
                            <div class="stat-title">Updates</div>
                            <div id="realtimeUpdates" class="stat-value text-lg">0</div>
                        </div>
                        <div class="stat">
                            <div class="stat-title">Active Listeners</div>
                            <div id="activeListeners" class="stat-value text-lg">0</div>
                        </div>
                    </div>
                </div>

                <!-- Performance Optimizer Stats -->
                <div class="card bg-base-200 p-3">
                    <h4 class="font-semibold text-sm mb-2 text-secondary">Optimizer</h4>
                    <div class="text-xs space-y-1">
                        <div class="flex justify-between">
                            <span>Cache Size:</span>
                            <span id="optimizerCacheSize">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Pending Batches:</span>
                            <span id="pendingBatches">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Throttled Updates:</span>
                            <span id="throttledUpdates">0</span>
                        </div>
                    </div>
                </div>

                <!-- Memory Usage -->
                <div class="card bg-base-200 p-3">
                    <h4 class="font-semibold text-sm mb-2 text-secondary">Memory</h4>
                    <div class="text-xs space-y-1">
                        <div class="flex justify-between">
                            <span>Inventory Items:</span>
                            <span id="inventoryCount">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Orders:</span>
                            <span id="ordersCount">0</span>
                        </div>
                        <div class="flex justify-between">
                            <span>Suppliers:</span>
                            <span id="suppliersCount">0</span>
                        </div>
                    </div>
                </div>

                <!-- Last Updated -->
                <div class="text-xs text-center text-base-content/70">
                    Last updated: <span id="lastUpdated">Never</span>
                </div>
            </div>
        `;

        document.body.appendChild(monitor);

        // Attach event listeners
        document.getElementById('perfMonitorClose').addEventListener('click', () => this.hide());
        document.getElementById('perfMonitorRefresh').addEventListener('click', () => this.updateDisplay());
    }

    /**
     * Start tracking performance metrics
     */
    startTracking() {
        this.updateDisplay();
        
        // Update every 5 seconds
        this.updateInterval = setInterval(() => {
            this.updateDisplay();
        }, 5000);
    }

    /**
     * Stop tracking performance metrics
     */
    stopTracking() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Update the performance display
     */
    updateDisplay() {
        if (!this.isVisible) return;

        try {
            // Get performance optimizer stats
            let optimizerStats = {};
            if (window.app && window.app.performanceOptimizer) {
                optimizerStats = window.app.performanceOptimizer.getStats();
            }

            // Get Firebase performance config stats
            let firebaseStats = {};
            if (window.app && window.app.firebaseConfig) {
                try {
                    const { getFirebaseUsageStats } = require('./firebase-performance-config.js');
                    firebaseStats = getFirebaseUsageStats();
                } catch (error) {
                    // Config not available
                }
            }

            // Update Firebase usage
            this.updateElement('firebaseReads', this.stats.firebaseReads);
            this.updateElement('firebaseWrites', this.stats.firebaseWrites);

            // Update cache performance
            this.updateElement('cacheHits', this.stats.cacheHits);
            this.updateElement('cacheMisses', this.stats.cacheMisses);
            
            const totalCacheRequests = this.stats.cacheHits + this.stats.cacheMisses;
            const hitRate = totalCacheRequests > 0 ? ((this.stats.cacheHits / totalCacheRequests) * 100).toFixed(1) : 0;
            this.updateElement('cacheHitRate', hitRate + '%');

            // Update real-time stats
            this.updateElement('realtimeUpdates', this.stats.realtimeUpdates);
            this.updateElement('activeListeners', optimizerStats.activeListeners || 0);

            // Update optimizer stats
            this.updateElement('optimizerCacheSize', optimizerStats.cacheSize || 0);
            this.updateElement('pendingBatches', optimizerStats.pendingBatches || 0);
            this.updateElement('throttledUpdates', optimizerStats.pendingThrottles || 0);

            // Update memory usage
            this.updateElement('inventoryCount', window.inventory ? window.inventory.length : 0);
            this.updateElement('ordersCount', window.app && window.app.ordersManager ? window.app.ordersManager.orders.length : 0);
            this.updateElement('suppliersCount', window.app && window.app.suppliers ? window.app.suppliers.length : 0);

            // Update timestamp
            this.updateElement('lastUpdated', new Date().toLocaleTimeString());

        } catch (error) {
            console.error('[PerformanceMonitor] Error updating display:', error);
        }
    }

    /**
     * Update a specific element
     */
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Track Firebase read operation
     */
    trackFirebaseRead() {
        this.stats.firebaseReads++;
        this.stats.lastUpdate = new Date();
    }

    /**
     * Track Firebase write operation
     */
    trackFirebaseWrite() {
        this.stats.firebaseWrites++;
        this.stats.lastUpdate = new Date();
    }

    /**
     * Track cache hit
     */
    trackCacheHit() {
        this.stats.cacheHits++;
    }

    /**
     * Track cache miss
     */
    trackCacheMiss() {
        this.stats.cacheMisses++;
    }

    /**
     * Track real-time update
     */
    trackRealtimeUpdate() {
        this.stats.realtimeUpdates++;
        this.stats.lastUpdate = new Date();
    }

    /**
     * Reset all statistics
     */
    resetStats() {
        this.stats = {
            firebaseReads: 0,
            firebaseWrites: 0,
            cacheHits: 0,
            cacheMisses: 0,
            realtimeUpdates: 0,
            lastUpdate: new Date()
        };
        this.updateDisplay();
    }

    /**
     * Get current statistics
     */
    getStats() {
        return { ...this.stats };
    }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Add global keyboard shortcut (Ctrl+Shift+P) to toggle monitor
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        event.preventDefault();
        performanceMonitor.toggle();
    }
});
