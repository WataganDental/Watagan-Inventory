// Testing utilities and monitoring setup
export class TestUtils {
    static mockFirebaseAuth() {
        return {
            currentUser: {
                uid: 'test-user-123',
                email: 'test@example.com',
                displayName: 'Test User'
            },
            signInWithEmailAndPassword: jest.fn(),
            signOut: jest.fn(),
            onAuthStateChanged: jest.fn()
        };
    }

    static mockFirestore() {
        const mockDoc = {
            id: 'test-doc-id',
            data: () => ({ name: 'Test Product', quantity: 10 }),
            exists: true
        };

        const mockCollection = {
            doc: jest.fn(() => ({
                get: jest.fn(() => Promise.resolve(mockDoc)),
                set: jest.fn(() => Promise.resolve()),
                update: jest.fn(() => Promise.resolve()),
                delete: jest.fn(() => Promise.resolve())
            })),
            get: jest.fn(() => Promise.resolve({
                docs: [mockDoc],
                size: 1,
                empty: false
            })),
            add: jest.fn(() => Promise.resolve({ id: 'new-doc-id' })),
            where: jest.fn(() => mockCollection),
            orderBy: jest.fn(() => mockCollection),
            limit: jest.fn(() => mockCollection)
        };

        return {
            collection: jest.fn(() => mockCollection),
            runTransaction: jest.fn((fn) => fn({
                get: jest.fn(() => Promise.resolve(mockDoc)),
                set: jest.fn(),
                update: jest.fn(),
                delete: jest.fn()
            }))
        };
    }

    static createTestProduct(overrides = {}) {
        return {
            id: 'test-product-123',
            name: 'Test Product',
            quantity: 10,
            cost: 25.99,
            minQuantity: 5,
            supplier: 'Test Supplier',
            location: 'Test Location',
            photo: '',
            ...overrides
        };
    }

    static createTestOrder(overrides = {}) {
        return {
            id: 'test-order-123',
            productId: 'test-product-123',
            productName: 'Test Product',
            quantity: 2,
            status: 'pending',
            createdAt: new Date(),
            userId: 'test-user-123',
            ...overrides
        };
    }

    // Integration test helpers
    static async waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkElement = () => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                } else {
                    setTimeout(checkElement, 100);
                }
            };
            
            checkElement();
        });
    }

    static simulateUserInput(element, value) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    static simulateClick(element) {
        element.click();
        element.dispatchEvent(new Event('click', { bubbles: true }));
    }
}

// Performance monitoring
export class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.observers = [];
        this.initializeObservers();
    }

    initializeObservers() {
        // Core Web Vitals monitoring
        if ('PerformanceObserver' in window) {
            // Largest Contentful Paint
            const lcpObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    this.recordMetric('LCP', entry.startTime);
                }
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            this.observers.push(lcpObserver);

            // First Input Delay
            const fidObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    this.recordMetric('FID', entry.processingStart - entry.startTime);
                }
            });
            fidObserver.observe({ entryTypes: ['first-input'] });
            this.observers.push(fidObserver);

            // Cumulative Layout Shift
            const clsObserver = new PerformanceObserver((entryList) => {
                let clsValue = 0;
                for (const entry of entryList.getEntries()) {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                }
                this.recordMetric('CLS', clsValue);
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });
            this.observers.push(clsObserver);
        }

        // Custom performance metrics
        this.monitorCustomMetrics();
    }

    monitorCustomMetrics() {
        // Monitor Firebase operation performance
        const originalFirestoreGet = firebase.firestore().collection('').constructor.prototype.get;
        firebase.firestore().collection('').constructor.prototype.get = async function(...args) {
            const startTime = performance.now();
            try {
                const result = await originalFirestoreGet.apply(this, args);
                window.performanceMonitor?.recordMetric('firestore_read', performance.now() - startTime);
                return result;
            } catch (error) {
                window.performanceMonitor?.recordMetric('firestore_error', 1);
                throw error;
            }
        };

        // Monitor page load times
        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            this.recordMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart);
            this.recordMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart);
        });
    }

    recordMetric(name, value) {
        const timestamp = Date.now();
        
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        
        this.metrics.get(name).push({ value, timestamp });
        
        // Keep only last 100 measurements per metric
        const measurements = this.metrics.get(name);
        if (measurements.length > 100) {
            measurements.splice(0, measurements.length - 100);
        }

        // Log performance issues
        this.checkPerformanceThresholds(name, value);
    }

    checkPerformanceThresholds(name, value) {
        const thresholds = {
            'LCP': 2500, // ms
            'FID': 100,  // ms
            'CLS': 0.1,  // score
            'firestore_read': 1000, // ms
            'page_load_time': 3000 // ms
        };

        if (thresholds[name] && value > thresholds[name]) {
            console.warn(`Performance threshold exceeded for ${name}: ${value} > ${thresholds[name]}`);
            
            // Send to analytics service if available
            if (typeof gtag !== 'undefined') {
                gtag('event', 'performance_issue', {
                    metric_name: name,
                    metric_value: value,
                    threshold: thresholds[name]
                });
            }
        }
    }

    getMetrics() {
        const summary = {};
        
        for (const [name, measurements] of this.metrics.entries()) {
            const values = measurements.map(m => m.value);
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const max = Math.max(...values);
            const min = Math.min(...values);
            
            summary[name] = {
                average: avg,
                maximum: max,
                minimum: min,
                count: values.length,
                latest: values[values.length - 1]
            };
        }
        
        return summary;
    }

    cleanup() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        this.metrics.clear();
    }
}

// Error tracking and reporting
export class ErrorTracker {
    constructor() {
        this.errors = [];
        this.setupGlobalErrorHandling();
    }

    setupGlobalErrorHandling() {
        // Catch JavaScript errors
        window.addEventListener('error', (event) => {
            this.reportError({
                type: 'javascript_error',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error?.stack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.reportError({
                type: 'unhandled_promise_rejection',
                message: event.reason?.message || 'Unhandled promise rejection',
                error: event.reason?.stack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
        });

        // Catch Firebase errors
        this.setupFirebaseErrorTracking();
    }

    setupFirebaseErrorTracking() {
        const originalConsoleError = console.error;
        console.error = (...args) => {
            // Check if this looks like a Firebase error
            const errorString = args.join(' ');
            if (errorString.includes('firebase') || errorString.includes('firestore')) {
                this.reportError({
                    type: 'firebase_error',
                    message: errorString,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                });
            }
            originalConsoleError.apply(console, args);
        };
    }

    reportError(errorData) {
        this.errors.push(errorData);
        
        // Keep only last 50 errors in memory
        if (this.errors.length > 50) {
            this.errors.splice(0, this.errors.length - 50);
        }

        // Log to console for development
        console.error('Error tracked:', errorData);

        // Send to external error tracking service if available
        if (typeof Sentry !== 'undefined') {
            Sentry.captureException(new Error(errorData.message), {
                extra: errorData
            });
        }

        // Send to Google Analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'exception', {
                description: errorData.message,
                fatal: errorData.type === 'javascript_error'
            });
        }
    }

    getErrors() {
        return [...this.errors];
    }

    clearErrors() {
        this.errors = [];
    }
}

// Initialize monitoring in production
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    window.performanceMonitor = new PerformanceMonitor();
    window.errorTracker = new ErrorTracker();
    
    // Report performance summary every 5 minutes
    setInterval(() => {
        const metrics = window.performanceMonitor.getMetrics();
        console.log('Performance Summary:', metrics);
        
        // Send to analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'performance_summary', {
                custom_parameter: JSON.stringify(metrics)
            });
        }
    }, 5 * 60 * 1000);
}
