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
    openCreateOrderModal() {
        this.openModal('createOrderModal', {
            focusElement: 'modalOrderProductId',
            onClose: () => this.resetCreateOrderForm()
        });

        // Populate product dropdown
        this.populateOrderProductDropdown();
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
            'modalOrderQuantity',
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
     */
    populateOrderProductDropdown() {
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
                regularOptgroup.appendChild(option);
            });
            select.appendChild(regularOptgroup);
        }

        console.log(`[ModalManager] Populated dropdown - ${lowStockItems.length} low stock, ${regularItems.length} regular items`);
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
