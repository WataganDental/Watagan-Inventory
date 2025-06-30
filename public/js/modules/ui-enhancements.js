/**
 * UI Enhancements Module
 * Handles modern UI interactions, animations, and dashboard statistics
 */

export class UIEnhancementManager {
    constructor() {
        this.dashboardStats = {
            totalProducts: 0,
            lowStockCount: 0,
            outOfStockCount: 0
        };
        this.toastContainer = null;
        this.initializeToastContainer();
    }

    /**
     * Initialize toast notification container
     */
    initializeToastContainer() {
        let existingContainer = document.getElementById('toast-container-navbar');
        if (existingContainer) {
            this.toastContainer = existingContainer;
            return;
        }

        const appNavbar = document.getElementById('appNavbar');
        if (appNavbar) {
            // Ensure appNavbar can serve as a positioning context if not already fixed/absolute
            const navbarPosition = window.getComputedStyle(appNavbar).position;
            if (navbarPosition !== 'fixed' && navbarPosition !== 'absolute' && navbarPosition !== 'relative') {
                appNavbar.style.position = 'relative';
            }

            const toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container-navbar';
            // Use daisyUI classes for the toast stack, and add custom styles for centering the container
            toastContainer.className = 'toast toast-center z-[100]'; // z-[100] to be above navbar's z-40. toast-center stacks toasts centrally.

            // Custom styling for centering the container itself within the navbar
            toastContainer.style.position = 'absolute';
            toastContainer.style.left = '50%';
            toastContainer.style.top = '50%'; // Position top of container at navbar's vertical center
            toastContainer.style.transform = 'translate(-50%, -50%)';
            toastContainer.style.width = 'auto'; // Fit content
            toastContainer.style.maxWidth = '80%'; // Max width relative to navbar or viewport

            appNavbar.appendChild(toastContainer);
            this.toastContainer = toastContainer;
            console.log('Toast container initialized in appNavbar center.');
        } else {
            // Fallback: If appNavbar isn't found, use the old body-appended method or log error
            console.warn('appNavbar not found. Toast container will be appended to body (top-end).');
            if (!document.getElementById('toast-container-body')) { // Use different ID for fallback
                const toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container-body';
                toastContainer.className = 'toast toast-top toast-end z-[100]';
                document.body.appendChild(toastContainer);
                this.toastContainer = toastContainer;
            } else {
                this.toastContainer = document.getElementById('toast-container-body');
            }
        }
    }

    /**
     * Update dashboard statistics
     * @param {Array} inventory - Array of inventory items
     */
    updateDashboardStats(inventory) {
        if (!Array.isArray(inventory)) {
            console.warn('Inventory is not an array:', inventory);
            return;
        }

        this.dashboardStats.totalProducts = inventory.length;
        this.dashboardStats.lowStockCount = inventory.filter(item => {
            const quantity = parseInt(item.quantity) || 0;
            const minQuantity = parseInt(item.minQuantity) || 0;
            return quantity > 0 && quantity <= minQuantity;
        }).length;
        this.dashboardStats.outOfStockCount = inventory.filter(item => {
            const quantity = parseInt(item.quantity) || 0;
            return quantity === 0;
        }).length;

        this.renderDashboardStats();
    }

    /**
     * Render dashboard statistics to DOM
     */
    renderDashboardStats() {
        const elements = {
            totalProducts: document.getElementById('totalProductsCount'),
            lowStock: document.getElementById('lowStockCount'),
            outOfStock: document.getElementById('outOfStockCount')
        };

        if (elements.totalProducts) {
            this.animateCounter(elements.totalProducts, this.dashboardStats.totalProducts);
        }
        if (elements.lowStock) {
            this.animateCounter(elements.lowStock, this.dashboardStats.lowStockCount);
        }
        if (elements.outOfStock) {
            this.animateCounter(elements.outOfStock, this.dashboardStats.outOfStockCount);
        }
    }

    /**
     * Animate counter from current value to target value
     * @param {HTMLElement} element - DOM element to animate
     * @param {number} targetValue - Target value to animate to
     */
    animateCounter(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        const duration = 1000; // 1 second
        const steps = 30;
        const stepValue = (targetValue - currentValue) / steps;
        const stepDuration = duration / steps;

        let currentStep = 0;
        const timer = setInterval(() => {
            currentStep++;
            const newValue = Math.round(currentValue + (stepValue * currentStep));
            element.textContent = currentStep === steps ? targetValue : newValue;

            if (currentStep >= steps) {
                clearInterval(timer);
            }
        }, stepDuration);
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of notification (success, error, warning, info)
     * @param {number} duration - Duration to show toast (ms)
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        const alertClass = this.getAlertClass(type);
        const icon = this.getToastIcon(type);

        toast.className = `alert ${alertClass} shadow-lg animate-pulse`;
        toast.innerHTML = `
            <div class="flex items-center">
                ${icon}
                <span class="text-sm">${message}</span>
            </div>
        `;

        this.toastContainer.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    toast.remove();
                }, 300);
            }
        }, duration);
    }

    /**
     * Get alert class for toast type
     * @param {string} type - Toast type
     * @returns {string} - CSS class
     */
    getAlertClass(type) {
        const classes = {
            success: 'alert-success',
            error: 'alert-error',
            warning: 'alert-warning',
            info: 'alert-info'
        };
        return classes[type] || 'alert-info';
    }

    /**
     * Get icon for toast type
     * @param {string} type - Toast type
     * @returns {string} - SVG icon HTML
     */
    getToastIcon(type) {
        const icons = {
            success: `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>`,
            error: `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>`,
            warning: `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>`,
            info: `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>`
        };
        return icons[type] || icons.info;
    }

    /**
     * Generate modern table row with status badges
     * @param {Object} item - Inventory item
     * @param {number} index - Row index
     * @returns {string} - HTML string for table row
     */
    generateModernTableRow(item, index) {
        const quantity = parseInt(item.quantity) || 0;
        const minQuantity = parseInt(item.minQuantity) || 0;
        const stockStatus = this.getStockStatus(quantity, minQuantity);
        const stockBadge = this.getStockBadge(stockStatus);

        return `
            <tr class="hover:bg-base-200 transition-colors">
                <td class="id-column hidden">
                    <code class="text-xs">${item.id || 'N/A'}</code>
                </td>
                <td>
                    <div class="flex items-center gap-3">
                        <div class="avatar placeholder">
                            <div class="bg-neutral text-neutral-content rounded-full w-12 h-12">
                                <span class="text-xs">${(item.name || 'N/A').substring(0, 2).toUpperCase()}</span>
                            </div>
                        </div>
                        <div>
                            <div class="font-bold text-sm">${item.name || 'Unnamed Product'}</div>
                            <div class="text-xs opacity-50 md:hidden">${item.supplier || 'No supplier'}</div>
                            <div class="text-xs opacity-50 lg:hidden">$${(item.cost || 0).toFixed(2)}</div>
                        </div>
                    </div>
                </td>
                <td class="text-center">
                    <div class="flex flex-col items-center gap-1">
                        ${stockBadge}
                        <span class="text-xs font-mono">${quantity}</span>
                        <div class="md:hidden text-xs opacity-50">Min: ${minQuantity}</div>
                    </div>
                </td>
                <td class="text-center hidden md:table-cell">
                    <div class="text-xs">
                        <div>Min: ${minQuantity}</div>
                        <div>Reorder: ${item.reorderQuantity || 0}</div>
                    </div>
                </td>
                <td class="text-right hidden lg:table-cell">
                    <span class="font-mono">${this.formatCurrency(item.cost || 0)}</span>
                </td>
                <td class="hidden md:table-cell">
                    <div class="text-xs">
                        ${item.supplier || 'No supplier'}
                    </div>
                </td>
                <td class="hidden lg:table-cell">
                    <div class="badge badge-outline badge-sm">
                        ${item.location || 'No location'}
                    </div>
                </td>
                <td class="text-center hidden xl:table-cell">
                    <span class="font-mono">${item.quantityOrdered || 0}</span>
                </td>
                <td class="text-center hidden xl:table-cell">
                    <span class="font-mono">${item.quantityBackordered || 0}</span>
                </td>
                <td class="text-center">
                    <div class="dropdown dropdown-end">
                        <div tabindex="0" role="button" class="btn btn-ghost btn-xs">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                            </svg>
                        </div>
                        <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 z-10">
                            <li><a href="#" class="edit-product-btn" data-product-id="${item.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                </svg>
                                Edit
                            </a></li>
                            <li><a href="#" class="view-qr-btn" data-product-id="${item.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 011-1h2m0 0V3a1 1 0 011-1h4a1 1 0 011 1v1m0 0h2a1 1 0 011 1v2a1 1 0 01-1 1h-2m0 0v4a1 1 0 01-1 1h-2a1 1 0 01-1-1v-4m-6 0V9a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1h2z"></path>
                                </svg>
                                QR Code
                            </a></li>
                            <li><a href="#" class="move-product-btn" data-product-id="${item.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>
                                </svg>
                                Move Location
                            </a></li>
                            <li><a href="#" class="delete-product-btn text-error" data-product-id="${item.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                                Delete
                            </a></li>
                        </ul>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Get stock status based on quantity and minimum quantity
     * @param {number} quantity - Current quantity
     * @param {number} minQuantity - Minimum quantity threshold
     * @returns {string} - Stock status
     */
    getStockStatus(quantity, minQuantity) {
        if (quantity === 0) return 'out-of-stock';
        if (quantity <= minQuantity) return 'low-stock';
        return 'in-stock';
    }

    /**
     * Get stock badge HTML based on status
     * @param {string} status - Stock status
     * @returns {string} - Badge HTML
     */
    getStockBadge(status) {
        const badges = {
            'in-stock': '<div class="badge badge-success badge-xs">✓</div>',
            'low-stock': '<div class="badge badge-warning badge-xs">⚠</div>',
            'out-of-stock': '<div class="badge badge-error badge-xs">✗</div>'
        };
        return badges[status] || badges['in-stock'];
    }

    /**
     * Format currency value
     * @param {number} value - Numeric value
     * @returns {string} - Formatted currency string
     */
    formatCurrency(value) {
        return `$${parseFloat(value || 0).toFixed(2)}`;
    }

    /**
     * Show loading skeleton for table
     */
    showTableLoading() {
        const loadingElement = document.getElementById('inventoryLoadingState');
        const tableElement = document.getElementById('inventoryTable');
        const emptyElement = document.getElementById('inventoryEmptyState');

        if (loadingElement) loadingElement.classList.remove('hidden');
        if (tableElement) tableElement.innerHTML = '';
        if (emptyElement) emptyElement.classList.add('hidden');
    }

    /**
     * Hide loading skeleton for table
     */
    hideTableLoading() {
        const loadingElement = document.getElementById('inventoryLoadingState');
        if (loadingElement) loadingElement.classList.add('hidden');
    }

    /**
     * Show empty state for table
     */
    showTableEmpty() {
        const emptyElement = document.getElementById('inventoryEmptyState');
        const tableElement = document.getElementById('inventoryTable');

        if (emptyElement) emptyElement.classList.remove('hidden');
        if (tableElement) tableElement.innerHTML = '';
    }

    /**
     * Hide empty state for table
     */
    hideTableEmpty() {
        const emptyElement = document.getElementById('inventoryEmptyState');
        if (emptyElement) emptyElement.classList.add('hidden');
    }

    /**
     * Update dashboard UI with provided stats
     * @param {Object} stats - Dashboard statistics
     * @param {number} stats.totalProducts
     * @param {number} stats.lowStockItems
     * @param {number} stats.outOfStockItems
     * @param {number} stats.totalValue
     */
    updateDashboard(stats) {
        if (!stats || typeof stats !== 'object') return;
        const totalProductsEl = document.getElementById('totalProductsCount');
        const lowStockEl = document.getElementById('lowStockCount');
        const outOfStockEl = document.getElementById('outOfStockCount');
        const totalValueEl = document.getElementById('totalInventoryValue');

        if (totalProductsEl && typeof stats.totalProducts === 'number') {
            this.animateCounter(totalProductsEl, stats.totalProducts);
        }
        if (lowStockEl && typeof stats.lowStockItems === 'number') {
            this.animateCounter(lowStockEl, stats.lowStockItems);
        }
        if (outOfStockEl && typeof stats.outOfStockItems === 'number') {
            this.animateCounter(outOfStockEl, stats.outOfStockItems);
        }
        if (totalValueEl && typeof stats.totalValue === 'number') {
            totalValueEl.textContent = `$${stats.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
    }

    /**
     * Update the inventory table with modern rows
     * @param {string} tableBodyId - The ID of the table body element
     * @param {Array} items - Array of inventory items to display
     */
    updateTable(tableBodyId, items) {
        const tableBody = document.getElementById(tableBodyId);
        const loadingState = document.getElementById('inventoryLoadingState');
        const emptyState = document.getElementById('inventoryEmptyState');
        if (!tableBody) return;
        // Hide loading state
        if (loadingState) loadingState.classList.add('hidden');
        // Show or hide empty state
        if (emptyState) {
            if (!items || items.length === 0) {
                emptyState.classList.remove('hidden');
                tableBody.innerHTML = '';
                return;
            } else {
                emptyState.classList.add('hidden');
            }
        }
        // Render table rows
        tableBody.innerHTML = items.map((item, idx) => this.generateModernTableRow(item, idx)).join('');
    }
}

// Export for use in other modules
export const uiEnhancementManager = new UIEnhancementManager();
