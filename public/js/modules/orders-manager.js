/**
 * Orders Management Module
 * Handles all order-related operations including creation, updates, and status management
 */

export class OrdersManager {
    constructor() {
        this.orders = [];
        this.filteredOrders = [];
        this.currentOrderId = null;
    }

    /**
     * Load orders from database with caching optimization
     */
    async loadOrders(forceRefresh = false) {
        try {
            // Try Firebase optimizer first for cost-effective loading
            if (window.app && window.app.firebaseOptimizer) {
                console.log('Loading orders using Firebase optimizer...');
                this.orders = await window.app.firebaseOptimizer.getCollection('orders', {
                    orderBy: [['createdAt', 'desc']], // Simplified to single field to avoid index requirement
                    limit: 200,
                    cacheDuration: 120000, // 2 minutes for orders
                    source: forceRefresh ? 'server' : 'default'
                });
                console.log(`Loaded ${this.orders.length} orders using Firebase optimizer`);
                return this.orders;
            }
            
            // Fallback to performance optimizer
            if (window.app && window.app.performanceOptimizer) {
                console.log('Loading orders using performance optimizer...');
                this.orders = await window.app.performanceOptimizer.loadDataWithCache('orders', 'orders_cache', forceRefresh);
                
                console.log(`Loaded ${this.orders.length} orders from ${forceRefresh ? 'database' : 'cache/database'}`);
                return this.orders;
            }

            // Fallback to direct loading (less efficient)
            console.log('Loading orders from database (direct query - less efficient)...');
            const ordersSnapshot = await window.db.collection('orders')
                .orderBy('orderDate', 'desc')
                .limit(200)
                .get();
            
            this.orders = [];
            
            ordersSnapshot.forEach(doc => {
                const data = doc.data();
                const order = {
                    id: doc.id,
                    ...data,
                    // Ensure we have a status field
                    status: data.status || 'pending'
                };
                this.orders.push(order);
            });

            console.log(`Loaded ${this.orders.length} orders`);
            return this.orders;
        } catch (error) {
            console.error('Error loading orders:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error loading orders: ' + error.message, 'error');
            }
            return [];
        }
    }

    /**
     * Display orders with smart default filter (backordered first, then pending only)
     */
    async displayOrdersWithDefaultFilter() {
        try {
            // First load orders to check what's available
            await this.loadOrders();
            
            // Check order priorities: backordered > pending only (no "all")
            const hasBackorderedOrders = this.orders.some(order => 
                (order.status || '').toLowerCase() === 'backordered'
            );
            
            const hasPendingOrders = this.orders.some(order => 
                (order.status || 'pending').toLowerCase() === 'pending'
            );
            
            // Determine default filter based on priority - show ALL orders to troubleshoot
            let defaultFilter = 'pending_backordered'; // Show pending & backordered by default
            let filterReason = 'showing pending & backordered orders by default';

            // Update the HTML filter dropdown to match
            const statusFilterEl = document.getElementById('filterOrderStatus');
            if (statusFilterEl) {
                statusFilterEl.value = defaultFilter;
            }

            console.log(`Using default filter: "${defaultFilter}" (${filterReason})`);
            console.log(`Orders summary: ${this.orders.length} total, ${hasBackorderedOrders ? 'has' : 'no'} backordered, ${hasPendingOrders ? 'has' : 'no'} pending`);

            // Display with the determined filter
            await this.displayOrders(defaultFilter, '');
            
        } catch (error) {
            console.error('Error in displayOrdersWithDefaultFilter:', error);
            // Fallback to showing all orders
            await this.displayOrders('', '');
        }
    }

    /**
     * Display orders in the table
     */
    async displayOrders(statusFilter = '', supplierFilter = '') {
        const ordersTableBody = document.getElementById('ordersTableBody');
        const loadingEl = document.getElementById('ordersLoading');
        const errorEl = document.getElementById('ordersError');
        const emptyStateEl = document.getElementById('ordersEmptyState');

        if (!ordersTableBody) {
            console.error('Orders table body not found');
            return;
        }

        // Show loading (if element exists)
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (errorEl) errorEl.classList.add('hidden');
        if (emptyStateEl) emptyStateEl.classList.add('hidden');

        try {
            // Load fresh data
            await this.loadOrders();

            // Apply filters
            this.filteredOrders = this.applyOrderFilters(statusFilter, supplierFilter);

            // Clear table
            ordersTableBody.innerHTML = '';

            if (this.filteredOrders.length === 0) {
                if (loadingEl) loadingEl.classList.add('hidden');
                if (emptyStateEl) {
                    emptyStateEl.classList.remove('hidden');
                } else {
                    // If no empty state element, show message in table
                    ordersTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-gray-500">No orders found matching the current filters.</td></tr>';
                }
                return;
            }

            // Generate table rows
            const tableRows = this.filteredOrders.map(order => this.createOrderRowHtml(order)).join('');
            ordersTableBody.innerHTML = tableRows;

            // Attach event listeners
            this.attachOrderEventListeners();

            // Hide loading (if element exists)
            if (loadingEl) loadingEl.classList.add('hidden');

            console.log(`Displayed ${this.filteredOrders.length} orders`);

        } catch (error) {
            console.error('Error displaying orders:', error);
            if (loadingEl) loadingEl.classList.add('hidden');
            if (errorEl) {
                errorEl.textContent = 'Error loading orders: ' + error.message;
                errorEl.classList.remove('hidden');
            } else {
                // If no error element, show error in table
                ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-500">Error loading orders: ${error.message}</td></tr>`;
            }
        }
    }

    /**
     * Apply filters to orders
     */
    applyOrderFilters(statusFilter, supplierFilter) {
        console.log(`Filtering ${this.orders.length} orders with statusFilter: "${statusFilter}", supplierFilter: "${supplierFilter}"`);
        
        // If no status filter, show all orders
        if (!statusFilter || statusFilter === '') {
            console.log('No status filter - showing all orders');
            return this.orders;
        }

        // Special case: show both pending and backordered
        if (statusFilter === 'pending_backordered') {
            const filtered = this.orders.filter(order => {
                const orderStatus = (order.status || 'pending').toLowerCase();
                return orderStatus === 'pending' || orderStatus === 'backordered' || orderStatus === 'partially_received';
            });
            console.log(`Filtered to ${filtered.length} orders (pending & backordered)`);
            return filtered;
        }

        const filtered = this.orders.filter(order => {
            // Status filter - case insensitive matching
            if (statusFilter) {
                const orderStatus = (order.status || 'pending').toLowerCase();
                const filterStatus = statusFilter.toLowerCase();

                // Direct match first
                if (orderStatus === filterStatus) {
                    return true;
                }

                // Handle mixed case statuses from original app
                const statusVariations = {
                    'pending': ['pending', 'Pending'],
                    'backordered': ['backordered', 'Backordered', 'partially_received', 'Partially Received', 'partial'],
                    'fulfilled': ['fulfilled', 'Fulfilled'],
                    'cancelled': ['cancelled', 'Cancelled']
                };

                for (const [key, variations] of Object.entries(statusVariations)) {
                    if (filterStatus === key) {
                        const isMatch = variations.some(variation => 
                            orderStatus === variation.toLowerCase() || 
                            (order.status || 'pending') === variation
                        );
                        if (isMatch) return true;
                    }
                }

                console.log(`Order ${order.id} filtered out: status "${order.status}" doesn't match filter "${statusFilter}"`);
                return false;
            }

            // Supplier filter
            if (supplierFilter && order.supplier !== supplierFilter) {
                return false;
            }

            return true;
        });

        console.log(`Filtered to ${filtered.length} orders`);
        return filtered;
    }

    /**
     * Create HTML for order row
     */
    createOrderRowHtml(order) {
        const statusColorMap = {
            'pending': 'badge-warning',
            'ordered': 'badge-info',
            'partially_received': 'badge-warning',
            'received': 'badge-success',
            'cancelled': 'badge-error'
        };

        const statusColor = statusColorMap[order.status] || 'badge-ghost';
        
        // Handle both createdAt and dateCreated fields
        let dateCreated = 'N/A';
        if (order.createdAt && order.createdAt.toDate) {
            dateCreated = order.createdAt.toDate().toLocaleDateString();
        } else if (order.dateCreated && order.dateCreated.toDate) {
            dateCreated = order.dateCreated.toDate().toLocaleDateString();
        } else if (order.createdAt && typeof order.createdAt === 'string') {
            dateCreated = new Date(order.createdAt).toLocaleDateString();
        } else if (order.dateCreated && typeof order.dateCreated === 'string') {
            dateCreated = new Date(order.dateCreated).toLocaleDateString();
        }
        
        const orderId = order.id ? order.id.substring(0, 8) : 'N/A';
        
        // Handle status display - normalize status for display
        const displayStatus = this.formatStatus(order.status || 'pending');

        return `
            <tr class="hover:bg-base-200" data-order-id="${order.id}">
                <td class="px-2 py-1 font-mono text-sm">${orderId}</td>
                <td class="px-2 py-1 font-medium">${order.productName || 'Unknown Product'}</td>
                <td class="px-2 py-1 text-center">${order.quantity || 0}</td>
                <td class="px-2 py-1 text-center">${order.cost ? '$' + order.cost.toFixed(2) : 'N/A'}</td>
                <td class="px-2 py-1 text-center font-semibold">${order.totalCost ? '$' + order.totalCost.toFixed(2) : (order.cost && order.quantity ? '$' + (order.cost * order.quantity).toFixed(2) : 'N/A')}</td>
                <td class="px-2 py-1 text-center">
                    <span class="badge ${statusColor} badge-sm">${displayStatus}</span>
                </td>
                <td class="px-2 py-1 text-center text-sm">${dateCreated}</td>
                <td class="px-2 py-1 text-center">
                    <div class="flex gap-1 justify-center">
                        <button class="btn btn-xs btn-ghost view-order-btn" data-order-id="${order.id}" title="View Details">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-xs btn-secondary edit-product-btn" data-order-id="${order.id}" data-product-id="${order.productId || ''}" title="Edit Product">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-xs btn-error delete-order-btn" data-order-id="${order.id}" title="Delete Order">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Format status text
     */
    formatStatus(status) {
        if (!status) return 'Pending';
        
        const statusLower = status.toLowerCase();
        const statusMap = {
            'pending': 'Pending',
            'ordered': 'Ordered', 
            'backordered': 'Backordered',
            'cancelled': 'Cancelled',
            'fulfilled': 'Fulfilled'
        };
        
        return statusMap[statusLower] || status;
    }

    /**
     * Attach event listeners to order elements
     */
    attachOrderEventListeners() {
        // View order buttons
        document.querySelectorAll('.view-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.dataset.orderId;
                this.viewOrderDetails(orderId);
            });
        });

        // Edit product buttons
        document.querySelectorAll('.edit-product-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.currentTarget.dataset.productId;
                if (productId && productId !== '') {
                    this.openEditProductModal(productId);
                } else {
                    console.warn('No product ID found for order');
                    if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                        uiEnhancementManager.showToast('No product ID found for this order', 'warning');
                    }
                }
            });
        });

        // Delete order buttons
        document.querySelectorAll('.delete-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.currentTarget.dataset.orderId;
                this.deleteOrder(orderId);
            });
        });
    }

    /**
     * View order details
     */
    async viewOrderDetails(orderId) {
        try {
            const order = this.orders.find(o => o.id === orderId);
            if (!order) {
                console.error('Order not found:', orderId);
                return;
            }

            // Show order details in modal or dedicated view
            this.displayOrderDetailsModal(order);

        } catch (error) {
            console.error('Error viewing order details:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error loading order details: ' + error.message, 'error');
            }
        }
    }

    /**
     * Display order details in modal
     */
    displayOrderDetailsModal(order) {
        // Use the mini status modal for now, or create a dedicated details modal
        if (typeof window.modalManager !== 'undefined') {
            window.modalManager.openMiniStatusModal(order.id, order);
        } else {
            // Fallback to alert
            const details = [
                `Order ID: ${order.id}`,
                `Product: ${order.productName}`,
                `Quantity: ${order.quantity}`,
                `Supplier: ${order.supplier}`,
                `Status: ${this.formatStatus(order.status)}`,
                `Created: ${order.dateCreated ? new Date(order.dateCreated.toDate()).toLocaleDateString() : 'N/A'}`
            ].join('\n');
            
            alert(`Order Details:\n\n${details}`);
        }
    }

    /**
     * Open status update modal
     */
    openStatusUpdateModal(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            console.error('Order not found:', orderId);
            return;
        }

        if (typeof window.modalManager !== 'undefined') {
            window.modalManager.openMiniStatusModal(orderId, order);
        } else {
            // Fallback to prompt
            const newStatus = prompt(`Update status for order ${orderId}:\n\nCurrent status: ${this.formatStatus(order.status)}\n\nEnter new status (pending, ordered, partially_received, received, cancelled):`);
            if (newStatus && newStatus !== order.status) {
                this.updateOrderStatus(orderId, newStatus);
            }
        }
    }

    /**
     * Open edit product modal
     */
    openEditProductModal(productId) {
        if (!productId || productId === '') {
            console.warn('No product ID provided for edit modal');
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('No product ID available for this order', 'warning');
            }
            return;
        }

        // Use the global function to open the edit product modal
        if (typeof window.openEditProductModalWithProduct === 'function') {
            window.openEditProductModalWithProduct(productId);
        } else {
            console.error('openEditProductModalWithProduct function not found');
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Edit product modal is not available', 'error');
            }
        }
    }

    /**
     * Update order status with optimization
     */
    async updateOrderStatus(orderId, newStatus, quantityReceived = null) {
        try {
            const orderRef = window.db.collection('orders').doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Order not found', 'error');
                }
                return;
            }

            const orderData = orderDoc.data();
            const updateData = {
                status: newStatus,
                lastUpdated: new Date()
            };

            // Handle quantity received for partial receipts
            if (newStatus === 'partially_received' && quantityReceived !== null) {
                updateData.quantityReceived = quantityReceived;
                updateData.quantityRemaining = (orderData.quantity || 0) - quantityReceived;
            } else if (newStatus === 'received' || newStatus === 'fulfilled') {
                updateData.quantityReceived = orderData.quantity || 0;
                updateData.quantityRemaining = 0;
            }

            // Use batched writes if performance optimizer is available
            if (window.app && window.app.performanceOptimizer) {
                await window.app.performanceOptimizer.batchWrite('orders', orderId, updateData, 'update');
            } else {
                await orderRef.update(updateData);
            }

            // Process inventory updates if needed
            if ((newStatus === 'received' || newStatus === 'fulfilled' || newStatus === 'partially_received') && orderData.productId) {
                await this.processOrderReceipt(orderId, orderData, quantityReceived);
            }

            // Log activity (batch this too if possible)
            if (typeof window.logActivity === 'function') {
                await window.logActivity(
                    'order_status_changed',
                    `Order ${orderId} status changed to ${newStatus}`,
                    orderId,
                    orderData.productName
                );
            }

            // Show success message
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast(`Order status updated to ${this.formatStatus(newStatus)}`, 'success');
            }

            // Use smart refresh instead of full refresh
            if (window.app && window.app.performanceOptimizer) {
                window.app.performanceOptimizer.smartUIRefresh('orders');
                window.app.performanceOptimizer.smartUIRefresh('dashboard');
            } else {
                // Fallback to full refresh
                await this.displayOrders();
                if (typeof window.updateInventoryDashboard === 'function') {
                    window.updateInventoryDashboard();
                }
            }

        } catch (error) {
            console.error('Error updating order status:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error updating order status: ' + error.message, 'error');
            }
        }
    }

    /**
     * Process order receipt and update inventory
     */
    async processOrderReceipt(orderId, orderData, quantityReceived = null) {
        if (!orderData.productId) {
            console.warn('Order has no productId, skipping inventory update');
            return;
        }

        try {
            const productRef = window.db.collection('inventory').doc(orderData.productId);
            const productDoc = await productRef.get();

            if (!productDoc.exists) {
                console.warn('Product not found for order:', orderData.productId);
                return;
            }

            const productData = productDoc.data();
            const currentQuantity = productData.quantity || 0;
            const quantityToAdd = quantityReceived || orderData.quantity || 0;
            const newQuantity = currentQuantity + quantityToAdd;

            // Prepare update data
            const updateData = {
                quantity: newQuantity,
                lastUpdated: new Date()
            };

            // Update cost if provided in order
            if (orderData.cost && orderData.cost > 0) {
                updateData.cost = orderData.cost;
                console.log(`Updating product ${orderData.productId} cost to $${orderData.cost.toFixed(2)}`);
            }

            // Update product quantity and cost
            await productRef.update(updateData);

            console.log(`Updated product ${orderData.productId} quantity: ${currentQuantity} + ${quantityToAdd} = ${newQuantity}`);

            // Log inventory change
            if (typeof window.logActivity === 'function') {
                const details = updateData.cost 
                    ? `Stock increased by ${quantityToAdd} and cost updated to $${updateData.cost.toFixed(2)} due to order receipt`
                    : `Stock increased by ${quantityToAdd} due to order receipt`;
                
                await window.logActivity(
                    'inventory_updated',
                    details,
                    orderData.productId,
                    productData.name
                );
            }

            // Refresh app inventory if available
            if (window.app && window.app.inventoryManager) {
                window.app.inventory = await window.app.inventoryManager.loadInventory();
                if (window.app.displayInventory) {
                    window.app.displayInventory();
                }
            }

        } catch (error) {
            console.error('Error processing order receipt:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error updating inventory: ' + error.message, 'warning');
            }
        }
    }

    /**
     * Delete order
     */
    async deleteOrder(orderId) {
        try {
            const order = this.orders.find(o => o.id === orderId);
            if (!order) {
                console.error('Order not found:', orderId);
                return;
            }

            // Confirm deletion
            const confirmed = confirm(`Are you sure you want to delete this order?\n\nProduct: ${order.productName}\nQuantity: ${order.quantity}\nSupplier: ${order.supplier}\n\nThis action cannot be undone.`);
            if (!confirmed) {
                return;
            }

            // Delete from database
            await window.db.collection('orders').doc(orderId).delete();

            // Log activity
            if (typeof window.logActivity === 'function') {
                await window.logActivity(
                    'order_deleted',
                    `Order deleted: ${order.productName} (${order.quantity} units)`,
                    orderId,
                    order.productName
                );
            }

            // Show success message
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Order deleted successfully', 'success');
            }

            // Refresh display
            await this.displayOrders();

        } catch (error) {
            console.error('Error deleting order:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error deleting order: ' + error.message, 'error');
            }
        }
    }

    /**
     * Create new order
     */
    async createOrder(orderData) {
        try {
            const order = {
                productId: orderData.productId,
                productName: orderData.productName,
                quantity: parseInt(orderData.quantity) || 0,
                cost: parseFloat(orderData.cost) || 0,
                totalCost: parseFloat(orderData.totalCost) || (parseInt(orderData.quantity) * parseFloat(orderData.cost)) || 0,
                supplier: orderData.supplier || '',
                notes: orderData.notes || '',
                status: 'pending',
                dateCreated: new Date(),
                expectedDeliveryDate: orderData.expectedDate ? new Date(orderData.expectedDate) : null,
                quantityReceived: 0,
                quantityRemaining: parseInt(orderData.quantity) || 0
            };

            const docRef = await window.db.collection('orders').add(order);

            // Update unit cost in inventory table if cost is provided
            if (order.cost > 0 && order.productId) {
                try {
                    console.log(`[OrdersManager] Updating unit cost for product ${order.productId} to $${order.cost.toFixed(2)}`);
                    
                    await window.db.collection('inventory').doc(order.productId).update({
                        cost: order.cost,
                        lastCostUpdate: new Date(),
                        lastCostFromOrder: docRef.id
                    });

                    // Update local inventory data
                    if (window.app?.inventory) {
                        const productIndex = window.app.inventory.findIndex(p => p.id === order.productId);
                        if (productIndex !== -1) {
                            window.app.inventory[productIndex].cost = order.cost;
                            window.app.inventory[productIndex].lastCostUpdate = new Date();
                            window.app.inventory[productIndex].lastCostFromOrder = docRef.id;
                        }
                    }

                    console.log(`[OrdersManager] Successfully updated unit cost for ${order.productName}`);
                    
                    // Note: We'll include the cost update in the main success message below

                } catch (costUpdateError) {
                    console.error('[OrdersManager] Error updating unit cost:', costUpdateError);
                    // Don't fail the order creation if cost update fails
                    if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                        uiEnhancementManager.showToast(`Order created but failed to update unit cost: ${costUpdateError.message}`, 'warning');
                    }
                }
            }

            // Log activity
            if (typeof window.logActivity === 'function') {
                await window.logActivity(
                    'order_created',
                    `Order created: ${order.productName} (${order.quantity} units @ $${order.cost.toFixed(2)} each)`,
                    docRef.id,
                    order.productName
                );
            }

            // Show success message
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                const costUpdateMessage = order.cost > 0 ? ` (Unit cost updated to $${order.cost.toFixed(2)})` : '';
                uiEnhancementManager.showToast(`Order created for ${order.productName} - Total: $${order.totalCost.toFixed(2)}${costUpdateMessage}`, 'success');
            }

            // Refresh display
            await this.displayOrders();
            
            // Refresh inventory display to show updated cost
            if (window.app?.displayInventory && typeof window.app.displayInventory === 'function') {
                await window.app.displayInventory();
            }

            return docRef.id;

        } catch (error) {
            console.error('Error creating order:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error creating order: ' + error.message, 'error');
            }
            throw error;
        }
        // Update supplier in inventory if changed
        if (order.productId && order.supplier) {
            try {
                // Get current product data
                const productDoc = await window.db.collection('inventory').doc(order.productId).get();
                if (productDoc.exists) {
                    const currentSupplier = productDoc.data().supplier || '';
                    if (currentSupplier !== order.supplier) {
                        await window.db.collection('inventory').doc(order.productId).update({
                            supplier: order.supplier,
                            lastSupplierUpdate: new Date(),
                            lastSupplierFromOrder: docRef.id
                        });
                        // Update local inventory data
                        if (window.app?.inventory) {
                            const productIndex = window.app.inventory.findIndex(p => p.id === order.productId);
                            if (productIndex !== -1) {
                                window.app.inventory[productIndex].supplier = order.supplier;
                                window.app.inventory[productIndex].lastSupplierUpdate = new Date();
                                window.app.inventory[productIndex].lastSupplierFromOrder = docRef.id;
                            }
                        }
                        console.log(`[OrdersManager] Supplier updated for product ${order.productName}`);
                    }
                }
            } catch (supplierUpdateError) {
                console.error('[OrdersManager] Error updating supplier:', supplierUpdateError);
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast(`Order created but failed to update supplier: ${supplierUpdateError.message}`, 'warning');
                }
            }
        }
    }

    /**
     * Submit order from modal form
     */
    async submitModalOrder() {
        try {
            const productId = document.getElementById('modalOrderProductId').value;
            const supplierId = document.getElementById('modalOrderSupplierId').value;
            const quantity = parseInt(document.getElementById('modalOrderQuantity').value) || 0;
            const cost = parseFloat(document.getElementById('modalOrderCost').value) || 0;

            // Validation
            if (!productId) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Please select a product', 'warning');
                }
                return;
            }

            if (!supplierId) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Please select a supplier', 'warning');
                }
                return;
            }

            if (quantity <= 0) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Please enter a valid quantity', 'warning');
                }
                return;
            }

            if (cost <= 0) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Please enter a valid cost per unit', 'warning');
                }
                return;
            }

            // Find product details
            const product = window.app?.inventory?.find(p => p.id === productId);
            if (!product) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Selected product not found', 'error');
                }
                return;
            }

            // Find supplier details
            const supplier = window.app?.suppliers?.find(s => s.id === supplierId);
            const supplierName = supplier ? supplier.name : supplierId;

            // Create order data
            const orderData = {
                productId: productId,
                productName: product.name,
                quantity: quantity,
                cost: cost,
                totalCost: quantity * cost,
                supplier: supplierName,
                supplierId: supplierId,
                notes: `Order created from dashboard modal`,
                expectedDate: null
            };

            // Create the order
            const orderId = await this.createOrder(orderData);


            // Prevent double submission
            const modalSubmitBtn = document.getElementById('modalSubmitOrderBtn');
            if (modalSubmitBtn) modalSubmitBtn.disabled = true;

            // Clear form
            document.getElementById('modalOrderProductId').value = '';
            document.getElementById('modalOrderSupplierId').value = '';
            document.getElementById('modalOrderQuantity').value = '';
            document.getElementById('modalOrderCost').value = '';

            // Set filter to pending_backordered so new order is visible
            const statusFilterEl = document.getElementById('filterOrderStatus');
            if (statusFilterEl) statusFilterEl.value = 'pending_backordered';

            // Close modal
            if (window.app?.modalManager?.closeCreateOrderModal) {
                window.app.modalManager.closeCreateOrderModal();
            }

            // Refresh dashboard
            if (window.app?.updateDashboard) {
                window.app.updateDashboard();
            }

            // Re-enable button after short delay
            setTimeout(() => { if (modalSubmitBtn) modalSubmitBtn.disabled = false; }, 1000);

            return orderId;

        } catch (error) {
            console.error('Error submitting modal order:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error creating order: ' + error.message, 'error');
            }
            throw error;
        }
    }

    /**
     * Submit order from orders section form
     */
    async submitOrder() {
        try {
            const productId = document.getElementById('orderProductId').value;
            const supplierId = document.getElementById('orderSupplierId').value;
            const quantity = parseInt(document.getElementById('orderQuantity').value) || 0;
            const cost = parseFloat(document.getElementById('orderCost').value) || 0;

            // Validation
            if (!productId) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Please select a product', 'warning');
                }
                return;
            }

            if (!supplierId) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Please select a supplier', 'warning');
                }
                return;
            }

            if (quantity <= 0) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Please enter a valid quantity', 'warning');
                }
                return;
            }

            if (cost <= 0) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Please enter a valid cost per unit', 'warning');
                }
                return;
            }

            // Find product details
            const product = window.app?.inventory?.find(p => p.id === productId);
            if (!product) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Selected product not found', 'error');
                }
                return;
            }

            // Find supplier details
            const supplier = window.app?.suppliers?.find(s => s.id === supplierId);
            const supplierName = supplier ? supplier.name : supplierId;

            // Create order data
            const orderData = {
                productId: productId,
                productName: product.name,
                quantity: quantity,
                cost: cost,
                totalCost: quantity * cost,
                supplier: supplierName,
                supplierId: supplierId,
                notes: `Order created from orders section`,
                expectedDate: null
            };

            // Create the order
            const orderId = await this.createOrder(orderData);


            // Prevent double submission
            const addOrderBtn = document.getElementById('addOrderBtn');
            if (addOrderBtn) addOrderBtn.disabled = true;

            // Clear form
            document.getElementById('orderProductId').value = '';
            document.getElementById('orderSupplierId').value = '';
            document.getElementById('orderQuantity').value = '';
            document.getElementById('orderCost').value = '';

            // Set filter to pending_backordered so new order is visible
            const statusFilterEl = document.getElementById('filterOrderStatus');
            if (statusFilterEl) statusFilterEl.value = 'pending_backordered';

            // Re-enable button after short delay
            setTimeout(() => { if (addOrderBtn) addOrderBtn.disabled = false; }, 1000);

            return orderId;

        } catch (error) {
            console.error('Error submitting order:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error creating order: ' + error.message, 'error');
            }
            throw error;
        }
    }

    /**
     * Get pending orders for dashboard
     */
    getPendingOrders() {
        return this.orders.filter(order => 
            order.status === 'pending' || order.status === 'ordered' || order.status === 'partially_received'
        );
    }

    /**
     * Get orders statistics
     */
    getOrdersStats() {
        const stats = {
            total: this.orders.length,
            pending: 0,
            ordered: 0,
            partiallyReceived: 0,
            received: 0,
            cancelled: 0
        };

        this.orders.forEach(order => {
            switch (order.status) {
                case 'pending':
                    stats.pending++;
                    break;
                case 'ordered':
                    stats.ordered++;
                    break;
                case 'partially_received':
                    stats.partiallyReceived++;
                    break;
                case 'received':
                    stats.received++;
                    break;
                case 'cancelled':
                    stats.cancelled++;
                    break;
            }
        });

        return stats;
    }

    /**
     * Export orders data
     */
    exportOrdersData(format = 'csv', statusFilter = '') {
        const dataToExport = statusFilter ? 
            this.orders.filter(order => order.status === statusFilter) : 
            this.orders;

        if (format === 'csv') {
            return this.exportOrdersToCSV(dataToExport);
        } else if (format === 'json') {
            return this.exportOrdersToJSON(dataToExport);
        }
    }

    /**
     * Export orders to CSV
     */
    exportOrdersToCSV(orders) {
        const headers = ['Order ID', 'Product Name', 'Quantity', 'Supplier', 'Status', 'Date Created', 'Expected Delivery'];
        const csvContent = [
            headers.join(','),
            ...orders.map(order => [
                order.id,
                `"${order.productName || ''}"`,
                order.quantity || 0,
                `"${order.supplier || ''}"`,
                order.status || '',
                order.dateCreated ? new Date(order.dateCreated.toDate()).toISOString().split('T')[0] : '',
                order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate.toDate()).toISOString().split('T')[0] : ''
            ].join(','))
        ].join('\n');

        return csvContent;
    }

    /**
     * Export orders to JSON
     */
    exportOrdersToJSON(orders) {
        const exportData = orders.map(order => ({
            ...order,
            dateCreated: order.dateCreated ? order.dateCreated.toDate().toISOString() : null,
            expectedDeliveryDate: order.expectedDeliveryDate ? order.expectedDeliveryDate.toDate().toISOString() : null
        }));

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Display pending orders on the dashboard
     */
    async displayPendingOrdersOnDashboard() {
        const tableBody = document.getElementById('dashboardPendingOrdersTableBody');
        if (!tableBody) {
            console.error("Dashboard Pending Orders table body not found.");
            return;
        }
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">Loading pending/backordered orders...</td></tr>';

        try {
            // Get both pending and backordered (including legacy partially_received)
            const ordersSnapshotPending = await window.db.collection('orders')
                .where('status', 'in', ['pending', 'backordered', 'partially_received'])
                .orderBy('orderDate', 'desc')
                .limit(10)
                .get();

            if (ordersSnapshotPending.empty) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-gray-500 dark:text-gray-400">No pending or backordered orders found.</td></tr>';
                return;
            }

            tableBody.innerHTML = '';
            ordersSnapshotPending.forEach(doc => {
                const order = doc.data();
                const row = tableBody.insertRow();
                row.className = 'hover';

                // Show 'Backordered' for both backordered and partially_received
                let statusDisplay = order.status;
                if (statusDisplay === 'partially_received' || statusDisplay === 'backordered') {
                    statusDisplay = 'Backordered';
                }

                row.innerHTML = `
                    <td class="text-xs whitespace-nowrap">${doc.id}</td>
                    <td>${order.productName || 'N/A'}</td>
                    <td class="text-center">${order.quantity}</td>
                    <td class="text-xs whitespace-nowrap">${order.orderDate ? order.orderDate.toDate().toLocaleDateString() : 'N/A'}</td>
                    <td><span class="badge badge-warning badge-sm">${statusDisplay}</span></td>
                    <td class="text-center">
                        <button class="btn btn-xs btn-ghost dashboard-edit-status-btn" data-order-id="${doc.id}" data-order-status="${order.status}" title="Edit Status">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </button>
                    </td>
                `;
            });
            // Add event listeners for status edit buttons
            tableBody.querySelectorAll('.dashboard-edit-status-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const orderId = this.getAttribute('data-order-id');
                    const orderStatus = this.getAttribute('data-order-status');
                    if (typeof window.openMiniStatusUpdateModal === 'function') {
                        window.openMiniStatusUpdateModal(orderId, orderStatus);
                    } else if (typeof openMiniStatusUpdateModal === 'function') {
                        openMiniStatusUpdateModal(orderId, orderStatus);
                    } else {
                        alert('Status modal function not found.');
                    }
                });
            });
            console.log("Pending/backordered orders displayed on dashboard.");
        } catch (error) {
            console.error("Error fetching or displaying pending/backordered orders on dashboard:", error);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-red-500 dark:text-red-400">Error loading pending/backordered orders.</td></tr>';
            if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                window.uiEnhancementManager.showToast('Error loading pending/backordered orders: ' + error.message, 'error');
            }
        }
    }
}

// Export singleton instance
export const ordersManager = new OrdersManager();
