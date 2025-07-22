/**
 * Modal Management Module
 * Handles all modal operations and their interactions
 */

export class ModalManager {
    constructor() {
        this.activeModals = new Set();
        this.modalData = new Map();
    }

    /**
    /**
     * Open Scan to Edit Modal
     */
    openScanToEditModal() {
        this.openModal('scanToEditProductModal', {
            focusElement: 'scanToEditProductIdInput',
            onClose: () => this.resetScanToEditForm()
        });
    }

    /**
     * Close Scan to Edit Modal
     */
    closeScanToEditModal() {
        this.closeModal('scanToEditProductModal');
    }

    /**
     * Initialize the modal manager
     */
    init() {
        this.setupKeyboardHandlers();
        this.setupOverlayHandlers();
    }

    /**
     * Setup global keyboard handlers for modals
     */
    setupKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModals.size > 0) {
                this.closeTopModal();
            }
        });
    }

    /**
     * Setup overlay click handlers
     */
    setupOverlayHandlers() {
        // This will be called for each modal individually
    }

    /**
     * Open modal with options
     */
    openModal(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal not found: ${modalId}`);
            return false;
        }

        // Store modal data
        this.modalData.set(modalId, options);
        this.activeModals.add(modalId);

        // Check if it's a dialog element or custom modal
        if (modal.tagName.toLowerCase() === 'dialog') {
            // Use showModal() for HTML dialog elements
            modal.showModal();
        } else {
            // Show custom modal
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        // Focus management
        if (options.focusElement) {
            const focusEl = document.getElementById(options.focusElement);
            if (focusEl) {
                setTimeout(() => focusEl.focus(), 100);
            }
        }

        // Prevent body scroll
        if (this.activeModals.size === 1) {
            document.body.style.overflow = 'hidden';
        }

        console.log(`Modal opened: ${modalId}`);
        return true;
    }

    /**
     * Close modal
     */
    closeModal(modalId, force = false) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal not found: ${modalId}`);
            return false;
        }

        // Check if modal can be closed
        const options = this.modalData.get(modalId) || {};
        if (!force && options.preventClose) {
            console.log(`Modal close prevented: ${modalId}`);
            return false;
        }

        // Check if it's a dialog element or custom modal
        if (modal.tagName.toLowerCase() === 'dialog') {
            // Use close() for HTML dialog elements
            modal.close();
        } else {
            // Hide custom modal
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }

        // Clean up
        this.activeModals.delete(modalId);
        this.modalData.delete(modalId);

        // Restore body scroll if no modals are open
        if (this.activeModals.size === 0) {
            document.body.style.overflow = '';
        }

        // Call cleanup function if provided
        if (options.onClose && typeof options.onClose === 'function') {
            options.onClose();
        }

        console.log(`Modal closed: ${modalId}`);
        return true;
    }

    /**
     * Close the topmost modal
     */
    closeTopModal() {
        if (this.activeModals.size === 0) return;

        const modals = Array.from(this.activeModals);
        const topModal = modals[modals.length - 1];
        this.closeModal(topModal);
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        const modals = Array.from(this.activeModals);
        modals.forEach(modalId => this.closeModal(modalId, true));
    }

    /**
     * Check if modal is open
     */
    isModalOpen(modalId) {
        return this.activeModals.has(modalId);
    }

    /**
     * Get modal data
     */
    getModalData(modalId) {
        return this.modalData.get(modalId) || {};
    }

    /**
     * Update modal data
     */
    updateModalData(modalId, data) {
        if (this.activeModals.has(modalId)) {
            const currentData = this.modalData.get(modalId) || {};
            this.modalData.set(modalId, { ...currentData, ...data });
        }
    }

    // ===== SPECIFIC MODAL HANDLERS =====

    /**
     * Open Add Product Modal
     */
    openAddProductModal() {
        this.openModal('addProductModal', {
            focusElement: 'modalProductName',
            onClose: () => this.resetAddProductForm()
        });
    }

    /**
     * Close Add Product Modal
     */
    closeAddProductModal() {
        this.closeModal('addProductModal');
    }

    /**
     * Reset Add Product Form
     */
    resetAddProductForm() {
        // Clear individual form fields since there's no form element
        const fields = [
            'modalProductId',
            'modalProductName',
            'modalProductQuantity',
            'modalProductCost',
            'modalProductMinQuantity',
            'modalProductReorderQuantity',
            'modalProductQuantityOrdered',
            'modalProductQuantityBackordered',
            'modalProductSupplier',
            'modalProductLocation'
        ];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = false;
                } else {
                    field.value = '';
                }
            }
        });

        const photoPreview = document.getElementById('modalProductPhotoPreview');
        if (photoPreview) {
            photoPreview.style.display = 'none';
            photoPreview.src = '';
        }

        // Reset any captured photo data
        if (typeof window.productManager !== 'undefined') {
            window.productManager.capturedPhoto = null;
        }
    }

    /**
     * Open Create Order Modal
     */
    /**
     * Open Create Order Modal
     * @param {string|null} currentSupplierId - The supplier to select by default
     */
    /**
     * Open Create Order Modal
     * Waits for suppliers and locations to be loaded before populating dropdowns
     * @param {string|null} currentSupplierId - The supplier to select by default
     * @param {string|null} productId - The product to pre-select
     * @param {number|string|null} quantity - The quantity to pre-fill
     * @returns {Promise<void>} Promise that resolves when modal is open and ready
     */
    async openCreateOrderModal(currentSupplierId = null, productId = null, quantity = null) {
        const modal = document.getElementById('createOrderModal');
        if (!modal) {
            console.error('Modal element #createOrderModal not found!');
            this.showAlertModal('Error', 'Order modal not found. Please check your HTML.');
            throw new Error('Modal not found');
        }

        await this.ensureSuppliersLoaded();
        // Note: ensureLocationsLoaded() commented out as modalOrderLocationId doesn't exist in current HTML
        // await this.ensureLocationsLoaded();

        this.openModal('createOrderModal', {
            focusElement: 'modalOrderProductId',
            onClose: () => this.resetCreateOrderForm()
        });

        this.populateOrderProductDropdown(productId);
        
        // Auto-select supplier if productId is provided and currentSupplierId is not specified
        let supplierToSelect = currentSupplierId;
        if (productId && !currentSupplierId && window.inventory) {
            const selectedProduct = window.inventory.find(item => item.id === productId);
            if (selectedProduct && selectedProduct.supplier) {
                supplierToSelect = selectedProduct.supplier;
                console.log(`[ModalManager] Auto-selecting supplier "${selectedProduct.supplier}" for product "${selectedProduct.name}"`);
            }
        }
        
        this.populateOrderSupplierDropdown(supplierToSelect);
        // Note: populateOrderLocationDropdown() commented out as modalOrderLocationId doesn't exist in current HTML
        // this.populateOrderLocationDropdown();

        // Pre-fill quantity if provided
        if (quantity !== null) {
            const quantityInput = document.getElementById('modalOrderQuantity');
            if (quantityInput) {
                quantityInput.value = quantity;
            }
        }

        const supplierSelect = document.getElementById('modalOrderSupplierId');
        if (supplierSelect && (!window.app?.suppliers || window.app.suppliers.length === 0)) {
            supplierSelect.innerHTML = '<option value="">No suppliers available</option>';
        }

        // Location dropdown check removed as the field doesn't exist in current modal
        // const locationSelect = document.getElementById('modalOrderLocationId');
        // if (locationSelect && (!window.app?.locations || window.app.locations.length === 0)) {
        //     locationSelect.innerHTML = '<option value="">No locations available</option>';
        // }

        // Return a resolved promise to indicate the modal is ready
        return Promise.resolve();
    }

    /**
     * Ensures suppliers are loaded before populating dropdowns
     */
    async ensureSuppliersLoaded() {
        // Check if app has already loaded suppliers
        if (window.app?.suppliers && window.app.suppliers.length > 0) {
            console.log('[DEBUG] Using existing suppliers from window.app:', window.app.suppliers.length);
            return;
        }

        // If app exists but hasn't loaded suppliers yet, use app's loadSuppliers method
        if (window.app && typeof window.app.loadSuppliers === 'function') {
            console.log('[DEBUG] Loading suppliers via app.loadSuppliers()...');
            await window.app.loadSuppliers();
            return;
        }

        // Fallback: load suppliers directly
        try {
            if (!window.db) {
                console.error('[DEBUG] Firebase database not initialized');
                window.app = window.app || {};
                window.app.suppliers = [];
                return;
            }

            const suppliersRef = window.db.collection('suppliers');
            console.log('[DEBUG] Querying suppliers collection in Firebase directly...');
            const snapshot = await suppliersRef.get();
            console.log(`[DEBUG] Suppliers query returned ${snapshot.size} documents.`);
            
            if (snapshot.empty) {
                console.warn('No suppliers found in the database.');
                window.app = window.app || {};
                window.app.suppliers = [];
            } else {
                const suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                window.app = window.app || {};
                window.app.suppliers = suppliers;
                console.log('[DEBUG] Suppliers loaded directly:', window.app.suppliers);
            }
        } catch (error) {
            console.error('Error loading suppliers:', error);
            window.app = window.app || {};
            window.app.suppliers = [];
        }
    }

    /**
     * Ensures locations are loaded before populating dropdowns
     */
    async ensureLocationsLoaded() {
        if (window.app?.locations && window.app.locations.length > 0) return;
        if (window.app?.loadLocations) {
            await window.app.loadLocations();
        }
    }

    /**
     * Populate order location dropdown
     */
    populateOrderLocationDropdown() {
        const select = document.getElementById('modalOrderLocationId');
        const locations = window.app?.locations || [];
        if (!select) return;

        select.innerHTML = '<option value="">Select Location</option>';
        if (locations.length === 0) {
            select.innerHTML = '<option value="">No locations available</option>';
            return;
        }
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.id;
            option.textContent = location.name;
            select.appendChild(option);
        });
    }
    /**
     * Populate order supplier dropdown
     * Populates #modalOrderSupplierId with all suppliers from window.app.suppliers
     * Optionally selects the current supplier if available
     */
    populateOrderSupplierDropdown(currentSupplierId = null) {
        const select = document.getElementById('modalOrderSupplierId');
        const suppliers = window.app?.suppliers || [];
        if (!select) return;

        select.innerHTML = '<option value="">Select Supplier</option>';
        if (suppliers.length === 0) {
            select.innerHTML = '<option value="">No suppliers available</option>';
            return;
        }
        suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = supplier.name;
            if (currentSupplierId && supplier.id === currentSupplierId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    /**
     * Close Create Order Modal
     */
    closeCreateOrderModal() {
        this.closeModal('createOrderModal');
    }

    /**
     * Reset Create Order Form
     */
    resetCreateOrderForm() {
        // Clear individual form fields since there's no form element
        const fields = [
            'modalOrderProductId',
            'modalOrderSupplierId',
            'modalOrderQuantity',
            'modalOrderCost',
            'modalOrderSupplier',
            'modalOrderNotes'
        ];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
            }
        });
    }

    /**
     * Populate order product dropdown (enhanced with low stock priority)
     * @param {string|null} selectedProductId - Product ID to pre-select
     */
    populateOrderProductDropdown(selectedProductId = null) {
        const select = document.getElementById('modalOrderProductId');
        if (!select || !window.inventory) return;

        console.log('[ModalManager] Populating order product dropdown with enhanced structure');

        select.innerHTML = '<option value="">Select a product...</option>';

        // Get low stock items first (priority)
        const lowStockItems = window.inventory.filter(item => {
            const quantity = item.quantity || 0;
            const minQuantity = item.minQuantity || 0;
            return quantity <= minQuantity && minQuantity > 0;
        });

        // Get regular items (not low stock)
        const regularItems = window.inventory.filter(item => {
            const quantity = item.quantity || 0;
            const minQuantity = item.minQuantity || 0;
            return !(quantity <= minQuantity && minQuantity > 0);
        });

        // Add low stock items first (if any)
        if (lowStockItems.length > 0) {
            const lowStockOptgroup = document.createElement('optgroup');
            lowStockOptgroup.label = '🔴 Low Stock Items (Recommended)';
            lowStockItems.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.name} (Stock: ${item.quantity || 0})`;
                if (selectedProductId && item.id === selectedProductId) {
                    option.selected = true;
                }
                lowStockOptgroup.appendChild(option);
            });
            select.appendChild(lowStockOptgroup);
        }

        // Add regular items
        if (regularItems.length > 0) {
            const regularOptgroup = document.createElement('optgroup');
            regularOptgroup.label = '📦 All Other Items';
            regularItems.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.name} (Stock: ${item.quantity || 0})`;
                if (selectedProductId && item.id === selectedProductId) {
                    option.selected = true;
                }
                regularOptgroup.appendChild(option);
            });
            select.appendChild(regularOptgroup);
        }

        console.log(`[ModalManager] Populated dropdown - ${lowStockItems.length} low stock, ${regularItems.length} regular items`);
        
        // If a product was selected, trigger change event to update any dependent fields
        if (selectedProductId) {
            const changeEvent = new Event('change', { bubbles: true });
            select.dispatchEvent(changeEvent);
        }
    }

    /**
     * Open Scan to Edit Modal
     */
    openScanToEditModal() {
        this.openModal('scanToEditProductModal', {
            focusElement: 'scanToEditProductIdInput',
            onClose: () => this.resetScanToEditForm()
        });
    }

    /**
     * Close Scan to Edit Modal
     */
    closeScanToEditModal() {
        this.closeModal('scanToEditProductModal');
    }

    /**
     * Reset Scan to Edit Form
     */
    resetScanToEditForm() {
        // Clear the product ID input
        const productIdInput = document.getElementById('scanToEditProductIdInput');
        if (productIdInput) {
            productIdInput.value = '';
        }

        // Show the ID input view and hide the form view
        const idInputView = document.getElementById('scanToEditIdInputView');
        if (idInputView) {
            idInputView.classList.remove('hidden');
        }

        const formView = document.getElementById('scanToEditFormView');
        if (formView) {
            formView.classList.add('hidden');
        }

        // Clear status message
        const statusMessage = document.getElementById('scanToEditStatusMessage');
        if (statusMessage) {
            statusMessage.textContent = '';
            statusMessage.className = 'text-sm text-center min-h-[20px]';
        }

        // Reset modal title
        const modalTitle = document.getElementById('scanToEditModalTitle');
        if (modalTitle) {
            modalTitle.textContent = 'Scan or Enter Product ID to Edit';
        }

        // Clear any form fields if they exist
        const fields = [
            'scanToEdit_productId',
            'scanToEdit_productName',
            'scanToEdit_productQuantity',
            'scanToEdit_productCost',
            'scanToEdit_productMinQuantity',
            'scanToEdit_productReorderQuantity',
            'scanToEdit_productQuantityOrdered',
            'scanToEdit_productQuantityBackordered',
            'scanToEdit_productSupplier',
            'scanToEdit_productLocation'
        ];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
            }
        });

        const photoPreview = document.getElementById('scanToEdit_photoPreview');
        if (photoPreview) {
            photoPreview.style.display = 'none';
            photoPreview.src = '';
        }
    }

    /**
     * Open Move Product Modal
     */
    openMoveProductModal() {
        this.openModal('moveProductModal', {
            focusElement: 'moveProductModal_productIdInput',
            onClose: () => this.resetMoveProductForm()
        });
    }

    /**
     * Close Move Product Modal
     */
    closeMoveProductModal() {
        this.closeModal('moveProductModal');
    }

    /**
     * Reset Move Product Form
     */
    resetMoveProductForm() {
        const form = document.getElementById('moveProductForm');
        if (form) {
            form.reset();
        }

        const productDetails = document.getElementById('moveProductModal_productDetails');
        if (productDetails) {
            productDetails.classList.add('hidden');
        }
    }

    /**
     * Open Update Stock Modal
     */
    openUpdateStockModal() {
        this.openModal('updateStockModal', {
            focusElement: 'updateStockProductIdInput',
            onClose: () => this.resetUpdateStockForm()
        });
    }

    /**
     * Close Update Stock Modal
     */
    closeUpdateStockModal() {
        this.closeModal('updateStockModal');
    }

    /**
     * Reset Update Stock Form
     */
    resetUpdateStockForm() {
        const input = document.getElementById('updateStockProductIdInput');
        if (input) {
            input.value = '';
        }

        const status = document.getElementById('updateStockModalStatus');
        if (status) {
            status.textContent = 'Ready to scan or enter Product ID';
            status.className = 'text-sm text-base-content';
        }

        const productInfo = document.getElementById('updateStockModalProductInfo');
        if (productInfo) {
            productInfo.classList.add('hidden');
        }
    }

    /**
     * Open Image Modal
     */
    openImageModal(imageUrl) {
        const modal = document.getElementById('imageModal');
        const image = document.getElementById('modalImage');
        
        if (modal && image && imageUrl) {
            image.src = imageUrl;
            this.openModal('imageModal');
        }
    }

    /**
     * Close Image Modal
     */
    closeImageModal() {
        this.closeModal('imageModal');
        
        const image = document.getElementById('modalImage');
        if (image) {
            image.src = '';
        }
    }

    /**
     * Open Mini Status Update Modal
     */
    openMiniStatusModal(orderId, orderData) {
        window.currentMiniModalOrderId = orderId;
        
        // Populate modal with order data
        const orderIdSpan = document.getElementById('miniModalDisplayOrderId');
        const productNameSpan = document.getElementById('miniModalProductName');
        const quantityInput = document.getElementById('miniModalEditableQuantity');
        const statusSelect = document.getElementById('miniModalOrderStatusSelect');
        const quantityGroup = document.getElementById('miniModalQuantityReceivedGroup');

        // Display full order ID instead of shortened version
        if (orderIdSpan) orderIdSpan.textContent = orderId;
        if (productNameSpan) productNameSpan.textContent = orderData.productName || 'Unknown Product';
        
        // Populate editable quantity field
        if (quantityInput) {
            quantityInput.value = orderData.quantity || 1;
        }
        
        // Auto-populate status field with current order status
        if (statusSelect) {
            const currentStatus = orderData.status || 'pending';
            statusSelect.value = currentStatus;
        }
        
        if (quantityGroup) quantityGroup.classList.add('hidden');

        this.openModal('miniStatusUpdateModal', {
            focusElement: 'miniModalOrderStatusSelect'
        });
    }

    /**
     * Close Mini Status Update Modal
     */
    closeMiniStatusModal() {
        this.closeModal('miniStatusUpdateModal');
        window.currentMiniModalOrderId = null;
    }

    /**
     * Show confirmation modal
     */
    showConfirmationModal(title, message, onConfirm, onCancel = null) {
        const modal = document.getElementById('confirmationModal');
        const titleEl = document.getElementById('confirmationModalTitle');
        const messageEl = document.getElementById('confirmationModalMessage');
        const confirmBtn = document.getElementById('confirmationModalConfirmBtn');
        const cancelBtn = document.getElementById('confirmationModalCancelBtn');

        if (!modal) {
            // Create dynamic confirmation modal if it doesn't exist
            return this.createDynamicConfirmationModal(title, message, onConfirm, onCancel);
        }

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;

        // Remove previous event listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        // Add new event listeners
        newConfirmBtn.addEventListener('click', () => {
            this.closeModal('confirmationModal');
            if (onConfirm) onConfirm();
        });

        newCancelBtn.addEventListener('click', () => {
            this.closeModal('confirmationModal');
            if (onCancel) onCancel();
        });

        this.openModal('confirmationModal', {
            focusElement: 'confirmationModalConfirmBtn'
        });
    }

    /**
     * Create dynamic confirmation modal
     */
    createDynamicConfirmationModal(title, message, onConfirm, onCancel) {
        const confirmed = confirm(`${title}\n\n${message}`);
        if (confirmed && onConfirm) {
            onConfirm();
        } else if (!confirmed && onCancel) {
            onCancel();
        }
    }

    /**
     * Show alert modal
     */
    showAlertModal(title, message, type = 'info') {
        // Use toast notification if available, otherwise fallback to alert
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast(message, type);
        } else {
            alert(`${title}\n\n${message}`);
        }
    }

    /**
     * Handle form submission in modal
     */
    handleModalFormSubmit(modalId, formData, submitFunction) {
        const modal = this.getModalData(modalId);
        
        // Disable form during submission
        this.setModalLoading(modalId, true);

        // Call submit function
        if (typeof submitFunction === 'function') {
            Promise.resolve(submitFunction(formData))
                .then((result) => {
                    if (result !== false) {
                        this.closeModal(modalId);
                    }
                })
                .catch((error) => {
                    console.error('Modal form submission error:', error);
                    this.showAlertModal('Error', 'An error occurred while submitting the form.', 'error');
                })
                .finally(() => {
                    this.setModalLoading(modalId, false);
                });
        }
    }

    /**
     * Set modal loading state
     */
    setModalLoading(modalId, isLoading) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const submitBtns = modal.querySelectorAll('button[type="submit"], .modal-submit-btn');
        const inputs = modal.querySelectorAll('input, select, textarea');

        submitBtns.forEach(btn => {
            btn.disabled = isLoading;
            if (isLoading) {
                btn.classList.add('loading');
            } else {
                btn.classList.remove('loading');
            }
        });

        inputs.forEach(input => {
            input.disabled = isLoading;
        });
    }
}

// Export singleton instance
export const modalManager = new ModalManager();
