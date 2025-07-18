/**
 * Firebase Performance Monitor
 * Tracks and reports Firebase usage to help optimize costs
 */

export class FirebasePerformanceMonitor {
    constructor() {
        this.stats = {
            reads: 0,
            writes: 0,
            deletes: 0,
            listeners: 0,
            cacheHits: 0,
            cacheMisses: 0,
            startTime: Date.now(),
            collections: {}
        };
        
        this.sessionStats = [];
        this.warningThresholds = {
            readsPerMinute: 100,
            writesPerMinute: 50,
            totalReadsPerSession: 1000
        };
        
        // Auto-report every 5 minutes
        setInterval(() => this.autoReport(), 5 * 60 * 1000);
    }

    /**
     * Track a Firebase read operation
     */
    trackRead(collection, type = 'document', fromCache = false) {
        this.stats.reads++;
        
        if (fromCache) {
            this.stats.cacheHits++;
        } else {
            this.stats.cacheMisses++;
        }
        
        if (!this.stats.collections[collection]) {
            this.stats.collections[collection] = { reads: 0, writes: 0, deletes: 0 };
        }
        this.stats.collections[collection].reads++;
        
        console.log(`[Firebase Monitor] Read ${type} from ${collection} (fromCache: ${fromCache})`);
        this.checkThresholds();
    }

    /**
     * Track a Firebase write operation
     */
    trackWrite(collection, type = 'document') {
        this.stats.writes++;
        
        if (!this.stats.collections[collection]) {
            this.stats.collections[collection] = { reads: 0, writes: 0, deletes: 0 };
        }
        this.stats.collections[collection].writes++;
        
        console.log(`[Firebase Monitor] Write ${type} to ${collection}`);
        this.checkThresholds();
    }

    /**
     * Track a Firebase delete operation
     */
    trackDelete(collection, type = 'document') {
        this.stats.deletes++;
        
        if (!this.stats.collections[collection]) {
            this.stats.collections[collection] = { reads: 0, writes: 0, deletes: 0 };
        }
        this.stats.collections[collection].deletes++;
        
        console.log(`[Firebase Monitor] Delete ${type} from ${collection}`);
    }

    /**
     * Track a real-time listener
     */
    trackListener(collection, action = 'added') {
        if (action === 'added') {
            this.stats.listeners++;
        } else if (action === 'removed') {
            this.stats.listeners = Math.max(0, this.stats.listeners - 1);
        }
        
        console.log(`[Firebase Monitor] Listener ${action} for ${collection} (total: ${this.stats.listeners})`);
    }

    /**
     * Check if we're approaching warning thresholds
     */
    checkThresholds() {
        const sessionMinutes = (Date.now() - this.stats.startTime) / (1000 * 60);
        const readsPerMinute = this.stats.reads / Math.max(sessionMinutes, 1);
        const writesPerMinute = this.stats.writes / Math.max(sessionMinutes, 1);

        if (readsPerMinute > this.warningThresholds.readsPerMinute) {
            console.warn(`[Firebase Monitor] HIGH READ RATE: ${readsPerMinute.toFixed(1)} reads/minute`);
        }

        if (writesPerMinute > this.warningThresholds.writesPerMinute) {
            console.warn(`[Firebase Monitor] HIGH WRITE RATE: ${writesPerMinute.toFixed(1)} writes/minute`);
        }

        if (this.stats.reads > this.warningThresholds.totalReadsPerSession) {
            console.warn(`[Firebase Monitor] HIGH SESSION READS: ${this.stats.reads} total reads`);
        }
    }

    /**
     * Get current performance stats
     */
    getStats() {
        const sessionMinutes = (Date.now() - this.stats.startTime) / (1000 * 60);
        const readsPerMinute = this.stats.reads / Math.max(sessionMinutes, 1);
        const writesPerMinute = this.stats.writes / Math.max(sessionMinutes, 1);
        const cacheHitRate = this.stats.reads > 0 ? (this.stats.cacheHits / this.stats.reads * 100) : 0;

        return {
            ...this.stats,
            sessionMinutes: sessionMinutes.toFixed(1),
            readsPerMinute: readsPerMinute.toFixed(1),
            writesPerMinute: writesPerMinute.toFixed(1),
            cacheHitRate: cacheHitRate.toFixed(1) + '%'
        };
    }

    /**
     * Generate a detailed performance report
     */
    generateReport() {
        const stats = this.getStats();
        const report = [
            '=== Firebase Performance Report ===',
            `Session Duration: ${stats.sessionMinutes} minutes`,
            `Total Reads: ${stats.reads} (${stats.readsPerMinute}/min)`,
            `Total Writes: ${stats.writes} (${stats.writesPerMinute}/min)`,
            `Total Deletes: ${stats.deletes}`,
            `Cache Hit Rate: ${stats.cacheHitRate}`,
            `Active Listeners: ${stats.listeners}`,
            '',
            'Per Collection:',
            ...Object.entries(stats.collections).map(([collection, data]) => 
                `  ${collection}: ${data.reads} reads, ${data.writes} writes, ${data.deletes} deletes`
            ),
            '',
            'Optimization Suggestions:'
        ];

        // Add optimization suggestions
        if (parseFloat(stats.cacheHitRate) < 50) {
            report.push('  - Improve caching strategy (cache hit rate is low)');
        }
        
        if (parseFloat(stats.readsPerMinute) > 50) {
            report.push('  - Consider reducing read frequency or implementing better caching');
        }
        
        if (stats.listeners > 5) {
            report.push('  - Review real-time listeners (many active listeners detected)');
        }
        
        if (stats.reads > 500) {
            report.push('  - Consider pagination or data limiting strategies');
        }

        return report.join('\n');
    }

    /**
     * Print performance report to console
     */
    printReport() {
        const report = this.generateReport();
        console.log(report);
        return report;
    }

    /**
     * Auto-report performance stats
     */
    autoReport() {
        const stats = this.getStats();
        console.group('[Firebase Monitor] 5-Minute Performance Summary');
        console.log(`Reads: ${stats.reads} (${stats.readsPerMinute}/min)`);
        console.log(`Writes: ${stats.writes} (${stats.writesPerMinute}/min)`);
        console.log(`Cache Hit Rate: ${stats.cacheHitRate}`);
        console.log(`Active Listeners: ${stats.listeners}`);
        console.groupEnd();

        // Store session stats
        this.sessionStats.push({
            timestamp: Date.now(),
            ...stats
        });

        // Keep only last 24 session stats (2 hours)
        if (this.sessionStats.length > 24) {
            this.sessionStats = this.sessionStats.slice(-24);
        }
    }

    /**
     * Reset stats (useful for testing)
     */
    reset() {
        this.stats = {
            reads: 0,
            writes: 0,
            deletes: 0,
            listeners: 0,
            cacheHits: 0,
            cacheMisses: 0,
            startTime: Date.now(),
            collections: {}
        };
        console.log('[Firebase Monitor] Stats reset');
    }

    /**
     * Export stats as JSON
     */
    exportStats() {
        return {
            current: this.getStats(),
            session: this.sessionStats,
            timestamp: new Date().toISOString()
        };
    }
}

// Create global instance
export const performanceMonitor = new FirebasePerformanceMonitor();

// Add to window for console access
if (typeof window !== 'undefined') {
    window.firebaseMonitor = performanceMonitor;
}

// Console helper functions
if (typeof window !== 'undefined') {
    window.firebaseStats = () => performanceMonitor.printReport();
    window.firebaseReset = () => performanceMonitor.reset();
}
