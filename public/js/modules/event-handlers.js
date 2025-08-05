/**
 * Event Handlers Module
 * Manages all event listeners and their setup
 */

export class EventHandlerManager {
    constructor() {
        this.isInitialized = false;
    }

    /**
     * Initialize all event handlers
     */
    init() {
        if (this.isInitialized) {
            console.warn('[EventHandlerManager] Already initialized');
            return;
        }

        try {
            this.setupCoreUIHandlers();
            this.setupNavigationHandlers();
            this.setupProductFormHandlers();
            this.setupSupplierLocationHandlers();
            this.setupInventoryHandlers();
            this.setupBatchActionsHandlers();
            this.setupReportHandlers();
            this.setupModalHandlers();
            this.setupQuickStockUpdateHandlers();
            this.setupDashboardHandlers();
            this.setupOrdersHandlers();
            this.setupUserManagementHandlers();
            
            this.isInitialized = true;
            console.log('[EventHandlerManager] All event handlers initialized');
        } catch (error) {
            console.error('[EventHandlerManager] Error during initialization:', error);
        }
    }

    /**
     * Setup core UI handlers (logout, dark mode, sidebar)
     */
    setupCoreUIHandlers() {
        // Logout button
        const logoutBtn = document.getElementById('logoutButton');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                firebase.auth().signOut().then(() => {
                    console.log('User signed out successfully.');
                }).catch(error => {
                    console.error('Sign out error:', error);
                    alert('Error signing out: ' + error.message);
                });
            });
        }

        // Dark mode toggle
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            this.setupDarkModeToggle(darkModeToggle);
        }

        // Sidebar toggle
        const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', window.toggleSidebar);
        }
    }

    /**
     * Setup dark mode toggle functionality
     */
    setupDarkModeToggle(darkModeToggle) {
        function updateDarkModeButtonText() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const isDark = currentTheme === window.DARK_THEME_NAME;
            darkModeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
            darkModeToggle.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        }
        
        updateDarkModeButtonText();

        darkModeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === window.DARK_THEME_NAME) {
                window.removeDarkMode();
            } else {
                window.applyDarkMode();
            }
            updateDarkModeButtonText();
            
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast(
                    currentTheme === window.DARK_THEME_NAME ? 'Light mode enabled' : 'Dark mode enabled', 
                    'info'
                );
            }
        });
    }

    /**
     * Setup navigation menu handlers
     */
    setupNavigationHandlers() {
        const menuItemsToSetup = [
            'menuDashboard', 'menuInventory', 'menuSuppliers', 'menuOrders',
            'menuReports', 'menuQuickStockUpdate', 'menuUserManagement'
        ];
        
        const viewMappings = {
            'menuDashboard': 'dashboardViewContainer',
            'menuInventory': 'inventoryViewContainer',
            'menuSuppliers': 'suppliersAndLocationsContainer',
            'menuOrders': 'ordersSectionContainer',
            'menuReports': 'reportsSectionContainer',
            'menuQuickStockUpdate': 'quickStockUpdateContainer',
            'menuUserManagement': 'userManagementViewContainer'
        };

        menuItemsToSetup.forEach(menuId => {
            const menuItemEl = document.getElementById(menuId);
            if (menuItemEl) {
                menuItemEl.addEventListener('click', (e) => {
                    e.preventDefault();
                    const viewId = viewMappings[menuId];
                    if (viewId && typeof window.showView === 'function') {
                        window.showView(viewId, menuId);
                    }
                });
            }
        });
    }

    /**
     * Setup product form handlers
     */
    setupProductFormHandlers() {
        const handlers = [
            { id: 'productSubmitBtn', handler: window.submitProduct },
            { id: 'cancelEditBtn', handler: window.resetProductForm },
            { id: 'capturePhotoBtn', handler: window.startPhotoCapture },
            { id: 'takePhotoBtn', handler: window.takePhoto },
            { id: 'cancelPhotoBtn', handler: window.cancelPhoto },
            { id: 'scanToEditBtn', handler: window.startEditScanner },
            { id: 'stopEditScannerBtn', handler: window.stopEditScanner }
        ];

        handlers.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element && typeof handler === 'function') {
                element.addEventListener('click', handler);
            }
        });
    }

    /**
     * Setup supplier and location handlers
     */
    setupSupplierLocationHandlers() {
        const addSupplierBtn = document.getElementById('addSupplierBtn');
        if (addSupplierBtn && typeof window.addSupplier === 'function') {
            addSupplierBtn.addEventListener('click', window.addSupplier);
        }

        const addLocationBtn = document.getElementById('addLocationBtn');
        if (addLocationBtn && typeof window.addLocation === 'function') {
            addLocationBtn.addEventListener('click', window.addLocation);
        }
    }

    /**
     * Setup inventory table and filter handlers
     */
    setupInventoryHandlers() {
        // Filter dropdowns
        const filterSupplier = document.getElementById('filterSupplier');
        if (filterSupplier && typeof window.displayInventory === 'function') {
            filterSupplier.addEventListener('change', () => {
                const searchTerm = document.getElementById('inventorySearchInput')?.value || '';
                const supplierFilter = filterSupplier.value;
                const locationFilter = document.getElementById('filterLocation')?.value || '';
                window.displayInventory(searchTerm, supplierFilter, locationFilter);
            });
        }

        const filterLocation = document.getElementById('filterLocation');
        if (filterLocation && typeof window.displayInventory === 'function') {
            filterLocation.addEventListener('change', () => {
                const searchTerm = document.getElementById('inventorySearchInput')?.value || '';
                const supplierFilter = document.getElementById('filterSupplier')?.value || '';
                const locationFilter = filterLocation.value;
                window.displayInventory(searchTerm, supplierFilter, locationFilter);
            });
        }

        // Clear filters button
        const clearInventoryFiltersBtn = document.getElementById('clearInventoryFiltersBtn');
        if (clearInventoryFiltersBtn) {
            clearInventoryFiltersBtn.addEventListener('click', () => {
                if (document.getElementById('filterSupplier')) document.getElementById('filterSupplier').value = '';
                if (document.getElementById('filterLocation')) document.getElementById('filterLocation').value = '';
                if (document.getElementById('inventorySearchInput')) document.getElementById('inventorySearchInput').value = '';
                window.currentPage = 1;
                if (typeof window.displayInventory === 'function') {
                    window.displayInventory('', '', '');
                }
            });
        }

        // Search input
        const inventorySearchInput = document.getElementById('inventorySearchInput');
        if (inventorySearchInput && typeof window.displayInventory === 'function') {
            inventorySearchInput.addEventListener('input', window.debounce(() => {
                window.currentPage = 1;
                const supplierFilter = document.getElementById('filterSupplier')?.value || '';
                const locationFilter = document.getElementById('filterLocation')?.value || '';
                window.displayInventory(inventorySearchInput.value, supplierFilter, locationFilter);
            }, 300));
        }

        // Pagination controls
        const prevPageBtn = document.getElementById('prevPageBtn');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (window.currentPage > 1) {
                    window.currentPage--;
                    if (typeof window.displayInventory === 'function') {
                        const searchTerm = document.getElementById('inventorySearchInput')?.value || '';
                        const supplierFilter = document.getElementById('filterSupplier')?.value || '';
                        const locationFilter = document.getElementById('filterLocation')?.value || '';
                        window.displayInventory(searchTerm, supplierFilter, locationFilter);
                    }
                }
            });
        }

        const nextPageBtn = document.getElementById('nextPageBtn');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                const totalPages = Math.ceil((window.app?.inventoryDisplayManager?.totalFilteredItems || 0) / (window.app?.inventoryDisplayManager?.itemsPerPage || 50));
                if (window.currentPage < totalPages) {
                    window.currentPage++;
                    if (typeof window.displayInventory === 'function') {
                        const searchTerm = document.getElementById('inventorySearchInput')?.value || '';
                        const supplierFilter = document.getElementById('filterSupplier')?.value || '';
                        const locationFilter = document.getElementById('filterLocation')?.value || '';
                        window.displayInventory(searchTerm, supplierFilter, locationFilter);
                    }
                }
            });
        }

        // Refresh inventory button
        const refreshInventoryBtn = document.getElementById('refreshInventoryBtn');
        if (refreshInventoryBtn && typeof window.handleRefreshInventory === 'function') {
            refreshInventoryBtn.addEventListener('click', window.handleRefreshInventory);
        }
    }

    /**
     * Setup batch actions and move product handlers
     */
    setupBatchActionsHandlers() {
        const handlers = [
            { id: 'addBatchEntryBtn', handler: window.addBatchEntry },
            { id: 'startUpdateScannerBtn', handler: window.startUpdateScanner },
            { id: 'stopUpdateScannerBtn', handler: window.stopUpdateScanner },
            { id: 'submitBatchUpdatesBtn', handler: window.submitBatchUpdates },
            { id: 'startMoveScannerBtn', handler: window.startMoveScanner },
            { id: 'stopMoveScannerBtn', handler: window.stopMoveScanner },
            { id: 'moveProductBtn', handler: window.moveProduct }
        ];

        handlers.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element && typeof handler === 'function') {
                element.addEventListener('click', handler);
            }
        });
    }

    /**
     * Setup report generation handlers
     */
    setupReportHandlers() {
        const emailOrderReportBtn = document.getElementById('emailOrderReportBtn');
        if (emailOrderReportBtn) {
            emailOrderReportBtn.addEventListener('click', () => {
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.emailOrderReport();
                } else {
                    console.error('Reports manager not available for email order report');
                }
            });
        }

        // New QR generation by location
        const generateQRByLocationBtn = document.getElementById('generateQRByLocationBtn');
        if (generateQRByLocationBtn) {
            generateQRByLocationBtn.addEventListener('click', () => {
                const locationSelect = document.getElementById('qrLocationSelect');
                const selectedLocation = locationSelect ? locationSelect.value : '';
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.generateQRCodesHTMLPrint(selectedLocation);
                }
            });
        }

        // HTML Print Button Handlers
        const generateQRHTMLPrintBtn = document.getElementById('generateQRHTMLPrintBtn');
        if (generateQRHTMLPrintBtn) {
            generateQRHTMLPrintBtn.addEventListener('click', () => {
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.generateQRCodesHTMLPrint();
                } else {
                    console.error('Reports manager not available for HTML print');
                }
            });
        }

        const generateOrderHTMLPrintBtn = document.getElementById('generateOrderHTMLPrintBtn');
        if (generateOrderHTMLPrintBtn) {
            generateOrderHTMLPrintBtn.addEventListener('click', () => {
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.generateOrderReportHTMLPrint();
                } else {
                    console.error('Reports manager not available for HTML print');
                }
            });
        }

        // Additional HTML Print Button Handlers
        const generateInventoryHTMLPrintBtn = document.getElementById('generateInventoryHTMLPrintBtn');
        if (generateInventoryHTMLPrintBtn) {
            generateInventoryHTMLPrintBtn.addEventListener('click', () => {
                if (window.app && window.app.reportsManager) {
                    // Get any active filters for inventory
                    const filters = {}; // You can extend this to get actual filter values
                    window.app.reportsManager.generateInventoryReportHTMLPrint(filters);
                } else {
                    console.error('Reports manager not available for HTML print');
                }
            });
        }

        const generateLowStockHTMLPrintBtn = document.getElementById('generateLowStockHTMLPrintBtn');
        if (generateLowStockHTMLPrintBtn) {
            generateLowStockHTMLPrintBtn.addEventListener('click', () => {
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.generateLowStockReportHTMLPrint();
                } else {
                    console.error('Reports manager not available for HTML print');
                }
            });
        }

        const generateSupplierHTMLPrintBtn = document.getElementById('generateSupplierHTMLPrintBtn');
        if (generateSupplierHTMLPrintBtn) {
            generateSupplierHTMLPrintBtn.addEventListener('click', () => {
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.generateSupplierReportHTMLPrint();
                } else {
                    console.error('Reports manager not available for HTML print');
                }
            });
        }

        const generateQuickActionsQRPrintBtn = document.getElementById('generateQuickActionsQRPrintBtn');
        if (generateQuickActionsQRPrintBtn) {
            generateQuickActionsQRPrintBtn.addEventListener('click', () => {
                if (typeof window.generateQuickActionsQRPrint === 'function') {
                    window.generateQuickActionsQRPrint();
                } else {
                    console.error('generateQuickActionsQRPrint function not available');
                }
            });
        }

        const trendProductSelect = document.getElementById('trendProductSelect');
        if (trendProductSelect && typeof window.generateProductUsageChart === 'function') {
            trendProductSelect.addEventListener('change', (event) => window.generateProductUsageChart(event.target.value));
        }

        // Order QR generation by supplier
        const generateOrderQRBySupplierBtn = document.getElementById('generateOrderQRBySupplierBtn');
        if (generateOrderQRBySupplierBtn) {
            generateOrderQRBySupplierBtn.addEventListener('click', () => {
                const supplierSelect = document.getElementById('qrOrderSupplierSelect');
                const selectedSupplier = supplierSelect ? supplierSelect.value : '';
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.generateOrderQRCodesBySupplierHTMLPrint(selectedSupplier);
                } else {
                    console.error('Reports manager not available for Order QR print');
                }
            });
        }

        // Pending/Backorder QR generation
        const generatePendingOrdersQRBtn = document.getElementById('generatePendingOrdersQRBtn');
        if (generatePendingOrdersQRBtn) {
            generatePendingOrdersQRBtn.addEventListener('click', () => {
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.generatePendingOrdersQRHTMLPrint();
                } else {
                    console.error('Reports manager not available for Pending Orders QR print');
                }
            });
        }

        // Email report handlers
        const emailInventoryReportBtn = document.getElementById('emailInventoryReportBtn');
        if (emailInventoryReportBtn) {
            emailInventoryReportBtn.addEventListener('click', () => {
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.emailInventoryReport();
                } else {
                    console.error('Reports manager not available for email inventory report');
                }
            });
        }

        const emailLowStockReportBtn = document.getElementById('emailLowStockReportBtn');
        if (emailLowStockReportBtn) {
            emailLowStockReportBtn.addEventListener('click', () => {
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.emailLowStockReport();
                } else {
                    console.error('Reports manager not available for email low stock report');
                }
            });
        }

        const emailSupplierReportBtn = document.getElementById('emailSupplierReportBtn');
        if (emailSupplierReportBtn) {
            emailSupplierReportBtn.addEventListener('click', () => {
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.emailSupplierReport();
                } else {
                    console.error('Reports manager not available for email supplier report');
                }
            });
        }

        const emailFastOrderReportBtn = document.getElementById('emailFastOrderReportBtn');
        if (emailFastOrderReportBtn) {
            emailFastOrderReportBtn.addEventListener('click', () => {
                if (window.app && window.app.reportsManager) {
                    window.app.reportsManager.emailFastOrderReport();
                } else {
                    console.error('Reports manager not available for email fast order report');
                }
            });
        }

    }

    /**
     * Setup modal handlers
     */
    setupModalHandlers() {
        // Image modal
        const closeImageModalBtn = document.getElementById('closeImageModalBtn');
        if (closeImageModalBtn && typeof window.closeImageModal === 'function') {
            closeImageModalBtn.addEventListener('click', window.closeImageModal);
        }

        const imageModalElement = document.getElementById('imageModal');
        if (imageModalElement && typeof window.closeImageModal === 'function') {
            imageModalElement.addEventListener('click', (e) => {
                if (e.target === imageModalElement) window.closeImageModal();
            });
        }

        // Mini status update modal
        this.setupMiniStatusModal();
    }

    /**
     * Setup mini status modal handlers
     */
    setupMiniStatusModal() {
        const miniModalCloseBtn = document.getElementById('miniModalCloseBtn');
        const miniStatusUpdateModalElement = document.getElementById('miniStatusUpdateModal');
        const miniModalOrderStatusSelect = document.getElementById('miniModalOrderStatusSelect');
        const miniModalQuantityReceivedGroup = document.getElementById('miniModalQuantityReceivedGroup');
        const miniModalQuantityReceivedInput = document.getElementById('miniModalQuantityReceived');
        const miniModalSaveStatusBtn = document.getElementById('miniModalSaveStatusBtn');

        if (miniModalCloseBtn && typeof window.closeMiniStatusModal === 'function') {
            miniModalCloseBtn.addEventListener('click', window.closeMiniStatusModal);
        }

        if (miniStatusUpdateModalElement && typeof window.closeMiniStatusModal === 'function') {
            miniStatusUpdateModalElement.addEventListener('click', (e) => {
                if (e.target === miniStatusUpdateModalElement) {
                    window.closeMiniStatusModal();
                }
            });
        }

        if (miniModalOrderStatusSelect && miniModalQuantityReceivedGroup && miniModalQuantityReceivedInput) {
            miniModalOrderStatusSelect.addEventListener('change', function() {
                if (this.value === 'partially_received') {
                    miniModalQuantityReceivedGroup.classList.remove('hidden');
                    miniModalQuantityReceivedInput.focus();
                } else {
                    miniModalQuantityReceivedGroup.classList.add('hidden');
                    miniModalQuantityReceivedInput.value = '';
                }
            });
        }

        if (miniModalSaveStatusBtn) {
            miniModalSaveStatusBtn.addEventListener('click', this.handleMiniModalSave.bind(this));
        }
    }

    /**
     * Handle mini modal save action
     */
    async handleMiniModalSave() {
        if (!window.currentMiniModalOrderId) {
            console.error("No currentMiniModalOrderId set. Cannot save status.");
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast("Error: No order selected to update.", "error");
            }
            return;
        }

        const newStatus = document.getElementById('miniModalOrderStatusSelect')?.value;
        const quantityReceivedInput = document.getElementById('miniModalQuantityReceived');
        const quantityReceived = quantityReceivedInput ? parseInt(quantityReceivedInput.value) : 0;
        
        // Get the new quantity from the editable field
        const newQuantityInput = document.getElementById('miniModalEditableQuantity');
        const newQuantity = newQuantityInput ? parseInt(newQuantityInput.value) : null;

        if (!newStatus) {
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast("No status selected.", "warning");
            }
            return;
        }

        if (newQuantity && newQuantity < 1) {
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast("Quantity must be at least 1.", "warning");
            }
            return;
        }

        try {
            const orderRef = window.db.collection('orders').doc(window.currentMiniModalOrderId);
            const orderDoc = await orderRef.get();
            
            if (!orderDoc.exists) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast(`Order ${window.currentMiniModalOrderId} not found.`, "error");
                }
                if (typeof window.closeMiniStatusModal === 'function') {
                    window.closeMiniStatusModal();
                }
                return;
            }

            const orderData = orderDoc.data();
            let productData = null;
            let productRef = null;

            if (orderData.productId) {
                productRef = window.db.collection('inventory').doc(orderData.productId);
                const productDoc = await productRef.get();
                if (productDoc.exists) {
                    productData = productDoc.data();
                }
            }

            // Prepare update data
            const updateData = { status: newStatus };
            
            // Add quantity to update if it was changed
            if (newQuantity && newQuantity !== orderData.quantity) {
                updateData.quantity = newQuantity;
                // Recalculate total cost if cost exists
                if (orderData.cost) {
                    updateData.totalCost = orderData.cost * newQuantity;
                }
            }

            // Process order based on status
            if (newStatus === 'received' && typeof window.processFullReceipt === 'function') {
                // For received status, update quantity first then process receipt
                if (Object.keys(updateData).length > 1) { // More than just status
                    await orderRef.update(updateData);
                    // Refresh order data for processing
                    const updatedOrderDoc = await orderRef.get();
                    const updatedOrderData = updatedOrderDoc.data();
                    await window.processFullReceipt(window.currentMiniModalOrderId, updatedOrderData, productData, productRef);
                } else {
                    await window.processFullReceipt(window.currentMiniModalOrderId, orderData, productData, productRef);
                }
            } else if (newStatus === 'fulfilled' && typeof window.processFullReceipt === 'function') {
                // For fulfilled status, same as received but keep status as 'fulfilled'
                if (Object.keys(updateData).length > 1) { // More than just status
                    await orderRef.update(updateData);
                    // Refresh order data for processing
                    const updatedOrderDoc = await orderRef.get();
                    const updatedOrderData = updatedOrderDoc.data();
                    await window.processFullReceipt(window.currentMiniModalOrderId, updatedOrderData, productData, productRef, 'fulfilled');
                } else {
                    await window.processFullReceipt(window.currentMiniModalOrderId, orderData, productData, productRef, 'fulfilled');
                }
            } else if (newStatus === 'partially_received' && typeof window.processPartialReceipt === 'function') {
                // For partial receipt, update quantity first then process
                if (Object.keys(updateData).length > 1) { // More than just status
                    await orderRef.update(updateData);
                    // Refresh order data for processing
                    const updatedOrderDoc = await orderRef.get();
                    const updatedOrderData = updatedOrderDoc.data();
                    await window.processPartialReceipt(window.currentMiniModalOrderId, updatedOrderData, productData, productRef, quantityReceived);
                } else {
                    await window.processPartialReceipt(window.currentMiniModalOrderId, orderData, productData, productRef, quantityReceived);
                }
            } else {
                // Handle other status changes
                await orderRef.update(updateData);
                const statusMessage = `Order ${newQuantity && newQuantity !== orderData.quantity ? 'quantity and ' : ''}status updated`;
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast(`${statusMessage} successfully.`, "success");
                }
            }

            // Refresh displays
            if (typeof window.loadAndDisplayOrders === 'function') {
                window.loadAndDisplayOrders();
            }
            if (productData && (newStatus === 'received' || newStatus === 'partially_received')) {
                if (typeof window.displayInventory === 'function') window.displayInventory();
                if (typeof window.updateInventoryDashboard === 'function') window.updateInventoryDashboard();
                if (typeof window.updateToOrderTable === 'function') window.updateToOrderTable();
            }

        } catch (error) {
            console.error("Error processing order status update from mini-modal:", error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast("Error updating status: " + error.message, "error");
            }
        }

        if (typeof window.closeMiniStatusModal === 'function') {
            window.closeMiniStatusModal();
        }
    }

    /**
     * Setup Quick Stock Update handlers
     */
    setupQuickStockUpdateHandlers() {
        // Tab switching
        const qsuTabs = ['manualBatchModeTab', 'barcodeScannerModeTab', 'fileUploadModeTab'];
        qsuTabs.forEach(tabId => {
            const tabEl = document.getElementById(tabId);
            if (tabEl && typeof window.switchQuickUpdateTab === 'function') {
                tabEl.addEventListener('click', () => window.switchQuickUpdateTab(tabId));
            }
        });

        // Barcode input
        const qsuBarcodeIdInput = document.getElementById('qsuBarcodeIdInput');
        if (qsuBarcodeIdInput) {
            qsuBarcodeIdInput.addEventListener('keypress', async (event) => {
                if (event.key === 'Enter' || event.keyCode === 13) {
                    event.preventDefault();
                    const scannedValue = qsuBarcodeIdInput.value.trim();
                    qsuBarcodeIdInput.value = '';

                    if (scannedValue) {
                        if (scannedValue.startsWith('ACTION_')) {
                            const parts = scannedValue.split('_');
                            if (parts.length === 3) {
                                const action = parts[1];
                                const quantity = parseInt(parts[2]);
                                if (typeof window.adjustScannedProductQuantity === 'function') {
                                    await window.adjustScannedProductQuantity(action, quantity.toString());
                                }
                            }
                        } else {
                            if (typeof window.handleQuickStockScan === 'function') {
                                await window.handleQuickStockScan(scannedValue);
                            }
                        }
                    }
                    qsuBarcodeIdInput.focus();
                }
            });
        }

        // Other QSU handlers
        const qsuHandlers = [
            { id: 'qsuAddManualEntryBtn', handler: window.addQuickStockManualEntry },
            { id: 'qsuSubmitBatchBtn', handler: window.submitQuickStockBatch },
            { id: 'qsuProcessFileBtn', handler: window.processQuickStockUploadedFile }
        ];

        qsuHandlers.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element && typeof handler === 'function') {
                element.addEventListener('click', handler);
            }
        });

        // File upload
        const qsuFileUpload = document.getElementById('qsuFileUpload');
        if (qsuFileUpload && typeof window.handleQuickStockFileUpload === 'function') {
            qsuFileUpload.addEventListener('change', window.handleQuickStockFileUpload);
        }

        // Product search
        const qsuProductSearch = document.getElementById('qsuProductSearch');
        if (qsuProductSearch && typeof window.handleQuickStockProductSearch === 'function') {
            qsuProductSearch.addEventListener('input', window.debounce(window.handleQuickStockProductSearch, 300));
        }

        // Quantity adjustment buttons
        const qsuAdjustIncrementBtn = document.getElementById('qsuAdjustIncrementBtn');
        if (qsuAdjustIncrementBtn && typeof window.adjustScannedProductQuantity === 'function') {
            qsuAdjustIncrementBtn.addEventListener('click', () => {
                const quantityToAdjust = document.getElementById('qsuAdjustQuantity')?.value;
                window.adjustScannedProductQuantity('increment', quantityToAdjust);
            });
        }

        const qsuAdjustDecrementBtn = document.getElementById('qsuAdjustDecrementBtn');
        if (qsuAdjustDecrementBtn && typeof window.adjustScannedProductQuantity === 'function') {
            qsuAdjustDecrementBtn.addEventListener('click', () => {
                const quantityToAdjust = document.getElementById('qsuAdjustQuantity')?.value;
                window.adjustScannedProductQuantity('decrement', quantityToAdjust);
            });
        }
    }

    /**
     * Setup dashboard-specific handlers
     */
    setupDashboardHandlers() {
        const dashboardHandlers = [
            { id: 'refreshDashboardBtn', handler: this.handleDashboardRefresh },
            { id: 'viewAllOrdersBtn', handler: () => window.showView('ordersSectionContainer', 'menuOrders') },
            { id: 'dashboardAddProductBtn', handler: window.openAddProductModal },
            { id: 'dashboardCreateOrderBtn', handler: window.openCreateOrderModal },
            { id: 'dashboardScanToEditBtn', handler: window.openScanToEditModal },
            { id: 'dashboardMoveProductBtn', handler: window.openMoveProductModal },
            { id: 'quickStockUpdateBtn', handler: window.openUpdateStockModal },
            { id: 'quickViewReportsBtn', handler: () => window.showView('reportsSectionContainer', 'menuReports') }
        ];

        dashboardHandlers.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element && typeof handler === 'function') {
                // Remove any existing event listeners by cloning the element
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                // Add the event listener to the new element
                newElement.addEventListener('click', handler);
            }
        });

        // Setup modal handlers for dashboard modals
        this.setupDashboardModalHandlers();
    }

    /**
     * Handle dashboard refresh
     */
    handleDashboardRefresh() {
        if (typeof window.updateEnhancedDashboard === 'function') {
            window.updateEnhancedDashboard();
        }
        if (typeof window.displayPendingOrdersOnDashboard === 'function') {
            window.displayPendingOrdersOnDashboard();
        }
    }

    /**
     * Setup dashboard modal handlers
     */
    setupDashboardModalHandlers() {
        // Add Product Modal
        const addProductModalHandlers = [
            { id: 'closeAddProductModalBtn', handler: window.closeAddProductModal },
            { id: 'modalProductSubmitBtn', handler: window.submitProduct },
            { id: 'modalCancelProductBtn', handler: window.closeAddProductModal }
            // Note: Camera buttons use onclick attributes in HTML to avoid duplicate calls
        ];

        addProductModalHandlers.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element && typeof handler === 'function') {
                element.addEventListener('click', handler);
            }
        });

        // Create Order Modal
        const createOrderModalHandlers = [
            { id: 'closeCreateOrderModalBtn', handler: window.closeCreateOrderModal },
            { id: 'modalSubmitOrderBtn', handler: window.submitModalOrder },
            { id: 'modalCancelOrderBtn', handler: window.closeCreateOrderModal }
        ];

        createOrderModalHandlers.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element && typeof handler === 'function') {
                element.addEventListener('click', handler);
            }
        });

        // Scan to Edit Modal
        this.setupScanToEditModal();
        
        // Move Product Modal
        this.setupMoveProductModal();
        
        // Update Stock Modal
        this.setupUpdateStockModal();
    }

    /**
     * Setup Scan to Edit Modal handlers
     */
    setupScanToEditModal() {
        const closeScanToEditModalBtn = document.getElementById('closeScanToEditModalBtn');
        if (closeScanToEditModalBtn && typeof window.closeScanToEditModal === 'function') {
            closeScanToEditModalBtn.addEventListener('click', window.closeScanToEditModal);
        }

        const scanToEditProductIdInput = document.getElementById('scanToEditProductIdInput');
        if (scanToEditProductIdInput && typeof window.handleScanToEditProductIdSubmit === 'function') {
            scanToEditProductIdInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter' || event.keyCode === 13) {
                    event.preventDefault();
                    window.handleScanToEditProductIdSubmit();
                }
            });
        }

        const scanToEditHandlers = [
            { id: 'scanToEditSubmitIdBtn', handler: window.handleScanToEditProductIdSubmit },
            { id: 'scanToEdit_submitProductBtn', handler: window.submitEditProductFromModal },
            { id: 'scanToEdit_cancelChangesBtn', handler: window.closeScanToEditModal },
            { id: 'scanToEdit_capturePhotoBtn', handler: window.startScanToEditModalPhotoCapture },
            { id: 'scanToEdit_takePhotoBtn', handler: window.takeScanToEditModalPhoto },
            { id: 'scanToEdit_cancelPhotoBtn', handler: window.cancelScanToEditModalPhoto }
        ];

        scanToEditHandlers.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element && typeof handler === 'function') {
                element.addEventListener('click', handler);
            }
        });
    }

    /**
     * Setup Move Product Modal handlers
     */
    setupMoveProductModal() {
        const closeMoveProductModalBtn = document.getElementById('closeMoveProductModalBtn');
        if (closeMoveProductModalBtn && typeof window.closeMoveProductModal === 'function') {
            closeMoveProductModalBtn.addEventListener('click', window.closeMoveProductModal);
        }

        const moveProductModal_productIdInput = document.getElementById('moveProductModal_productIdInput');
        if (moveProductModal_productIdInput && typeof window.handleMoveProductModalIdSubmit === 'function') {
            moveProductModal_productIdInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter' || event.keyCode === 13) {
                    event.preventDefault();
                    window.handleMoveProductModalIdSubmit();
                }
            });
        }

        const moveProductHandlers = [
            { id: 'moveProductModal_findBtn', handler: window.handleMoveProductModalIdSubmit },
            { id: 'moveProductModal_submitBtn', handler: window.submitMoveProductFromModal },
            { id: 'moveProductModal_cancelBtn', handler: window.closeMoveProductModal }
        ];

        moveProductHandlers.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element && typeof handler === 'function') {
                element.addEventListener('click', handler);
            }
        });
    }

    /**
     * Setup Update Stock Modal handlers
     */
    setupUpdateStockModal() {
        const updateStockHandlers = [
            { id: 'closeUpdateStockModalBtn', handler: window.closeUpdateStockModal },
            { id: 'updateStockDoneBtn', handler: window.closeUpdateStockModal },
            { id: 'updateStockAdjustIncrementBtn', handler: () => window.adjustUpdateStockModalQuantity('increment') },
            { id: 'updateStockAdjustDecrementBtn', handler: () => window.adjustUpdateStockModalQuantity('decrement') }
        ];

        updateStockHandlers.forEach(({ id, handler }) => {
            const element = document.getElementById(id);
            if (element && typeof handler === 'function') {
                element.addEventListener('click', handler);
            }
        });

        const updateStockProductIdInput = document.getElementById('updateStockProductIdInput');
        if (updateStockProductIdInput) {
            updateStockProductIdInput.addEventListener('keypress', async (event) => {
                if (event.key === 'Enter' || event.keyCode === 13) {
                    event.preventDefault();
                    const scannedValue = updateStockProductIdInput.value.trim();
                    updateStockProductIdInput.value = '';
                    
                    if (scannedValue) {
                        if (scannedValue.startsWith('ACTION_')) {
                            if (typeof window.processUpdateStockModalAction === 'function') {
                                await window.processUpdateStockModalAction(scannedValue);
                            }
                        } else {
                            if (typeof window.handleUpdateStockModalScan === 'function') {
                                await window.handleUpdateStockModalScan(scannedValue);
                            }
                        }
                    } else {
                        if (typeof window.setUpdateStockModalStatus === 'function') {
                            window.setUpdateStockModalStatus('Please enter or scan a Product ID or Action Code.', true);
                        }
                    }
                    updateStockProductIdInput.focus();
                }
            });
        }
    }

    /**
     * Setup orders view handlers
     */
    setupOrdersHandlers() {
        const addOrderBtn = document.getElementById('addOrderBtn');
        if (addOrderBtn && typeof window.handleAddOrder === 'function') {
            addOrderBtn.addEventListener('click', window.handleAddOrder);
        }

        const filterOrderStatus = document.getElementById('filterOrderStatus');
        if (filterOrderStatus) {
            filterOrderStatus.addEventListener('change', () => {
                if (window.app && window.app.ordersManager) {
                    const statusFilter = filterOrderStatus.value;
                    const supplierFilter = document.getElementById('filterOrderSupplierDropdown')?.value || '';
                    window.app.ordersManager.displayOrders(statusFilter, supplierFilter);
                }
            });
        }

        const filterOrderSupplierDropdown = document.getElementById('filterOrderSupplierDropdown');
        if (filterOrderSupplierDropdown) {
            filterOrderSupplierDropdown.addEventListener('change', () => {
                if (window.app && window.app.ordersManager) {
                    const statusFilter = document.getElementById('filterOrderStatus')?.value || '';
                    const supplierFilter = filterOrderSupplierDropdown.value;
                    window.app.ordersManager.displayOrders(statusFilter, supplierFilter);
                }
            });
        }
    }

    /**
     * Setup user management handlers
     */
    setupUserManagementHandlers() {
        const selectAllUsersCheckbox = document.getElementById('selectAllUsersCheckbox');
        if (selectAllUsersCheckbox && typeof window.handleSelectAllUsers === 'function') {
            selectAllUsersCheckbox.addEventListener('change', window.handleSelectAllUsers);
        }

        const deleteSelectedUsersBtn = document.getElementById('deleteSelectedUsersBtn');
        if (deleteSelectedUsersBtn) {
            if (typeof window.handleDeleteSelectedUsers === 'function') {
                deleteSelectedUsersBtn.addEventListener('click', window.handleDeleteSelectedUsers);
            }
            deleteSelectedUsersBtn.disabled = true;
        }

        const updateRoleForSelectedUsersBtn = document.getElementById('updateRoleForSelectedUsersBtn');
        if (updateRoleForSelectedUsersBtn) {
            if (typeof window.handleUpdateRoleForSelectedUsers === 'function') {
                updateRoleForSelectedUsersBtn.addEventListener('click', window.handleUpdateRoleForSelectedUsers);
            }
            updateRoleForSelectedUsersBtn.disabled = true;
        }
    }
}

// Export singleton instance
export const eventHandlerManager = new EventHandlerManager();
