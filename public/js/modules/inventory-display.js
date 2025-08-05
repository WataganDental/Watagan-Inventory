/**
 * Inventory Display Module
 * Handles inventory table display, filtering, pagination, and search
 */

export class InventoryDisplayManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 50;
        this.totalFilteredItems = 0;
        this.inventory = [];
        this.filteredInventory = [];
    }

    /**
     * Set inventory data
     */
    setInventory(inventoryData) {
        this.inventory = Array.isArray(inventoryData) ? inventoryData : [];
    }

    /**
     * Display inventory with optional filtering and performance optimization
     */
    displayInventory(searchTerm = '', supplierFilter = '', locationFilter = '') {
        // Use performance optimizer throttling if available
        if (window.app && window.app.performanceOptimizer) {
            window.app.performanceOptimizer.throttledUpdate('inventory_display', () => {
                this.doDisplayInventory(searchTerm, supplierFilter, locationFilter);
            }, 300);
        } else {
            this.doDisplayInventory(searchTerm, supplierFilter, locationFilter);
        }
    }

    /**
     * Internal method to actually display inventory
     */
    doDisplayInventory(searchTerm = '', supplierFilter = '', locationFilter = '') {
        const inventoryTableBody = document.getElementById('inventoryTable');
        const loadingEl = document.getElementById('inventoryLoading');
        const errorEl = document.getElementById('inventoryError');
        const emptyStateEl = document.getElementById('inventoryEmptyState');

        if (!inventoryTableBody) {
            console.error("displayInventory: inventoryTable body not found.");
            this.showError(errorEl, "Inventory table element not found in HTML.");
            return;
        }

        this.showLoading(loadingEl, errorEl, emptyStateEl);
        inventoryTableBody.innerHTML = '';

        if (!Array.isArray(this.inventory)) {
            console.error("Global inventory data is not loaded or not an array.");
            this.hideLoading(loadingEl);
            this.showError(errorEl, "Inventory data is not available. Please try reloading.");
            return;
        }

        try {
            // Apply filters
            this.filteredInventory = this.applyFilters(searchTerm, supplierFilter, locationFilter);
            this.totalFilteredItems = this.filteredInventory.length;

            // Update inventory statistics (throttled)
            if (window.app && window.app.performanceOptimizer) {
                window.app.performanceOptimizer.throttledUpdate('inventory_stats', () => {
                    this.updateInventoryStatistics();
                }, 1000);
            } else {
                this.updateInventoryStatistics();
            }

            if (this.filteredInventory.length === 0) {
                this.hideLoading(loadingEl);
                this.showEmptyState(emptyStateEl, searchTerm, supplierFilter, locationFilter);
                this.updatePaginationControls();
                return;
            }

            // Apply pagination
            const paginatedItems = this.getPaginatedItems();

            // Generate and display rows
            const tableRows = paginatedItems.map(item => {
                if (typeof window.productManager !== 'undefined' && window.productManager.createProductRowHtml) {
                    return window.productManager.createProductRowHtml(item);
                } else {
                    return this.createBasicProductRowHtml(item);
                }
            }).join('');

            inventoryTableBody.innerHTML = tableRows;

            // Attach event listeners to new elements (throttled)
            if (typeof window.productManager !== 'undefined' && window.productManager.attachTableEventListeners) {
                if (window.app && window.app.performanceOptimizer) {
                    window.app.performanceOptimizer.throttledUpdate('inventory_events', () => {
                        window.productManager.attachTableEventListeners();
                    }, 200);
                } else {
                    window.productManager.attachTableEventListeners();
                }
            }

            this.hideLoading(loadingEl);
            this.hideError(errorEl);
            this.hideEmptyState(emptyStateEl);
            this.updatePaginationControls();

            console.log(`Displayed ${paginatedItems.length} items (${this.filteredInventory.length} total filtered)`);

        } catch (error) {
            console.error("Error displaying inventory:", error);
            this.hideLoading(loadingEl);
            this.showError(errorEl, "Error displaying inventory: " + error.message);
        }
    }

    /**
     * Update inventory statistics in the stats bar
     */
    updateInventoryStatistics() {
        const totalProducts = this.inventory.length;
        let lowStockCount = 0;
        let outOfStockCount = 0;

        this.inventory.forEach(item => {
            if (item.quantity === 0) {
                outOfStockCount++;
            } else if (item.quantity <= item.minQuantity && item.minQuantity > 0) {
                lowStockCount++;
            }
        });

        // Update the stats elements
        const totalProductsEl = document.getElementById('totalProductsCount');
        const lowStockEl = document.getElementById('lowStockCount');
        const outOfStockEl = document.getElementById('outOfStockCount');

        if (totalProductsEl) {
            totalProductsEl.textContent = totalProducts;
        }
        if (lowStockEl) {
            lowStockEl.textContent = lowStockCount;
        }
        if (outOfStockEl) {
            outOfStockEl.textContent = outOfStockCount;
        }

        console.log(`Inventory stats updated: ${totalProducts} total, ${lowStockCount} low stock, ${outOfStockCount} out of stock`);
    }

    /**
     * Apply filters to inventory
     */
    applyFilters(searchTerm, supplierFilter, locationFilter) {
        return this.inventory.filter(item => {
            // Search term filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchesSearch = 
                    (item.name && item.name.toLowerCase().includes(searchLower)) ||
                    (item.supplier && item.supplier.toLowerCase().includes(searchLower)) ||
                    (item.location && item.location.toLowerCase().includes(searchLower));
                
                if (!matchesSearch) return false;
            }

            // Supplier filter
            if (supplierFilter && item.supplier !== supplierFilter) {
                return false;
            }

            // Location filter
            if (locationFilter && item.location !== locationFilter) {
                return false;
            }

            return true;
        });
    }

    /**
     * Get paginated items for current page
     */
    getPaginatedItems() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return this.filteredInventory.slice(startIndex, endIndex);
    }

    /**
     * Update pagination controls
     */
    updatePaginationControls() {
        const totalPages = Math.ceil(this.totalFilteredItems / this.itemsPerPage);
        const currentPageDisplay = document.getElementById('currentPageDisplay');
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        const pageInfo = document.getElementById('pageInfo');

        if (currentPageDisplay) {
            currentPageDisplay.textContent = this.currentPage;
        }

        if (prevPageBtn) {
            prevPageBtn.disabled = this.currentPage <= 1;
            prevPageBtn.classList.toggle('btn-disabled', this.currentPage <= 1);
        }

        if (nextPageBtn) {
            nextPageBtn.disabled = this.currentPage >= totalPages;
            nextPageBtn.classList.toggle('btn-disabled', this.currentPage >= totalPages);
        }

        if (pageInfo) {
            const startItem = Math.min((this.currentPage - 1) * this.itemsPerPage + 1, this.totalFilteredItems);
            const endItem = Math.min(this.currentPage * this.itemsPerPage, this.totalFilteredItems);
            
            if (this.totalFilteredItems === 0) {
                pageInfo.textContent = 'No items to display';
            } else {
                pageInfo.textContent = `Showing ${startItem}-${endItem} of ${this.totalFilteredItems} items`;
            }
        }
    }

    /**
     * Go to specific page
     */
    goToPage(pageNumber) {
        const totalPages = Math.ceil(this.totalFilteredItems / this.itemsPerPage);
        
        if (pageNumber < 1 || pageNumber > totalPages) {
            console.warn(`Invalid page number: ${pageNumber}. Valid range: 1-${totalPages}`);
            return;
        }

        this.currentPage = pageNumber;
        this.displayInventory(
            document.getElementById('inventorySearchInput')?.value || '',
            document.getElementById('filterSupplier')?.value || '',
            document.getElementById('filterLocation')?.value || ''
        );
    }

    /**
     * Go to next page
     */
    nextPage() {
        const totalPages = Math.ceil(this.totalFilteredItems / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    }

    /**
     * Go to previous page
     */
    previousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        const searchInput = document.getElementById('inventorySearchInput');
        const supplierFilter = document.getElementById('filterSupplier');
        const locationFilter = document.getElementById('filterLocation');

        if (searchInput) searchInput.value = '';
        if (supplierFilter) supplierFilter.value = '';
        if (locationFilter) locationFilter.value = '';

        this.currentPage = 1;
        this.displayInventory();
    }

    /**
     * Show loading state
     */
    showLoading(loadingEl, errorEl, emptyStateEl) {
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (errorEl) errorEl.classList.add('hidden');
        if (emptyStateEl) emptyStateEl.classList.add('hidden');
    }

    /**
     * Hide loading state
     */
    hideLoading(loadingEl) {
        if (loadingEl) loadingEl.classList.add('hidden');
    }

    /**
     * Show error state
     */
    showError(errorEl, message) {
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    /**
     * Hide error state
     */
    hideError(errorEl) {
        if (errorEl) errorEl.classList.add('hidden');
    }

    /**
     * Show empty state
     */
    showEmptyState(emptyStateEl, searchTerm, supplierFilter, locationFilter) {
        if (!emptyStateEl) return;

        let message = 'No products found';
        if (searchTerm || supplierFilter || locationFilter) {
            message += ' matching your filters';
        }

        const emptyMessage = emptyStateEl.querySelector('.empty-message');
        if (emptyMessage) {
            emptyMessage.textContent = message;
        }

        emptyStateEl.classList.remove('hidden');
    }

    /**
     * Hide empty state
     */
    hideEmptyState(emptyStateEl) {
        if (emptyStateEl) emptyStateEl.classList.add('hidden');
    }

    /**
     * Create basic product row HTML (fallback if productManager not available)
     */
    createBasicProductRowHtml(item) {
        const itemName = item.name || 'N/A';
        const itemQuantity = item.quantity !== undefined ? item.quantity : 'N/A';
        const itemSupplier = item.supplier || 'N/A';
        const itemLocation = item.location || 'N/A';
        const itemCost = item.cost !== undefined ? item.cost : 0;

        return `
            <tr data-product-id="${item.id}">
                <td class="px-2 py-1 font-medium">${itemName}</td>
                <td class="px-2 py-1 text-center">${itemQuantity}</td>
                <td class="px-2 py-1">${itemSupplier}</td>
                <td class="px-2 py-1">${itemLocation}</td>
                <td class="px-2 py-1 text-right">$${itemCost.toFixed(2)}</td>
                <td class="px-2 py-1 text-center">
                    <div class="flex gap-1 justify-center">
                        <button class="btn btn-xs btn-warning edit-product-btn" data-product-id="${item.id}" title="Edit Product">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-xs btn-error delete-product-btn" data-product-id="${item.id}" title="Delete Product">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Refresh inventory display
     */
    async refreshInventory() {
        try {
            if (typeof window.loadInventory === 'function') {
                await window.loadInventory();
            }
            
            this.currentPage = 1;
            this.displayInventory();

            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Inventory refreshed successfully', 'success');
            }

        } catch (error) {
            console.error('Error refreshing inventory:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error refreshing inventory: ' + error.message, 'error');
            }
        }
    }

    /**
     * Get inventory statistics
     */
    getInventoryStats() {
        if (!Array.isArray(this.inventory)) {
            return {
                totalProducts: 0,
                totalValue: 0,
                lowStockItems: 0,
                outOfStockItems: 0
            };
        }

        const stats = {
            totalProducts: this.inventory.length,
            totalValue: 0,
            lowStockItems: 0,
            outOfStockItems: 0
        };

        this.inventory.forEach(item => {
            // Calculate total value
            const quantity = item.quantity || 0;
            const cost = item.cost || 0;
            stats.totalValue += quantity * cost;

            // Count low stock and out of stock
            if (quantity === 0) {
                stats.outOfStockItems++;
            } else if (quantity <= (item.minQuantity || 0) && item.minQuantity > 0) {
                stats.lowStockItems++;
            }
        });

        return stats;
    }

    /**
     * Filter inventory by stock level
     */
    filterByStockLevel(level) {
        let filteredItems = [];

        switch (level) {
            case 'low':
                filteredItems = this.inventory.filter(item => 
                    item.quantity > 0 && 
                    item.quantity <= (item.minQuantity || 0) && 
                    item.minQuantity > 0
                );
                break;
            case 'out':
                filteredItems = this.inventory.filter(item => item.quantity === 0);
                break;
            case 'normal':
                filteredItems = this.inventory.filter(item => 
                    item.quantity > (item.minQuantity || 0)
                );
                break;
            default:
                filteredItems = this.inventory;
        }

        this.filteredInventory = filteredItems;
        this.totalFilteredItems = filteredItems.length;
        this.currentPage = 1;
        
        // Display filtered results
        const inventoryTableBody = document.getElementById('inventoryTable');
        if (inventoryTableBody) {
            const paginatedItems = this.getPaginatedItems();
            const tableRows = paginatedItems.map(item => {
                if (typeof window.productManager !== 'undefined' && window.productManager.createProductRowHtml) {
                    return window.productManager.createProductRowHtml(item);
                } else {
                    return this.createBasicProductRowHtml(item);
                }
            }).join('');

            inventoryTableBody.innerHTML = tableRows;

            if (typeof window.productManager !== 'undefined' && window.productManager.attachTableEventListeners) {
                window.productManager.attachTableEventListeners();
            }
        }

        this.updatePaginationControls();
    }

    /**
     * Export visible inventory data
     */
    exportVisibleData(format = 'csv') {
        const visibleData = this.getPaginatedItems();
        
        if (format === 'csv') {
            return this.exportToCSV(visibleData);
        } else if (format === 'json') {
            return this.exportToJSON(visibleData);
        }
    }

    /**
     * Export to CSV format
     */
    exportToCSV(data) {
        const headers = ['Name', 'Quantity', 'Min Quantity', 'Reorder Quantity', 'Cost', 'Supplier', 'Location'];
        const csvContent = [
            headers.join(','),
            ...data.map(item => [
                `"${item.name || ''}"`,
                item.quantity || 0,
                item.minQuantity || 0,
                item.reorderQuantity || 0,
                item.cost || 0,
                `"${item.supplier || ''}"`,
                `"${item.location || ''}"`
            ].join(','))
        ].join('\n');

        return csvContent;
    }

    /**
     * Export to JSON format
     */
    exportToJSON(data) {
        return JSON.stringify(data, null, 2);
    }
}

// Export singleton instance
export const inventoryDisplayManager = new InventoryDisplayManager();
