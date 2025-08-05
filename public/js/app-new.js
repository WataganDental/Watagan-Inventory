// Mini Status Update Modal logic
document.addEventListener('DOMContentLoaded', function() {
    // Wire up Add Order button in orders section
    const addOrderBtn = document.getElementById('addOrderBtn');
    if (addOrderBtn) {
        addOrderBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            if (window.handleAddOrder) {
                await window.handleAddOrder();
            }
        });
    }
  const miniModal = document.getElementById('miniStatusUpdateModal');
  const closeBtn = document.getElementById('miniModalCloseBtn');
  const saveBtn = document.getElementById('miniModalSaveStatusBtn');
  const statusSelect = document.getElementById('miniModalOrderStatusSelect');
  const quantityReceivedInput = document.getElementById('miniModalQuantityReceived');

  // Open modal function (to be called from order actions)
  window.openMiniStatusUpdateModal = function(orderId, currentStatus) {
    document.getElementById('miniModalDisplayOrderId').textContent = orderId;
    statusSelect.value = currentStatus || 'pending';
    quantityReceivedInput.value = '';
    miniModal.classList.remove('hidden');
  };

  // Close modal function
  function closeMiniModal() {
    miniModal.classList.add('hidden');
  }
  closeBtn.addEventListener('click', closeMiniModal);

  // Save status function
  saveBtn.addEventListener('click', async function() {
    const orderId = document.getElementById('miniModalDisplayOrderId').textContent;
    const newStatus = statusSelect.value;
    const quantityReceived = quantityReceivedInput.value;
    // TODO: Replace with actual update logic (call Firebase or update locally)
    // Example:
    if (window.app && window.app.ordersManager && typeof window.app.ordersManager.updateOrderStatus === 'function') {
      try {
        await window.app.ordersManager.updateOrderStatus(orderId, newStatus, quantityReceived);
        window.app.showSuccess('Order status updated');
        closeMiniModal();
      } catch (err) {
        window.app.showError('Failed to update order status');
      }
    } else {
      closeMiniModal();
    }
  });
});
/**
 * Main Application Module
 * Coordinates all modules and handles application initialization
 */

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyC4I5X1Gca4VEvqRspnitNFSLu8C0jH7sQ",
  authDomain: "watagandental-inventory-e6e7b.firebaseapp.com",
  projectId: "watagandental-inventory-e6e7b",
  storageBucket: "watagandental-inventory-e6e7b.firebasestorage.app",
  messagingSenderId: "309417981178",
  appId: "1:309417981178:web:8fa5239801426e8b428543",
  measurementId: "G-PVQTBS5BSH"
};

// Import all modules
import { uiEnhancementManager } from './modules/ui-enhancements.js';
import { InventoryManager } from './modules/inventory.js';
import { eventHandlerManager } from './modules/event-handlers.js';
import { productManager } from './modules/product-manager.js';
import { inventoryDisplayManager } from './modules/inventory-display.js';
import { modalManager } from './modules/modal-manager.js';
import { ordersManager } from './modules/orders-manager.js';
import { ReportsManager } from './modules/reports-manager.js';
import BarcodeScannerModule from './modules/barcode-scanner.js';

/**
 * Main Application Class
 */
class WataganInventoryApp {
    constructor() {
        this.isInitialized = false;
        this.firebaseInitialized = false;
        this.currentUser = null;
        this.userRole = null;
        
        // Module instances
        this.eventHandlers = eventHandlerManager;
        this.productManager = productManager;
        this.inventoryDisplay = inventoryDisplayManager;
        this.modalManager = modalManager;
        this.ordersManager = ordersManager;
        this.reportsManager = new ReportsManager();
        this.barcodeScannerModule = new BarcodeScannerModule();
        
        // Global state
        this.inventory = [];
        this.suppliers = [];
        this.locations = [];
        this.currentPage = 1;
        this.totalFilteredItems = 0;
        this.ITEMS_PER_PAGE = 50;
        
        // Theme constants
        this.LIGHT_THEME_NAME = 'cupcake';
        this.DARK_THEME_NAME = 'dark';
        this.SIDEBAR_STATE_KEY = 'sidebar-minimized';
        
        // Auto-refresh settings (now using real-time listeners)
        this.autoRefreshInterval = null;
        this.AUTO_REFRESH_INTERVAL_MS = 300000; // 5 minutes (fallback only)
        this.autoRefreshEnabled = true;
        this.lastUserActivity = Date.now();
        
        // Real-time listeners
        this.ordersListener = null;
        this.inventoryListener = null;
        this.realtimeListenersEnabled = true;
        
        // Make accessible globally for compatibility
        this.exposeGlobally();
    }

    /**
     * Expose app instance and key functions globally for backward compatibility
     */
    exposeGlobally() {
        window.app = this;
        window.inventory = this.inventory;
        window.currentPage = this.currentPage;
        window.totalFilteredItems = this.totalFilteredItems;
        window.ITEMS_PER_PAGE = this.ITEMS_PER_PAGE;
        window.LIGHT_THEME_NAME = this.LIGHT_THEME_NAME;
        window.DARK_THEME_NAME = this.DARK_THEME_NAME;
        window.SIDEBAR_STATE_KEY = this.SIDEBAR_STATE_KEY;
        
        // Expose manager instances
        window.productManager = this.productManager;
        window.inventoryDisplayManager = this.inventoryDisplay;
        window.modalManager = this.modalManager;
        window.ordersManager = this.ordersManager;
        
        // Expose key functions
        window.showView = this.showView.bind(this);
        window.toggleSidebar = this.toggleSidebar.bind(this);
        window.displayInventory = this.displayInventory.bind(this);
        window.loadInventory = this.loadInventory.bind(this);
        window.submitProduct = this.submitProduct.bind(this);
        window.resetProductForm = this.resetProductForm.bind(this);
        
        // Additional functions for compatibility
        window.displaySuppliersAndLocations = this.displaySuppliersAndLocations.bind(this);
        window.initializeReports = this.initializeReports.bind(this);
        window.loadUserManagement = this.loadUserManagement.bind(this);
        window.populateTrendProductSelect = this.populateTrendProductSelect.bind(this);
        window.displayUserRoleManagement = this.displayUserRoleManagement.bind(this);
        window.handleSaveUserRole = this.handleSaveUserRole.bind(this);
        window.updateSelectedUsers = this.updateSelectedUsers.bind(this);
        window.updateDashboard = this.updateDashboard.bind(this);
        window.updateInventoryStats = this.updateInventoryStats.bind(this);
        window.updateOrderStats = this.updateOrderStats.bind(this);
        window.displayPendingOrdersOnDashboard = this.displayPendingOrdersOnDashboard.bind(this);
        window.updateLowStockAlerts = this.updateLowStockAlerts.bind(this);
        window.updateRecentActivity = this.updateRecentActivity.bind(this);
        window.viewQRCode = this.viewQRCode.bind(this);
        
        // Auto-refresh control functions
        window.toggleAutoRefresh = this.toggleAutoRefresh.bind(this);
        window.stopAutoRefresh = this.stopAutoRefresh.bind(this);
        window.startAutoRefresh = this.startAutoRefresh.bind(this);
        
        // Real-time listeners control functions
        window.startRealtimeListeners = this.startRealtimeListeners.bind(this);
        window.stopRealtimeListeners = this.stopRealtimeListeners.bind(this);
        window.toggleRealtimeListeners = this.toggleRealtimeListeners.bind(this);
        
        // Suppliers and locations management functions
        window.addSupplier = this.addSupplier.bind(this);
        window.addLocation = this.addLocation.bind(this);
        window.deleteSupplier = this.deleteSupplier.bind(this);
        window.deleteLocation = this.deleteLocation.bind(this);
        
        // Authentication functions
        window.applyDarkMode = this.applyDarkMode.bind(this);
        window.removeDarkMode = this.removeDarkMode.bind(this);
        
        // Utility functions
        window.debounce = function(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };
        window.logActivity = this.logActivity.bind(this);
        
        // Additional global utility functions for compatibility
        window.generateUUID = function() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        window.minimizeSidebar = function() {
            if (window.app) {
                window.app.minimizeSidebar();
            }
        };

        window.maximizeSidebar = function() {
            if (window.app) {
                window.app.maximizeSidebar();
            }
        };

        // Compatibility aliases for renamed functions
        window.updateInventoryDashboard = function() {
            if (window.app) {
                window.app.updateInventoryStats();
                window.app.updateLowStockAlerts();
            }
        };

        window.updateEnhancedDashboard = function() {
            if (window.app) {
                window.app.updateDashboard();
            }
        };

        // Photo capture functions
        window.startPhotoCapture = function() {
            console.log('startPhotoCapture called');
            if (window.app && window.app.productManager) {
                window.app.productManager.startPhotoCapture();
            }
        };

        // Modal photo capture functions
        window.startModalPhotoCapture = function() {
            // Modal-specific camera logic
            const video = document.getElementById('modalPhotoVideo');
            const canvas = document.getElementById('modalPhotoCanvas');
            const captureBtn = document.getElementById('modalCapturePhotoBtn');
            const takePhotoBtn = document.getElementById('modalTakePhotoBtn');
            const cancelPhotoBtn = document.getElementById('modalCancelPhotoBtn');
            const preview = document.getElementById('modalProductPhotoPreview');
            if (!video || !canvas || !captureBtn || !takePhotoBtn || !cancelPhotoBtn || !preview) {
                console.warn('Modal camera elements not found:', {
                    video: !!video,
                    canvas: !!canvas,
                    captureBtn: !!captureBtn,
                    takePhotoBtn: !!takePhotoBtn,
                    cancelPhotoBtn: !!cancelPhotoBtn,
                    preview: !!preview
                });
                return;
            }
            // Show video, hide preview
            video.classList.remove('hidden');
            preview.classList.add('hidden');
            // Start camera (prefer back camera)
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .catch(() => {
                    // Fallback to front camera if back camera is not available
                    return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                })
                .catch(() => {
                    // Final fallback to any available camera
                    return navigator.mediaDevices.getUserMedia({ video: true });
                })
                .then(stream => {
                video.srcObject = stream;
                video.play();
                // Wire up take photo
                takePhotoBtn.onclick = function() {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    canvas.getContext('2d').drawImage(video, 0, 0);
                    const dataUrl = canvas.toDataURL('image/png');
                    preview.src = dataUrl;
                    preview.classList.remove('hidden');
                    video.classList.add('hidden');
                    // Stop camera
                    stream.getTracks().forEach(track => track.stop());
                };
                // Cancel photo
                cancelPhotoBtn.onclick = function() {
                    preview.classList.add('hidden');
                    video.classList.remove('hidden');
                    preview.src = '';
                    // Stop camera
                    stream.getTracks().forEach(track => track.stop());
                };
            }).catch(err => {
                alert('Camera not available: ' + err.message);
            });
        };

        window.takeModalPhoto = function() {
            console.log('takeModalPhoto called');
            if (window.app && window.app.productManager) {
                window.app.productManager.takeModalPhoto();
            }
        };

        window.cancelModalPhoto = function() {
            console.log('cancelModalPhoto called');
            if (window.app && window.app.productManager) {
                window.app.productManager.cancelModalPhoto();
            }
        };

        window.startScanToEditModalPhotoCapture = function() {
            console.log('startScanToEditModalPhotoCapture called');
            if (window.app && window.app.productManager) {
                window.app.productManager.startPhotoCapture('scanToEditPhotoVideo', 'scanToEditPhotoCanvas');
            }
        };

        window.takePhoto = function() {
            console.log('takePhoto called');
            if (window.app && window.app.productManager) {
                window.app.productManager.takePhoto();
            }
        };

        window.cancelPhoto = function() {
            console.log('cancelPhoto called');
            if (window.app && window.app.productManager) {
                window.app.productManager.cancelPhoto();
            }
        };

        window.uploadPhoto = function(id, photoData) {
            console.log('uploadPhoto called', id);
            if (window.app && window.app.productManager) {
                return window.app.productManager.uploadPhoto(id, photoData);
            }
        };
        // Debugging: Add console logs to modal-opening functions
        window.openCreateOrderModalWithProduct = function(productId, quantity) {
            console.log('[DEBUG] openCreateOrderModalWithProduct called', { productId, quantity });
            const modal = document.getElementById('createOrderModal');
            if (!modal) {
                console.error("Create Order Modal element not found.");
                return;
            }
            const productDropdown = document.getElementById('modalOrderProductId');
            productDropdown.innerHTML = '<option value="">Select Product</option>';
            document.getElementById('modalOrderQuantity').value = quantity || '';
            document.getElementById('modalOrderSupplierInfo').classList.add('hidden');
            document.getElementById('modalOrderSelectedProductSupplier').textContent = 'N/A';
            if (window.inventory && window.inventory.length > 0) {
                window.inventory.sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id)).forEach(product => {
                    const option = document.createElement('option');
                    option.value = product.id;
                    option.textContent = `${product.name} (Stock: ${product.quantity}, Min: ${product.minQuantity})`;
                    option.dataset.supplier = product.supplier || 'N/A';
                    if (product.id === productId) option.selected = true;
                    productDropdown.appendChild(option);
                });
            } else {
                productDropdown.innerHTML = '<option value="">No products available</option>';
            }
            const selectedOption = productDropdown.options[productDropdown.selectedIndex];
            const supplier = selectedOption ? selectedOption.dataset.supplier : null;
            if (supplier && supplier !== 'N/A') {
                document.getElementById('modalOrderSelectedProductSupplier').textContent = supplier;
                document.getElementById('modalOrderSupplierInfo').classList.remove('hidden');
            } else {
                document.getElementById('modalOrderSupplierInfo').classList.add('hidden');
            }
            
            // Remove any previous modal hiding classes
            modal.classList.remove('hidden');
            modal.classList.remove('invisible');
            modal.classList.add('flex');
            
            // Show the modal using the dialog API
            if (typeof modal.showModal === 'function') {
                try {
                    modal.showModal();
                } catch (e) {
                    console.warn('Modal already open:', e);
                }
            }
            
            productDropdown.focus();
        };

        window.openEditProductModalWithProduct = async function(productId) {
            console.log('[DEBUG] openEditProductModalWithProduct called', { productId });
            const modal = document.getElementById('scanToEditProductModal');
            if (!modal) {
                console.error("Scan to Edit Product Modal element not found.");
                return;
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            const productIdInput = document.getElementById('scanToEditProductIdInput');
            if (productIdInput) {
                productIdInput.value = productId;
                if (typeof window.handleScanToEditProductIdSubmit === 'function') {
                    await window.handleScanToEditProductIdSubmit();
                } else {
                    console.error("handleScanToEditProductIdSubmit function not found.");
                }
            } else {
                console.error("Could not find Product ID input in Scan-to-Edit modal to auto-load product.");
            }
        };

        window.openMoveProductModalWithProduct = async function(productId) {
            console.log('[DEBUG] openMoveProductModalWithProduct called', { productId });
            const modal = document.getElementById('moveProductModal');
            if (!modal) {
                console.error("Move Product Modal element not found.");
                return;
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            const productIdInput = document.getElementById('moveProductModal_productIdInput');
            if (productIdInput) {
                productIdInput.value = productId;
                if (typeof window.handleMoveProductModalIdSubmit === 'function') {
                    await window.handleMoveProductModalIdSubmit();
                } else {
                    console.error("handleMoveProductModalIdSubmit function not found.");
                }
            } else {
                console.error("Could not find Product ID input in Move Product modal to auto-load product.");
            }
        };
        // Expose modal-opening functions for low stock table actions
        window.openCreateOrderModalWithProduct = function(productId, quantity) {
            console.log('[DEBUG] openCreateOrderModalWithProduct called (v2)', { productId, quantity });
            // Open the Create Order modal and pre-select product and quantity
            const modal = document.getElementById('createOrderModal');
            if (!modal) {
                console.error("Create Order Modal element not found.");
                return;
            }
            // Reset form fields
            const productDropdown = document.getElementById('modalOrderProductId');
            productDropdown.innerHTML = '<option value="">Select Product</option>';
            document.getElementById('modalOrderQuantity').value = quantity || '';

            // Populate product dropdown and select the product
            let selectedProduct = null;
            if (window.inventory && window.inventory.length > 0) {
                window.inventory.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product.id;
                    option.textContent = `${product.name} (Stock: ${product.quantity}, Min: ${product.minQuantity})`;
                    option.dataset.supplier = product.supplier || '';
                    if (product.id === productId) {
                        option.selected = true;
                        selectedProduct = product;
                    }
                    productDropdown.appendChild(option);
                });
            } else {
                productDropdown.innerHTML = '<option value="">No products available</option>';
            }

            // Populate supplier dropdown and set default to product's supplier
            const supplierDropdown = document.getElementById('modalOrderSupplierId');
            supplierDropdown.innerHTML = '<option value="">Select Supplier</option>';
            const suppliers = window.app?.suppliers || window.suppliers || [];
            suppliers.forEach(supplier => {
                const option = document.createElement('option');
                option.value = supplier.id || supplier.name;
                option.textContent = supplier.name;
                if (selectedProduct && selectedProduct.supplier && (selectedProduct.supplier === supplier.name || selectedProduct.supplier === supplier.id)) {
                    option.selected = true;
                }
                supplierDropdown.appendChild(option);
            });

            // Remove any previous modal hiding classes
            modal.classList.remove('hidden');
            modal.classList.remove('invisible');
            modal.classList.add('flex');
            
            // Show the modal using the dialog API
            if (typeof modal.showModal === 'function') {
                try {
                    modal.showModal();
                } catch (e) {
                    console.warn('Modal already open:', e);
                }
            }
            
            productDropdown.focus();
        };

        window.openEditProductModalWithProduct = async function(productId) {
            // Open Scan to Edit modal and auto-load product
            const modal = document.getElementById('scanToEditProductModal');
            if (!modal) {
                console.error("Scan to Edit Product Modal element not found.");
                return;
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            const productIdInput = document.getElementById('scanToEditProductIdInput');
            if (productIdInput) {
                productIdInput.value = productId;
                if (typeof window.handleScanToEditProductIdSubmit === 'function') {
                    await window.handleScanToEditProductIdSubmit();
                } else {
                    console.error("handleScanToEditProductIdSubmit function not found.");
                }
            } else {
                console.error("Could not find Product ID input in Scan-to-Edit modal to auto-load product.");
            }
        };

        window.openMoveProductModalWithProduct = async function(productId) {
            // Open Move Product modal and auto-load product
            const modal = document.getElementById('moveProductModal');
            if (!modal) {
                console.error("Move Product Modal element not found.");
                return;
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            const productIdInput = document.getElementById('moveProductModal_productIdInput');
            if (productIdInput) {
                productIdInput.value = productId;
                if (typeof window.handleMoveProductModalIdSubmit === 'function') {
                    await window.handleMoveProductModalIdSubmit();
                } else {
                    console.error("handleMoveProductModalIdSubmit function not found.");
                }
            } else {
                console.error("Could not find Product ID input in Move Product modal to auto-load product.");
            }
        };

        // Batch operations functions
        window.addBatchEntry = function() {
            console.log('addBatchEntry called');
            if (window.app && window.app.batchManager) {
                window.app.batchManager.addBatchEntry();
            } else {
                // Simple implementation for now
                const container = document.getElementById('batchEntriesContainer');
                if (container) {
                    const entryId = 'batch-' + Date.now();
                    const entryHtml = `
                        <div id="${entryId}" class="flex gap-2 items-center p-2 border rounded">
                            <input type="text" placeholder="Product ID" class="input input-sm flex-1">
                            <input type="number" placeholder="Qty Change" class="input input-sm w-20">
                            <button onclick="removeBatchEntry('${entryId}')" class="btn btn-sm btn-error">Remove</button>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', entryHtml);
                }
            }
        };

        window.removeBatchEntry = function(entryId) {
            console.log('removeBatchEntry called', entryId);
            const entry = document.getElementById(entryId);
            if (entry) {
                entry.remove();
            }
        };

        window.submitBatchUpdates = function() {
            console.log('submitBatchUpdates called');
            // Simple implementation - would need full database integration
            const container = document.getElementById('batchEntriesContainer');
            if (container) {
                const entries = container.querySelectorAll('div[id^="batch-"]');
                if (entries.length === 0) {
                    alert('No batch entries to submit');
                    return;
                }
                
                const updates = [];
                entries.forEach(entry => {
                    const productId = entry.querySelector('input[placeholder="Product ID"]').value;
                    const qtyChange = entry.querySelector('input[placeholder="Qty Change"]').value;
                    if (productId && qtyChange) {
                        updates.push({ productId, qtyChange: parseInt(qtyChange) });
                    }
                });
                
                console.log('Batch updates to process:', updates);
                // Here you would typically update the database
                alert(`Would process ${updates.length} batch updates`);
                container.innerHTML = ''; // Clear entries after submission
            }
        };

        // PDF generation functions
        window.generateFastOrderReportPDF = function() {
            console.log('generateFastOrderReportPDF called');
            if (window.app && window.app.reportsManager) {
                window.app.reportsManager.generateFastOrderReportPDF();
            }
        };

        window.generateOrderReportPDFWithQRCodes = function() {
            console.log('generateOrderReportPDFWithQRCodes called');
            if (window.app && window.app.reportsManager) {
                window.app.reportsManager.generateOrderReportPDFWithQRCodes();
            }
        };

        window.generateAllQRCodesPDF = function() {
            console.log('generateAllQRCodesPDF called');
            if (window.app && window.app.reportsManager) {
                window.app.reportsManager.generateAllQRCodesPDF();
            }
        };

        window.generateProductUsageChart = function(productId) {
            console.log('generateProductUsageChart called', productId);
            if (window.app && window.app.reportsManager) {
                window.app.reportsManager.generateProductUsageChart(productId);
            }
        };

        // Scanner functions
        window.startEditScanner = function() {
            console.log('startEditScanner called');
            // Simple implementation - would integrate with barcode scanner library
            const input = document.getElementById('scanToEditProductIdInput') || document.getElementById('productIdScanInput');
            if (input) {
                input.focus();
                input.placeholder = 'Scanner active - scan barcode or type ID...';
                if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                    window.uiEnhancementManager.showToast('Scanner started - scan barcode or type ID', 'info');
                }
            }
        };

        window.stopEditScanner = function() {
            console.log('stopEditScanner called');
            const input = document.getElementById('scanToEditProductIdInput') || document.getElementById('productIdScanInput');
            if (input) {
                input.placeholder = 'Enter Product ID';
                if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                    window.uiEnhancementManager.showToast('Scanner stopped', 'info');
                }
            }
        };

        window.startUpdateScanner = function() {
            console.log('startUpdateScanner called');
            const input = document.getElementById('updateStockProductIdInput');
            if (input) {
                input.focus();
                input.placeholder = 'Scanner active - scan barcode...';
                if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                    window.uiEnhancementManager.showToast('Update scanner started', 'info');
                }
            }
        };

        window.stopUpdateScanner = function() {
            console.log('stopUpdateScanner called');
            const input = document.getElementById('updateStockProductIdInput');
            if (input) {
                input.placeholder = 'Waiting for barcode scan or manual entry...';
                if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                    window.uiEnhancementManager.showToast('Update scanner stopped', 'info');
                }
            }
        };

        window.startMoveScanner = function() {
            console.log('startMoveScanner called');
            const input = document.getElementById('moveProductIdInput');
            if (input) {
                input.focus();
                input.placeholder = 'Scanner active - scan product to move...';
                if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                    window.uiEnhancementManager.showToast('Move scanner started', 'info');
                }
            }
        };

        window.stopMoveScanner = function() {
            console.log('stopMoveScanner called');
            const input = document.getElementById('moveProductIdInput');
            if (input) {
                input.placeholder = 'Enter Product ID to move';
                if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                    window.uiEnhancementManager.showToast('Move scanner stopped', 'info');
                }
            }
        };

        // Dashboard modal functions
        window.openAddProductModal = function() {
            if (window.app && window.app.modalManager) {
                window.app.modalManager.openAddProductModal();
            }
        };

        window.openCreateOrderModal = function() {
            if (window.app && window.app.modalManager) {
                window.app.modalManager.openCreateOrderModal();
            }
        };

        window.openScanToEditModal = function() {
            if (window.app && window.app.modalManager) {
                window.app.modalManager.openScanToEditModal();
            }
        };

        window.openMoveProductModal = function() {
            if (window.app && window.app.modalManager) {
                window.app.modalManager.openMoveProductModal();
            }
        };

        window.openUpdateStockModal = function() {
            // For quick stock update, show the dedicated view instead of modal
            if (window.app) {
                window.app.showView('quickStockUpdateContainer', 'menuQuickStockUpdate');
            }
        };

        // Modal close functions
        window.closeMoveProductModal = function() {
            if (window.app && window.app.modalManager) {
                window.app.modalManager.closeMoveProductModal();
            }
        };

        window.closeScanToEditModal = function() {
            if (window.app && window.app.modalManager) {
                window.app.modalManager.closeScanToEditModal();
            }
        };

        window.closeAddProductModal = function() {
            if (window.app && window.app.modalManager) {
                window.app.modalManager.closeAddProductModal();
            }
        };

        window.closeCreateOrderModal = function() {
            if (window.app && window.app.modalManager) {
                window.app.modalManager.closeCreateOrderModal();
            }
        };

        // Move Product Modal functions
        window.handleMoveProductModalIdSubmit = async function() {
            const productIdInput = document.getElementById('moveProductModal_productIdInput');
            const statusMessage = document.getElementById('moveProductModal_statusMessage');
            const productId = productIdInput.value.trim();

            if (!productId) {
                statusMessage.textContent = 'Please enter a Product ID.';
                statusMessage.className = 'text-sm text-center text-warning-content';
                return;
            }

            statusMessage.textContent = 'Searching for product...';
            statusMessage.className = 'text-sm text-center text-info-content';

            try {
                const productDoc = await window.db.collection('inventory').doc(productId).get();
                if (productDoc.exists) {
                    const product = productDoc.data();
                    
                    // Store the product ID in the hidden field for submitMoveProductFromModal
                    document.getElementById('moveProductModal_productId').value = productId;

                    document.getElementById('moveProductModal_productName').textContent = product.name || 'N/A';
                    document.getElementById('moveProductModal_currentLocation').textContent = product.location || 'N/A';

                    const locationDropdown = document.getElementById('moveProductModal_newLocation');
                    locationDropdown.innerHTML = '<option value="">Select New Location</option>';
                    if (window.app && window.app.locations) {
                        window.app.locations.forEach(loc => {
                            if (loc.name !== product.location) { // Don't list current location as an option
                                const option = document.createElement('option');
                                option.value = loc.name;
                                option.textContent = loc.name;
                                locationDropdown.appendChild(option);
                            }
                        });
                    }
                    locationDropdown.value = ""; // Ensure no location is pre-selected

                    document.getElementById('moveProductIdInputView').classList.add('hidden');
                    document.getElementById('moveProductFormView').classList.remove('hidden');
                    document.getElementById('moveProductModalTitle').textContent = `Move: ${product.name}`;
                    statusMessage.textContent = ''; // Clear status message
                } else {
                    statusMessage.textContent = `Product ID "${productId}" not found.`;
                    statusMessage.className = 'text-sm text-center text-error-content';
                    document.getElementById('moveProductModal_productId').value = '';
                }
            } catch (error) {
                console.error("Error fetching product for move:", error);
                statusMessage.textContent = 'Error fetching product. Please try again.';
                statusMessage.className = 'text-sm text-center text-error-content';
                document.getElementById('moveProductModal_productId').value = '';
            }
        };

        // Order modal functions
        window.submitModalOrder = function() {
            console.log('submitModalOrder called');
            if (window.app && window.app.ordersManager) {
                window.app.ordersManager.submitModalOrder();
            }
        };

        // Order functions
        window.handleAddOrder = async function() {
            console.log('handleAddOrder called');
            if (window.app && window.app.ordersManager) {
                return await window.app.ordersManager.submitOrder();
            }
            console.error('Orders manager not available');
        };

        // Add event listeners to auto-fill cost fields and auto-select suppliers
        const fillCost = (selectId, costInputId) => {
            const select = document.getElementById(selectId);
            const costInput = document.getElementById(costInputId);
            if (select && costInput) {
                select.addEventListener('change', function() {
                    const product = window.app?.inventory?.find(p => p.id === select.value);
                    if (product && product.cost) {
                        costInput.value = product.cost;
                    } else {
                        costInput.value = '';
                    }
                    
                    // Auto-select supplier if available
                    let supplierDropdownId = '';
                    if (selectId === 'modalOrderProductId') {
                        supplierDropdownId = 'modalOrderSupplierId';
                    } else if (selectId === 'orderProductId') {
                        supplierDropdownId = 'orderSupplierId';
                    }
                    
                    if (supplierDropdownId && product && product.supplier) {
                        const supplierDropdown = document.getElementById(supplierDropdownId);
                        if (supplierDropdown) {
                            // Find supplier by name to get the ID
                            const supplier = window.app?.suppliers?.find(s => s.name === product.supplier);
                            if (supplier) {
                                supplierDropdown.value = supplier.id || supplier.name;
                            } else {
                                // If supplier not found in list, try setting by name
                                supplierDropdown.value = product.supplier;
                            }
                        }
                    }
                });
            }
        };
        fillCost('orderProductId', 'orderCost');
        fillCost('modalOrderProductId', 'modalOrderCost');
    }

    /**
     * Wait for Firebase to be available
     */
    async waitForFirebase() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait time
            
            const checkFirebase = () => {
                attempts++;
                
                if (typeof firebase !== 'undefined') {
                    console.log('[App] Firebase is available after', attempts, 'attempts');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Firebase not available after maximum wait time'));
                } else {
                    setTimeout(checkFirebase, 100);
                }
            };
            
            checkFirebase();
        });
    }

    /**
     * Initialize Firebase with performance optimizations
     */
    async initFirebase() {
        if (this.firebaseInitialized) {
            console.log('[App] Firebase already initialized');
            return;
        }

        try {
            console.log('[App] Waiting for Firebase to be available...');
            await this.waitForFirebase();
            
            console.log('[App] Initializing Firebase...');
            
            let app;
            if (firebase.apps.length === 0) {
                app = firebase.initializeApp(firebaseConfig);
                console.log('[App] Firebase initialized successfully:', app.name);
            } else {
                app = firebase.app();
                console.log('[App] Using existing Firebase app:', app.name);
            }
            
            // Initialize Firebase services
            window.db = firebase.firestore();
            window.storage = firebase.storage();
            window.auth = firebase.auth();
            
            // Initialize Firebase optimizer for cost reduction
            try {
                const { createFirebaseOptimizer } = await import('./modules/firebase-optimizer.js');
                this.firebaseOptimizer = createFirebaseOptimizer(window.db);
                console.log('[App] Firebase optimizer initialized');
            } catch (error) {
                console.warn('[App] Could not load Firebase optimizer:', error);
            }
            
            // Apply Firebase performance optimizations
            try {
                const { applyFirebaseOptimizations } = await import('./firebase-performance-config.js');
                this.firebaseConfig = applyFirebaseOptimizations();
                console.log('[App] Firebase performance optimizations applied');
            } catch (error) {
                console.warn('[App] Could not load Firebase performance config:', error);
            }

            // Initialize performance optimizer
            try {
                const { performanceOptimizer } = await import('./modules/performance-optimizer.js');
                this.performanceOptimizer = performanceOptimizer;
                console.log('[App] Performance optimizer initialized');
            } catch (error) {
                console.warn('[App] Could not load performance optimizer:', error);
            }
            
            // Initialize performance monitor
            try {
                const { performanceMonitor } = await import('./modules/performance-monitor.js');
                this.performanceMonitor = performanceMonitor;
                console.log('[App] Performance monitor initialized (Ctrl+Shift+P to toggle)');
            } catch (error) {
                console.warn('[App] Could not load performance monitor:', error);
            }
            
            // Initialize FirebaseUI for authentication
            if (typeof firebaseui !== 'undefined') {
                window.ui = new firebaseui.auth.AuthUI(window.auth);
            }
            
            console.log('[App] Firestore instance created:', !!window.db);
            console.log('[App] Storage instance created:', !!window.storage);
            console.log('[App] Auth instance created:', !!window.auth);
            console.log('[App] FirebaseUI instance created:', !!window.ui);
            
            this.firebaseInitialized = true;
            
        } catch (error) {
            console.error('[App] Firebase initialization error:', error);
            throw error;
        }
    }

    /**
     * Initialize the application
     */
    async init() {
        if (this.isInitialized) {
            console.warn('[App] Already initialized');
            return;
        }

        try {
            console.log('[App] Starting initialization...');
            
            // Initialize Firebase first
            await this.initFirebase();
            
            // Initialize theme
            this.initTheme();
            
            // Initialize modules
            this.modalManager.init();
            
            // Set up authentication state listener
            this.setupAuthStateListener();
            
            // Update copyright year
            this.updateCopyrightYear();
            
            // Initialize UI enhancements
            if (typeof initializeAllEnhancements === 'function') {
                setTimeout(() => {
                    initializeAllEnhancements();
                }, 500);
            }
            
            this.isInitialized = true;
            console.log('[App] Initialization complete');
            
            // Real-time listeners will start after successful authentication
            
        } catch (error) {
            console.error('[App] Initialization error:', error);
            this.showError('Application failed to initialize: ' + error.message);
        }
    }

    /**
     * Set up Firebase authentication state listener
     */
    setupAuthStateListener() {
        if (!window.auth) {
            console.error('[App] Auth not initialized');
            return;
        }

        window.auth.onAuthStateChanged(async (user) => {
            const logoutBtn = document.getElementById('logoutButton');
            const authContainer = document.getElementById('authContainer');
            const appNavbar = document.getElementById('appNavbar');
            const appMainContainer = document.getElementById('appMainContainer');
            const userProfileImage = document.getElementById('userProfileImage');

            if (user) {
                console.log('[App] Auth state changed: User is signed in', user.email || user.uid);
                
                // Update UI for authenticated user
                if (authContainer) authContainer.classList.add('hidden');
                if (appNavbar) appNavbar.classList.remove('hidden');
                if (appMainContainer) appMainContainer.classList.remove('hidden');
                if (logoutBtn) logoutBtn.classList.remove('hidden');

                // Set user profile image
                this.updateUserProfile(user, userProfileImage);

                try {
                    // Load application data after authentication
                    await this.loadInitialData();
                    
                    // Load user role
                    await this.loadUserRole(user);
                    
                    // Start real-time listeners after successful data load
                    this.startRealtimeListeners();
                    
                    // Show default view (dashboard)
                    this.showDefaultView();
                    
                    console.log('[App] Post-authentication setup complete');
                    
                } catch (error) {
                    console.error('[App] Error during post-login data loading:', error);
                    this.showError('Could not load application data: ' + error.message);
                }

            } else {
                // User is signed out
                console.log('[App] Auth state changed: User is signed out');
                if (appNavbar) appNavbar.classList.add('hidden');
                if (appMainContainer) appMainContainer.classList.add('hidden');
                if (logoutBtn) logoutBtn.classList.add('hidden');
                if (authContainer) authContainer.classList.remove('hidden');
                
                // Stop real-time listeners to prevent unnecessary Firebase usage
                this.stopRealtimeListeners();
                this.stopAutoRefresh();
                
                // Clear user data
                this.currentUser = null;
                this.userRole = null;
                this.inventory = [];
                this.suppliers = [];
                this.locations = [];
            }
        });

        // Set up FirebaseUI
        this.setupFirebaseUI();
    }

    /**
     * Set up FirebaseUI authentication interface
     */
    setupFirebaseUI() {
        if (!window.ui) {
            console.error('[App] FirebaseUI not initialized');
            return;
        }

        const uiConfig = {
            callbacks: {
                signInSuccessWithAuthResult: function(authResult, redirectUrl) {
                    console.log('[App] FirebaseUI: signInSuccessWithAuthResult', authResult);
                    return false; // Let onAuthStateChanged handle UI changes
                },
                uiShown: function() {
                    console.log('[App] FirebaseUI: uiShown');
                    const authErrorMessage = document.getElementById('authErrorMessage');
                    if (authErrorMessage) {
                        authErrorMessage.classList.add('hidden');
                    }
                },
                signInFailure: function(error) {
                    console.error('[App] FirebaseUI: signInFailure', error);
                    const authErrorMessage = document.getElementById('authErrorMessage');
                    if (authErrorMessage) {
                        authErrorMessage.textContent = `Login Error: ${error.message} (Code: ${error.code})`;
                        authErrorMessage.classList.remove('hidden');
                    }
                    return Promise.resolve();
                }
            },
            signInFlow: 'popup',
            signInSuccessUrl: null,
            signInOptions: [
                firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                firebase.auth.EmailAuthProvider.PROVIDER_ID
            ],
            tosUrl: '<your-tos-url>',
            privacyPolicyUrl: '<your-privacy-policy-url>'
        };

        // Start FirebaseUI
        const authContainer = document.getElementById('firebaseui-auth-container');
        if (authContainer) {
            window.ui.start('#firebaseui-auth-container', uiConfig);
            console.log('[App] FirebaseUI started');
        } else {
            console.error('[App] FirebaseUI auth container not found');
        }
    }

    /**
     * Update user profile display
     */
    updateUserProfile(user, userProfileImage) {
        this.currentUser = user;
        
        if (userProfileImage) {
            if (user.photoURL) {
                userProfileImage.src = user.photoURL;
                userProfileImage.alt = user.displayName || user.email || 'User profile';
                userProfileImage.classList.remove('hidden');
            } else {
                // Use default user icon SVG
                const defaultUserIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clip-rule="evenodd" /></svg>';
                userProfileImage.src = `data:image/svg+xml;base64,${btoa(defaultUserIconSvg)}`;
                userProfileImage.alt = user.displayName || user.email || 'User profile (default icon)';
                userProfileImage.classList.remove('hidden');
            }
        }
    }

    /**
     * Load user role from Firestore
     */
    async loadUserRole(user) {
        try {
            const userRoleRef = window.db.collection('user_roles').doc(user.uid);
            const docSnapshot = await userRoleRef.get();
            
            if (docSnapshot.exists) {
                this.userRole = docSnapshot.data().role;
                console.log('[App] User role loaded:', this.userRole);
            } else {
                this.userRole = 'staff'; // Default role
                console.log('[App] No specific role found for user, defaulting to:', this.userRole);
            }
            
            // Update UI based on user role
            this.updateUIForRole(this.userRole);
            
        } catch (error) {
            console.error('[App] Error loading user role:', error);
            this.userRole = 'staff'; // Fallback to staff role
            this.updateUIForRole(this.userRole);
        }
    }

    /**
     * Show default view after authentication
     */
    showDefaultView() {
        const menuDashboard = document.getElementById('menuDashboard');
        if (menuDashboard) {
            this.showView('dashboardViewContainer', 'menuDashboard');
        } else {
            console.warn('[App] Dashboard menu not found, falling back to inventory view');
            const menuInventory = document.getElementById('menuInventory');
            if (menuInventory) {
                this.showView('inventoryViewContainer', 'menuInventory');
            } else {
                console.error('[App] No default view menu items found');
            }
        }
    }

    /**
     * Update copyright year in footer
     */
    updateCopyrightYear() {
        const yearElement = document.getElementById('currentYear');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    }

    /**
     * Initialize theme based on stored preference
     */
    initTheme() {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            this.applyDarkMode();
        } else {
            this.removeDarkMode();
        }
    }

    /**
     * Load initial application data
     */
    async loadInitialData() {
        try {
            // Load inventory
            await this.loadInventory();
            
            // Load suppliers and locations
            await this.loadSuppliers();
            await this.loadLocations();
            
            // Load orders
            await this.ordersManager.loadOrders();
            
            // Update reports manager with data
            this.reportsManager.setData(this.inventory, this.ordersManager.orders, this.suppliers, this.locations);
            
            console.log('[App] Initial data loaded successfully');
            
        } catch (error) {
            console.error('[App] Error loading initial data:', error);
            throw error;
        }
    }

    /**
     * Load inventory data with optimized Firebase usage
     */
    async loadInventory() {
        try {
            if (!window.db) {
                throw new Error('Database not initialized');
            }

            console.log('[App] Loading inventory...');

            // Use Firebase optimizer for cost-effective loading
            if (this.firebaseOptimizer) {
                this.inventory = await this.firebaseOptimizer.getCollection('inventory', {
                    orderBy: [['name', 'asc']],
                    limit: 1000, // Increased to load all inventory items
                    cacheDuration: 300000, // 5 minutes
                    source: 'default' // Use cache first, then server
                });
                console.log(`[App] Loaded ${this.inventory.length} inventory items using optimizer`);
            } else if (this.performanceOptimizer) {
                // Fallback to performance optimizer
                this.inventory = await this.performanceOptimizer.loadDataWithCache('inventory', 'inventory_cache');
            } else {
                // Fallback to direct loading
                console.log('[App] Using direct Firebase query (no optimizer available)');
                const snapshot = await window.db.collection('inventory').get();
                this.inventory = [];
                this.inventory = [];
                
                snapshot.forEach(doc => {
                    this.inventory.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
            }

            // Update global reference and display manager
            window.inventory = this.inventory;
            this.inventoryDisplay.setInventory(this.inventory);

            console.log(`[App] Loaded ${this.inventory.length} inventory items`);
            
        } catch (error) {
            console.error('[App] Error loading inventory:', error);
            throw error;
        }
    }

    /**
     * Load suppliers data with optimized Firebase usage
     */
    async loadSuppliers() {
        try {
            if (!window.db) return [];

            console.log('[App] Loading suppliers...');

            // Use Firebase optimizer for cost-effective loading
            if (this.firebaseOptimizer) {
                this.suppliers = await this.firebaseOptimizer.getCollection('suppliers', {
                    orderBy: [['name', 'asc']],
                    limit: 100,
                    cacheDuration: 1800000, // 30 minutes (suppliers change rarely)
                    source: 'cache' // Prefer cache for suppliers
                });
                console.log(`[App] Loaded ${this.suppliers.length} suppliers using optimizer`);
            } else if (this.performanceOptimizer) {
                // Fallback to performance optimizer
                this.suppliers = await this.performanceOptimizer.loadDataWithCache('suppliers', 'suppliers_cache');
            } else {
                // Fallback to direct loading
                console.log('[App] Using direct Firebase query for suppliers (no optimizer available)');
                const snapshot = await window.db.collection('suppliers').get();
                this.suppliers = [];
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    this.suppliers.push({
                        id: doc.id,
                        name: data.name || doc.id, // Use data.name if available, otherwise use doc.id
                        ...data
                    });
                });
            }

            // Throttle dropdown population
            if (this.performanceOptimizer) {
                this.performanceOptimizer.throttledUpdate('supplier_dropdowns', () => {
                    this.populateSupplierDropdowns();
                }, 500);
            } else {
                this.populateSupplierDropdowns();
            }
            
            console.log(`[App] Loaded ${this.suppliers.length} suppliers`);
            
        } catch (error) {
            console.error('[App] Error loading suppliers:', error);
            return [];
        }
    }

    /**
     * Load locations data with caching optimization
     */
    async loadLocations() {
        try {
            if (!window.db) return [];

            // Use performance optimizer for cached loading if available
            if (this.performanceOptimizer) {
                this.locations = await this.performanceOptimizer.loadDataWithCache('locations', 'locations_cache');
            } else {
                // Fallback to direct loading
                const snapshot = await window.db.collection('locations').get();
                this.locations = [];
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    this.locations.push({
                        id: doc.id,
                        name: data.name || doc.id, // Use data.name if available, otherwise use doc.id
                        ...data
                    });
                });
            }

            // Throttle dropdown population
            if (this.performanceOptimizer) {
                this.performanceOptimizer.throttledUpdate('location_dropdowns', () => {
                    this.populateLocationDropdowns();
                }, 500);
            } else {
                this.populateLocationDropdowns();
            }
            
            console.log(`[App] Loaded ${this.locations.length} locations`);
            
        } catch (error) {
            console.error('[App] Error loading locations:', error);
            return [];
        }
    }

    /**
     * Populate supplier dropdown menus
     */
    populateSupplierDropdowns() {
        const dropdowns = [
            'productSupplier',
            'filterSupplier', 
            'filterOrderSupplierDropdown',
            'modalOrderSupplier',
            'modalOrderSupplierId',      // New modal supplier dropdown
            'orderSupplierId',           // New orders section supplier dropdown
            'qrOrderSupplierSelect'      // Added for Order QR Code Generation
        ];

        dropdowns.forEach(dropdownId => {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                // Save current value
                const currentValue = dropdown.value;
                
                // Clear and repopulate - different default option for different dropdowns
                if (dropdownId === 'qrOrderSupplierSelect' || dropdownId === 'filterSupplier' || dropdownId === 'filterOrderSupplierDropdown') {
                    dropdown.innerHTML = '<option value="">All Suppliers</option>';
                } else if (dropdownId === 'modalOrderSupplierId' || dropdownId === 'orderSupplierId') {
                    dropdown.innerHTML = '<option value="">Select Supplier</option>';
                } else {
                    dropdown.innerHTML = '<option value="">Select supplier...</option>';
                }
                
                this.suppliers.forEach(supplier => {
                    const option = document.createElement('option');
                    // Use supplier ID as value for the new order dropdowns to ensure we get the right reference
                    if (dropdownId === 'modalOrderSupplierId' || dropdownId === 'orderSupplierId') {
                        option.value = supplier.id || supplier.name;
                        option.textContent = supplier.name;
                    } else {
                        option.value = supplier.name;
                        option.textContent = supplier.name;
                    }
                    dropdown.appendChild(option);
                });
                
                // Restore value if it still exists
                if (currentValue) {
                    dropdown.value = currentValue;
                }
            }
        });
    }

    /**
     * Populate location dropdown menus
     */
    populateLocationDropdowns() {
        const dropdowns = [
            'productLocation',
            'filterLocation',
            'moveToLocation',
            'modalProductLocation',
            'qrLocationSelect' // Added for QR generation by location
        ];

        dropdowns.forEach(dropdownId => {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                // Save current value
                const currentValue = dropdown.value;
                
                // Clear and repopulate
                const defaultText = dropdownId === 'qrLocationSelect' ? 'All Locations' : 'Select location...';
                dropdown.innerHTML = `<option value="">${defaultText}</option>`;
                
                this.locations.forEach(location => {
                    const option = document.createElement('option');
                    option.value = location.name;
                    option.textContent = location.name;
                    dropdown.appendChild(option);
                });
                
                // Restore value if it still exists
                if (currentValue) {
                    dropdown.value = currentValue;
                }
            }
        });
    }

    /**
     * Populate order product dropdowns
     */
    populateOrderProductDropdowns() {
        console.log('[populateOrderProductDropdowns] Starting to populate dropdowns');
        const orderProductSelect = document.getElementById('orderProductId');
        const modalOrderProductSelect = document.getElementById('modalOrderProductId');
        
        console.log('[populateOrderProductDropdowns] Found elements:', {
            orderProductSelect: !!orderProductSelect,
            modalOrderProductSelect: !!modalOrderProductSelect,
            inventoryCount: this.inventory ? this.inventory.length : 0
        });
        
        // Clear existing options (except first)
        [orderProductSelect, modalOrderProductSelect].forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">Select Product</option>';
            }
        });
        
        // Calculate pending quantities for each product from orders
        const pendingQuantities = {};
        if (this.ordersManager && this.ordersManager.orders) {
            this.ordersManager.orders.forEach(order => {
                if (order.status === 'pending' && order.productId) {
                    pendingQuantities[order.productId] = (pendingQuantities[order.productId] || 0) + (parseInt(order.quantity) || 0);
                }
            });
        }
        
        // Get low stock items first (priority)
        const lowStockItems = this.inventory.filter(item => {
            const currentQuantity = parseInt(item.quantity) || 0;
            const quantityOrdered = pendingQuantities[item.id] || 0; // Use calculated pending quantities
            const minQuantity = parseInt(item.minQuantity) || 0;
            const totalAvailable = currentQuantity + quantityOrdered;
            
            // Show in low stock if: current quantity is low AND total available (including orders) is still below minimum
            return currentQuantity <= minQuantity && totalAvailable <= minQuantity && minQuantity > 0;
        }).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        
        // Get regular inventory items
        const regularItems = this.inventory.filter(item => {
            const currentQuantity = parseInt(item.quantity) || 0;
            const quantityOrdered = pendingQuantities[item.id] || 0; // Use calculated pending quantities
            const minQuantity = parseInt(item.minQuantity) || 0;
            const totalAvailable = currentQuantity + quantityOrdered;
            
            // Not in low stock if: current quantity is adequate OR total available exceeds minimum
            return !(currentQuantity <= minQuantity && totalAvailable <= minQuantity && minQuantity > 0);
        }).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        
        // Add low stock items first (with indicator)
        [orderProductSelect, modalOrderProductSelect].forEach(select => {
            if (select) {
                if (lowStockItems.length > 0) {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = '🔴 Low Stock Items (Recommended)';
                    lowStockItems.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.id;
                        option.textContent = `${item.name} (Stock: ${item.quantity || 0}/${item.minQuantity || 0})`;
                        optgroup.appendChild(option);
                    });
                    select.appendChild(optgroup);
                }
                
                // Add regular items
                if (regularItems.length > 0) {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = 'All Products';
                    regularItems.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.id;
                        option.textContent = `${item.name} (Stock: ${item.quantity || 0})`;
                        optgroup.appendChild(option);
                    });
                    select.appendChild(optgroup);
                }
            }
        });
        
        console.log(`[App] Populated order product dropdowns - ${lowStockItems.length} low stock, ${regularItems.length} regular items`);
    }

    /**
     * Show specific view and hide others
     */
    showView(viewId, activeMenuId = null) {
        try {
            // Hide all view containers
            const viewContainers = [
                'dashboardViewContainer',
                'inventoryViewContainer', 
                'suppliersAndLocationsContainer',
                'ordersSectionContainer',
                'reportsSectionContainer',
                'quickStockUpdateContainer',
                'userManagementViewContainer'
            ];

            viewContainers.forEach(containerId => {
                const container = document.getElementById(containerId);
                if (container) {
                    container.classList.add('hidden');
                }
            });

            // Show target view
            const targetView = document.getElementById(viewId);
            if (targetView) {
                targetView.classList.remove('hidden');
                
                // Update active menu item
                if (activeMenuId) {
                    this.updateActiveMenu(activeMenuId);
                }
                
                // Trigger view-specific actions
                this.handleViewChange(viewId);
                
                console.log(`[App] Switched to view: ${viewId}`);
            } else {
                console.error(`[App] View not found: ${viewId}`);
            }
            
        } catch (error) {
            console.error('[App] Error switching view:', error);
        }
    }

    /**
     * Update active menu item styling
     */
    updateActiveMenu(activeMenuId) {
        // Remove active class from all menu items
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to current menu item
        const activeMenuItem = document.getElementById(activeMenuId);
        if (activeMenuItem) {
            activeMenuItem.classList.add('active');
        }
    }

    /**
     * Handle view change events
     */
    handleViewChange(viewId) {
        switch (viewId) {
            case 'inventoryViewContainer':
                this.displayInventory();
                break;
            case 'dashboardViewContainer':
                this.updateDashboard();
                break;
            case 'ordersSectionContainer':
                // Display orders with smart default filter - check for pending orders first
                this.ordersManager.displayOrdersWithDefaultFilter();
                this.populateOrderProductDropdowns();
                this.updateLowStockAlerts();
                break;
            case 'suppliersAndLocationsContainer':
                this.displaySuppliersAndLocations();
                break;
            case 'reportsSectionContainer':
                this.initializeReports();
                break;
            case 'userManagementViewContainer':
                this.loadUserManagement();
                break;
            case 'quickStockUpdateContainer':
                // Initialize barcode scanner event listeners for Quick Stock Update
                if (this.barcodeScannerModule) {
                    this.barcodeScannerModule.initializeEventListeners();
                }
                
                // Set default tab to barcode scanner mode
                if (typeof window.switchQuickUpdateTab === 'function') {
                    window.switchQuickUpdateTab('barcodeScannerModeTab');
                }
                break;
        }
    }

    /**
     * Display inventory using the display manager
     */
    displayInventory(searchTerm = '', supplierFilter = '', locationFilter = '') {
        this.inventoryDisplay.displayInventory(searchTerm, supplierFilter, locationFilter);
        
        // Update global references for compatibility
        this.currentPage = this.inventoryDisplay.currentPage;
        this.totalFilteredItems = this.inventoryDisplay.totalFilteredItems;
        window.currentPage = this.currentPage;
        window.totalFilteredItems = this.totalFilteredItems;
    }

    /**
     * Update dashboard
     */
    /**
     * Submit product using product manager
     */
    async submitProduct() {
        await this.productManager.submitProduct();
    }

    /**
     * Reset product form using product manager
     */
    resetProductForm() {
        this.productManager.resetProductForm();
    }

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        if (!sidebar || !mainContent) return;

        const isMinimized = sidebar.classList.contains('sidebar-minimized');
        
        if (isMinimized) {
            this.maximizeSidebar();
        } else {
            this.minimizeSidebar();
        }
    }

    /**
     * Minimize sidebar
     */
    minimizeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
        
        if (sidebar) {
            sidebar.classList.add('sidebar-minimized');
            sidebar.classList.remove('w-64');
            sidebar.classList.add('w-16');
        }
        if (mainContent) {
            mainContent.classList.add('main-expanded');
            mainContent.classList.remove('ml-64');
            mainContent.classList.add('ml-16');
            // Update max-width for minimized sidebar (4rem = 64px)
            mainContent.classList.remove('max-w-[calc(100vw-16rem)]');
            mainContent.classList.add('max-w-[calc(100vw-4rem)]');
        }
        
        // Update icon to show expand arrow
        if (sidebarToggleIcon) {
            sidebarToggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" />`;
        }
        
        // Hide menu text
        const menuTexts = document.querySelectorAll('.menu-text');
        menuTexts.forEach(text => text.classList.add('hidden'));
        
        localStorage.setItem(this.SIDEBAR_STATE_KEY, 'true');
    }

    /**
     * Maximize sidebar
     */
    maximizeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
        
        if (sidebar) {
            sidebar.classList.remove('sidebar-minimized');
            sidebar.classList.remove('w-16');
            sidebar.classList.add('w-64');
        }
        if (mainContent) {
            mainContent.classList.remove('main-expanded');
            mainContent.classList.remove('ml-16');
            mainContent.classList.add('ml-64');
            // Restore max-width for full sidebar (16rem = 256px)
            mainContent.classList.remove('max-w-[calc(100vw-4rem)]');
            mainContent.classList.add('max-w-[calc(100vw-16rem)]');
        }
        
        // Update icon to show collapse arrow
        if (sidebarToggleIcon) {
            sidebarToggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5" />`;
        }
        
        // Show menu text
        const menuTexts = document.querySelectorAll('.menu-text');
        menuTexts.forEach(text => text.classList.remove('hidden'));
        
        localStorage.setItem(this.SIDEBAR_STATE_KEY, 'false');
    }

    /**
     * Apply dark mode
     */
    applyDarkMode() {
        document.documentElement.setAttribute('data-theme', this.DARK_THEME_NAME);
        localStorage.setItem('darkMode', 'true');
    }

    /**
     * Remove dark mode (apply light mode)
     */
    removeDarkMode() {
        document.documentElement.setAttribute('data-theme', this.LIGHT_THEME_NAME);
        localStorage.setItem('darkMode', 'false');
    }

    /**
     * Log activity
     */
    async logActivity(actionType, details, itemId = null, itemName = null) {
        try {
            if (!window.db || !this.currentUser) return;

            const activityData = {
                actionType,
                details,
                itemId,
                itemName,
                userId: this.currentUser.uid,
                userEmail: this.currentUser.email,
                timestamp: new Date()
            };

            await window.db.collection('activity_log').add(activityData);
            console.log('[App] Activity logged:', actionType);
            
        } catch (error) {
            console.error('[App] Error logging activity:', error);
        }
    }

    /**
     * Handle authentication state changes
     */
    handleAuthStateChange(user) {
        this.currentUser = user;
        
        if (user) {
            console.log('[App] User authenticated:', user.email);
            this.loadUserRole(user.uid);
        } else {
            console.log('[App] User signed out');
            this.currentUser = null;
            this.userRole = null;
        }
    }

    /**
     * Update UI based on user role
     */
    updateUIForRole(role) {
        console.log('[App] Updating UI for role:', role);
        
        // Get admin-specific UI elements
        const menuSuppliers = document.getElementById('menuSuppliers');
        const addSupplierBtn = document.getElementById('addSupplierBtn');
        const addLocationBtn = document.getElementById('addLocationBtn');
        const supplierFormContent = document.getElementById('supplierFormContent');
        const locationFormContent = document.getElementById('locationFormContent');
        const menuUserManagement = document.getElementById('menuUserManagement');

        // Default to hiding elements that require admin role
        if (menuSuppliers && menuSuppliers.parentElement) menuSuppliers.parentElement.classList.add('hidden');
        if (addSupplierBtn) addSupplierBtn.classList.add('hidden');
        if (addLocationBtn) addLocationBtn.classList.add('hidden');
        if (supplierFormContent) supplierFormContent.classList.add('hidden');
        if (locationFormContent) locationFormContent.classList.add('hidden');
        if (menuUserManagement && menuUserManagement.parentElement) menuUserManagement.parentElement.classList.add('hidden');

        // Also handle class-based elements
        const adminOnlyElements = document.querySelectorAll('.admin-only');
        const managerOnlyElements = document.querySelectorAll('.manager-only');

        if (role === 'admin') {
            // Enable admin-specific menu items
            if (menuSuppliers && menuSuppliers.parentElement) menuSuppliers.parentElement.classList.remove('hidden');
            if (addSupplierBtn) addSupplierBtn.classList.remove('hidden');
            if (addLocationBtn) addLocationBtn.classList.remove('hidden');
            if (supplierFormContent) supplierFormContent.classList.remove('hidden');
            if (locationFormContent) locationFormContent.classList.remove('hidden');
            if (menuUserManagement && menuUserManagement.parentElement) menuUserManagement.parentElement.classList.remove('hidden');
            
            // Enable class-based admin elements
            adminOnlyElements.forEach(el => el.classList.remove('hidden'));
            managerOnlyElements.forEach(el => el.classList.remove('hidden'));
            
            console.log('[App] Admin UI elements enabled');
        } else if (role === 'manager') {
            adminOnlyElements.forEach(el => el.classList.add('hidden'));
            managerOnlyElements.forEach(el => el.classList.remove('hidden'));
            console.log('[App] Manager UI elements enabled');
        } else {
            adminOnlyElements.forEach(el => el.classList.add('hidden'));
            managerOnlyElements.forEach(el => el.classList.add('hidden'));
            console.log('[App] Staff UI elements enabled');
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast(message, 'error');
        } else {
            alert('Error: ' + message);
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast(message, 'success');
        } else {
            console.log('Success: ' + message);
        }
    }

    /**
     * Utility: Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ===== VIEW-SPECIFIC INITIALIZATION FUNCTIONS =====
    
    /**
     * Display suppliers and locations
     */
    displaySuppliersAndLocations() {
        console.log('[App] Loading suppliers and locations...');
        
        // Load and display suppliers
        this.loadSuppliers().then(() => {
            this.updateSupplierList();
            return this.loadLocations();
        }).then(() => {
            this.updateLocationList();
            console.log('[App] Suppliers and locations displayed successfully');
        }).catch(error => {
            console.error('[App] Error loading suppliers/locations:', error);
        });
    }

    /**
     * Update supplier list display
     */
    updateSupplierList() {
        const supplierList = document.getElementById('supplierList');
        console.log('Updating supplier list with:', this.suppliers);
        
        if (!supplierList) {
            console.log('supplierList element not found in DOM - skipping supplier list update');
            return;
        }
        
        supplierList.innerHTML = '';
        this.suppliers.forEach(supplier => {
            const supplierName = supplier.name || supplier.id || supplier;
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center';
            li.innerHTML = `${supplierName} <button data-supplier="${supplierName}" class="deleteSupplierBtn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>`;
            supplierList.appendChild(li);
        });
        
        console.log('Supplier list updated, items:', supplierList.children.length);
        
        // Attach delete event listeners
        document.querySelectorAll('.deleteSupplierBtn').forEach(button => {
            button.addEventListener('click', () => this.deleteSupplier(button.getAttribute('data-supplier')));
        });
    }

    /**
     * Update location list display
     */
    updateLocationList() {
        const locationList = document.getElementById('locationList');
        console.log('Updating location list with:', this.locations);
        
        if (!locationList) {
            console.log('locationList element not found in DOM - skipping location list update');
            return;
        }
        
        locationList.innerHTML = '';
        this.locations.forEach(location => {
            const locationName = location.name || location.id || location;
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center dark:text-gray-200';
            li.innerHTML = `${locationName} <button data-location-name="${locationName}" class="deleteLocationBtn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>`;
            locationList.appendChild(li);
        });
        
        console.log('Location list updated, items:', locationList.children.length);
        
        // Attach delete event listeners
        document.querySelectorAll('.deleteLocationBtn').forEach(button => {
            button.addEventListener('click', () => this.deleteLocation(button.getAttribute('data-location-name')));
        });
    }

    /**
     * Delete a supplier
     */
    async deleteSupplier(supplierName) {
        if (!supplierName) return;
        
        if (!confirm(`Are you sure you want to delete supplier "${supplierName}"?`)) {
            return;
        }

        try {
            await window.db.collection('suppliers').doc(supplierName).delete();
            console.log(`Supplier "${supplierName}" deleted successfully`);
            
            // Reload suppliers and update UI
            await this.loadSuppliers();
            this.updateSupplierList();
            
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast(`Supplier "${supplierName}" deleted successfully`, 'success');
            }
        } catch (error) {
            console.error('Error deleting supplier:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Failed to delete supplier: ' + error.message, 'error');
            }
        }
    }

    /**
     * Delete a location
     */
    async deleteLocation(locationName) {
        if (!locationName) return;
        
        if (!confirm(`Are you sure you want to delete location "${locationName}"?`)) {
            return;
        }

        try {
            await window.db.collection('locations').doc(locationName).delete();
            console.log(`Location "${locationName}" deleted successfully`);
            
            // Reload locations and update UI
            await this.loadLocations();
            this.updateLocationList();
            
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast(`Location "${locationName}" deleted successfully`, 'success');
            }
        } catch (error) {
            console.error('Error deleting location:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Failed to delete location: ' + error.message, 'error');
            }
        }
    }

    /**
     * Add a new supplier
     */
    async addSupplier() {
        const nameInput = document.getElementById('supplierName');
        if (!nameInput) {
            console.error('Supplier name input not found');
            return;
        }
        
        const name = nameInput.value.trim();
        if (!name) {
            alert('Please enter a supplier name.');
            return;
        }
        
        // Check if supplier already exists
        const existingSupplier = this.suppliers.find(s => (s.name || s.id || s) === name);
        if (existingSupplier) {
            alert('Supplier already exists.');
            return;
        }
        
        try {
            await window.db.collection('suppliers').doc(name).set({ name });
            console.log(`Supplier "${name}" added successfully`);
            
            // Clear input
            nameInput.value = '';
            
            // Reload suppliers and update UI
            await this.loadSuppliers();
            this.updateSupplierList();
            
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast(`Supplier "${name}" added successfully`, 'success');
            }
        } catch (error) {
            console.error('Error adding supplier:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Failed to add supplier: ' + error.message, 'error');
            }
        }
    }

    /**
     * Add a new location
     */
    async addLocation() {
        const nameInput = document.getElementById('locationName');
        if (!nameInput) {
            console.error('Location name input not found');
            return;
        }
        
        const name = nameInput.value.trim();
        if (!name) {
            alert('Please enter a location name.');
            return;
        }
        
        // Check if location already exists
        const existingLocation = this.locations.find(l => (l.name || l.id || l) === name);
        if (existingLocation) {
            alert('Location already exists.');
            return;
        }
        
        try {
            await window.db.collection('locations').doc(name).set({ name });
            console.log(`Location "${name}" added successfully`);
            
            // Clear input
            nameInput.value = '';
            
            // Reload locations and update UI
            await this.loadLocations();
            this.updateLocationList();
            
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast(`Location "${name}" added successfully`, 'success');
            }
        } catch (error) {
            console.error('Error adding location:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Failed to add location: ' + error.message, 'error');
            }
        }
    }
    
    /**
     * Initialize reports section
     */
    initializeReports() {
        console.log('[App] Initializing reports...');
        
        // Populate trend product select
        this.populateTrendProductSelect();
        
        // Initialize empty chart
        if (typeof window.generateProductUsageChart === 'function') {
            window.generateProductUsageChart('');
        }
    }
    
    /**
     * Load user management section
     */
    loadUserManagement() {
        console.log('[App] Loading user management...');
        
        // Check if user has admin permissions
        if (this.userRole !== 'admin') {
            console.warn('[App] User management requires admin role');
            this.showError('Access denied: Admin privileges required');
            return;
        }
        
        // Load user role management
        this.displayUserRoleManagement();
    }

    /**
     * Populate trend product select dropdown
     */
    populateTrendProductSelect() {
        const trendProductSelect = document.getElementById('trendProductSelect');
        if (!trendProductSelect) return;
        
        // Clear existing options
        trendProductSelect.innerHTML = '<option value="">Select a product...</option>';
        
        // Add products from inventory
        this.inventory.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} (${item.brand || 'No Brand'})`;
            trendProductSelect.appendChild(option);
        });
        
        console.log('[App] Populated trend product select with', this.inventory.length, 'products');
    }

    /**
     * Render suppliers table
     */
    renderSuppliersTable() {
        const supplierList = document.getElementById('supplierList');
        if (!supplierList) {
            console.warn('[App] Supplier list element not found');
            return;
        }
        
        supplierList.innerHTML = '';
        
        if (this.suppliers.length === 0) {
            supplierList.innerHTML = '<li class="text-gray-500">No suppliers found</li>';
            return;
        }
        
        this.suppliers.forEach(supplier => {
            const listItem = document.createElement('li');
            listItem.className = 'flex justify-between items-center p-2 border-b';
            listItem.innerHTML = `
                <div>
                    <span class="font-medium">${supplier.name || 'N/A'}</span>
                    ${supplier.contact ? `<br><small class="text-sm opacity-70">${supplier.contact}</small>` : ''}
                </div>
                <button class="btn btn-xs btn-error" onclick="deleteSupplier('${supplier.id}')">Delete</button>
            `;
            supplierList.appendChild(listItem);
        });
        
        console.log('[App] Rendered suppliers list with', this.suppliers.length, 'suppliers');
    }

    /**
     * Render locations list
     */
    renderLocationsTable() {
        const locationList = document.getElementById('locationList');
        if (!locationList) {
            console.warn('[App] Location list element not found');
            return;
        }
        
        locationList.innerHTML = '';
        
        if (this.locations.length === 0) {
            locationList.innerHTML = '<li class="text-gray-500">No locations found</li>';
            return;
        }
        
        this.locations.forEach(location => {
            const listItem = document.createElement('li');
            listItem.className = 'flex justify-between items-center p-2 border-b';
            listItem.innerHTML = `
                <span class="font-medium">${location.name || 'N/A'}</span>
                <button class="btn btn-xs btn-error" onclick="deleteLocation('${location.id}')">Delete</button>
            `;
            locationList.appendChild(listItem);
        });
        
        console.log('[App] Rendered locations list with', this.locations.length, 'locations');
    }

    /**
     * Display user role management (admin only)
     */
    async displayUserRoleManagement() {
        const tableBody = document.getElementById('userRolesTableBody');
        const selectAllCheckbox = document.getElementById('selectAllUsersCheckbox');
        
        if (!tableBody) {
            console.error('[App] User roles table body not found');
            return;
        }
        
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">Loading users...</td></tr>';
        
        try {
            // Call Firebase Cloud Function to list users
            const listUsersAndRolesCallable = firebase.functions().httpsCallable('listUsersAndRoles');
            const result = await listUsersAndRolesCallable();
            const users = result.data.users;
            
            tableBody.innerHTML = '';
            
            if (!users || users.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">No users found.</td></tr>';
                if (selectAllCheckbox) selectAllCheckbox.disabled = true;
                return;
            }
            
            if (selectAllCheckbox) {
                selectAllCheckbox.disabled = false;
                selectAllCheckbox.checked = false;
            }
            
            users.forEach(user => {
                const row = tableBody.insertRow();
                row.setAttribute('data-uid', user.uid);
                row.innerHTML = `
                    <td class="px-6 py-4 text-center">
                        <input type="checkbox" class="user-checkbox checkbox checkbox-sm" data-uid="${user.uid}">
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">${user.email || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-xs">${user.uid}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${user.currentRole || 'No Role Assigned'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <select id="roleSelect-${user.uid}" class="role-select-dropdown border dark:border-gray-600 p-2 rounded dark:bg-slate-700 dark:text-gray-200 text-xs">
                            <option value="staff" ${(user.currentRole === 'staff' || !user.currentRole) ? 'selected' : ''}>Staff</option>
                            <option value="admin" ${user.currentRole === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <button data-uid="${user.uid}" class="save-role-btn btn btn-xs btn-info">Save Role</button>
                    </td>
                `;
            });
            
            // Add event listeners for save role buttons
            document.querySelectorAll('.save-role-btn').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const userId = event.target.dataset.uid;
                    const newRole = document.getElementById(`roleSelect-${userId}`).value;
                    await this.handleSaveUserRole(userId, newRole);
                });
            });
            
            // Add event listeners for checkboxes
            document.querySelectorAll('.user-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    this.updateSelectedUsers();
                });
            });
            
            console.log('[App] Loaded', users.length, 'users for role management');
            
        } catch (error) {
            console.error('[App] Error loading user role management:', error);
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-600">Error loading users: ${error.message}</td></tr>`;
        }
    }

    /**
     * Handle saving user role
     */
    async handleSaveUserRole(userId, newRole) {
        try {
            const updateUserRoleCallable = firebase.functions().httpsCallable('updateUserRole');
            await updateUserRoleCallable({ userId, role: newRole });
            
            this.showSuccess(`User role updated to ${newRole}`);
            
            // Refresh the user management display
            this.displayUserRoleManagement();
            
        } catch (error) {
            console.error('[App] Error saving user role:', error);
            this.showError('Error updating user role: ' + error.message);
        }
    }

    /**
     * Update selected users display
     */
    updateSelectedUsers() {
        const checkboxes = document.querySelectorAll('.user-checkbox');
        const selectAllCheckbox = document.getElementById('selectAllUsersCheckbox');
        const deleteBtn = document.getElementById('deleteSelectedUsersBtn');
        const updateRoleBtn = document.getElementById('updateRoleForSelectedUsersBtn');
        
        const checkedBoxes = Array.from(checkboxes).filter(cb => cb.checked);
        const allChecked = checkboxes.length > 0 && checkedBoxes.length === checkboxes.length;
        const someChecked = checkedBoxes.length > 0 && checkedBoxes.length < checkboxes.length;
        
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked;
        }
        
        // Enable/disable bulk action buttons
        const hasSelection = checkedBoxes.length > 0;
        if (deleteBtn) deleteBtn.disabled = !hasSelection;
        if (updateRoleBtn) updateRoleBtn.disabled = !hasSelection;
    }

    /**
     * Update dashboard with statistics
     */
    updateDashboard() {
        // Update statistics
        this.updateInventoryStats();
        this.updateOrderStats();
        
        // Display pending orders
        this.ordersManager.displayPendingOrdersOnDashboard();
        
        // Update low stock alerts
        this.updateLowStockAlerts();
        
        // Populate order product dropdowns (including modal dropdown)
        this.populateOrderProductDropdowns();
        
        // Update recent activity
        this.updateRecentActivity();
        
        console.log('[App] Dashboard updated');
    }

    /**
     * Update inventory statistics on dashboard
     */
    updateInventoryStats() {
        if (!Array.isArray(this.inventory)) {
            console.warn('Inventory not loaded yet, skipping stats update');
            return;
        }

        // Dashboard statistics elements (match actual HTML IDs)
        const totalItemsEl = document.getElementById('dashboardTotalProducts');
        const lowStockEl = document.getElementById('dashboardLowStockItems');
        const outOfStockEl = document.getElementById('dashboardOutOfStockItems');
        const totalValueEl = document.getElementById('dashboardTotalValue');
        
        const totalCount = this.inventory.length;
        
        // Calculate pending quantities for each product from orders
        const pendingQuantities = {};
        if (this.ordersManager && this.ordersManager.orders) {
            this.ordersManager.orders.forEach(order => {
                if (order.status === 'pending' && order.productId) {
                    pendingQuantities[order.productId] = (pendingQuantities[order.productId] || 0) + (parseInt(order.quantity) || 0);
                }
            });
        }
        
        // Calculate low stock items (current quantity <= minQuantity AND total available still <= minQuantity)
        const lowStockCount = this.inventory.filter(item => {
            const currentQuantity = parseInt(item.quantity) || 0;
            const quantityOrdered = pendingQuantities[item.id] || 0; // Use calculated pending quantities
            const minQuantity = parseInt(item.minQuantity) || 0;
            const totalAvailable = currentQuantity + quantityOrdered;
            
            // Show in low stock if: current quantity is low AND total available (including orders) is still below minimum
            return currentQuantity <= minQuantity && totalAvailable <= minQuantity && minQuantity > 0 && currentQuantity > 0;
        }).length;
        
        // Calculate out of stock items (quantity = 0)
        const outOfStockCount = this.inventory.filter(item => {
            const quantity = parseInt(item.quantity) || 0;
            return quantity === 0;
        }).length;
        
        // Calculate total value using cost field (not price)
        const totalValue = this.inventory.reduce((sum, item) => {
            const quantity = parseInt(item.quantity) || 0;
            const cost = parseFloat(item.cost) || 0;
            return sum + (quantity * cost);
        }, 0);
        
        // Update dashboard elements
        if (totalItemsEl) totalItemsEl.textContent = totalCount;
        if (lowStockEl) lowStockEl.textContent = lowStockCount;
        if (outOfStockEl) outOfStockEl.textContent = outOfStockCount;
        if (totalValueEl) totalValueEl.textContent = `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        console.log(`[App] Dashboard stats updated - Total: ${totalCount}, Low Stock: ${lowStockCount}, Out of Stock: ${outOfStockCount}, Value: $${totalValue.toLocaleString()}`);
    }

    /**
     * Update order statistics on dashboard
     */
    updateOrderStats() {
        // Get orders from orders manager
        const orders = this.ordersManager.orders || [];
        
        const totalOrdersEl = document.getElementById('totalOrders');
        const pendingOrdersEl = document.getElementById('pendingOrders');
        
        if (totalOrdersEl) {
            totalOrdersEl.textContent = orders.length;
        }
        
        const pendingCount = orders.filter(order => order.status === 'pending').length;
        if (pendingOrdersEl) {
            pendingOrdersEl.textContent = pendingCount;
        }
    }

    /**
     * Display pending orders on dashboard
     */
    async displayPendingOrdersOnDashboard() {
        try {
            await this.ordersManager.displayPendingOrdersOnDashboard();
            console.log('[App] Pending orders displayed on dashboard');
        } catch (error) {
            console.error('[App] Error displaying pending orders on dashboard:', error);
        }
    }

    /**
     * Update low stock alerts
     */
    updateLowStockAlerts() {
        console.log('[App] updateLowStockAlerts called');
        try {
            if (!this.inventory || this.inventory.length === 0) {
                console.log('[App] No inventory data available for low stock alerts');
                // Clear both potential table bodies if inventory is empty
                const tableBodyInventory = document.getElementById('lowStockTableBody');
                if (tableBodyInventory) tableBodyInventory.innerHTML = '<tr><td colspan="7" class="text-center p-4">No inventory data.</td></tr>';
                const tableBodyOrders = document.getElementById('ordersViewLowStockTableBody');
                if (tableBodyOrders) tableBodyOrders.innerHTML = '<tr><td colspan="7" class="text-center p-4">No inventory data.</td></tr>';
                return;
            }

            // Calculate pending quantities for each product from orders
            const pendingQuantities = {};
            if (this.ordersManager && this.ordersManager.orders) {
                this.ordersManager.orders.forEach(order => {
                    if (order.status === 'pending' && order.productId) {
                        pendingQuantities[order.productId] = (pendingQuantities[order.productId] || 0) + (parseInt(order.quantity) || 0);
                    }
                });
            }

            const lowStockItems = this.inventory.filter(item => {
                const currentQuantity = parseInt(item.quantity) || 0;
                const quantityOrdered = pendingQuantities[item.id] || 0; // Use calculated pending quantities
                const minQuantity = parseInt(item.minQuantity) || 0;
                const totalAvailable = currentQuantity + quantityOrdered;
                
                // Show in low stock if: current quantity is low AND total available (including orders) is still below minimum
                return currentQuantity <= minQuantity && totalAvailable <= minQuantity && minQuantity > 0;
            });

            // Determine which table body and badge to update based on the currently visible view
            let targetTableBodyId = 'lowStockTableBody'; // Default to original inventory view's table
            let targetBadgeId = 'lowStockAlertBadge'; // Updated to match actual badge ID

            const ordersView = document.getElementById('ordersSectionContainer');
            if (ordersView && !ordersView.classList.contains('hidden')) {
                targetTableBodyId = 'ordersViewLowStockTableBody';
                targetBadgeId = 'ordersViewLowStockAlertBadge';
            }

            const lowStockTableBody = document.getElementById(targetTableBodyId);
            const lowStockAlertBadge = document.getElementById(targetBadgeId);

            if (!lowStockTableBody) {
                console.warn(`[App] Low stock table body with ID '${targetTableBodyId}' not found in the current view.`);
                // Clear the other table if it exists to avoid stale data
                const otherTableBodyId = targetTableBodyId === 'lowStockTableBody' ? 'ordersViewLowStockTableBody' : 'lowStockTableBody';
                const otherTableBody = document.getElementById(otherTableBodyId);
                if (otherTableBody) otherTableBody.innerHTML = '';
                return;
            }

            // Clear the other table if it exists, to prevent showing alerts in two places
            const inactiveTableBodyId = targetTableBodyId === 'lowStockTableBody' ? 'ordersViewLowStockTableBody' : 'lowStockTableBody';
            const inactiveTableBody = document.getElementById(inactiveTableBodyId);
            if (inactiveTableBody) inactiveTableBody.innerHTML = '';

            // Clear existing table
            lowStockTableBody.innerHTML = '';

            if (lowStockItems.length === 0) {
                const row = lowStockTableBody.insertRow();
                row.innerHTML = `
                    <td colspan="7" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center">
                            <svg class="w-12 h-12 mb-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <h3 class="text-lg font-semibold mb-2">All products are well stocked!</h3>
                            <p class="text-sm">No low stock alerts at this time</p>
                        </div>
                    </td>
                `;
            } else {
                // Group items by supplier
                const itemsBySupplier = {};
                lowStockItems.forEach(item => {
                    const supplierName = item.supplier || 'No Supplier Specified';
                    if (!itemsBySupplier[supplierName]) {
                        itemsBySupplier[supplierName] = [];
                    }
                    itemsBySupplier[supplierName].push(item);
                });

                // Sort suppliers alphabetically
                const sortedSuppliers = Object.keys(itemsBySupplier).sort();

                // Render grouped items
                sortedSuppliers.forEach((supplierName, supplierIndex) => {
                    const supplierItems = itemsBySupplier[supplierName];
                    
                    // Add supplier header row
                    const headerRow = lowStockTableBody.insertRow();
                    headerRow.className = 'bg-base-200 dark:bg-slate-600';
                    headerRow.innerHTML = `
                        <td colspan="7" class="px-4 py-3 font-semibold text-base-content">
                            <div class="flex items-center gap-2">
                                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6"></path>
                                </svg>
                                ${supplierName} (${supplierItems.length} item${supplierItems.length !== 1 ? 's' : ''})
                            </div>
                        </td>
                    `;

                    // Add items for this supplier
                    supplierItems.forEach(item => {
                        const currentQuantity = parseInt(item.quantity) || 0;
                        const quantityOrdered = pendingQuantities[item.id] || 0; // Use calculated pending quantities
                        const minQuantity = parseInt(item.minQuantity) || 0;
                        const totalAvailable = currentQuantity + quantityOrdered;
                        
                        const row = lowStockTableBody.insertRow();
                        row.className = 'border-b dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900';
                        row.innerHTML = `
                            <td class="px-4 py-2 font-medium text-amber-800 dark:text-amber-200 pl-8">${item.name}</td>
                            <td class="px-4 py-2 text-center">
                                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                    ${currentQuantity}
                                </span>
                            </td>
                            <td class="px-4 py-2 text-center">
                                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${quantityOrdered > 0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}">
                                    ${quantityOrdered}
                                </span>
                            </td>
                            <td class="px-4 py-2 text-center text-amber-700 dark:text-amber-300">${minQuantity}</td>
                            <td class="px-4 py-2 text-amber-700 dark:text-amber-300">${item.location || 'Not specified'}</td>
                            <td class="px-4 py-2 text-amber-700 dark:text-amber-300">${item.supplier || 'Not specified'}</td>
                            <td class="px-4 py-2 text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <button class="btn btn-success btn-xs order-now-btn" data-product-id="${item.id}" data-reorder-qty="${Math.max(1, minQuantity - totalAvailable)}" title="Order ${Math.max(1, minQuantity - totalAvailable)} more to reach minimum">Order Now</button>
                                    <button class="btn btn-warning btn-xs edit-product-btn" data-product-id="${item.id}">Edit</button>
                                    <button class="btn btn-accent btn-xs move-product-btn" data-product-id="${item.id}">Move</button>
                                </div>
                            </td>
                        `;
                    });

                    // Add spacing between supplier groups (except for the last one)
                    if (supplierIndex < sortedSuppliers.length - 1) {
                        const spacerRow = lowStockTableBody.insertRow();
                        spacerRow.innerHTML = `<td colspan="7" class="py-2"></td>`;
                    }
                });
            }

            // Update alert badge to show supplier count (moved outside if/else)
            if (lowStockAlertBadge) {
                if (lowStockItems.length > 0) {
                    // Group items by supplier to count unique suppliers
                    const itemsBySupplier = {};
                    lowStockItems.forEach(item => {
                        const supplierName = item.supplier || 'No Supplier Specified';
                        if (!itemsBySupplier[supplierName]) {
                            itemsBySupplier[supplierName] = [];
                        }
                        itemsBySupplier[supplierName].push(item);
                    });
                    const supplierCount = Object.keys(itemsBySupplier).length;
                    lowStockAlertBadge.textContent = `${lowStockItems.length} items from ${supplierCount} supplier${supplierCount !== 1 ? 's' : ''}`;
                    lowStockAlertBadge.classList.remove('hidden');
                } else {
                    lowStockAlertBadge.textContent = '0 items need attention';
                    lowStockAlertBadge.classList.add('hidden');
                }
            }

            console.log(`[App] Low stock alerts updated for ${targetTableBodyId}: ${lowStockItems.length} items`);
            // Attach event listeners for action buttons after rendering all rows
            const lowStockTableBodyEl = document.getElementById(targetTableBodyId);
            if (lowStockTableBodyEl) {
                lowStockTableBodyEl.querySelectorAll('.order-now-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const productId = btn.getAttribute('data-product-id');
                        const reorderQty = btn.getAttribute('data-reorder-qty') || '';
                        console.log('[DEBUG] Order Now clicked', { productId, reorderQty });
                        if (typeof openCreateOrderModalWithProduct === 'function') {
                            openCreateOrderModalWithProduct(productId, reorderQty);
                        } else {
                            console.error('openCreateOrderModalWithProduct not found');
                        }
                    });
                });
                lowStockTableBodyEl.querySelectorAll('.edit-product-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const productId = btn.getAttribute('data-product-id');
                        if (typeof openEditProductModalWithProduct === 'function') {
                            openEditProductModalWithProduct(productId);
                        }
                        console.log('[DEBUG] Edit clicked', productId);
                    });
                });
                lowStockTableBodyEl.querySelectorAll('.move-product-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const productId = btn.getAttribute('data-product-id');
                        if (typeof openMoveProductModalWithProduct === 'function') {
                            openMoveProductModalWithProduct(productId);
                        }
                        console.log('[DEBUG] Move clicked', productId);
                    });
                });
            }
        } catch (error) {
            console.error('[App] Error in updateLowStockAlerts:', error);
        }
    }

    /**
     * Update recent activity list on dashboard
     */
    async updateRecentActivity() {
        const recentActivityListEl = document.getElementById('recentActivityList');
        
        if (!recentActivityListEl) {
            console.warn('Recent activity list element not found');
            return;
        }

        if (!window.db) {
            recentActivityListEl.innerHTML = `
                <div class="flex items-center text-sm text-base-content/60">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Recent activity (Database not ready)
                </div>`;
            return;
        }

        try {
            const snapshot = await window.db.collection('activity_log')
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();

            if (snapshot.empty) {
                recentActivityListEl.innerHTML = `
                    <div class="flex items-center text-sm text-base-content/60">
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        No recent activity found
                    </div>`;
                return;
            }

            let activitiesHtml = '';
            snapshot.docs.forEach(doc => {
                const activity = doc.data();
                const userDisplay = activity.userEmail || activity.userId || 'System';
                const timestamp = activity.timestamp ? 
                    activity.timestamp.toDate().toLocaleString() : 'N/A';
                const itemInfo = activity.itemName ? 
                    `${activity.details} for ${activity.itemName}` : activity.details;

                activitiesHtml += `
                    <li class="py-1 border-b border-base-300 last:border-b-0">
                        <p class="text-sm text-base-content">${itemInfo}</p>
                        <p class="text-xs text-base-content/60">By: ${userDisplay} at ${timestamp}</p>
                    </li>`;
            });

            recentActivityListEl.innerHTML = `<ul class="space-y-1">${activitiesHtml}</ul>`;
            console.log('[App] Recent activity updated');

        } catch (error) {
            console.error("Error fetching recent activity:", error);
            recentActivityListEl.innerHTML = `
                <div class="flex items-center text-sm text-error">
                    <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                    Error loading recent activity
                </div>`;
        }
    }

    /**
     * Start auto-refresh for real-time updates
     */
    startAutoRefresh() {
        console.log('[AutoRefresh] Starting auto-refresh');
        if (this.autoRefreshInterval) {
            console.log('[AutoRefresh] Auto-refresh already running');
            return;
        }
        
        // Set up user activity tracking to pause auto-refresh when inactive
        this.setupUserActivityTracking();
        
        this.autoRefreshInterval = setInterval(async () => {
            try {
                // Only refresh if user has been active in the last 10 minutes
                const timeSinceLastActivity = Date.now() - this.lastUserActivity;
                const inactivityThreshold = 10 * 60 * 1000; // 10 minutes
                
                if (timeSinceLastActivity > inactivityThreshold) {
                    console.log('[AutoRefresh] User inactive, skipping refresh to save Firebase costs');
                    return;
                }
                
                console.log('[AutoRefresh] Refreshing low stock alerts and orders...');
                await this.updateLowStockAlerts();
                
                // Only refresh orders if we're actually viewing the orders section
                const ordersSection = document.getElementById('ordersSectionContainer');
                if (ordersSection && !ordersSection.classList.contains('hidden')) {
                    console.log('[AutoRefresh] Orders view active, refreshing orders');
                    await this.ordersManager.loadOrders();
                } else {
                    console.log('[AutoRefresh] Orders view not active, skipping orders refresh to save costs');
                }
                
                console.log('[AutoRefresh] Refresh completed');
            } catch (error) {
                console.error('[AutoRefresh] Error during refresh:', error);
            }
        }, this.AUTO_REFRESH_INTERVAL_MS);
        
        console.log(`[AutoRefresh] Auto-refresh started with ${this.AUTO_REFRESH_INTERVAL_MS / 1000}s interval (cost-optimized)`);
    }

    /**
     * Set up user activity tracking
     */
    setupUserActivityTracking() {
        const updateActivity = () => {
            this.lastUserActivity = Date.now();
        };
        
        // Track various user activities
        ['click', 'keypress', 'mousemove', 'scroll'].forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });
        
        console.log('[AutoRefresh] User activity tracking enabled');
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        console.log('[AutoRefresh] Stopping auto-refresh');
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            console.log('[AutoRefresh] Auto-refresh stopped');
        } else {
            console.log('[AutoRefresh] No auto-refresh to stop');
        }
    }

    /**
     * Toggle auto-refresh on/off (for user control)
     */
    toggleAutoRefresh() {
        if (this.autoRefreshEnabled) {
            this.stopAutoRefresh();
            this.autoRefreshEnabled = false;
            console.log('[AutoRefresh] Auto-refresh disabled by user');
        } else {
            this.startAutoRefresh();
            this.autoRefreshEnabled = true;
            console.log('[AutoRefresh] Auto-refresh enabled by user');
        }
        return this.autoRefreshEnabled;
    }

    /**
     * Start optimized real-time listeners for orders and inventory
     */
    startRealtimeListeners() {
        if (!window.db) {
            console.error('[Realtime] Firestore not initialized');
            return;
        }

        console.log('[Realtime] Starting optimized real-time listeners...');

        // Initialize performance optimizer if not already done
        if (!this.performanceOptimizer) {
            import('./modules/performance-optimizer.js').then(module => {
                this.performanceOptimizer = module.performanceOptimizer;
                this.setupOptimizedListeners();
            });
        } else {
            this.setupOptimizedListeners();
        }
    }

    /**
     * Setup optimized listeners using performance optimizer
     */
    setupOptimizedListeners() {
        // Orders listener with optimization
        this.ordersListener = this.performanceOptimizer.optimizedListener(
            'orders',
            'orders_realtime',
            (orders, metadata) => {
                // Only update if data actually changed
                if (!metadata.fromCache || metadata.hasPendingWrites) {
                    console.log(`[Realtime] Orders updated: ${orders.length} items`);
                    
                    // Update orders manager data
                    if (this.ordersManager) {
                        this.ordersManager.orders = orders;
                        
                        // Smart UI refresh - only update visible components
                        this.performanceOptimizer.smartUIRefresh('orders');
                        this.performanceOptimizer.smartUIRefresh('dashboard');
                        
                        // Throttled low stock alerts update
                        this.performanceOptimizer.throttledUpdate('low_stock_alerts', () => {
                            this.updateLowStockAlerts();
                        }, 2000);
                    }
                    
                    // Show subtle notification (throttled)
                    this.performanceOptimizer.throttledUpdate('orders_notification', () => {
                        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                            uiEnhancementManager.showToast(`Orders synced (${orders.length})`, 'info', 1500);
                        }
                    }, 5000); // Only show notification every 5 seconds max
                }
            }
        );

        // Inventory listener with optimization
        this.inventoryListener = this.performanceOptimizer.optimizedListener(
            'inventory',
            'inventory_realtime',
            (inventory, metadata) => {
                // Only update if data actually changed
                if (!metadata.fromCache || metadata.hasPendingWrites) {
                    console.log(`[Realtime] Inventory updated: ${inventory.length} items`);
                    
                    this.inventory = inventory;
                    window.inventory = inventory; // Update global reference
                    
                    // Smart UI refresh - only update visible components
                    this.performanceOptimizer.smartUIRefresh('inventory');
                    this.performanceOptimizer.smartUIRefresh('dashboard');
                    
                    // Throttled updates for expensive operations
                    this.performanceOptimizer.throttledUpdate('product_dropdowns', () => {
                        this.populateOrderProductDropdowns();
                    }, 3000);
                    
                    this.performanceOptimizer.throttledUpdate('low_stock_alerts', () => {
                        this.updateLowStockAlerts();
                    }, 2000);
                    
                    // Show subtle notification (throttled)
                    this.performanceOptimizer.throttledUpdate('inventory_notification', () => {
                        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                            uiEnhancementManager.showToast(`Inventory synced (${inventory.length})`, 'info', 1500);
                        }
                    }, 5000); // Only show notification every 5 seconds max
                }
            }
        );

        this.realtimeListenersEnabled = true;
        console.log('[Realtime] Optimized real-time listeners started successfully');
        
        // Show user notification
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast('Optimized real-time sync enabled', 'success');
        }
        
        // Stop auto-refresh since we have real-time updates now
        this.stopAutoRefresh();
    }

    /**
     * Stop real-time listeners
     */
    stopRealtimeListeners() {
        console.log('[Realtime] Stopping real-time listeners...');
        
        if (this.ordersListener) {
            this.ordersListener();
            this.ordersListener = null;
            console.log('[Realtime] Orders listener stopped');
        }
        
        if (this.inventoryListener) {
            this.inventoryListener();
            this.inventoryListener = null;
            console.log('[Realtime] Inventory listener stopped');
        }
        
        this.realtimeListenersEnabled = false;
        console.log('[Realtime] All real-time listeners stopped');
        
        // Show user notification
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast('Real-time updates disabled', 'info');
        }
    }

    /**
     * Toggle real-time listeners on/off
     */
    toggleRealtimeListeners() {
        if (this.realtimeListenersEnabled) {
            this.stopRealtimeListeners();
            // Start auto-refresh as fallback
            this.startAutoRefresh();
            console.log('[Realtime] Real-time listeners disabled, using auto-refresh fallback');
        } else {
            this.startRealtimeListeners();
            console.log('[Realtime] Real-time listeners enabled');
        }
        return this.realtimeListenersEnabled;
    }

    /**
     * View QR Code for a product
     */
    async viewQRCode(productId) {
        console.log('[App] viewQRCode called for product:', productId);
        try {
            // Find the product
            const product = this.inventory.find(item => item.id === productId);
            if (!product) {
                this.showError('Product not found');
                return;
            }

            // Ensure QR code library is available
            if (typeof QRCode === 'undefined') {
                this.showError('QR Code library not available');
                return;
            }

            // Create or get QR code modal
            let qrModal = document.getElementById('qrCodeModal');
            if (!qrModal) {
                // Create QR modal if it doesn't exist
                qrModal = document.createElement('div');
                qrModal.id = 'qrCodeModal';
                qrModal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                qrModal.innerHTML = `
                    <div class="bg-base-100 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold text-base-content">Product QR Code</h3>
                            <button id="closeQRModal" class="btn btn-sm btn-circle btn-ghost">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                                               </div>
                        <div class="text-center">
                            <div id="qrCodeContainer" class="mb-4 flex justify-center"></div>
                            <p id="qrProductName" class="font-medium text-base-content mb-2"></p>
                            <p id="qrProductId" class="text-sm text-base-content/60 mb-4"></p>
                            <button id="downloadQRBtn" class="btn btn-primary btn-sm">Download QR Code</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(qrModal);

                // Add event listeners
                document.getElementById('closeQRModal').addEventListener('click', () => {
                    qrModal.classList.add('hidden');
                    qrModal.classList.remove('flex');
                });

                qrModal.addEventListener('click', (e) => {
                    if (e.target === qrModal) {
                        qrModal.classList.add('hidden');
                        qrModal.classList.remove('flex');
                    }
                });
            }

            // Generate QR code
            const qrContainer = document.getElementById('qrCodeContainer');
            qrContainer.innerHTML = ''; // Clear previous QR code

            const qr = new QRCode(qrContainer, {
                text: productId,
                width: 200,
                height: 200,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });

            // Update modal content
            document.getElementById('qrProductName').textContent = product.name;
            document.getElementById('qrProductId').textContent = `ID: ${productId}`;

            // Download functionality
            document.getElementById('downloadQRBtn').onclick = () => {
                const canvas = qrContainer.querySelector('canvas');
                if (canvas) {
                    const link = document.createElement('a');
                    link.download = `${product.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qr.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                    this.showSuccess('QR code downloaded');
                }
            };

            // Show modal
            qrModal.classList.remove('hidden');
            qrModal.classList.add('flex');

            this.showSuccess(`QR code displayed for ${product.name}`);
            
        } catch (error) {
            console.error('[App] Error in viewQRCode:', error);
            this.showError('Failed to generate QR code: ' + error.message);
        }
    }
}

// Create global app instance
const app = new WataganInventoryApp();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('[DOMContentLoaded] Starting app initialization...');
    
    try {
        // Initialize event handlers first
        app.eventHandlers.init();
        
        // Initialize the app
        await app.init();
        
        // Setup sidebar state
        const sidebarMinimized = localStorage.getItem(app.SIDEBAR_STATE_KEY) === 'true';
        if (sidebarMinimized) {
            app.minimizeSidebar();
        } else {
            app.maximizeSidebar();
        }
        

    // Add event listener for modal order submit button
    const modalSubmitOrderBtn = document.getElementById('modalSubmitOrderBtn');
    if (modalSubmitOrderBtn) {
        modalSubmitOrderBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            // Collect modal form data
            const productId = document.getElementById('modalOrderProductId').value;
            const supplierId = document.getElementById('modalOrderSupplierId').value;
            const quantity = parseInt(document.getElementById('modalOrderQuantity').value);
            const cost = parseFloat(document.getElementById('modalOrderCost').value);
            if (!productId || isNaN(quantity) || quantity <= 0) {
                window.uiEnhancementManager?.showToast('Please select a product and enter a valid quantity.', 'warning');
                return;
            }
            const product = window.app?.inventory?.find(p => p.id === productId);
            if (!product) {
                window.uiEnhancementManager?.showToast('Selected product not found. Please refresh.', 'error');
                return;
            }
            const user = window.app?.currentUser || (window.firebase?.auth()?.currentUser);
            if (!user) {
                window.uiEnhancementManager?.showToast('You must be logged in to create an order.', 'error');
                return;
            }
            try {
                const orderData = {
                    productId,
                    productName: product.name,
                    quantity,
                    unitCost: cost || null,
                    status: 'pending',
                    orderDate: window.firebase?.firestore?.Timestamp?.now() || new Date(),
                    createdAt: window.firebase?.firestore?.Timestamp?.now() || new Date(),
                    userId: user.uid,
                    supplier: supplierId || product.supplier || null
                };
                const db = window.db || window.firebase?.firestore();
                const orderRef = await db.collection('orders').add(orderData);
                // Update product quantityOrdered
                const productRef = db.collection('inventory').doc(productId);
                await db.runTransaction(async (transaction) => {
                    const productDoc = await transaction.get(productRef);
                    if (!productDoc.exists) throw new Error('Product not found in inventory.');
                    const currentQuantityOrdered = productDoc.data().quantityOrdered || 0;
                    transaction.update(productRef, { quantityOrdered: currentQuantityOrdered + quantity });
                });
                // Log activity
                if (typeof window.logActivity === 'function') {
                    await window.logActivity('order_created', `Order for ${quantity} of ${product.name} (Order ID: ${orderRef.id}) created.`, orderRef.id, product.name);
                }
                window.uiEnhancementManager?.showToast(`Order for ${product.name} created successfully!`, 'success');
                // Clear modal fields
                document.getElementById('modalOrderProductId').value = '';
                document.getElementById('modalOrderSupplierId').value = '';
                document.getElementById('modalOrderQuantity').value = '';
                document.getElementById('modalOrderCost').value = '';
                // Refresh UI
                // Reset filter dropdown to show all statuses
                const statusFilterEl = document.getElementById('filterOrderStatus');
                if (statusFilterEl) statusFilterEl.value = '';
                // Reload and display all orders
                if (window.app?.ordersManager?.loadOrders) await window.app.ordersManager.loadOrders(true);
                if (window.app?.ordersManager?.displayOrdersWithDefaultFilter) await window.app.ordersManager.displayOrdersWithDefaultFilter();
                if (window.app?.updateRecentActivity) window.app.updateRecentActivity();
                if (window.app?.updateDashboard) window.app.updateDashboard();
            } catch (error) {
                window.uiEnhancementManager?.showToast(`Error creating order: ${error.message}`, 'error');
            }
        });
    }
        console.log('[DOMContentLoaded] App initialization complete');
        
    } catch (error) {
        console.error('[DOMContentLoaded] App initialization failed:', error);
    }
});

// Export for module usage
// --- Barcode/QR scanning and move product logic integration ---

// Import the barcode scanner module (note: the module sets up global functions)
// Barcode scanner functionality is now handled by the BarcodeScannerModule

// Compatibility wrapper functions for existing scanner UI integrations
window.startEditScanner = function() {
    console.log('[BarcodeScannerCompat] startEditScanner called');
    if (window.barcodeScannerModule) {
        window.barcodeScannerModule.initBarcodeScanner({
            inputId: 'scanToEditProductIdInput',
            onScan: function(code) {
                if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                    window.uiEnhancementManager.showToast('Scanned: ' + code, 'success');
                }
            }
        });
    }
};

window.stopEditScanner = function() {
    console.log('[BarcodeScannerCompat] stopEditScanner called');
    if (window.barcodeScannerModule) {
        window.barcodeScannerModule.stopBarcodeScanner();
    }
    const input = document.getElementById('scanToEditProductIdInput') || document.getElementById('productIdScanInput');
    if (input) {
        input.placeholder = 'Enter Product ID';
        if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
            window.uiEnhancementManager.showToast('Scanner stopped', 'info');
        }
    }
};

window.startUpdateScanner = function() {
    console.log('[BarcodeScannerCompat] startUpdateScanner called');
    if (window.barcodeScannerModule) {
        window.barcodeScannerModule.initBarcodeScanner({
            inputId: 'updateStockProductIdInput',
            onScan: function(code) {
                if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                    window.uiEnhancementManager.showToast('Scanned: ' + code, 'success');
                }
            }
        });
    }
};

window.stopUpdateScanner = function() {
    console.log('[BarcodeScannerCompat] stopUpdateScanner called');
    if (window.barcodeScannerModule) {
        window.barcodeScannerModule.stopBarcodeScanner();
    }
    const input = document.getElementById('updateStockProductIdInput');
    if (input) {
        input.placeholder = 'Waiting for barcode scan or manual entry...';
        if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
            window.uiEnhancementManager.showToast('Update scanner stopped', 'info');
        }
    }
};

window.startMoveScanner = function() {
    console.log('[BarcodeScannerCompat] startMoveScanner called');
    if (window.barcodeScannerModule) {
        window.barcodeScannerModule.initBarcodeScanner({
            inputId: 'moveProductIdInput',
            onScan: function(code) {
                if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                    window.uiEnhancementManager.showToast('Scanned: ' + code, 'success');
                }
            }
        });
    }
};

window.stopMoveScanner = function() {
    console.log('[BarcodeScannerCompat] stopMoveScanner called');
    if (window.barcodeScannerModule) {
        window.barcodeScannerModule.stopBarcodeScanner();
    }
    const input = document.getElementById('moveProductIdInput');
    if (input) {
        input.placeholder = 'Enter Product ID to move';
        if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
            window.uiEnhancementManager.showToast('Move scanner stopped', 'info');
        }
    }
};

// Move product logic (UI + DB update)
window.moveProduct = async function(productId) {
    if (!window.app || !window.db) {
        alert('App or database not ready');
        return;
    }
    const product = window.app.inventory.find(item => item.id === productId);
    if (!product) {
        window.app.showError('Product not found');
        return;
    }
    // Prompt for new location
    const locations = window.app.locations || [];
    let locationOptions = locations.map(loc => `${loc.name}`).join(', ');
    let newLocation = prompt(`Enter new location for ${product.name} (Available: ${locationOptions})`, product.location || '');
    if (!newLocation) return;
    // Update in Firestore
    try {
        await window.db.collection('inventory').doc(productId).update({ location: newLocation });
        product.location = newLocation;
        window.app.showSuccess(`Product moved to ${newLocation}`);
        window.app.displayInventory();
        window.app.updateLowStockAlerts();
    } catch (err) {
        window.app.showError('Failed to move product: ' + err.message);
    }
};

// Patch for jsPDF/QRCode error handling in reports-manager.js (if needed)
window.ensureJsPDF = function() {
    if (typeof jsPDF === 'undefined') {
        window.app.showError('PDF library not loaded. Please refresh the page.');
        return false;
    }
    return true;
};
window.ensureQRCode = function() {
    if (typeof QRCode === 'undefined') {
        window.app.showError('QR Code library not available');
        return false;
    }
    return true;
};

// Quick Stock Update tab switching functionality
window.switchQuickUpdateTab = function(tabIdToActivate) {
    console.log(`[QuickStockUpdate] switchQuickUpdateTab called for: ${tabIdToActivate}`);

    const tabButtons = [
        document.getElementById('manualBatchModeTab'),
        document.getElementById('barcodeScannerModeTab'),
        document.getElementById('fileUploadModeTab')
    ].filter(btn => btn !== null);

    const tabContents = [
        document.getElementById('manualBatchModeContent'),
        document.getElementById('barcodeScannerModeContent'),
        document.getElementById('fileUploadModeContent')
    ].filter(content => content !== null);

    let activeContentId = null;

    // Handle tab switching with daisyUI classes
    tabButtons.forEach(button => {
        const contentId = button.getAttribute('data-tabs-target'); // e.g., "#barcodeScannerModeContent"
        const contentElement = contentId ? document.querySelector(contentId) : null;





        if (button.id === tabIdToActivate) {
            // Activate this tab and content
            button.classList.add('tab-active');
            if (contentElement) {
                contentElement.classList.remove('hidden');
                activeContentId = contentElement.id;
                console.log(`[QuickStockUpdate] Showing content: ${activeContentId}`);
            } else {
                console.warn(`[QuickStockUpdate] Content panel for tab ${button.id} (target: ${contentId}) not found.`);
            }
        } else {
            // Deactivate other tabs and content
            button.classList.remove('tab-active');
            if (contentElement) {
                contentElement.classList.add('hidden');
                console.log(`[QuickStockUpdate] Hiding content: ${contentElement.id}`);
            }
        }
    });

    // Specific actions when a tab becomes active
    if (activeContentId === 'barcodeScannerModeContent') {
        console.log('[QuickStockUpdate] Barcode Scanner Mode tab activated.');
        
        // Initialize barcode scanner event listeners if module exists
        if (window.barcodeScannerModule) {
            window.barcodeScannerModule.initializeEventListeners();
        }
        
        // Set initial status
        if (window.setBarcodeStatus) {
            window.setBarcodeStatus('Ready for barcode input. Scan or type Product ID and press Enter.', false);
        }
        if (window.setLastActionFeedback) {
            window.setLastActionFeedback('---', false);
        }
        
        // Hide product info initially
        const scannedProductInfoEl = document.getElementById('qsuScannedProductInfo');
        if (scannedProductInfoEl) {
            scannedProductInfoEl.classList.add('hidden');
        }
        
        // Focus on barcode input
        const barcodeInput = document.getElementById('qsuBarcodeIdInput');
        if (barcodeInput) {
            setTimeout(() => barcodeInput.focus(), 100);
        }
    } else if (activeContentId === 'manualBatchModeContent') {
        console.log('[QuickStockUpdate] Manual Batch Mode tab activated.');
        
        // Focus on product search input
        const productSearch = document.getElementById('qsuProductSearch');
        if (productSearch) {
            setTimeout(() => productSearch.focus(), 100);
        }
    } else if (activeContentId === 'fileUploadModeContent') {
        console.log('[QuickStockUpdate] File Upload Mode tab activated.');
    }
};

// Global wrapper functions for enhanced reports functionality
window.generateAllQRCodesPDF = function() {
    if (window.app && window.app.reportsManager) {
        return window.app.reportsManager.generateAllQRCodesPDF();
    }
    console.error('Reports manager not available');
};

window.generateQRCodesByLocationPDF = function(locationName) {
    if (window.app && window.app.reportsManager) {
        return window.app.reportsManager.generateQRCodesByLocationPDF(locationName);
    }
    console.error('Reports manager not available');
};

window.generateOrderReportPDFWithQRCodes = function() {
    if (window.app && window.app.reportsManager) {
        return window.app.reportsManager.generateOrderReportPDFWithQRCodes();
    }
    console.error('Reports manager not available');
};

window.generateFastOrderReportPDF = function() {
    if (window.app && window.app.reportsManager) {
        return window.app.reportsManager.generateFastOrderReportPDF();
    }
    console.error('Reports manager not available');
};

// Global wrapper functions for HTML print methods
window.generateQRCodesHTMLPrint = function() {
    if (window.app && window.app.reportsManager) {
        return window.app.reportsManager.generateQRCodesHTMLPrint();
    }
    console.error('Reports manager not available');
};

window.generateOrderReportHTMLPrint = function() {
    if (window.app && window.app.reportsManager) {
        return window.app.reportsManager.generateOrderReportHTMLPrint();
    }
    console.error('Reports manager not available');
};

// Global wrapper functions for additional HTML print methods
window.generateInventoryReportHTMLPrint = function(filters = {}) {
    if (window.app && window.app.reportsManager) {
        return window.app.reportsManager.generateInventoryReportHTMLPrint(filters);
    }
    console.error('Reports manager not available');
};

window.generateLowStockReportHTMLPrint = function() {
    if (window.app && window.app.reportsManager) {
        return window.app.reportsManager.generateLowStockReportHTMLPrint();
    }
    console.error('Reports manager not available');
};

window.generateSupplierReportHTMLPrint = function() {
    if (window.app && window.app.reportsManager) {
        return window.app.reportsManager.generateSupplierReportHTMLPrint();
    }
    console.error('Reports manager not available');
};

window.generateFastOrderReportHTMLPrint = function() {
    if (window.app && window.app.reportsManager) {
        return window.app.reportsManager.generateFastOrderReportHTMLPrint();
    }
    console.error('Reports manager not available');
};

// Quick Actions QR Codes generation function
window.generateQuickActionsQRPrint = function() {
    console.log('Generating Quick Actions QR codes for print...');
    
    // Ensure QRCode library is available
    if (typeof QRCode === 'undefined') {
        alert('QR Code library not available. Please refresh the page.');
        return;
    }
    
    // Action configurations (same as barcode scanner module)
    const actionConfigs = [
        { label: '+10 Units', data: 'ACTION_ADD_10', type: 'add' },
        { label: '+1 Unit', data: 'ACTION_ADD_1', type: 'add' },
        { label: '-10 Units', data: 'ACTION_SUB_10', type: 'subtract' },
        { label: '-1 Unit', data: 'ACTION_SUB_1', type: 'subtract' },
        { label: '+2 Units', data: 'ACTION_ADD_2', type: 'add' },
        { label: '+3 Units', data: 'ACTION_ADD_3', type: 'add' },
        { label: '-2 Units', data: 'ACTION_SUB_2', type: 'subtract' },
        { label: '-3 Units', data: 'ACTION_SUB_3', type: 'subtract' },
        { label: '+4 Units', data: 'ACTION_ADD_4', type: 'add' },
        { label: '+5 Units', data: 'ACTION_ADD_5', type: 'add' },
        { label: '-4 Units', data: 'ACTION_SUB_4', type: 'subtract' },
        { label: '-5 Units', data: 'ACTION_SUB_5', type: 'subtract' },
        { label: '+6 Units', data: 'ACTION_ADD_6', type: 'add' },
        { label: '+7 Units', data: 'ACTION_ADD_7', type: 'add' },
        { label: '-6 Units', data: 'ACTION_SUB_6', type: 'subtract' },
        { label: '-7 Units', data: 'ACTION_SUB_7', type: 'subtract' },
        { label: '+8 Units', data: 'ACTION_ADD_8', type: 'add' },
        { label: '+9 Units', data: 'ACTION_ADD_9', type: 'add' },
        { label: '-8 Units', data: 'ACTION_SUB_8', type: 'subtract' },
        { label: '-9 Units', data: 'ACTION_SUB_9', type: 'subtract' }
    ];
    
    // Create print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Quick Actions QR Codes</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    background: white;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 10px;
                }
                .qr-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                    margin: 20px 0;
                }
                .qr-item {
                    text-align: center;
                    border: 1px solid #ddd;
                    padding: 15px;
                    border-radius: 8px;
                    background: #f9f9f9;
                }
                .qr-item.add {
                    background: #e7f5e7;
                    border-color: #4CAF50;
                }
                .qr-item.subtract {
                    background: #ffeaea;
                    border-color: #f44336;
                }
                .qr-item h3 {
                    margin: 10px 0 5px 0;
                    font-size: 14px;
                    font-weight: bold;
                }
                .qr-container {
                    margin: 10px 0;
                }
                .instructions {
                    margin-top: 30px;
                    padding: 15px;
                    background: #f0f8ff;
                    border: 1px solid #4169E1;
                    border-radius: 5px;
                }
                .instructions h3 {
                    color: #4169E1;
                    margin-top: 0;
                }
                @media print {
                    body { margin: 10px; }
                    .qr-grid { gap: 15px; }
                    .qr-item { padding: 10px; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Quick Actions QR Codes</h1>
                <p>Scan these QR codes after scanning a product to quickly adjust inventory</p>
            </div>
            <div class="qr-grid" id="qrGrid">
                <!-- QR codes will be inserted here -->
            </div>
            <div class="instructions">
                <h3>How to Use:</h3>
                <ol>
                    <li>First, scan a product barcode/QR code in the Quick Stock Update section</li>
                    <li>Then, scan one of these action QR codes to adjust the quantity</li>
                    <li>Green QR codes add to inventory (+)</li>
                    <li>Red QR codes subtract from inventory (-)</li>
                </ol>
            </div>
        </body>
        </html>
    `);
    
    // Wait for the document to be ready, then generate QR codes
    printWindow.document.close();
    
    setTimeout(() => {
        const qrGrid = printWindow.document.getElementById('qrGrid');
        
        actionConfigs.forEach(action => {
            const qrItem = printWindow.document.createElement('div');
            qrItem.className = `qr-item ${action.type}`;
            
            const title = printWindow.document.createElement('h3');
            title.textContent = action.label;
            qrItem.appendChild(title);
            
            const qrContainer = printWindow.document.createElement('div');
            qrContainer.className = 'qr-container';
            qrItem.appendChild(qrContainer);
            
            const code = printWindow.document.createElement('p');
            code.textContent = action.data;
            code.style.fontSize = '10px';
            code.style.color = '#666';
            code.style.margin = '5px 0 0 0';
            qrItem.appendChild(code);
            
            qrGrid.appendChild(qrItem);
            
            // Generate QR code
            try {
                new QRCode(qrContainer, {
                    text: action.data,
                    width: 120,
                    height: 120,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (error) {
                console.error('Error generating QR code:', error);
                qrContainer.innerHTML = '<p>Error generating QR</p>';
            }
        });
        
        // Auto-print after a short delay
        setTimeout(() => {
            printWindow.print();
        }, 1000);
        
    }, 500);
};

// Scan-to-edit modal functions (minimal implementation)
window.handleScanToEditProductIdSubmit = async function() {
    const productIdInput = document.getElementById('scanToEditProductIdInput');
    const statusMessage = document.getElementById('scanToEditStatusMessage');
    const productId = productIdInput.value.trim();

    if (!productId) {
        statusMessage.textContent = 'Please enter a Product ID.';
        statusMessage.className = 'text-sm text-center text-warning-content';
        return;
    }

    statusMessage.textContent = 'Searching for product...';
    statusMessage.className = 'text-sm text-center text-info-content';

    try {
        const productDoc = await window.db.collection('inventory').doc(productId).get();
        if (productDoc.exists) {
            const product = productDoc.data();
            product.id = productId; // Ensure ID is set
            statusMessage.textContent = 'Product found. Loading details...';
            window.populateEditFormInModal(product);
            document.getElementById('scanToEditIdInputView').classList.add('hidden');
            document.getElementById('scanToEditFormView').classList.remove('hidden');
            document.getElementById('scanToEditModalTitle').textContent = `Editing: ${product.name}`;
        } else {
            statusMessage.textContent = `Product ID "${productId}" not found.`;
            statusMessage.className = 'text-sm text-center text-error-content';
        }
    } catch (error) {
        console.error("Error fetching product for edit:", error);
        statusMessage.textContent = 'Error fetching product. Please try again.';
        statusMessage.className = 'text-sm text-center text-error-content';
    }
};

window.populateEditFormInModal = function(product) {
    console.log('Populating edit form modal with product:', product);
    
    // Store current editing product ID
    window.currentEditingProductId = product.id;
    
    // Populate basic form fields
    const fields = [
        { id: 'scanToEdit_productName', value: product.name || '' },
        { id: 'scanToEdit_productQuantity', value: product.quantity !== undefined ? product.quantity : '' },
        { id: 'scanToEdit_productCost', value: product.cost !== undefined ? product.cost : '' },
        { id: 'scanToEdit_productMinQuantity', value: product.minQuantity !== undefined ? product.minQuantity : '' },
        { id: 'scanToEdit_productReorderQuantity', value: product.reorderQuantity !== undefined ? product.reorderQuantity : '' }
    ];
    
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) element.value = field.value;
    });
    
    // Populate supplier dropdown
    const supplierDropdown = document.getElementById('scanToEdit_productSupplier');
    if (supplierDropdown) {
        supplierDropdown.innerHTML = '<option value="">Select Supplier</option>';
        const suppliers = window.app?.suppliers || [];
        suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.name;
            option.textContent = supplier.name;
            if (product.supplier === supplier.name) option.selected = true;
            supplierDropdown.appendChild(option);
        });
        // Set current value
        supplierDropdown.value = product.supplier || "";
    }

    // Populate location dropdown
    const locationDropdown = document.getElementById('scanToEdit_productLocation');
    if (locationDropdown) {
        locationDropdown.innerHTML = '<option value="">Select Location</option>';
        const locations = window.app?.locations || [];
        locations.forEach(l => {
            const option = document.createElement('option');
            option.value = l.name;
            option.textContent = l.name;
            if (product.location === l.name) option.selected = true;
            locationDropdown.appendChild(option);
        });
        // Set current value
        locationDropdown.value = product.location || "";
    }
    
    // Handle product image
    const photoPreview = document.getElementById('scanToEdit_productPhotoPreview');
    if (photoPreview) {
        if (product.photoURL || product.photo) {
            photoPreview.src = product.photoURL || product.photo;
            photoPreview.classList.remove('hidden');
            window.scanToEditModalOriginalPhotoUrl = product.photoURL || product.photo;
        } else {
            photoPreview.src = '';
            photoPreview.classList.add('hidden');
            window.scanToEditModalOriginalPhotoUrl = null;
        }
    }
};

/**
 * Submit edit product from modal
 */
window.submitEditProductFromModal = async function() {
    const id = window.currentEditingProductId;
    if (!id) {
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast("Product ID is missing. Cannot update.", "error");
        }
        return;
    }

    const name = document.getElementById('scanToEdit_productName').value.trim();
    const quantity = parseInt(document.getElementById('scanToEdit_productQuantity').value) || 0;
    const cost = parseFloat(document.getElementById('scanToEdit_productCost').value) || 0;
    const minQuantity = parseInt(document.getElementById('scanToEdit_productMinQuantity').value) || 0;
    const reorderQuantity = parseInt(document.getElementById('scanToEdit_productReorderQuantity').value) || 0;
    const quantityOrdered = parseInt(document.getElementById('scanToEdit_productQuantityOrdered').value) || 0;
    const quantityBackordered = parseInt(document.getElementById('scanToEdit_productQuantityBackordered').value) || 0;
    const supplier = document.getElementById('scanToEdit_productSupplier').value;
    const location = document.getElementById('scanToEdit_productLocation').value;

    if (!name || !supplier || !location) {
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast("Please fill all required fields (Name, Supplier, Location).", "warning");
        }
        return;
    }
    
    if (quantity < 0 || cost < 0 || minQuantity < 0 || reorderQuantity < 0 || quantityOrdered < 0 || quantityBackordered < 0) {
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast("Numeric values (quantity, cost, etc.) cannot be negative.", "warning");
        }
        return;
    }

    const name_lowercase = name.toLowerCase();
    const name_words_lc = name_lowercase.split(' ').filter(word => word.length > 0);

    try {
        const productDataToUpdate = {
            name, 
            name_lowercase, 
            name_words_lc, 
            quantity, 
            cost, 
            minQuantity,
            reorderQuantity, 
            quantityOrdered, 
            quantityBackordered,
            supplier, 
            location
        };

        await window.db.collection('inventory').doc(id).update(productDataToUpdate);

        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast(`Product "${name}" updated successfully!`, 'success');
        }

        // Close the modal
        const modal = document.getElementById('scanToEditProductModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            
            // Reset modal views
            document.getElementById('scanToEditIdInputView').classList.remove('hidden');
            document.getElementById('scanToEditFormView').classList.add('hidden');
            document.getElementById('scanToEditProductIdInput').value = '';
        }

        // Refresh inventory data and displays
        if (typeof window.app !== 'undefined' && window.app.loadInventory) {
            await window.app.loadInventory();
            await window.app.displayInventory();
            await window.updateInventoryDashboard();
            await window.app.updateLowStockAlerts();
        }

    } catch (error) {
        console.error("Error updating product from modal:", error);
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast(`Error updating product: ${error.message}`, 'error');
        }
    }
};

/**
 * Move Product Modal Functions
 */
let currentMoveProductId = null;

/**
 * Submit move product from modal
 */
window.submitMoveProductFromModal = async function() {
    console.log('[submitMoveProductFromModal] Starting move product submission');
    
    // Get the product ID from the hidden field
    const productId = document.getElementById('moveProductModal_productId').value;
    if (!productId) {
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast("No product selected to move.", "error");
        }
        console.error('[submitMoveProductFromModal] No product ID found');
        return;
    }
    
    const newLocation = document.getElementById('moveProductModal_newLocation').value;
    if (!newLocation) {
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast("Please select a new location.", "warning");
        }
        console.error('[submitMoveProductFromModal] No new location selected');
        return;
    }

    try {
        console.log(`[submitMoveProductFromModal] Moving product ${productId} to ${newLocation}`);
        
        const productRef = window.db.collection('inventory').doc(productId);
        await productRef.update({ location: newLocation });

        const productName = document.getElementById('moveProductModal_productName').textContent;
        
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast(`Product "${productName}" moved to ${newLocation}.`, "success");
        }
        
        // Log activity if function exists
        if (typeof window.logActivity === 'function') {
            await window.logActivity('product_moved_modal', 
                `Product: ${productName} (ID: ${productId}) moved to ${newLocation} via modal.`, 
                productId, productName);
        }

        // Close the modal
        const modal = document.getElementById('moveProductModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        
        // Clear the stored product ID
        currentMoveProductId = null;
        document.getElementById('moveProductModal_productId').value = '';

        // Refresh inventory data and UI
        if (typeof window.app !== 'undefined' && window.app.loadInventory) {
            await window.app.loadInventory();
            await window.app.displayInventory();
            await window.updateInventoryDashboard();
        }

        console.log('[submitMoveProductFromModal] Product moved successfully');

    } catch (error) {
        console.error("Error moving product from modal:", error);
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast(`Error moving product: ${error.message}`, 'error');
        }
    }
};

export default app;
