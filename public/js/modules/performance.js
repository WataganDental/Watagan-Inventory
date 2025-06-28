// Performance optimization utilities
export class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.imageObserver = null;
        this.debounceTimers = new Map();
    }

    // Debounce function to limit frequent calls
    debounce(func, wait, key = 'default') {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }

        const timeoutId = setTimeout(() => {
            this.debounceTimers.delete(key);
            func();
        }, wait);

        this.debounceTimers.set(key, timeoutId);
    }

    // Throttle function to limit calls to maximum frequency
    throttle(func, limit) {
        let lastFunc;
        let lastRan;
        return function() {
            const context = this;
            const args = arguments;
            if (!lastRan) {
                func.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(function() {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    }

    // Cache management for frequently accessed data
    setCache(key, value, ttl = 300000) { // 5 minutes default TTL
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, { value, expiresAt });
    }

    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() > cached.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return cached.value;
    }

    clearCache(pattern = null) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    // Lazy loading for images
    initializeLazyLoading() {
        if (this.imageObserver) {
            this.imageObserver.disconnect();
        }

        this.imageObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const dataSrc = img.getAttribute('data-src');
                        
                        if (dataSrc) {
                            // Add loading placeholder
                            img.style.background = 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)';
                            img.style.backgroundSize = '200% 100%';
                            img.style.animation = 'loading 1.5s infinite';
                            
                            img.src = dataSrc;
                            img.removeAttribute('data-src');
                            
                            img.onload = () => {
                                img.style.background = '';
                                img.style.animation = '';
                                img.classList.remove('lazy-load-image');
                            };
                            
                            img.onerror = () => {
                                img.style.background = '';
                                img.style.animation = '';
                                img.src = '/icons/icon-192x192.png'; // Fallback image
                                img.classList.remove('lazy-load-image');
                            };
                        }
                        
                        observer.unobserve(img);
                    }
                });
            },
            {
                rootMargin: '50px 0px',
                threshold: 0.01
            }
        );

        this.observeLazyImages();
    }

    observeLazyImages() {
        if (!this.imageObserver) return;
        
        const images = document.querySelectorAll('img.lazy-load-image');
        images.forEach(img => this.imageObserver.observe(img));
    }

    // Virtual scrolling for large lists
    createVirtualList(container, items, renderItem, itemHeight = 60) {
        const containerHeight = container.clientHeight;
        const visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
        let scrollTop = 0;
        let startIndex = 0;

        const scrollableContent = document.createElement('div');
        scrollableContent.style.height = `${items.length * itemHeight}px`;
        scrollableContent.style.position = 'relative';

        const visibleContent = document.createElement('div');
        visibleContent.style.position = 'absolute';
        visibleContent.style.top = '0px';
        visibleContent.style.width = '100%';

        scrollableContent.appendChild(visibleContent);
        container.innerHTML = '';
        container.appendChild(scrollableContent);

        const updateVisibleItems = this.throttle(() => {
            scrollTop = container.scrollTop;
            startIndex = Math.floor(scrollTop / itemHeight);
            const endIndex = Math.min(startIndex + visibleCount, items.length);

            visibleContent.style.transform = `translateY(${startIndex * itemHeight}px)`;
            visibleContent.innerHTML = '';

            for (let i = startIndex; i < endIndex; i++) {
                const itemElement = renderItem(items[i], i);
                itemElement.style.height = `${itemHeight}px`;
                visibleContent.appendChild(itemElement);
            }
        }, 16); // ~60fps

        container.addEventListener('scroll', updateVisibleItems);
        updateVisibleItems(); // Initial render

        return {
            updateItems: (newItems) => {
                items = newItems;
                scrollableContent.style.height = `${items.length * itemHeight}px`;
                updateVisibleItems();
            },
            destroy: () => {
                container.removeEventListener('scroll', updateVisibleItems);
            }
        };
    }

    // Batch database operations
    async batchOperation(operations, batchSize = 500) {
        const results = [];
        
        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = operations.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch);
            results.push(...batchResults);
            
            // Add small delay between batches to prevent overwhelming the server
            if (i + batchSize < operations.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        return results;
    }

    // Memory cleanup
    cleanup() {
        if (this.imageObserver) {
            this.imageObserver.disconnect();
            this.imageObserver = null;
        }
        
        this.cache.clear();
        
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }
}

// Add loading animation CSS if not already present
const loadingCSS = `
@keyframes loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
`;

// Only add CSS in browser environment
if (typeof document !== 'undefined' && !document.querySelector('#loading-animation-css')) {
    const style = document.createElement('style');
    style.id = 'loading-animation-css';
    style.textContent = loadingCSS;
    document.head.appendChild(style);
}
