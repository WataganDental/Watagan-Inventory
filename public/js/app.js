// Import the UI enhancement manager
import { uiEnhancementManager } from './modules/ui-enhancements.js';
import { InventoryManager } from './modules/inventory.js';

// +++++ START OF MOVED AND STUB FUNCTIONS +++++

// Function to create HTML for a single product row
function createProductRowHtml(item) {
    let rowClass = 'hover:bg-gray-50 dark:hover:bg-slate-750'; // Base classes
    if (item.quantity === 0) {
        rowClass = 'bg-error/20 hover:bg-error/30'; // Out of stock
    } else if (item.quantity <= item.minQuantity && item.minQuantity > 0) {
        rowClass = 'bg-warning/20 hover:bg-warning/30'; // Low stock
    }

    const photoUrl = item.photo || `https://picsum.photos/seed/${item.id}/40/40`; // Placeholder
    const placeholderSvg = `<svg class="w-full h-full text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`;

    // Ensure values are not null/undefined before calling methods like toFixed() or using them in template literals
    const itemName = item.name || 'N/A';
    const itemQuantity = item.quantity !== undefined ? item.quantity : 'N/A';
    const itemMinQuantity = item.minQuantity !== undefined ? item.minQuantity : 0;
    const itemReorderQuantity = item.reorderQuantity !== undefined ? item.reorderQuantity : 0;
    const itemCost = item.cost !== undefined ? item.cost : 0;
    const itemSupplier = item.supplier || 'N/A';
    const itemLocation = item.location || 'N/A';
    const itemQuantityOrdered = item.quantityOrdered !== undefined ? item.quantityOrdered : 0;
    const itemProductQuantityBackordered = item.productQuantityBackordered !== undefined ? item.productQuantityBackordered : 0;

    return `
        <tr class="${rowClass}" data-product-id="${item.id}">
            <td class="p-1 align-middle">
                <div class="avatar">
                    <div class="w-10 h-10 mask mask-circle">
                        <img src="${photoUrl}" alt="${itemName}" class="product-photo-thumb" data-img-url="${item.photo || ''}" onerror="this.onerror=null;this.parentElement.innerHTML='${placeholderSvg.replace(/"/g, '&quot;')}';"/>
                    </div>
                </div>
            </td>
            <td class="px-2 py-1 font-medium align-middle">${itemName}</td>
            <td class="px-2 py-1 text-center align-middle">${itemQuantity}</td>
            <td class="px-2 py-1 text-center align-middle hidden md:table-cell">${itemMinQuantity} / ${itemReorderQuantity}</td>
            <td class="px-2 py-1 text-right align-middle hidden lg:table-cell">$${itemCost.toFixed(2)}</td>
            <td class="px-2 py-1 align-middle hidden md:table-cell">${itemSupplier}</td>
            <td class="px-2 py-1 align-middle hidden lg:table-cell">${itemLocation}</td>
            <td class="px-2 py-1 text-center align-middle hidden xl:table-cell">${itemQuantityOrdered}</td>
            <td class="px-2 py-1 text-center align-middle hidden xl:table-cell">${itemProductQuantityBackordered}</td>
            <td class="p-1 align-middle text-center whitespace-nowrap">
                <div class="dropdown dropdown-end">
                    <label tabindex="0" class="btn btn-ghost btn-xs m-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                        </svg>
                    </label>
                    <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32 z-[1]">
                        <li><button class="btn btn-xs btn-ghost justify-start w-full edit-product-btn" data-product-id="${item.id}">Edit</button></li>
                        <li><button class="btn btn-xs btn-ghost justify-start w-full view-qr-btn" data-product-id="${item.id}">QR</button></li>
                        <li><button class="btn btn-xs btn-ghost justify-start w-full move-product-action-btn" data-product-id="${item.id}">Move</button></li>
                        <li><button class="btn btn-xs btn-ghost justify-start w-full delete-product-btn" data-product-id="${item.id}">Delete</button></li>
                    </ul>
                </div>
            </td>
        </tr>
    `;
}

function displayInventory(searchTerm = '', supplierFilter = '', locationFilter = '') {
    const inventoryTableBody = document.getElementById('inventoryTable');
    const loadingEl = document.getElementById('inventoryLoading');
    const errorEl = document.getElementById('inventoryError');
    const emptyStateEl = document.getElementById('inventoryEmptyState');

    const currentPageDisplay = document.getElementById('currentPageDisplay');
    const prevPageBtn = document.getElementById('prevPageBtn'); // UNCOMMENTED
    const nextPageBtn = document.getElementById('nextPageBtn'); // UNCOMMENTED
    const pageInfo = document.getElementById('pageInfo');

    if (!inventoryTableBody) {
        console.error("displayInventory: inventoryTable body not found.");
        if(errorEl) {
            errorEl.textContent = "Inventory table element not found in HTML.";
            errorEl.classList.remove('hidden');
        }
        return;
    }

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (emptyStateEl) emptyStateEl.classList.add('hidden');
    inventoryTableBody.innerHTML = '';

    let filteredInventory = inventory;

    if (!Array.isArray(inventory)) {
        console.error("Global inventory data is not loaded or not an array.");
        if (loadingEl) loadingEl.classList.add('hidden');
        if (errorEl) {
            errorEl.textContent = "Inventory data is not available. Please try reloading.";
            errorEl.classList.remove('hidden');
        }
        return;
    }

    const searchTermVal = document.getElementById('inventorySearchInput')?.value.toLowerCase() || searchTerm.toLowerCase();
    const supplierFilterVal = document.getElementById('filterSupplier')?.value || supplierFilter;
    const locationFilterVal = document.getElementById('filterLocation')?.value || locationFilter;

    if (searchTermVal) {
        filteredInventory = filteredInventory.filter(item =>
            (item.name && item.name.toLowerCase().includes(searchTermVal)) ||
            (item.id && item.id.toLowerCase().includes(searchTermVal))
        );
    }
    if (supplierFilterVal) {
        filteredInventory = filteredInventory.filter(item => item.supplier === supplierFilterVal);
    }
    if (locationFilterVal) {
        filteredInventory = filteredInventory.filter(item => item.location === locationFilterVal);
    }

    totalFilteredItems = filteredInventory.length;

    const totalPages = Math.ceil(totalFilteredItems / ITEMS_PER_PAGE) || 1;
    currentPage = Math.max(1, Math.min(currentPage, totalPages));

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedItems = filteredInventory.slice(startIndex, endIndex);

    if (loadingEl) loadingEl.classList.add('hidden');

    if (paginatedItems.length === 0) {
        if (emptyStateEl) {
            emptyStateEl.classList.remove('hidden');
            const emptyStateMessageContainer = emptyStateEl.querySelector('h3');
            if (emptyStateMessageContainer) emptyStateMessageContainer.textContent = "No products found matching your criteria.";
        } else {
            inventoryTableBody.innerHTML = `<tr><td colspan="10" class="text-center p-4">
                <div role="alert" class="alert alert-info justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span>No products found matching your criteria.</span>
                </div>
            </td></tr>`;
        }
    } else {
        paginatedItems.forEach(item => {
            // const row = inventoryTableBody.insertRow(); // We don't need to insert a blank row first
            // row.className and row.innerHTML are handled by createProductRowHtml
            inventoryTableBody.innerHTML += createProductRowHtml(item); // Append the full HTML string of the row
        });
    }

    if (currentPageDisplay) currentPageDisplay.textContent = `${currentPage} / ${totalPages}`;
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;

    if(pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}. Total items: ${totalFilteredItems}`;

    attachTableEventListeners();
    const idColumnToggleBtn = document.getElementById('toggleInventoryIDColumnBtn');
    const idCells = document.querySelectorAll('#inventoryTable .id-column');
    if (idColumnToggleBtn && idColumnToggleBtn.classList.contains('active')) {
        idCells.forEach(col => col.classList.remove('hidden'));
    } else {
        idCells.forEach(col => col.classList.add('hidden'));
    }
}

function attachTableEventListeners() {
    const table = document.getElementById('inventoryTable');
    if (!table) return;

    table.querySelectorAll('.edit-product-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', (e) => {
            const productId = e.currentTarget.dataset.productId;
            const productFormSection = document.getElementById('productManagement');
            if (productFormSection) productFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            const formCheckbox = document.getElementById('toggleProductFormCheckbox');
            if (formCheckbox) formCheckbox.checked = true;
            else {
                const productFormContent = document.getElementById('productFormContent');
                if(productFormContent) productFormContent.classList.remove('hidden');
            }
            editProduct(productId);
        });
    });

    table.querySelectorAll('.delete-product-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', (e) => deleteProduct(e.currentTarget.dataset.productId));
    });

    table.querySelectorAll('.move-product-action-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', (e) => {
            const productId = e.currentTarget.dataset.productId;
            const moveProductIdInput = document.getElementById('moveProductId');
            const batchActionsSection = document.getElementById('batchActions');
            const toggleMoveProductFormCheckbox = document.getElementById('toggleMoveProductFormBtn');

            if (moveProductIdInput && batchActionsSection && toggleMoveProductFormCheckbox) {
                moveProductIdInput.value = productId;
                batchActionsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                toggleMoveProductFormCheckbox.checked = true;
                setTimeout(() => document.getElementById('newLocation')?.focus(), 150);
            } else {
                uiEnhancementManager.showToast('Move product UI elements not found.', 'error');
            }
        });
    });

    table.querySelectorAll('.product-photo-thumb').forEach(img => {
        const newImg = img.cloneNode(true);
        img.parentNode.replaceChild(newImg, img);
        newImg.addEventListener('click', (e) => {
            const imageUrl = e.currentTarget.dataset.imgUrl;
            if (imageUrl && typeof openImageModal === 'function') {
                openImageModal(imageUrl);
            }
        });
    });
    table.querySelectorAll('.view-qr-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', (e) => {
            const productId = e.currentTarget.dataset.productId;
            if (typeof viewQRCode === 'function') {
                viewQRCode(productId);
            } else {
                console.error('viewQRCode function is not defined.');
                uiEnhancementManager.showToast('Error: QR Code function not available.', 'error');
            }
        });
    });
}

// +++++ END OF MOVED FUNCTIONS +++++

// Global State Variables for Barcode Scanner Mode
// let isBarcodeScannerModeActive = false; // No longer needed for camera-based scanning
// let qsuStream = null; // No longer needed for camera-based scanning
// let qsuAnimationLoopId = null; // No longer needed for camera-based scanning
let currentBarcodeModeProductId = null; // Still used to store the currently scanned/entered product ID for actions


// +++++ START OF STUB AND OTHER FUNCTIONS (MOVED EARLIER) +++++

function startUpdateScanner() { console.log('startUpdateScanner called - STUB'); }
function stopUpdateScanner() { console.log('stopUpdateScanner called - STUB'); }
function startMoveScanner() { console.log('startMoveScanner called - STUB'); }
function stopMoveScanner() { console.log('stopMoveScanner called - STUB'); }

/*
async function startQuickStockBarcodeScanner() {
    console.log('startQuickStockBarcodeScanner called');
    const video = document.getElementById('qsuVideo');
    const canvasElement = document.getElementById('qsuCanvas');
    const scanResultElement = document.getElementById('qsuScanResult');
    const startBtn = document.getElementById('qsuScanProductBtn');
    const stopBtn = document.getElementById('qsuStopScanBtn');
    const scannedProductInfoEl = document.getElementById('qsuScannedProductInfo');

    if (!video || !canvasElement || !scanResultElement || !startBtn || !stopBtn || !scannedProductInfoEl) {
        console.error('QSU Scanner: One or more UI elements are missing.');
        setBarcodeStatus('Scanner UI elements missing. Cannot start.', true);
        return;
    }

    scannedProductInfoEl.classList.add('hidden');
    setBarcodeStatus('Initializing scanner...', false);

    if (qsuStream) {
        qsuStream.getTracks().forEach(track => track.stop());
    }
    if (qsuAnimationLoopId) {
        cancelAnimationFrame(qsuAnimationLoopId);
    }

    try {
        qsuStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = qsuStream;
        video.classList.remove('hidden');
        video.play();

        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        isBarcodeScannerModeActive = true;
        setBarcodeStatus('Scanner active. Point camera at a product QR code.', false);
        scanResultElement.textContent = '';

        const canvas = canvasElement.getContext('2d', { willReadFrequently: true });

        function tick() {
            if (!isBarcodeScannerModeActive || !qsuStream) return;

            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvasElement.height = video.videoHeight;
                canvasElement.width = video.videoWidth;
                canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
                const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code) {
                    scanResultElement.textContent = `Found QR: ${code.data}`;
                    handleQuickStockScan(code.data);
                    return;
                }
            }
            if (isBarcodeScannerModeActive) {
                qsuAnimationLoopId = requestAnimationFrame(tick);
            }
        }
        qsuAnimationLoopId = requestAnimationFrame(tick);

    } catch (err) {
        console.error("Error starting QSU barcode scanner:", err);
        let userMessage = `Error: ${err.message}`;
        if (err.name === "NotFoundError") {
            userMessage = "No camera found. Please ensure a camera is connected and enabled.";
        } else if (err.name === "NotAllowedError") {
            userMessage = "Camera permission denied. Please allow camera access in your browser settings.";
        }
        setBarcodeStatus(userMessage, true);
        if(scanResultElement) scanResultElement.textContent = userMessage; // Added null check for safety
        isBarcodeScannerModeActive = false;
        if (qsuStream) {
            qsuStream.getTracks().forEach(track => track.stop());
        }
        video.classList.add('hidden');
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
    }
}
*/

/*
function stopQuickStockBarcodeScanner() {
    console.log('stopQuickStockBarcodeScanner called');
    const video = document.getElementById('qsuVideo');
    const startBtn = document.getElementById('qsuScanProductBtn');
    const stopBtn = document.getElementById('qsuStopScanBtn');
    const scanResultElement = document.getElementById('qsuScanResult');
    const scannedProductInfoEl = document.getElementById('qsuScannedProductInfo');

    if (qsuStream) {
        qsuStream.getTracks().forEach(track => track.stop());
        qsuStream = null;
    }
    if (qsuAnimationLoopId) {
        cancelAnimationFrame(qsuAnimationLoopId);
        qsuAnimationLoopId = null;
    }

    if (video) video.classList.add('hidden');
    if (startBtn) startBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');

    isBarcodeScannerModeActive = false;

    setBarcodeStatus('Scan a Product QR Code to begin.', false);
    if(scanResultElement) scanResultElement.textContent = '';
    if(scannedProductInfoEl) scannedProductInfoEl.classList.add('hidden');
}
*/

async function handleQuickStockScan(productId) {
    console.log("handleQuickStockScan called with Product ID:", productId);
    setBarcodeStatus(`Processing ID: ${productId}...`, false);

    // if (isBarcodeScannerModeActive) { // isBarcodeScannerModeActive might be repurposed or removed
        // stopQuickStockBarcodeScanner(); // This function is now commented out
    // }

    currentBarcodeModeProductId = productId; // This global variable is still useful

    const product = inventory.find(p => p.id === productId);

    const productNameEl = document.getElementById('qsuProductName');
    const currentStockEl = document.getElementById('qsuCurrentStock');
    const scannedProductInfoEl = document.getElementById('qsuScannedProductInfo');
    const productSpecificQREl = document.getElementById('barcodeProductSpecificQR');
    const productSpecificImageEl = document.getElementById('barcodeProductSpecificImage');

    if (!productNameEl || !currentStockEl || !scannedProductInfoEl || !productSpecificQREl || !productSpecificImageEl) {
        console.error("handleQuickStockScan: One or more UI elements for displaying product info are missing.");
        setBarcodeStatus("UI error displaying product info.", true);
        return;
    }

    if (product) {
        productNameEl.textContent = product.name;
        currentStockEl.textContent = product.quantity;
        scannedProductInfoEl.classList.remove('hidden');

        setBarcodeStatus(`Product: ${product.name}. Adjust quantity or scan action.`, false);
        setLastActionFeedback("Product identified.", false);

        productSpecificQREl.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(productSpecificQREl, {
                text: product.id,
                width: 80,
                height: 80,
                colorDark: document.documentElement.classList.contains('dark') ? "#FFFFFF" : "#000000",
                colorLight: document.documentElement.classList.contains('dark') ? "#4A5568" : "#FFFFFF",
            });
        }
        if (product.photo) {
            productSpecificImageEl.src = product.photo;
            productSpecificImageEl.classList.remove('hidden');
        } else {
            productSpecificImageEl.classList.add('hidden');
        }

        await displayBarcodeModeActionQRCodes();

    } else {
        productNameEl.textContent = 'N/A';
        currentStockEl.textContent = 'N/A';
        scannedProductInfoEl.classList.add('hidden');
        productSpecificQREl.innerHTML = '<span class="text-xs">N/A</span>';
        productSpecificImageEl.classList.add('hidden');

        setBarcodeStatus(`Product ID "${productId}" not found in inventory.`, true);
        setLastActionFeedback(`Failed to find product: ${productId}`, true);
        currentBarcodeModeProductId = null;
    }
}

async function adjustScannedProductQuantity(adjustmentType, quantityToAdjustStr) {
    const quantityToAdjust = parseInt(quantityToAdjustStr);
    const showToast = (message, type = 'info') => {
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast(message, type);
        } else {
            console.warn('uiEnhancementManager.showToast not available. Message:', message);
            // Fallback or alternative notification if needed
            setLastActionFeedback(message, type === 'error' || type === 'warning');
        }
    };

    if (!currentBarcodeModeProductId) {
        showToast("No active product selected for quantity adjustment.", 'error');
        setLastActionFeedback("No active product selected for quantity adjustment.", true); // Keep for non-toast UI
        return;
    }
    if (isNaN(quantityToAdjust) || quantityToAdjust <= 0) {
        showToast("Invalid quantity for adjustment. Must be a positive number.", 'error');
        setLastActionFeedback("Invalid quantity for adjustment.", true); // Keep for non-toast UI
        return;
    }

    try {
        const productRef = db.collection('inventory').doc(currentBarcodeModeProductId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            const msg = `Product ${currentBarcodeModeProductId} not found in database.`;
            showToast(msg, 'error');
            setLastActionFeedback(msg, true);
            return;
        }

        const productData = productDoc.data();
        let currentQuantity = productData.quantity;
        let newQuantity;
        let successMessage = '';

        if (adjustmentType === 'increment') {
            newQuantity = currentQuantity + quantityToAdjust;
            await productRef.update({ quantity: newQuantity });
            successMessage = `Added ${quantityToAdjust} to ${productData.name}. New stock: ${newQuantity}`;
            showToast(successMessage, 'success');
            setLastActionFeedback(successMessage, false);
            await logActivity('stock_adjusted_scan', `Product: ${productData.name} quantity increased by ${quantityToAdjust} (New: ${newQuantity})`, currentBarcodeModeProductId, productData.name);
        } else if (adjustmentType === 'decrement') {
            if (currentQuantity >= quantityToAdjust) {
                newQuantity = currentQuantity - quantityToAdjust;
                await productRef.update({ quantity: newQuantity });
                successMessage = `Removed ${quantityToAdjust} from ${productData.name}. New stock: ${newQuantity}`;
                showToast(successMessage, 'success');
                setLastActionFeedback(successMessage, false);
                await logActivity('stock_adjusted_scan', `Product: ${productData.name} quantity decreased by ${quantityToAdjust} (New: ${newQuantity})`, currentBarcodeModeProductId, productData.name);
            } else {
                const errMsg = `Cannot remove ${quantityToAdjust}. Only ${currentQuantity} in stock for ${productData.name}.`;
                showToast(errMsg, 'warning');
                setLastActionFeedback(errMsg, true);
                return;
            }
        } else {
            const errMsg = "Invalid adjustment type specified.";
            showToast(errMsg, 'error');
            setLastActionFeedback(errMsg, true);
            return;
        }

        // Update local inventory array
        const inventoryIndex = inventory.findIndex(p => p.id === currentBarcodeModeProductId);
        if (inventoryIndex !== -1) {
            inventory[inventoryIndex].quantity = newQuantity;
        }

        // Update UI elements
        const currentStockEl = document.getElementById('qsuCurrentStock');
        if (currentStockEl) {
            currentStockEl.textContent = newQuantity;
        }

        // Refresh relevant parts of the UI
        if (document.getElementById('inventoryViewContainer') && !document.getElementById('inventoryViewContainer').classList.contains('hidden')) {
            displayInventory();
        }
        updateInventoryDashboard();
        updateToOrderTable(); // Ensure this is robust

    } catch (error) {
        console.error("Error adjusting product quantity:", error);
        const errMsg = `Error updating stock: ${error.message}`;
        showToast(errMsg, 'error');
        setLastActionFeedback(errMsg, true);
    }
}

function addQuickStockManualEntry() { console.log('addQuickStockManualEntry called - STUB'); }
function submitQuickStockBatch() { console.log('submitQuickStockBatch called - STUB'); }
function handleQuickStockProductSearch() { console.log('handleQuickStockProductSearch called - STUB'); }
function handleQuickStockFileUpload() { console.log('handleQuickStockFileUpload called - STUB'); }
function processQuickStockUploadedFile() { console.log('processQuickStockUploadedFile called - STUB'); }
async function handleAddOrder() {
    console.log('[handleAddOrder] Initiated.');
    const productId = document.getElementById('orderProductId').value;
    const supplierId = document.getElementById('orderSupplierId')?.value;
    const quantityInput = document.getElementById('orderQuantity');
    const costInput = document.getElementById('orderCost');
    const quantity = parseInt(quantityInput.value);
    const cost = parseFloat(costInput?.value) || 0;

    if (!productId) {
        uiEnhancementManager.showToast('Please select a product to order.', 'warning');
        console.warn('[handleAddOrder] No product selected.');
        return;
    }
    
    if (!supplierId) {
        uiEnhancementManager.showToast('Please select a supplier.', 'warning');
        console.warn('[handleAddOrder] No supplier selected.');
        return;
    }
    
    if (isNaN(quantity) || quantity <= 0) {
        uiEnhancementManager.showToast('Please enter a valid quantity greater than 0.', 'warning');
        console.warn('[handleAddOrder] Invalid quantity:', quantityInput.value);
        return;
    }

    if (cost <= 0) {
        uiEnhancementManager.showToast('Please enter a valid cost per unit.', 'warning');
        console.warn('[handleAddOrder] Invalid cost:', cost);
        return;
    }

    const product = inventory.find(p => p.id === productId);
    if (!product) {
        uiEnhancementManager.showToast('Selected product not found in local inventory. Please refresh.', 'error');
        console.error('[handleAddOrder] Product not found in local inventory array for ID:', productId);
        return;
    }

    const user = firebase.auth().currentUser;
    if (!user) {
        uiEnhancementManager.showToast('You must be logged in to create an order.', 'error');
        console.warn('[handleAddOrder] User not authenticated.');
        return;
    }

    try {
        // Find supplier details
        const supplier = suppliers.find(s => s.id === supplierId || s.name === supplierId);
        const supplierName = supplier ? supplier.name : supplierId;

        const orderData = {
            productId: productId,
            productName: product.name,
            quantity: quantity,
            cost: cost,
            totalCost: quantity * cost,
            status: 'pending',
            orderDate: firebase.firestore.Timestamp.now(),
            createdAt: firebase.firestore.Timestamp.now(),
            userId: user.uid,
            supplier: supplierName,
            supplierId: supplierId,
            notes: 'Order created from orders section'
        };

        const orderRef = await db.collection('orders').add(orderData);
        console.log('[handleAddOrder] Order created successfully in Firestore with ID:', orderRef.id);

        // Atomically update quantityOrdered for the product
        const productRef = db.collection('inventory').doc(productId);
        await db.runTransaction(async (transaction) => {
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists) {
                throw new Error(`Product document with ID ${productId} not found in inventory.`);
            }
            const currentQuantityOrdered = productDoc.data().quantityOrdered || 0;
            transaction.update(productRef, { quantityOrdered: currentQuantityOrdered + quantity });
        });
        console.log(`[handleAddOrder] Successfully updated quantityOrdered for product ${productId} by ${quantity}.`);

        await logActivity('order_created', `Order for ${quantity} of ${product.name} (Order ID: ${orderRef.id}) created.`, orderRef.id, product.name);
        uiEnhancementManager.showToast(`Order for ${product.name} created successfully!`, 'success');

        // Clear form fields
        document.getElementById('orderProductId').value = '';
        if (document.getElementById('orderSupplierId')) document.getElementById('orderSupplierId').value = '';
        quantityInput.value = '';
        if (costInput) costInput.value = '';

        // Refresh UI components
        console.log('[handleAddOrder] Refreshing UI components...');
        await loadAndDisplayOrders(); // Refresh orders list

        inventory = await inventoryManager.loadInventory(); // Refresh global inventory
        displayInventory(); // Refresh main inventory table
        updateInventoryDashboard(); // Update dashboard stats
        updateToOrderTable(); // Update "to order" table
        populateProductsDropdown(); // Re-populate products dropdown for new orders
        if (typeof displayPendingOrdersOnDashboard === "function") {
            displayPendingOrdersOnDashboard(); // Refresh pending orders on dashboard
        }

        console.log('[handleAddOrder] Process completed successfully.');

    } catch (error) {
        console.error('[handleAddOrder] Error creating order:', error);
        uiEnhancementManager.showToast(`Error creating order: ${error.message}`, 'error');
    }
}

function switchQuickUpdateTab(tabIdToActivate) {
    console.log(`switchQuickUpdateTab called for: ${tabIdToActivate}`);

    const tabButtons = [
        document.getElementById('barcodeScannerModeTab'),
        document.getElementById('manualBatchModeTab'),
        // document.getElementById('fileUploadModeTab') // If you add this tab back
    ].filter(btn => btn !== null);

    const tabContents = [
        document.getElementById('barcodeScannerModeContent'),
        document.getElementById('manualBatchModeContent'),
        // document.getElementById('fileUploadModeContent') // If you add this tab back
    ].filter(content => content !== null);

    let activeContentId = null;

    // Classes for active/inactive tabs (Tailwind based on provided HTML)
    const activeTabClasses = ['border-blue-600', 'text-blue-600', 'dark:border-blue-500', 'dark:text-blue-500'];
    const inactiveTabClasses = ['border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'dark:hover:text-gray-300'];

    tabButtons.forEach(button => {
        const contentId = button.getAttribute('data-tabs-target'); // e.g., "#barcodeScannerModeContent"
        const contentElement = contentId ? document.querySelector(contentId) : null;

        if (button.id === tabIdToActivate) {
            // Activate this tab and content
            button.setAttribute('aria-selected', 'true');
            activeTabClasses.forEach(cls => button.classList.add(cls));
            inactiveTabClasses.forEach(cls => button.classList.remove(cls));
            if (contentElement) {
                contentElement.classList.remove('hidden');
                activeContentId = contentElement.id;
                console.log(`Showing content: ${activeContentId}`);
            } else {
                console.warn(`Content panel for tab ${button.id} (target: ${contentId}) not found.`);
            }
        } else {
            // Deactivate other tabs and content
            button.setAttribute('aria-selected', 'false');
            activeTabClasses.forEach(cls => button.classList.remove(cls));
            inactiveTabClasses.forEach(cls => button.classList.add(cls));
            if (contentElement) {
                contentElement.classList.add('hidden');
                console.log(`Hiding content: ${contentElement.id}`);

                // If we are hiding a tab that might have an active scanner, stop it.
                // The camera scanner is removed, so stopQuickStockBarcodeScanner is commented out.
                // if (contentElement.id === 'barcodeScannerModeContent' && typeof stopQuickStockBarcodeScanner === 'function' && typeof isBarcodeScannerModeActive !== 'undefined' && isBarcodeScannerModeActive) {
                //     console.log('Switching away from Barcode Scanner Mode, stopping scanner.');
                //     stopQuickStockBarcodeScanner();
                // }
                if (contentElement.id === 'manualBatchModeContent') { // Assuming manual batch might use scanners too
                    if (typeof stopUpdateScanner === 'function' && document.getElementById('updateVideo') && !document.getElementById('updateVideo').classList.contains('hidden')) {
                        console.log('Switching away from Manual Batch Mode with active update scanner, stopping it.');
                        stopUpdateScanner();
                    }
                }
            }
        }
    });

    // Specific actions when a tab becomes active
    if (activeContentId === 'barcodeScannerModeContent') {
        console.log('Barcode Scanner Mode tab activated.');
        setBarcodeStatus('Ready for barcode input. Scan or type Product ID and press Enter.', false);
        setLastActionFeedback('---', false);
        const scannedProductInfoEl = document.getElementById('qsuScannedProductInfo');
        if(scannedProductInfoEl) scannedProductInfoEl.classList.add('hidden');
        const qsuBarcodeIdInput = document.getElementById('qsuBarcodeIdInput');
        if (qsuBarcodeIdInput) {
            qsuBarcodeIdInput.value = ''; // Clear previous input
            qsuBarcodeIdInput.focus();
        }
    } else if (activeContentId === 'manualBatchModeContent') {
        console.log('Manual Batch Entry tab activated.');
        const updateScanResultEl = document.getElementById('updateScanResult');
        if(updateScanResultEl) updateScanResultEl.textContent = '';
        // Potentially focus first input or clear previous batch entries if desired
    }
    // Add more else if blocks for other tabs like fileUploadModeContent if re-enabled

    if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
        uiEnhancementManager.showToast(`Switched to ${document.getElementById(tabIdToActivate)?.textContent || tabIdToActivate} tab.`, 'info');
    } else {
        console.warn('uiEnhancementManager or showToast not available for tab switch notification.');
    }
}

function generateFastOrderReportPDF() { console.log('generateFastOrderReportPDF called - STUB'); }
function generateOrderReportPDFWithQRCodes() { console.log('generateOrderReportPDFWithQRCodes called - STUB'); }
function generateAllQRCodesPDF() { console.log('generateAllQRCodesPDF called - STUB'); }
function generateProductUsageChart(productId) { console.log(`generateProductUsageChart called for ${productId} - STUB`); }
window.viewOrderDetails = async function(orderId) {
    console.log(`viewOrderDetails called for order ID: ${orderId}`);
    if (!db) {
        console.error("Firestore (db) is not initialized.");
        uiEnhancementManager.showToast("Error: Database connection not available.", "error");
        return;
    }

    try {
        const orderRef = db.collection('orders').doc(orderId);
        const doc = await orderRef.get();

        if (doc.exists) {
            const orderData = doc.data();
            console.log("Order data for modal:", orderData);

            // Populate modal fields
            document.getElementById('modalOrderId').textContent = doc.id;
            document.getElementById('modalProductName').textContent = orderData.productName || 'N/A';
            document.getElementById('modalOrderQuantity').textContent = orderData.quantity;
            document.getElementById('modalCurrentStatus').textContent = orderData.status;

            let orderDateText = 'N/A';
            if (orderData.orderDate && orderData.orderDate.toDate) {
                orderDateText = orderData.orderDate.toDate().toLocaleString();
            } else if (orderData.createdAt && orderData.createdAt.toDate) {
                orderDateText = orderData.createdAt.toDate().toLocaleString();
            }
            document.getElementById('modalOrderDate').textContent = orderDateText;

            // Set dropdown to current status
            const statusSelect = document.getElementById('modalOrderStatusSelect');
            if (statusSelect) {
                statusSelect.value = orderData.status;
            }

            // Store orderId for the save button
            currentModalOrderId = doc.id;

            // Open the modal
            openOrderDetailsModal();

        } else {
            console.log("No such order found!");
            uiEnhancementManager.showToast("Order not found.", "error");
        }
    } catch (error) {
        console.error("Error fetching order details for modal: ", error);
        uiEnhancementManager.showToast("Error fetching order details: " + error.message, "error");
    }
}

function populateTrendProductSelect() { console.log('populateTrendProductSelect called - STUB'); }

async function logActivity(actionType, details, itemId = null, itemName = null) {
    try {
        const user = firebase.auth().currentUser;
        const logObject = {
            actionType: actionType,
            details: details,
            itemId: itemId,
            itemName: itemName,
            userId: user ? user.uid : 'anonymous',
            userEmail: user ? user.email : 'anonymous',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log('Activity Logged (stub):', logObject);

        // Firestore write will be enabled in a later step
        if (db) {
            await db.collection('activity_log').add(logObject);
            console.log('Activity written to Firestore.');
        } else {
            console.warn('Firestore db instance not available for logActivity.');
        }
    } catch (error) {
        console.error('Error in logActivity:', error);
    }
}

function updateEnhancedDashboard() {
    console.log('updateEnhancedDashboard called - IMPLEMENTING');

    const totalProductsEl = document.getElementById('dashboardTotalProducts');
    const lowStockItemsEl = document.getElementById('dashboardLowStockItems');
    const outOfStockItemsEl = document.getElementById('dashboardOutOfStockItems');
    const totalValueEl = document.getElementById('dashboardTotalValue');
    const recentActivityListEl = document.getElementById('recentActivityList');

    if (!totalProductsEl || !lowStockItemsEl || !outOfStockItemsEl || !totalValueEl || !recentActivityListEl) {
        console.error('Dashboard elements not found. Aborting updateEnhancedDashboard.');
        return;
    }

    if (!inventory || inventory.length === 0) {
        console.warn('Inventory data is not available for dashboard update.');
        totalProductsEl.textContent = '0';
        lowStockItemsEl.textContent = '0';
        outOfStockItemsEl.textContent = '0';
        totalValueEl.textContent = '$0.00';
        recentActivityListEl.innerHTML = `
            <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                No inventory data to display stats.
            </div>`;
        return;
    }

    const totalProducts = inventory.length;
    const lowStockItems = inventory.filter(item => item.quantity <= item.minQuantity && item.minQuantity > 0).length;
    const outOfStockItems = inventory.filter(item => item.quantity === 0).length;
    const totalValue = inventory.reduce((sum, item) => {
        const cost = parseFloat(item.cost) || 0;
        const quantity = parseInt(item.quantity) || 0;
        return sum + (quantity * cost);
    }, 0);

    totalProductsEl.textContent = totalProducts;
    lowStockItemsEl.textContent = lowStockItems;
    outOfStockItemsEl.textContent = outOfStockItems;
    totalValueEl.textContent = `$${totalValue.toFixed(2)}`;

    // Fetch and display Recent Activity
    if (db) {
        db.collection('activity_log').orderBy('timestamp', 'desc').limit(10).get()
            .then(snapshot => {
                if (snapshot.empty) {
                    recentActivityListEl.innerHTML = `
                        <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            No recent activity found.
                        </div>`;
                    return;
                }
                let activitiesHtml = '';
                snapshot.docs.forEach(doc => {
                    const activity = doc.data();
                    const userDisplay = activity.userEmail || activity.userId || 'System';
                    const timestamp = activity.timestamp ? activity.timestamp.toDate().toLocaleString() : 'N/A';
                    const itemInfo = activity.itemName ? `${activity.details} for ${activity.itemName}` : activity.details;

                    activitiesHtml += `
                        <li class="py-1 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                            <p class="text-sm text-gray-700 dark:text-gray-300">${itemInfo}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">By: ${userDisplay} at ${timestamp}</p>
                        </li>`;
                });
                recentActivityListEl.innerHTML = `<ul class="space-y-1">${activitiesHtml}</ul>`;
            })
            .catch(error => {
                console.error("Error fetching recent activity:", error);
                recentActivityListEl.innerHTML = `
                    <div class="flex items-center text-sm text-red-500 dark:text-red-400">
                        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                        Error loading recent activity.
                    </div>`;
            });
    } else {
        recentActivityListEl.innerHTML = `
            <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Recent activity (DB not ready).
            </div>`;
    }
    console.log('Dashboard stats updated, activity feed initiated.');
}

// START: Order Processing Functions
async function processFullReceipt(orderId, orderData, productData, productRef, finalStatus = 'received') {
    console.log(`[processFullReceipt] Processing full receipt for order ${orderId}, final status: ${finalStatus}`);
    if (!orderData || !productData || !productRef) {
        uiEnhancementManager.showToast("Missing data for full receipt processing.", "error");
        console.error("[processFullReceipt] Missing orderData, productData, or productRef.");
        return;
    }

    const orderRefFs = db.collection('orders').doc(orderId);
    const quantityReceived = orderData.quantity; // For full receipt, quantity received is the total ordered quantity

    try {
        // Update inventory: increase quantity, decrease quantityOrdered
        const newInventoryQuantity = (productData.quantity || 0) + quantityReceived;
        const newInventoryQuantityOrdered = Math.max(0, (productData.quantityOrdered || 0) - quantityReceived);

        await productRef.update({
            quantity: newInventoryQuantity,
            quantityOrdered: newInventoryQuantityOrdered
        });
        console.log(`[processFullReceipt] Inventory updated for product ${productData.id}: quantity=${newInventoryQuantity}, quantityOrdered=${newInventoryQuantityOrdered}`);

        // Update order status to the specified final status
        await orderRefFs.update({ status: finalStatus });
        console.log(`[processFullReceipt] Order ${orderId} status updated to '${finalStatus}'.`);

        const statusText = finalStatus === 'fulfilled' ? 'fulfilled' : 'received';
        uiEnhancementManager.showToast(`Order ${orderId} ${statusText}. Inventory updated.`, "success");
        await logActivity('order_received_full', `Order ${orderId} (${orderData.productName}) ${statusText}. Quantity: ${quantityReceived}.`, orderId, orderData.productName);

        // Update local inventory array for immediate UI reflection
        const localProductIndex = inventory.findIndex(p => p.id === productData.id);
        if (localProductIndex !== -1) {
            inventory[localProductIndex].quantity = newInventoryQuantity;
            inventory[localProductIndex].quantityOrdered = newInventoryQuantityOrdered;
        }

    } catch (error) {
        console.error(`[processFullReceipt] Error processing full receipt for order ${orderId}:`, error);
        uiEnhancementManager.showToast(`Error processing full receipt for ${orderId}: ${error.message}`, "error");
    }
}


async function processPartialReceipt(orderId, orderData, productData, productRef, quantityActuallyReceived) {
    console.log(`[processPartialReceipt] Processing partial receipt for order ${orderId}, quantity: ${quantityActuallyReceived}`);
    if (!orderData || !productData || !productRef || isNaN(quantityActuallyReceived) || quantityActuallyReceived <= 0) {
        uiEnhancementManager.showToast("Invalid data for partial receipt processing.", "error");
        console.error("[processPartialReceipt] Missing or invalid data:", { orderData, productData, productRef, quantityActuallyReceived });
        return;
    }

    const orderRefFs = db.collection('orders').doc(orderId);
    const quantityRemainingForBackorder = orderData.quantity - quantityActuallyReceived;

    if (quantityRemainingForBackorder <= 0) {
        uiEnhancementManager.showToast("Quantity received is full or exceeds order. Use 'Received' status.", "warning");
        console.warn("[processPartialReceipt] Quantity received implies full receipt. Aborting partial.");
        return; // Or call processFullReceipt
    }

    try {
        // 1. Update Inventory
        const newInventoryQuantity = (productData.quantity || 0) + quantityActuallyReceived;
        const newInventoryQuantityOrdered = Math.max(0, (productData.quantityOrdered || 0) - quantityActuallyReceived);
        // productQuantityBackordered on the product itself tracks total backordered units for THIS product,
        // not specifically from this single order. So we add the new backorder quantity to it.
        const newProductQuantityBackordered = (productData.productQuantityBackordered || 0) + quantityRemainingForBackorder;


        await productRef.update({
            quantity: newInventoryQuantity,
            quantityOrdered: newInventoryQuantityOrdered,
            productQuantityBackordered: newProductQuantityBackordered
        });
        console.log(`[processPartialReceipt] Inventory updated for product ${productData.id}: quantity=${newInventoryQuantity}, quantityOrdered=${newInventoryQuantityOrdered}, productQuantityBackordered=${newProductQuantityBackordered}`);

        // 2. Update Original Order
        await orderRefFs.update({
            status: 'partially_received',
            quantityReceived: quantityActuallyReceived,
            quantityBackordered: quantityRemainingForBackorder
            // The original order.quantity remains the total initially ordered.
        });
        console.log(`[processPartialReceipt] Original order ${orderId} updated to 'partially_received'.`);

        // 3. Create New Backorder Document
        const backorderData = {
            productId: orderData.productId,
            productName: orderData.productName,
            quantity: quantityRemainingForBackorder,
            status: 'backordered', // New status for this new order
            originalOrderId: orderId, // Link to the original partially received order
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            supplier: productData.supplier, // Assuming productData has supplier info
            userId: orderData.userId || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : 'unknown')
        };
        const newBackorderRef = await db.collection('orders').add(backorderData);
        console.log(`[processPartialReceipt] New backorder document created with ID: ${newBackorderRef.id}`);

        // Log Activities
        await logActivity('order_received_partial', `Order ${orderId} (${orderData.productName}) partially received. Quantity: ${quantityActuallyReceived}.`, orderId, orderData.productName);
        await logActivity('backorder_created', `Backorder for ${quantityRemainingForBackorder} of ${orderData.productName} (from order ${orderId}) created. New Order ID: ${newBackorderRef.id}`, newBackorderRef.id, orderData.productName);

        uiEnhancementManager.showToast(`Order ${orderId} partially received. Backorder for ${quantityRemainingForBackorder} units created.`, "success");

        // Update local inventory array
        const localProductIndex = inventory.findIndex(p => p.id === productData.id);
        if (localProductIndex !== -1) {
            inventory[localProductIndex].quantity = newInventoryQuantity;
            inventory[localProductIndex].quantityOrdered = newInventoryQuantityOrdered;
            inventory[localProductIndex].productQuantityBackordered = newProductQuantityBackordered;
        }

    } catch (error) {
        console.error(`[processPartialReceipt] Error processing partial receipt for order ${orderId}:`, error);
        uiEnhancementManager.showToast(`Error processing partial receipt for ${orderId}: ${error.message}`, "error");
    }
}
// END: Order Processing Functions


// +++++ END OF STUB FUNCTIONS +++++

const SIDEBAR_STATE_KEY = 'sidebarMinimized';

// Global variables for edit scan mode
let isEditScanModeActive = false;
let editScanInputBuffer = "";

let stream = null;
let photoStream = null;
let inventory = []; // Holds the full inventory list, populated by loadInventory()
let suppliers = [];
let locations = []; // Added for location management
let batchUpdates = [];
let db; // Declare db globally
let storage; // Declare storage globally
let inventoryManager; // Declare inventory manager globally
let originalPhotoUrlForEdit = ''; // Stores the original photo URL when editing a product

// Global variables for Quick Stock Update
let quickStockBarcodeBuffer = ""; // Used by Manual Batch (indirectly via keypress), and Barcode Scanner modes

// Global State Variables for Barcode Scanner Mode (already defined above with qsuStream, qsuAnimationLoopId)
// let currentBarcodeModeProductId = null; // Declaration moved up
// let isBarcodeScannerModeActive = false; // Declaration moved up
// let qsuStream = null; // Declaration moved up
// let qsuAnimationLoopId = null; // Declaration moved up

// Pagination Global Variables
let currentPage = 1;
const ITEMS_PER_PAGE = 25;
let totalFilteredItems = 0;

// Lazy Loading Global Variable
let imageObserver = null;
let productIdsWithClientBackorders = []; // Added for new highlighting logic

let currentUserRole = null; // Ensure this is global for access by updateUserInterfaceForRole and auth changes

function updateUserInterfaceForRole(role) {
  console.log("Updating UI for role:", role);

  const menuSuppliers = document.getElementById('menuSuppliers');
  const addSupplierBtn = document.getElementById('addSupplierBtn');
  const addLocationBtn = document.getElementById('addLocationBtn');
  const supplierFormContent = document.getElementById('supplierFormContent');
  const locationFormContent = document.getElementById('locationFormContent');
  const menuUserManagement = document.getElementById('menuUserManagement');

  // Default to hiding elements that require admin role
  if (menuSuppliers && menuSuppliers.parentElement) menuSuppliers.parentElement.classList.add('hidden'); // Assuming hidden on <li>
  if (addSupplierBtn) addSupplierBtn.classList.add('hidden');
  if (addLocationBtn) addLocationBtn.classList.add('hidden');
  if (supplierFormContent) supplierFormContent.classList.add('hidden');
  if (locationFormContent) locationFormContent.classList.add('hidden');
  if (menuUserManagement && menuUserManagement.parentElement) menuUserManagement.parentElement.classList.add('hidden');


  if (role === 'admin') {
    if (menuSuppliers && menuSuppliers.parentElement) menuSuppliers.parentElement.classList.remove('hidden');
    if (addSupplierBtn) addSupplierBtn.classList.remove('hidden');
    if (addLocationBtn) addLocationBtn.classList.remove('hidden');
    if (supplierFormContent) supplierFormContent.classList.remove('hidden');
    if (locationFormContent) locationFormContent.classList.remove('hidden');
    if (menuUserManagement && menuUserManagement.parentElement) menuUserManagement.parentElement.classList.remove('hidden');
  } else if (role === 'staff') {
    // Staff-specific UI adjustments can go here if needed.
    // Most are covered by default hiding.
  } else {
    console.warn("Unknown or null role for UI update:", role, "Applying most restrictive UI.");
  }
}


// Debug function to check UI container visibility
function debugUIContainers() {
  const containers = [
    'authContainer',
    'appNavbar',
    'appMainContainer',
    'mainContent',
    'dashboardViewContainer',
    'inventoryViewContainer'
  ];

  console.log('=== UI CONTAINER DEBUG ===');
  containers.forEach(containerId => {
    const element = document.getElementById(containerId);
    if (element) {
      const isHidden = element.classList.contains('hidden');
      const computedStyle = window.getComputedStyle(element);
      const display = computedStyle.display;
      const visibility = computedStyle.visibility;
      const opacity = computedStyle.opacity;

      console.log(`${containerId}:`, {
        exists: true,
        hidden: isHidden,
        display: display,
        visibility: visibility,
        opacity: opacity,
        classList: Array.from(element.classList)
      });
    } else {
      console.log(`${containerId}: NOT FOUND`);
    }
  });
  console.log('=== END DEBUG ===');
}

// Add debug function to window for console access
window.debugUIContainers = debugUIContainers;

// Corrected showView function
function showView(viewIdToShow, clickedMenuId) {
  console.log(`[showView] Attempting to show view: ${viewIdToShow}, triggered by: ${clickedMenuId || 'system'}`);

  const mainViewContainerIds = [
    'dashboardViewContainer',
    'inventoryViewContainer',
    'suppliersAndLocationsContainer',
    'ordersSectionContainer',
    'reportsSectionContainer',
    'quickStockUpdateContainer',
    'userManagementSectionContainer'
  ];

  // Explicitly hide all main view containers first
  mainViewContainerIds.forEach(id => {
    const containerToHide = document.getElementById(id);
    if (containerToHide) {
      if (!containerToHide.classList.contains('hidden')) {
        containerToHide.classList.add('hidden');
        // console.log(`[showView] Explicitly hid: ${id}`); // Keep for debugging if needed
      }
    } else {
      // This warning is important to catch if a view ID is misspelled or missing from HTML
      // Ensure all actual view container IDs used in your HTML are in mainViewContainerIds.
      console.warn(`[showView] Container ID ${id} not found in DOM during hide all phase. Check HTML and mainViewContainerIds list.`);
    }
  });

  // Now, show the target view
  const targetView = document.getElementById(viewIdToShow);
  if (targetView) {
    console.log(`[showView] Before removing 'hidden' from ${viewIdToShow}, classList: ${targetView.classList}`);
    targetView.classList.remove('hidden');
    console.log(`[showView] Made visible: ${targetView.id}, classList after: ${targetView.classList}`);

    // VIEW SPECIFIC INITIALIZATIONS
    if (targetView.id === 'dashboardViewContainer') {
        console.log('[showView] Initializing dashboardViewContainer.');
        // Log children state for dashboard
        const dashboardChildrenIds = ['dashboardStatsBar', 'dashboardQuickActions', 'dashboardPendingOrdersSection', 'dashboardRecentActivity']; // Assuming these are IDs of main sections
        const dashboardStatsBar = targetView.querySelector('.stats'); // First stats bar
        const quickActionsGrid = targetView.querySelector('.grid.grid-cols-1.md\\:grid-cols-3'); // Quick actions grid
        const pendingOrdersSection = document.getElementById('dashboardPendingOrdersSection'); // Specific ID
        const recentActivitySection = targetView.querySelector('section:last-child .card-body #recentActivityList'); // More specific to recent activity list

        console.log(`[showView] Dashboard children check:`);
        if (dashboardStatsBar) console.log(`  Stats Bar: hidden? ${dashboardStatsBar.classList.contains('hidden')}, display: ${window.getComputedStyle(dashboardStatsBar).display}`); else console.log("  Stats Bar section not found by selector.");
        if (quickActionsGrid) console.log(`  Quick Actions Grid: hidden? ${quickActionsGrid.classList.contains('hidden')}, display: ${window.getComputedStyle(quickActionsGrid).display}`); else console.log("  Quick Actions Grid not found by selector.");
        if (pendingOrdersSection) console.log(`  Pending Orders Section: hidden? ${pendingOrdersSection.classList.contains('hidden')}, display: ${window.getComputedStyle(pendingOrdersSection).display}`); else console.log("  Pending Orders Section by ID not found.");
        if (recentActivitySection) console.log(`  Recent Activity List container: hidden? ${recentActivitySection.parentElement.classList.contains('hidden')}, display: ${window.getComputedStyle(recentActivitySection.parentElement).display}`); else console.log("  Recent Activity List container not found by selector.");

        if (typeof updateEnhancedDashboard === 'function') updateEnhancedDashboard(); else console.error("[showView] updateEnhancedDashboard is not defined");
        if (typeof displayPendingOrdersOnDashboard === 'function') displayPendingOrdersOnDashboard(); else console.error("[showView] displayPendingOrdersOnDashboard is not defined");
    } else if (targetView.id === 'inventoryViewContainer') {
        console.log('[showView] Initializing inventoryViewContainer.');
        if (typeof displayInventory === 'function') displayInventory(); else console.error("[showView] displayInventory is not defined");
        if (typeof updateInventoryDashboard === 'function') updateInventoryDashboard(); else console.error("[showView] updateInventoryDashboard is not defined");
        if (typeof updateToOrderTable === 'function') updateToOrderTable(); else console.error("[showView] updateToOrderTable is not defined");
    } else if (targetView.id === 'dashboardViewContainer') {
        console.log('[showView] Initializing dashboardViewContainer.');
        if (typeof updateEnhancedDashboard === 'function') updateEnhancedDashboard(); else console.error("[showView] updateEnhancedDashboard is not defined");
        if (typeof displayPendingOrdersOnDashboard === 'function') displayPendingOrdersOnDashboard(); else console.error("[showView] displayPendingOrdersOnDashboard is not defined");
    } else if (targetView.id === 'quickStockUpdateContainer') {
        console.log('[showView] Initializing quickStockUpdateContainer.');
        const initialTabToSelect = document.getElementById('barcodeScannerModeTab') ? 'barcodeScannerModeTab' : 'manualBatchModeTab';
        if (typeof switchQuickUpdateTab === 'function') {
            switchQuickUpdateTab(initialTabToSelect);
        } else {
            console.error("[showView] switchQuickUpdateTab is not defined.");
        }
    } else if (targetView.id === 'ordersSectionContainer') {
        console.log('[showView] Initializing ordersSectionContainer.');
        if (typeof populateProductsDropdown === 'function') populateProductsDropdown(); else console.error("populateProductsDropdown is not defined");
        if (typeof loadAndDisplayOrders === 'function') loadAndDisplayOrders(); else console.error("loadAndDisplayOrders is not defined");
        if (typeof updateLowStockAlerts === 'function') updateLowStockAlerts(); else console.error("[showView] updateLowStockAlerts for orders view is not defined");
    } else if (targetView.id === 'reportsSectionContainer') {
        console.log('[showView] Initializing reportsSectionContainer.');
        if (typeof populateTrendProductSelect === 'function') populateTrendProductSelect(); else console.error("populateTrendProductSelect is not defined");
        if (typeof generateProductUsageChart === 'function') generateProductUsageChart(''); else console.error("generateProductUsageChart is not defined");
    } else if (targetView.id === 'userManagementSectionContainer') {
        console.log('[showView] Initializing userManagementSectionContainer.');
        if (typeof displayUserRoleManagement === 'function') displayUserRoleManagement(); else console.error("displayUserRoleManagement is not defined");
    } else if (targetView.id === 'suppliersAndLocationsContainer') {
        console.log('[showView] Initializing suppliersAndLocationsContainer.');
        // Assuming loadSuppliers and loadLocations also update their respective lists.
        if (typeof loadSuppliers === 'function') loadSuppliers(); else console.error("[showView] loadSuppliers is not defined");
        if (typeof loadLocations === 'function') loadLocations(); else console.error("[showView] loadLocations is not defined");
    }
  } else {
    console.error(`[showView] Target view container with ID '${viewIdToShow}' not found.`);
    const fallbackView = document.getElementById('dashboardViewContainer');
    if (fallbackView) {
        fallbackView.classList.remove('hidden');
        console.warn(`[showView] Fallback: Displaying dashboardViewContainer as ${viewIdToShow} was not found.`);
        clickedMenuId = 'menuDashboard';
    }
  }

  // Update active menu item styling
  if (clickedMenuId) {
    const menuItems = [
        document.getElementById('menuDashboard'),
        document.getElementById('menuInventory'),
        document.getElementById('menuSuppliers'),
        document.getElementById('menuOrders'),
        document.getElementById('menuReports'),
        document.getElementById('menuQuickStockUpdate'),
        document.getElementById('menuUserManagement')
    ].filter(item => item !== null);

    const activeMenuClasses = ['bg-base-300', 'text-base-content', 'font-semibold'];
    const inactiveMenuClasses = ['text-base-content', 'hover:bg-base-300/50'];

    menuItems.forEach(item => {
        item.classList.remove(...activeMenuClasses, ...inactiveMenuClasses, 'bg-gray-300', 'dark:bg-slate-700', 'text-gray-900', 'dark:text-white', 'text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-300', 'dark:hover:bg-slate-700');
        const icon = item.querySelector('svg');
        if (icon) {
            icon.classList.remove('text-gray-500', 'dark:text-gray-400', 'group-hover:text-gray-700', 'dark:group-hover:text-gray-200', 'text-gray-700', 'dark:text-gray-100');
        }

        if (item.id === clickedMenuId) {
            activeMenuClasses.forEach(cls => item.classList.add(cls));
            if (icon) icon.classList.add('text-base-content');
        } else {
            inactiveMenuClasses.forEach(cls => item.classList.add(cls));
            if (icon) icon.classList.add('text-base-content');
        }
    });
  } else {
      console.warn(`[showView] clickedMenuId was not provided. Menu items will not be styled.`);
  }
}


// Helper functions for Barcode Scanner Mode
function setBarcodeStatus(message, isError = false) {
    const statusEl = document.getElementById('barcodeScannerStatus');
    if (statusEl) {
        statusEl.textContent = message;
        if (isError) {
            statusEl.classList.remove('bg-blue-100', 'dark:bg-blue-800', 'text-blue-700', 'dark:text-blue-200');
            statusEl.classList.add('bg-red-100', 'dark:bg-red-700', 'text-red-700', 'dark:text-red-200');
        } else {
            statusEl.classList.remove('bg-red-100', 'dark:bg-red-700', 'text-red-700', 'dark:text-red-200');
            statusEl.classList.add('bg-blue-100', 'dark:bg-blue-800', 'text-blue-700', 'dark:text-blue-200');
        }
    }
}

function setLastActionFeedback(message, isError = false) {
    const lastActionEl = document.getElementById('barcodeLastActionFeedback');
    if (lastActionEl) {
        lastActionEl.textContent = message;
        if (isError) {
            lastActionEl.classList.remove('text-green-600', 'dark:text-green-400');
            lastActionEl.classList.add('text-red-600', 'dark:text-red-400');
        } else {
            lastActionEl.classList.remove('text-red-600', 'dark:text-red-400');
            lastActionEl.classList.add('text-green-600', 'dark:text-green-400');
        }
    }
}

// START OF FUNCTIONS TO ADD

async function displayBarcodeModeActionQRCodes() {
  const container = document.getElementById('barcodeModeActionQRCodesContainer');
  if (!container) {
    console.error('Barcode Mode Action QR Codes container (barcodeModeActionQRCodesContainer) not found.');
    return;
  }
  container.innerHTML = ''; // Clear previous QRs

  const actions = [
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

  if (typeof QRCode === 'undefined') {
    console.error('QRCode library is not loaded. Cannot display action QR codes for Barcode Mode.');
    container.innerHTML = '<p class="text-red-500 dark:text-red-400 col-span-full">Error: QRCode library not loaded.</p>';
    return;
  }

  actions.forEach(action => {
    const actionDiv = document.createElement('div');
    let bgColorClass = 'bg-gray-100 dark:bg-gray-700'; // Default/cancel
    if (action.type === 'add') {
      bgColorClass = 'bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-600';
    } else if (action.type === 'subtract') {
      bgColorClass = 'bg-red-100 hover:bg-red-200 dark:bg-red-700 dark:hover:bg-red-600';
    } else if (action.type === 'set') {
      bgColorClass = 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-700 dark:hover:bg-blue-600';
    } else if (action.type === 'complete') {
      bgColorClass = 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-700 dark:hover:bg-yellow-600';
    }
    actionDiv.className = `flex flex-col items-center p-2 border dark:border-slate-600 rounded-md shadow ${bgColorClass} transition-colors duration-150`;

    const qrCodeElem = document.createElement('div');
    qrCodeElem.id = `barcode-mode-action-qr-${action.data}`; // Ensure unique IDs if necessary
    actionDiv.appendChild(qrCodeElem);

    const labelElem = document.createElement('p');
    labelElem.textContent = action.label;
    labelElem.className = 'text-sm mt-1 dark:text-gray-200';
    actionDiv.appendChild(labelElem);

    container.appendChild(actionDiv);

    try {
      new QRCode(qrCodeElem, {
        text: action.data,
        width: 80,
        height: 80,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      console.error(`Error generating QR code for action ${action.label} in Barcode Mode:`, e);
      qrCodeElem.textContent = 'Error';
    }
  });
  console.log('Barcode Mode Action QR codes displayed in single container.');
}

// END OF FUNCTIONS TO ADD

// START - Placeholder functions for Orders section
async function populateProductsDropdown() {
  try {
    const db = firebase.firestore();
    const inventorySnapshot = await db.collection('inventory').get();
    const dropdown = document.getElementById('orderProductId');

    if (!dropdown) {
      console.error('Dropdown element with ID "orderProductId" not found in orders section');
      return;
    }
    dropdown.innerHTML = ''; // Clear existing options

    const products = inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const productsToOrder = products.filter(item =>
      (item.quantity + (item.quantityOrdered || 0) + (item.productQuantityBackordered || 0)) <= item.minQuantity && item.minQuantity > 0
      // Added item.minQuantity > 0 to ensure items with no min quantity set (or set to 0) aren't accidentally included if their stock is 0.
    );

    if (productsToOrder.length === 0) {
      const noProductsOption = document.createElement('option');
      noProductsOption.value = "";
      noProductsOption.text = "No products currently need reordering";
      noProductsOption.disabled = true;
      noProductsOption.selected = true;
      dropdown.appendChild(noProductsOption);
      console.log('Products dropdown: No products need reordering.');
    } else {
      const defaultOption = document.createElement('option');
      defaultOption.value = "";
      defaultOption.text = "Select a Product to Order";
      defaultOption.disabled = true;
      defaultOption.selected = true;
      dropdown.appendChild(defaultOption);

      productsToOrder.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id)); // Sort for better UX

      productsToOrder.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.text = product.name || product.id;
        dropdown.appendChild(option);
      });
      console.log(`Products dropdown populated with ${productsToOrder.length} items needing reorder.`);
    }
  } catch (error) {
    console.error('Error populating products dropdown:', error);
    const dropdown = document.getElementById('orderProductId');
    if (dropdown) {
        dropdown.innerHTML = '<option value="" disabled selected>Error loading products</option>';
    }
  }
}

async function loadAndDisplayOrders() {
  console.log('[loadAndDisplayOrders] Using orders manager for compatibility');
  
  try {
    // Use the orders manager with smart default filtering
    if (window.ordersManager) {
      // Check if specific filters are applied
      const filterStatusDropdown = document.getElementById('filterOrderStatus');
      const filterSupplierDropdown = document.getElementById('filterOrderSupplier');
      
      const statusFilter = filterStatusDropdown ? filterStatusDropdown.value : '';
      const supplierFilter = filterSupplierDropdown ? filterSupplierDropdown.value : '';
      
      // If no filters are applied, use smart default filtering
      if (!statusFilter && !supplierFilter) {
        console.log('[loadAndDisplayOrders] No filters applied, using smart default filtering');
        await window.ordersManager.displayOrdersWithDefaultFilter();
      } else {
        console.log(`[loadAndDisplayOrders] Applying filters - Status: "${statusFilter}", Supplier: "${supplierFilter}"`);
        await window.ordersManager.displayOrders(statusFilter, supplierFilter);
      }
      console.log('[loadAndDisplayOrders] Orders loaded successfully via orders manager');
    } else {
      console.error('[loadAndDisplayOrders] Orders manager not available');
      const ordersTableBody = document.getElementById('ordersTableBody');
      if (ordersTableBody) {
        ordersTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-red-500 dark:text-red-400">Orders manager not initialized</td></tr>';
      }
    }
  } catch (error) {
    console.error('[loadAndDisplayOrders] Error:', error);
    const ordersTableBody = document.getElementById('ordersTableBody');
    if (ordersTableBody) {
      ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-500 dark:text-red-400">Error loading orders: ${error.message}</td></tr>`;
    }
  }
}
// END - Placeholder functions for Orders section

async function handleRefreshInventory() {
    console.log('Refreshing inventory manually...');
    const refreshBtn = document.getElementById('refreshInventoryBtn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('loading'); // DaisyUI loading class
    }
    if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
        uiEnhancementManager.showToast('Refreshing inventory data...', 'info', 3000);
    }

    try {
        inventory = await inventoryManager.loadInventory(); // Fetch latest data
        displayInventory(); // Re-render table (current page)
        updateInventoryDashboard(); // Update dashboard stats
        updateToOrderTable(); // Update 'to order' list
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast('Inventory refreshed successfully!', 'success');
        }
    } catch (error) {
        console.error('Error refreshing inventory:', error);
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast('Error refreshing inventory: ' + error.message, 'error');
        }
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('loading');
        }
    }
}

async function displayUserRoleManagement() {
  const tableBody = document.getElementById('userRolesTableBody');
  const selectAllCheckbox = document.getElementById('selectAllUsersCheckbox');
  if (!tableBody || !selectAllCheckbox) return;

  tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">Loading users...</td></tr>'; // Colspan is 6 now

  try {
    const listUsersAndRolesCallable = firebase.functions().httpsCallable('listUsersAndRoles');
    const result = await listUsersAndRolesCallable();
    const users = result.data.users;

    tableBody.innerHTML = '';

    if (!users || users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">No users found.</td></tr>';
      selectAllCheckbox.disabled = true;
      return;
    }
    selectAllCheckbox.disabled = false;
    selectAllCheckbox.checked = false; // Reset select all

    users.forEach(user => {
      const row = tableBody.insertRow();
      row.setAttribute('data-uid', user.uid); // Store UID on the row
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

    document.querySelectorAll('.save-role-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const userId = event.target.dataset.uid;
        const newRole = document.getElementById(`roleSelect-${userId}`).value;
        await handleSaveUserRole(userId, newRole);
      });
    });

    // Add event listeners for row checkboxes
    document.querySelectorAll('.user-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const allChecked = Array.from(document.querySelectorAll('.user-checkbox')).every(cb => cb.checked);
            const someChecked = Array.from(document.querySelectorAll('.user-checkbox')).some(cb => cb.checked);
            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = !allChecked && someChecked;
            updateSelectedUsers();
        });
    });


  } catch (error) {
    console.error("Error fetching or displaying users for role management:", error);
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-500">Error loading users: ${error.message}</td></tr>`;
    selectAllCheckbox.disabled = true;
  }
}

let selectedUserUIDs = [];

function updateSelectedUsers() {
    selectedUserUIDs = Array.from(document.querySelectorAll('.user-checkbox:checked'))
                             .map(checkbox => checkbox.dataset.uid);
    console.log("Selected UIDs:", selectedUserUIDs);
    // Enable/disable bulk action buttons based on selection
    const deleteBtn = document.getElementById('deleteSelectedUsersBtn');
    const updateRoleBtn = document.getElementById('updateRoleForSelectedUsersBtn');
    if (deleteBtn) deleteBtn.disabled = selectedUserUIDs.length === 0;
    if (updateRoleBtn) updateRoleBtn.disabled = selectedUserUIDs.length === 0;
}

function handleSelectAllUsers(event) {
    const isChecked = event.target.checked;
    document.querySelectorAll('.user-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    updateSelectedUsers();
}

async function handleDeleteSelectedUsers() {
    if (selectedUserUIDs.length === 0) {
        uiEnhancementManager.showToast('No users selected for deletion.', 'warning');
        return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedUserUIDs.length} selected user(s)? This action cannot be undone.`)) {
        return;
    }

    uiEnhancementManager.showToast('Deleting selected users...', 'info', 5000);
    try {
        const bulkDeleteUsersCallable = firebase.functions().httpsCallable('bulkDeleteUsers');
        const response = await bulkDeleteUsersCallable({ uids: selectedUserUIDs });

        console.log("Bulk delete response:", response.data);
        let successCount = response.data.successCount || 0;
        let failureCount = response.data.failureCount || 0;
        let message = `${successCount} user(s) deleted successfully.`;
        if (failureCount > 0) {
            message += ` ${failureCount} user(s) failed to delete. Check console for details.`;
            // Log detailed errors if provided by the function
            if (response.data.errors && response.data.errors.length > 0) {
                response.data.errors.forEach(err => console.error("Bulk delete error detail:", err));
            }
        }
        uiEnhancementManager.showToast(message, failureCount > 0 ? 'warning' : 'success', 7000);
        displayUserRoleManagement(); // Refresh the list
        selectedUserUIDs = []; // Clear selection
        updateSelectedUsers(); // Update button states
    } catch (error) {
        console.error("Error calling bulkDeleteUsers function:", error);
        uiEnhancementManager.showToast(`Error deleting users: ${error.message}. Check console.`, 'error', 7000);
    }
}

async function handleUpdateRoleForSelectedUsers() {
    if (selectedUserUIDs.length === 0) {
        uiEnhancementManager.showToast('No users selected for role update.', 'warning');
        return;
    }

    // Simple prompt for role selection. A modal would be better for UX.
    const newRole = prompt(`Enter new role for ${selectedUserUIDs.length} selected user(s) (e.g., "admin" or "staff"):`);
    if (!newRole || (newRole.toLowerCase() !== 'admin' && newRole.toLowerCase() !== 'staff')) {
        uiEnhancementManager.showToast('Invalid role entered or action cancelled.', 'info');
        return;
    }

    if (!confirm(`Are you sure you want to update the role to "${newRole}" for ${selectedUserUIDs.length} selected user(s)?`)) {
        return;
    }

    uiEnhancementManager.showToast('Updating roles for selected users...', 'info', 5000);
    try {
        const bulkUpdateUserRolesCallable = firebase.functions().httpsCallable('bulkUpdateUserRoles');
        const response = await bulkUpdateUserRolesCallable({ uids: selectedUserUIDs, newRole: newRole.toLowerCase() });

        console.log("Bulk role update response:", response.data);
        let successCount = response.data.successCount || 0;
        let failureCount = response.data.failureCount || 0;
        let message = `${successCount} user role(s) updated successfully to "${newRole}".`;
        if (failureCount > 0) {
            message += ` ${failureCount} user role(s) failed to update. Check console for details.`;
             if (response.data.errors && response.data.errors.length > 0) {
                response.data.errors.forEach(err => console.error("Bulk role update error detail:", err));
            }
        }
        uiEnhancementManager.showToast(message, failureCount > 0 ? 'warning' : 'success', 7000);
        displayUserRoleManagement(); // Refresh the list
        selectedUserUIDs = []; // Clear selection
        updateSelectedUsers(); // Update button states
    } catch (error) {
        console.error("Error calling bulkUpdateUserRoles function:", error);
        uiEnhancementManager.showToast(`Error updating roles: ${error.message}. Check console.`, 'error', 7000);
    }
}


async function handleSaveUserRole(userId, newRole) {
  if (!userId || !newRole) {
    alert('User ID or new role is missing.');
    return;
  }
  console.log(`Attempting to set role for ${userId} to ${newRole}`);
  try {
    await db.collection('user_roles').doc(userId).set({ role: newRole });
    alert(`Role for user ${userId} successfully updated to ${newRole}.`);
    // Refresh the user list to show updated role
    displayUserRoleManagement();
  } catch (error) {
    console.error("Error saving user role:", error);
    alert(`Failed to save role for user ${userId}: ${error.message}`);
  }
}

function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

// Modal DOM element variables (module-scoped)
let imageModal = null;
let modalImage = null;
let closeImageModalBtn = null;

// Dark Mode Toggle Functionality
const LIGHT_THEME_NAME = 'nord'; // Based on output.css analysis
const DARK_THEME_NAME = 'nord-dark'; // Changed from 'sunset'
const THEME_STORAGE_KEY = 'theme'; // Changed from 'darkMode' to store theme name

const applyDarkMode = () => {
  document.documentElement.setAttribute('data-theme', DARK_THEME_NAME);
  localStorage.setItem(THEME_STORAGE_KEY, DARK_THEME_NAME);
  console.log('Dark mode applied, data-theme set to:', DARK_THEME_NAME);
};

const removeDarkMode = () => { // This function now applies the light theme
  document.documentElement.setAttribute('data-theme', LIGHT_THEME_NAME);
  localStorage.setItem(THEME_STORAGE_KEY, LIGHT_THEME_NAME);
  console.log('Light mode applied, data-theme set to:', LIGHT_THEME_NAME);
};

const initialDarkModeCheck = () => {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (storedTheme === DARK_THEME_NAME) {
    applyDarkMode();
  } else if (storedTheme === LIGHT_THEME_NAME) {
    removeDarkMode(); // Apply light theme
  } else if (systemPrefersDark) {
    applyDarkMode(); // Default to dark if system prefers and no user choice
  } else {
    removeDarkMode(); // Default to light
  }
};

initialDarkModeCheck();

// Stub functions for missing functionalities to prevent ReferenceErrors
function toggleSidebar() {
    console.log('[toggleSidebar] Called - Not fully implemented.');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent'); // Assuming this is the main content area that needs to adjust
    const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');

    if (sidebar && mainContent && sidebarToggleIcon) {
        sidebar.classList.toggle('w-64'); // Full width
        sidebar.classList.toggle('w-16'); // Minimized width (example)
        mainContent.classList.toggle('ml-64');
        mainContent.classList.toggle('ml-16'); // Adjust margin based on sidebar width

        // Toggle menu text visibility
        const menuTexts = sidebar.querySelectorAll('.menu-text');
        menuTexts.forEach(text => {
            text.classList.toggle('hidden'); // Or more sophisticated animation
        });

        // Change icon
        if (sidebar.classList.contains('w-16')) { // Minimized
            sidebarToggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />`; // Hamburger
            localStorage.setItem(SIDEBAR_STATE_KEY, 'true');
        } else { // Maximized
            sidebarToggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5" />`; // Chevron left (original)
            localStorage.setItem(SIDEBAR_STATE_KEY, 'false');
        }
        console.log('[toggleSidebar] Sidebar toggled. Minimized:', sidebar.classList.contains('w-16'));
    } else {
        console.error('[toggleSidebar] Sidebar, mainContent, or toggleIcon element not found.');
    }
}

function minimizeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
    if (sidebar && mainContent && sidebarToggleIcon && !sidebar.classList.contains('w-16')) {
        sidebar.classList.add('w-16');
        sidebar.classList.remove('w-64');
        mainContent.classList.add('ml-16');
        mainContent.classList.remove('ml-64');
        sidebar.querySelectorAll('.menu-text').forEach(text => text.classList.add('hidden'));
        sidebarToggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />`; // Hamburger
    }
}

function maximizeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
     if (sidebar && mainContent && sidebarToggleIcon && sidebar.classList.contains('w-16')) {
        sidebar.classList.remove('w-16');
        sidebar.classList.add('w-64');
        mainContent.classList.remove('ml-16');
        mainContent.classList.add('ml-64');
        sidebar.querySelectorAll('.menu-text').forEach(text => text.classList.remove('hidden'));
        sidebarToggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5" />`; // Chevron
    }
}


function startEditScanner() {
    console.log('[startEditScanner] Called - Not implemented.');
    // Basic placeholder:
    const editVideo = document.getElementById('editVideo');
    const scanResultEl = document.getElementById('editScanResult');
    if(editVideo) editVideo.classList.remove('hidden');
    if(scanResultEl) scanResultEl.textContent = 'Edit scanner started (feature not fully implemented).';
    // In a real scenario, this would involve QuaggaJS or similar to use the camera.
}

function stopEditScanner() {
    console.log('[stopEditScanner] Called - Not implemented (related to startEditScanner).');
    const editVideo = document.getElementById('editVideo');
    if(editVideo) editVideo.classList.add('hidden');
    // Stop camera stream if active
}


function emailReport() {
    console.log('[emailReport] Called - Not implemented.');
    alert('Email report functionality is not yet implemented.');
}

function initiateImageModalVars() {
    console.log('[initiateImageModalVars] Called.');
    imageModal = document.getElementById('imageModal');
    modalImage = document.getElementById('modalImage');
    closeImageModalBtn = document.getElementById('closeImageModalBtn'); // Listener for this is in DOMContentLoaded
    if (!imageModal || !modalImage || !closeImageModalBtn) {
        console.warn('[initiateImageModalVars] One or more image modal elements not found.');
    }
}

function openImageModal(imageUrl) {
    console.log('[openImageModal] Called with URL:', imageUrl);
    if (imageModal && modalImage) {
        modalImage.src = imageUrl;
        imageModal.classList.remove('hidden');
        imageModal.classList.add('flex'); // Assuming flex is used to center it
    } else {
        console.error('[openImageModal] Modal elements not initialized or found.');
    }
}

function closeImageModal() {
    console.log('[closeImageModal] Called.');
    if (imageModal) {
        imageModal.classList.add('hidden');
        imageModal.classList.remove('flex');
        if(modalImage) modalImage.src = ''; // Clear image
    } else {
        console.error('[closeImageModal] imageModal element not found.');
    }
}

// Firebase Initialization
const firebaseConfig = {
  apiKey: "AIzaSyC4I5X1Gca4VEvqRspnitNFSLu8C0jH7sQ",
  authDomain: "watagandental-inventory-e6e7b.firebaseapp.com",
  projectId: "watagandental-inventory-e6e7b",
  storageBucket: "watagandental-inventory-e6e7b.firebasestorage.app",
  messagingSenderId: "309417981178",
  appId: "1:309417981178:web:8fa5239801426e8b428543",
  measurementId: "G-PVQTBS5BSH"
};

try {
  let app;
  if (firebase.apps.length === 0) {
    app = firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully:', app.name);
  } else {
    app = firebase.app();
    console.log('Using existing Firebase app:', app.name);
  }
  db = firebase.firestore();
  storage = firebase.storage();
  inventoryManager = new InventoryManager(db, storage); // Initialize inventory manager
  const auth = firebase.auth(); // Added Firebase Auth
  const ui = new firebaseui.auth.AuthUI(auth); // FirebaseUI instance
  console.log('Firestore instance created:', !!db);
  console.log('Storage instance created:', !!storage);
  console.log('InventoryManager instance created:', !!inventoryManager);
  console.log('Auth instance created:', !!auth);
  console.log('FirebaseUI instance created:', !!ui);

    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
      const logoutBtn = document.getElementById('logoutButton');
      const authContainer = document.getElementById('authContainer'); // This is the main container for login screen
      const appNavbar = document.getElementById('appNavbar');
      const appMainContainer = document.getElementById('appMainContainer');
      const userProfileImage = document.getElementById('userProfileImage'); // Get profile image element
      const customLoginForm = document.getElementById('loginForm'); // The old custom form
      const customGoogleSignInSection = document.getElementById('customGoogleSignInSection'); // The old Google Sign In button section

      if (user) {
        console.log('Auth state changed: User is signed in', user.email || user.uid, 'Photo URL:', user.photoURL);
        if (authContainer) authContainer.classList.add('hidden'); // Hide the entire login screen
        if (appNavbar) appNavbar.classList.remove('hidden');
        if (appMainContainer) appMainContainer.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');

        if (userProfileImage) {
          if (user.photoURL) {
            userProfileImage.src = user.photoURL;
            userProfileImage.alt = user.displayName || user.email || 'User profile';
            userProfileImage.src = user.photoURL;
            userProfileImage.alt = user.displayName || user.email || 'User profile';
            userProfileImage.classList.remove('hidden');
          } else {
            // Use a generic SVG icon as a data URI if no photoURL
            const defaultUserIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clip-rule="evenodd" /></svg>';
            userProfileImage.src = `data:image/svg+xml;base64,${btoa(defaultUserIconSvg)}`;
            userProfileImage.alt = user.displayName || user.email || 'User profile (default icon)';
            userProfileImage.classList.remove('hidden'); // Ensure it's visible
          }
        }

        // Primary attempt to set UI visibility
        // if (authContainer) authContainer.classList.add('hidden'); // Already done above
        // if (appNavbar) appNavbar.classList.remove('hidden'); // Already done above
        // if (appMainContainer) appMainContainer.classList.remove('hidden'); // Already done above
        // if (logoutBtn) logoutBtn.classList.remove('hidden'); // Already done above

        // Asynchronous data loading chain
        inventoryManager.loadInventory().then(loadedInventory => {
          inventory = loadedInventory;
          console.log('Global inventory array updated with', inventory.length, 'items');
          return loadSuppliers(); // Chain supplier loading
        }).then(() => {
          console.log('Suppliers loaded successfully.');
          return loadLocations(); // Chain location loading
        }).then(() => {
          console.log('Locations loaded successfully.');
          const userRoleRef = db.collection('user_roles').doc(user.uid);
          return userRoleRef.get(); // Chain user role fetching
        }).then(docSnapshot => {
          if (docSnapshot.exists) {
            currentUserRole = docSnapshot.data().role;
            console.log('User role loaded:', currentUserRole);
          } else {
            currentUserRole = 'staff'; // Default role
            console.log('No specific role found for user, defaulting to:', currentUserRole);
            // Optionally, create the role document here for new users if it doesn't exist
            // db.collection('user_roles').doc(user.uid).set({ role: 'staff' });
          }
          updateUserInterfaceForRole(currentUserRole);

          // Data loaded, now show the specific view
          // Default to Dashboard view
          const menuDashboardEl = document.getElementById('menuDashboard');
          if (menuDashboardEl) {
            showView('dashboardViewContainer', menuDashboardEl.id);
          } else {
            console.warn("Default menu item 'menuDashboard' not found after login. Falling back to inventory view.");
            // Fallback to inventory view if dashboard menu item is somehow missing
            const menuInventoryEl = document.getElementById('menuInventory');
            if (menuInventoryEl) {
              showView('inventoryViewContainer', menuInventoryEl.id);
            } else {
              console.error("Fallback menu item 'menuInventory' also not found. No default view can be set.");
            }
          }
        }).catch(error => {
          console.error("Error during post-login data loading or UI setup:", error);
          // Display a user-friendly error message in the main application area
          if(appMainContainer) {
            // Ensure appMainContainer is visible to show the error
            appMainContainer.classList.remove('hidden');
            // Clear any potential loading spinners or old content
            appMainContainer.innerHTML = `
              <div class="p-4 text-center">
                <h2 class="text-xl font-semibold text-red-600 dark:text-red-400">Application Error</h2>
                <p class="text-gray-700 dark:text-gray-300 mt-2">Could not load application data: ${error.message}</p>
                <p class="text-gray-500 dark:text-gray-400 mt-1">Please try refreshing the page. If the problem persists, contact support.</p>
              </div>`;
          }
          // Also ensure the auth container is hidden if an error occurs post-login attempt
          if (authContainer) authContainer.classList.add('hidden');
          if (appNavbar) appNavbar.classList.remove('hidden'); // Keep navbar visible for logout option
        });

        // Diagnostic logging after a slightly longer delay
        setTimeout(() => {
          console.log("State of UI after 1.5 seconds (for debugging):");
          debugUIContainers();

          // Check if the main container is still hidden after all primary attempts.
          // This is purely for logging to see if the primary approach failed.
          if (appMainContainer && appMainContainer.classList.contains('hidden')) {
            console.error("CRITICAL DIAGNOSTIC: appMainContainer is still hidden after 1.5s and primary logic. This indicates a persistent issue with initial visibility settings or interference from other scripts/CSS.");
          }
          if (authContainer && !authContainer.classList.contains('hidden')) {
            console.error("CRITICAL DIAGNOSTIC: authContainer is still visible after 1.5s and primary logic. Login screen should be hidden.");
          }
          if (appNavbar && appNavbar.classList.contains('hidden')) {
            console.warn("DIAGNOSTIC: appNavbar is hidden after 1.5s. It should be visible for logged-in users.");
          }

        }, 1500);

      } else {
        // User is signed out.
        console.log('Auth state changed: User is signed out');
        if (appNavbar) appNavbar.classList.add('hidden');
        if (appMainContainer) appMainContainer.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (authContainer) authContainer.classList.remove('hidden'); // Show the login screen container

        // Hide custom form elements if they were not already hidden via HTML
        if (customLoginForm && !customLoginForm.classList.contains('hidden')) {
            customLoginForm.classList.add('hidden');
        }
        if (customGoogleSignInSection && !customGoogleSignInSection.classList.contains('hidden')) {
            customGoogleSignInSection.classList.add('hidden');
        }

        currentUserRole = null;
        updateUserInterfaceForRole(null);
        if (userProfileImage) { // Hide and reset profile image on logout
          userProfileImage.classList.add('hidden');
          userProfileImage.src = '#';
          userProfileImage.alt = 'User';
        }

        const uiConfig = {
          callbacks: {
            signInSuccessWithAuthResult: function(authResult, redirectUrl) {
              // User successfully signed in.
              // Return true to automatically redirect (if signInSuccessUrl is set)
              // Return false to handle manually (e.g. if you want to stay on the page or do something else)
              console.log('FirebaseUI: signInSuccessWithAuthResult', authResult);
              // The onAuthStateChanged listener will handle UI changes, so we don't need to do much here.
              // If a role needs to be set for new users immediately, this might be a place.
              // For now, just let onAuthStateChanged handle it.
              return false; // Let onAuthStateChanged handle UI changes
            },
            uiShown: function() {
              // The widget is rendered.
              // Maybe hide a loader if you have one.
              console.log('FirebaseUI: uiShown');
              document.getElementById('authErrorMessage').classList.add('hidden'); // Hide any previous custom error
            },
            signInFailure: function(error) {
                // Handle sign-in errors (e.g., account_exists_with_different_credential).
                console.error('FirebaseUI: signInFailure', error);
                const authErrorMessage = document.getElementById('authErrorMessage');
                if (authErrorMessage) {
                    authErrorMessage.textContent = `Login Error: ${error.message} (Code: ${error.code})`;
                    authErrorMessage.classList.remove('hidden');
                }
                // You might want to return a promise that resolves to false to prevent redirect on error.
                return Promise.resolve();
            }
          },
          signInFlow: 'popup', // Use 'popup' for Google, Facebook, etc. 'redirect' is another option.
          signInSuccessUrl: null, // Disable automatic redirect, handled by onAuthStateChanged
          signInOptions: [
            firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            firebase.auth.EmailAuthProvider.PROVIDER_ID,
            // Add other providers like:
            // firebase.auth.FacebookAuthProvider.PROVIDER_ID,
            // firebase.auth.TwitterAuthProvider.PROVIDER_ID,
            // firebase.auth.GithubAuthProvider.PROVIDER_ID,
            // firebase.auth.PhoneAuthProvider.PROVIDER_ID,
          ],
          // Terms of service url.
          tosUrl: '<your-tos-url>', // Replace with your TOS URL or remove if not needed
          // Privacy policy url.
          privacyPolicyUrl: '<your-privacy-policy-url>' // Replace with your Privacy Policy URL or remove
        };

        // Start the FirebaseUI Auth interface.
        // It will listen for user input and display the appropriate UI.
        // The #firebaseui-auth-container element must be present in your HTML.
        ui.start('#firebaseui-auth-container', uiConfig);
      }
    });

    // Initial check if a user is already signed in (e.g. page refresh)
    // If not, Firebase will handle anonymous sign-in if configured, or user needs to log in.
    // The onAuthStateChanged listener will manage UI updates based on the auth state.
    // No explicit signInAnonymously call here unless onAuthStateChanged logic is insufficient.
    // The existing onAuthStateChanged handles the anonymous sign-in if user is null.
    if (!auth.currentUser) {
        console.log("No current user on app load, anonymous sign-in call REMOVED."); // MODIFIED Log
        // auth.signInAnonymously() // Commented out as per requirement
        //     .then(() => {
        //         console.log("Initial anonymous sign-in successful.");
        //     })
        //     .catch((error) => {
        //         console.error("Initial anonymous sign-in error:", error.code, error.message);
        //          alert("Initial Authentication failed: " + error.message + "\nPlease ensure Anonymous sign-in is enabled in your Firebase project's Authentication settings and that your Firebase configuration is correct, and that the domains are correctly whitelisted if running locally for testing.");
        //     });
    }
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

// Utility to load jsPDF dynamically with polling
async function loadJsPDF(scriptSrc = '/js/jspdf.umd.min.js') {
  return new Promise((resolve, reject) => {
    if (window.jspdf && typeof window.jspdf.jsPDF === 'function') {
      console.log(`jsPDF already available at window.jspdf.jsPDF (when trying to load ${scriptSrc})`);
      resolve(window.jspdf.jsPDF);
      return;
    }
    if (typeof window.jsPDF === 'function') {
      console.log(`jsPDF already available at window.jsPDF (when trying to load ${scriptSrc})`);
      resolve(window.jsPDF);
      return;
    }

    console.log(`Dynamically loading jsPDF from ${scriptSrc}...`);
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;

    script.onload = () => {
      console.log(`jsPDF script from ${scriptSrc} onload event fired.`);
      let startTime = Date.now();
      const maxWaitTime = 2000;
      const pollInterval = 50;

      const intervalId = setInterval(() => {
        console.log(`Polling for jsPDF library (from ${scriptSrc})...`);
        if (window.jspdf && typeof window.jspdf.jsPDF === 'function') {
          console.log(`Found jsPDF constructor at window.jspdf.jsPDF (polling from ${scriptSrc})`);
          clearInterval(intervalId);
          resolve(window.jspdf.jsPDF);
        } else if (typeof window.jsPDF === 'function') {
          console.log(`Found jsPDF constructor at window.jsPDF (polling from ${scriptSrc})`);
          clearInterval(intervalId);
          resolve(window.jsPDF);
        } else if (Date.now() - startTime > maxWaitTime) {
          console.error(`jsPDF library not found after polling timeout for ${scriptSrc}.`);
          clearInterval(intervalId);
          reject(new Error(`jsPDF library not found after polling timeout for ${scriptSrc}`));
        }
      }, pollInterval);
    };

    script.onerror = (error) => {
      console.error(`Failed to load jsPDF script from ${scriptSrc}:`, error);
      reject(new Error(`Failed to load jsPDF script from ${scriptSrc}`));
    };

    document.head.appendChild(script);
  });
}

// Utility to wait for jsPDF to be available
async function waitForJsPDF() {
  const localScriptPath = '/js/jspdf.umd.min.js';
  const cdnUrl = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';

  try {
    console.log(`Attempting to load jsPDF from local path: ${localScriptPath}`);
    const JsPDF = await loadJsPDF(localScriptPath);
    console.log('jsPDF loaded successfully from local path.');
    return JsPDF;
  } catch (error) {
    console.warn(`Initial jsPDF load from ${localScriptPath} failed:`, error.message);
    console.log(`Attempting to load jsPDF from fallback CDN: ${cdnUrl}...`);
    try {
      const JsPDF = await loadJsPDF(cdnUrl);
      console.log('jsPDF loaded successfully from CDN fallback.');
      return JsPDF;
    } catch (cdnError) {
      console.error(`Failed to load jsPDF from CDN fallback (${cdnUrl}):`, cdnError.message);
      throw new Error(`Failed to load jsPDF from both local path and CDN: ${cdnError.message}`);
    }
  }
}

// Utility to load PDFLib dynamically with polling
async function loadPdfLib(scriptSrc = '/js/pdf-lib.min.js') {
  return new Promise((resolve, reject) => {
    // Check if PDFLib is already available
    if (window.PDFLib) {
      console.log(`PDFLib already available (when trying to load ${scriptSrc})`);
      resolve(window.PDFLib);
      return;
    }

    console.log(`Dynamically loading PDFLib from ${scriptSrc}...`);
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true; // Keep async for non-blocking load

    script.onload = () => {
      console.log(`PDFLib script from ${scriptSrc} onload event fired.`);
      let startTime = Date.now();
      const maxWaitTime = 10000; // Use the 10-second timeout
      const pollInterval = 100;  // Polling interval

      const intervalId = setInterval(() => {
        console.log(`Polling for PDFLib library (from ${scriptSrc})...`);
        if (window.PDFLib) {
          console.log(`Found PDFLib on window object (polling from ${scriptSrc})`);
          clearInterval(intervalId);
          resolve(window.PDFLib);
        } else if (Date.now() - startTime > maxWaitTime) {
          console.error(`PDFLib library not found on window object after polling timeout for ${scriptSrc}.`);
          clearInterval(intervalId);
          reject(new Error(`PDFLib library not found on window object after polling timeout for ${scriptSrc}`));
        }
      }, pollInterval);
    };

    script.onerror = (error) => {
      console.error(`Failed to load PDFLib script from ${scriptSrc}:`, error);
      reject(new Error(`Failed to load PDFLib script from ${scriptSrc}`));
    };

    document.head.appendChild(script);
  });
}

// Collapsible Section Functionality
function setupCollapsibleSection(buttonId, contentId, isInitiallyExpanded) {
  const button = document.getElementById(buttonId);
  const content = document.getElementById(contentId);

  if (!button) {
    console.error(`Collapsible section button not found for ID: ${buttonId}`);
    return;
  }
  if (!content) {
    console.error(`Collapsible section content not found for ID: ${contentId}`);
    return;
  }

  button.addEventListener('click', () => {
    button.classList.toggle('active');
    content.classList.toggle('hidden');
  });

  if (isInitiallyExpanded) {
    content.classList.remove('hidden');
    button.classList.add('active');
  } else {
    content.classList.add('hidden');
    button.classList.remove('active');
  }
}

// Utility to Generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function ensureQRCodeIsAvailable(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkQRCode = () => {
      if (typeof window.QRCode === 'function') {
        console.log('QRCode library is available.');
        resolve();
      } else if (Date.now() - startTime > timeout) {
        console.error('QRCode library did not load within timeout.');
        reject(new Error('QRCode library failed to load in time.'));
      } else {
        setTimeout(checkQRCode, 100);
      }
    };
    checkQRCode();
  });
}

// Ensures PDFLib is available, attempting to load it if necessary.
async function ensurePDFLibIsAvailable(timeout = 10000) { // Timeout in loadPdfLib is primary
  if (window.PDFLib) {
    console.log('PDFLib library is already available on window.');
    return Promise.resolve();
  }
  console.log('ensurePDFLibIsAvailable: PDFLib not found, attempting to load dynamically...');
  try {
    await loadPdfLib('/js/pdf-lib.min.js'); // loadPdfLib has its own timeout
    console.log('ensurePDFLibIsAvailable: PDFLib loaded successfully.');
  } catch (error) {
    console.error('ensurePDFLibIsAvailable: Failed to load PDFLib.', error);
    // Rethrow the error so calling functions (like generateFastOrderReportPDF) can catch it.
    throw error;
  }
}

// Supplier Management
async function addSupplier() {
  const name = document.getElementById('supplierName').value.trim();
  if (!name) {
    alert('Please enter a supplier name.');
    return;
  }
  if (suppliers.includes(name)) {
    alert('Supplier already exists.');
    return;
  }
  try {
    await db.collection('suppliers').doc(name).set({ name });
    document.getElementById('supplierName').value = '';
    await loadSuppliers();
  } catch (error) {
    console.error('Error adding supplier:', error);
    alert('Failed to add supplier: ' + error.message);
  }
}

async function deleteSupplier(supplierName) {
  const products = await db.collection('inventory').where('supplier', '==', supplierName).get();
  if (!products.empty) {
    alert('Cannot delete supplier: in use by products.');
    return;
  }
  try {
    await db.collection('suppliers').doc(supplierName).delete();
    await loadSuppliers();
  } catch (error) {
    console.error('Error deleting supplier:', error);
    alert('Failed to delete supplier: ' + error.message);
  }
}

async function loadSuppliers() {
  try {
    console.log('Fetching suppliers from Firestore...');
    const snapshot = await db.collection('suppliers').get();
    console.log('Suppliers snapshot:', snapshot.size, 'documents');
    suppliers = snapshot.docs.map(doc => doc.data().name);
    console.log('Suppliers loaded:', suppliers);
    updateSupplierList();
    updateSupplierDropdown();
  } catch (error) {
    console.error('Error loading suppliers:', error);
    // Don't show alert to user, just log the error
    console.warn('Failed to load suppliers, continuing with empty supplier list');
    suppliers = []; // Ensure suppliers array is not undefined
  }
}

function updateSupplierList() {
  const supplierList = document.getElementById('supplierList');
  console.log('Updating supplier list with:', suppliers);
  
  if (!supplierList) {
    console.log('supplierList element not found in DOM - skipping supplier list update');
    return;
  }
  
  supplierList.innerHTML = '';
  suppliers.forEach(supplier => {
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center';
    li.innerHTML = `${supplier} <button data-supplier="${supplier}" class="deleteSupplierBtn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>`;
    supplierList.appendChild(li);
  });
  console.log('Supplier list updated, items:', supplierList.children.length);
  document.querySelectorAll('.deleteSupplierBtn').forEach(button => {
    button.addEventListener('click', () => deleteSupplier(button.getAttribute('data-supplier')));
  });
}

function updateSupplierDropdown() {
  const productSupplierDropdown = document.getElementById('productSupplier');
  const filterSupplierDropdown = document.getElementById('filterSupplier');
  const filterToOrderSupplierDropdown = document.getElementById('filterToOrderSupplier');
  const filterOrderSupplierDropdown = document.getElementById('filterOrderSupplierDropdown'); // Added this line
  const orderSupplierDropdown = document.getElementById('orderSupplierId'); // New order supplier dropdown
  const modalOrderSupplierDropdown = document.getElementById('modalOrderSupplierId'); // New modal order supplier dropdown
  const qrOrderSupplierSelect = document.getElementById('qrOrderSupplierSelect'); // Added for Order QR generation

  const populate = (dropdown, includeAllOption) => {
    if (!dropdown) return;
    const currentValue = dropdown.value;
    dropdown.innerHTML = includeAllOption ? '<option value="">All Suppliers</option>' : '<option value="">Select Supplier</option>';
    suppliers.forEach(supplier => {
      const option = document.createElement('option');
      option.value = supplier;
      option.textContent = supplier;
      dropdown.appendChild(option);
    });
    if (suppliers.includes(currentValue)) {
      dropdown.value = currentValue;
    }
  };

  populate(productSupplierDropdown, false);
  populate(filterSupplierDropdown, true);
  populate(filterToOrderSupplierDropdown, true);
  populate(filterOrderSupplierDropdown, true); // Added this line
  populate(orderSupplierDropdown, false); // New order supplier dropdown
  populate(modalOrderSupplierDropdown, false); // New modal order supplier dropdown
  populate(qrOrderSupplierSelect, true); // Added for Order QR generation
  console.log('Supplier dropdowns updated.');
}

// Location Management
async function loadLocations() {
  try {
    console.log('Fetching locations from Firestore...');
    const snapshot = await db.collection('locations').orderBy('name').get();
    locations = snapshot.docs.map(doc => doc.data());
    console.log('Locations loaded:', locations);
    updateLocationList();
    updateLocationDropdowns();
  } catch (error) {
    console.error('Error loading locations:', error);
    console.warn('Failed to load locations, continuing with empty location list');
    locations = []; // Ensure locations array is not undefined
  }
}

function updateLocationList() {
  const locationList = document.getElementById('locationList');
  if (!locationList) return;
  locationList.innerHTML = '';
  locations.forEach(location => {
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center dark:text-gray-200';
    li.innerHTML = `${location.name} <button data-location-name="${location.name}" class="deleteLocationBtn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>`;
    locationList.appendChild(li);
  });
  document.querySelectorAll('.deleteLocationBtn').forEach(button => {
    button.addEventListener('click', () => deleteLocation(button.getAttribute('data-location-name')));
  });
}

async function addLocation() {
  const nameInput = document.getElementById('locationName');
  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) {
    alert('Please enter a location name.');
    return;
  }
  if (locations.some(loc => loc.name.toLowerCase() === name.toLowerCase())) {
    alert('Location already exists.');
    return;
  }
  try {
    await db.collection('locations').doc(name).set({ name });
    nameInput.value = '';
    await loadLocations();
  } catch (error) {
    console.error('Error adding location:', error);
    alert('Failed to add location: ' + error.message);
  }
}

async function deleteLocation(locationName) {
  try {
    const productsQuery = await db.collection('inventory').where('location', '==', locationName).get();
    if (!productsQuery.empty) {
      alert(`Cannot delete location "${locationName}": it is currently in use by ${productsQuery.size} product(s).`);
      return;
    }
    if (confirm(`Are you sure you want to delete location "${locationName}"?`)) {
      await db.collection('locations').doc(locationName).delete();
      await loadLocations();
    }
  } catch (error) {
    console.error('Error deleting location:', error);
    alert('Failed to delete location: ' + error.message);
  }
}

function updateLocationDropdowns() {
  const productLocationDropdown = document.getElementById('productLocation');
  const newLocationDropdown = document.getElementById('newLocation');
  const filterLocationDropdown = document.getElementById('filterLocation');

  const populate = (dropdown, includeAllOption) => {
    if (!dropdown) return;
    const currentValue = dropdown.value;
    dropdown.innerHTML = includeAllOption ? '<option value="">All Locations</option>' : '<option value="">Select Location</option>';
    locations.forEach(location => {
      const option = document.createElement('option');
      option.value = location.name;
      option.textContent = location.name;
      dropdown.appendChild(option);
    });
    if (locations.some(loc => loc.name === currentValue)) {
      dropdown.value = currentValue;
    }
     else if (dropdown.id === 'productLocation' && !currentValue && locations.length > 0 && !includeAllOption) {
     }
  };

  populate(productLocationDropdown, false);
  populate(newLocationDropdown, false);
  populate(filterLocationDropdown, true);
  console.log('Location dropdowns updated.');
}

// Product Photo Capture
async function startPhotoCapture() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera access not supported by this browser.');
    return;
  }
  try {
    photoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('photoVideo');
    video.srcObject = photoStream;
    video.play();
    video.classList.remove('hidden');
    document.getElementById('capturePhotoBtn').classList.add('hidden');
    document.getElementById('takePhotoBtn').classList.remove('hidden');
    document.getElementById('cancelPhotoBtn').classList.remove('hidden');
  } catch (err) {
    console.error('Error accessing camera:', err);
    alert('Error accessing camera: ' + err.message);
  }
}

async function takePhoto() {
  const video = document.getElementById('photoVideo');
  const canvas = document.getElementById('photoCanvas');
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const photoData = canvas.toDataURL('image/jpeg', 0.5);
  document.getElementById('productPhotoPreview').src = photoData;
  document.getElementById('productPhotoPreview').classList.remove('hidden');
  cancelPhoto();
}

function cancelPhoto() {
  if (photoStream) {
    photoStream.getTracks().forEach(track => track.stop());
    photoStream = null;
    document.getElementById('photoVideo').srcObject = null;
    document.getElementById('photoVideo').classList.add('hidden');
    document.getElementById('capturePhotoBtn').classList.remove('hidden');
    document.getElementById('takePhotoBtn').classList.add('hidden');
    document.getElementById('cancelPhotoBtn').classList.add('hidden');
  }
}

async function uploadPhoto(id, photoData) {
  if (!photoData || photoData === '') return '';
  try {
    const blob = await (await fetch(photoData)).blob();
    const storageRef = storage.ref(`products/${id}.jpg`);
    await storageRef.put(blob);
    return await storageRef.getDownloadURL();
  } catch (error) {
    console.error('Error uploading photo:', error);
    return '';
  }
}

// Product Management
async function submitProduct() {
  const id = document.getElementById('productId').value || generateUUID();
  const name = document.getElementById('productName').value.trim();
  const quantity = parseInt(document.getElementById('productQuantity').value) || 0;
  const cost = parseFloat(document.getElementById('productCost').value) || 0;
  const minQuantity = parseInt(document.getElementById('productMinQuantity').value) || 0;
  const quantityOrdered = parseInt(document.getElementById('productQuantityOrdered').value) || 0;
  const quantityBackordered = parseInt(document.getElementById('productQuantityBackordered').value) || 0;
  const reorderQuantity = parseInt(document.getElementById('productReorderQuantity').value) || 0;
  const supplier = document.getElementById('productSupplier').value;
  const location = document.getElementById('productLocation').value;
  const currentPhotoSrc = document.getElementById('productPhotoPreview').src;

  if (name && quantity >= 0 && cost >= 0 && minQuantity >= 0 && supplier && location) {
    const name_lowercase = name.toLowerCase();
    const name_words_lc = name_lowercase.split(' ').filter(word => word.length > 0); // Create word array
    try {
      let photoUrlToSave;
      const productIdValue = document.getElementById('productId').value;

      if (currentPhotoSrc.startsWith('data:image')) { // New photo captured
        photoUrlToSave = await uploadPhoto(id, currentPhotoSrc);
      } else if (productIdValue && currentPhotoSrc === originalPhotoUrlForEdit) { // Editing, photo unchanged
        photoUrlToSave = originalPhotoUrlForEdit;
      } else if (!currentPhotoSrc) { // No photo, or photo was cleared (needs specific logic if clearing is intended)
        photoUrlToSave = ''; 
      } else { // Existing photo URL, but not a new capture (should ideally be originalPhotoUrlForEdit)
        photoUrlToSave = await uploadPhoto(id, currentPhotoSrc); // This case might be redundant if originalPhotoUrlForEdit is handled
      }


      await db.collection('inventory').doc(id).set({
        id,
        name,
        name_lowercase,
        name_words_lc, // Add this new field
        quantity,
        cost,
        minQuantity,
        quantityOrdered,
        productQuantityBackordered: quantityBackordered, // Ensure field name consistency
        reorderQuantity,
        supplier,
        location,
        photo: photoUrlToSave
      });
      resetProductForm();
      inventory = await inventoryManager.loadInventory(); // Refresh local inventory

      // Log activity
      await logActivity(productIdValue ? 'product_updated' : 'product_added', `Product: ${name}`, id);

      // Always refresh the display from the newly loaded inventory
      displayInventory();
      updateInventoryDashboard();
      updateToOrderTable();

    } catch (error) {
      console.error('Error submitting product:', error);
      alert('Failed to submit product: ' + error.message);
    }
  } else {
    alert('Please fill all fields with valid values.');
  }
}

async function editProduct(id) {
  const snapshot = await db.collection('inventory').where('id', '==', id).get();
  if (!snapshot.empty) {
    const product = snapshot.docs[0].data();
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productQuantity').value = product.quantity;
    document.getElementById('productCost').value = product.cost;
    document.getElementById('productMinQuantity').value = product.minQuantity;
    document.getElementById('productQuantityOrdered').value = product.quantityOrdered || 0;
    document.getElementById('productQuantityBackordered').value = product.productQuantityBackordered || 0; // Corrected field name
    document.getElementById('productReorderQuantity').value = product.reorderQuantity || 0;
    document.getElementById('productSupplier').value = product.supplier;
    document.getElementById('productLocation').value = product.location;
    if (product.photo) {
      originalPhotoUrlForEdit = product.photo;
      document.getElementById('productPhotoPreview').src = product.photo;
      document.getElementById('productPhotoPreview').classList.remove('hidden');
    } else {
      originalPhotoUrlForEdit = '';
      document.getElementById('productPhotoPreview').src = ''; // Clear if no photo
      document.getElementById('productPhotoPreview').classList.add('hidden');
    }
    const productFormTitleEl = document.getElementById('productFormTitle');
    if (productFormTitleEl) productFormTitleEl.textContent = 'Edit Product';
    document.getElementById('productSubmitBtn').textContent = 'Update Product';
    document.getElementById('cancelEditBtn').classList.remove('hidden');
  }
}

function resetProductForm() {
  document.getElementById('productId').value = '';
  document.getElementById('productName').value = '';
  document.getElementById('productQuantity').value = '';
  document.getElementById('productCost').value = '';
  document.getElementById('productMinQuantity').value = '';
  document.getElementById('productQuantityOrdered').value = '';
  document.getElementById('productQuantityBackordered').value = '';
  document.getElementById('productReorderQuantity').value = '';
  document.getElementById('productSupplier').value = '';
  document.getElementById('productLocation').value = 'Surgery 1'; // Consider making this dynamic or empty
  document.getElementById('productPhotoPreview').src = '';
  document.getElementById('productPhotoPreview').classList.add('hidden');
  originalPhotoUrlForEdit = '';
  const productFormTitleEl = document.getElementById('productFormTitle');
  if (productFormTitleEl) productFormTitleEl.textContent = 'Add New Product';
  document.getElementById('productSubmitBtn').textContent = 'Add Product';
  document.getElementById('cancelEditBtn').classList.add('hidden');
  cancelPhoto();
}

async function deleteProduct(id) {
  if (confirm('Are you sure you want to delete this product?')) {
    try {
      await db.collection('inventory').doc(id).delete();
      try {
        await storage.ref(`products/${id}.jpg`).delete();
      } catch (err) {
        console.log('No photo to delete:', err);
      }
      // Find product name before it's removed from local inventory for logging
      const productForLog = inventory.find(p => p.id === id);
      inventory = await inventoryManager.loadInventory();
      displayInventory(); // Refresh main inventory table
      updateInventoryDashboard(); // Refresh dashboard stats
      await updateToOrderTable(); // Refresh to-order table
      // Log activity
      await logActivity('product_deleted', `Product: ${productForLog ? productForLog.name : id}`, id);
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product: ' + error.message);
    }
  }
}

// Batch Updates
function addBatchEntry() {
  const batchUpdatesDiv = document.getElementById('batchUpdates');
  const entryId = `batch-${batchUpdates.length}`;
  const entryDiv = document.createElement('div');
  entryDiv.className = 'flex gap-2 items-center'; // Keep this class for overall row alignment
  entryDiv.innerHTML = `
    <input id='${entryId}-id' type='text' placeholder='Product ID (from scan)' class='border dark:border-gray-600 p-2 rounded flex-1 dark:bg-slate-700 dark:text-gray-200 dark:placeholder-gray-400' style='min-width: 150px;'>
    <span id="${entryId}-name" class="text-sm text-gray-700 dark:text-gray-300 w-48 truncate" title="Product name will appear here" style="line-height: 2.5rem;"></span>
    <input id="${entryId}-quantity" type="number" placeholder="Quantity" class="border dark:border-gray-600 p-2 rounded w-24 dark:bg-slate-700 dark:text-gray-200 dark:placeholder-gray-400">
    <select id="${entryId}-action" class="border dark:border-gray-600 p-2 rounded w-32 dark:bg-slate-700 dark:text-gray-200">
      <option value="add">Add</option>
      <option value="remove">Remove</option>
    </select>
    <button data-entry-id="${entryId}" class="removeBatchEntryBtn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Remove</button>
  `;
  batchUpdatesDiv.appendChild(entryDiv);
  batchUpdates.push(entryId);

  const productIdInput = document.getElementById(`${entryId}-id`);
  if (productIdInput) {
    productIdInput.focus();

    productIdInput.addEventListener('keypress', function(event) {
      if ((event.key === 'Enter' || event.keyCode === 13) && productIdInput.value.trim() !== '') {
        event.preventDefault();
        const currentProductId = productIdInput.value.trim();
        const currentEntryId = productIdInput.id.replace('-id', '');
        const nameSpan = document.getElementById(`${currentEntryId}-name`);

        if (nameSpan) {
          db.collection('inventory').doc(currentProductId).get().then(doc => {
            if (doc.exists) {
              nameSpan.textContent = doc.data().name;
              nameSpan.title = doc.data().name;
            } else {
              nameSpan.textContent = 'Not Found';
              nameSpan.title = 'Product Not Found';
            }
          }).catch(err => {
            console.error("Error fetching product name for batch manual entry:", err);
            nameSpan.textContent = 'Error';
            nameSpan.title = 'Error fetching name';
          });
        }

        stopUpdateScanner(); // Ensure any camera scanner for this batch is stopped
        console.log('Enter in batch Product ID ' + entryId + '. Value: ' + currentProductId + '. Adding new row.');
        // Logic to focus next or add new row
        const quantityInput = document.getElementById(`${currentEntryId}-quantity`);
        if (quantityInput) {
            quantityInput.focus();
        } else {
            addBatchEntry(); // Fallback if quantity input somehow not found, though unlikely
        }
        // To decide whether to add a new row or just move focus, we might need more context
        // For now, let's assume if we are on the last item, we add a new one.
        // This part of the logic might need to be the same as what was there before,
        // or adjusted based on whether this is the *last* entry.
        // The original code just called addBatchEntry(); which might be too aggressive if not the last line.
        // Let's refine to: focus quantity, and if it's the last line, add new.
        // Check if this is the last entry in batchUpdates
        const isLastEntry = batchUpdates.indexOf(currentEntryId) === batchUpdates.length - 1;
        if (isLastEntry) {
            // If quantity is filled, or if user presses enter again from quantity,
            // then consider adding new row. For now, just focusing quantity is enough.
            // The original 'addBatchEntry()' call here might have been too aggressive.
            // addBatchEntry(); // This might be too aggressive if not the last line.
            // Let's make it focus quantity first, then if enter on quantity of last line, add new.
            // For now, just focus quantity. The original code was: addBatchEntry();
            // The original logic was: stopUpdateScanner(); console.log(...); addBatchEntry();
            // This means after typing ID and enter, it immediately added a new blank row.
            // Let's keep that original behavior for speed.
             addBatchEntry();
        }


      }
    });
  }

  const clearToOrderFilterBtnEl = document.getElementById('clearToOrderFilterBtn');
  if (clearToOrderFilterBtnEl) {
    clearToOrderFilterBtnEl.addEventListener('click', () => {
      const filterToOrderSupplierDropdown = document.getElementById('filterToOrderSupplier');
      if (filterToOrderSupplierDropdown) {
        filterToOrderSupplierDropdown.value = "";
      }
      updateToOrderTable();
    });
  }


  const newRemoveButton = entryDiv.querySelector('.removeBatchEntryBtn');
  if (newRemoveButton) {
      newRemoveButton.addEventListener('click', () => {
          removeBatchEntry(newRemoveButton.getAttribute('data-entry-id'));
      });
  }

}

function removeBatchEntry(entryId) {
  const idInput = document.getElementById('batchUpdates').querySelector(`[id="${entryId}-id"]`);
  if (idInput && idInput.parentElement) {
      idInput.parentElement.remove();
      batchUpdates = batchUpdates.filter(id => id !== entryId);
  } else {
      console.error(`Could not find element or its parent to remove for entryId: ${entryId}. idInput found: ${!!idInput}`);
  }
}

async function submitBatchUpdates() {
  let messages = [];
  for (const entryId of batchUpdates) {
    const productId = document.getElementById(`${entryId}-id`).value.trim();
    const quantity = parseInt(document.getElementById(`${entryId}-quantity`).value) || 0;
    const action = document.getElementById(`${entryId}-action`).value;
    const snapshot = await db.collection('inventory').where('id', '==', productId).get();
    if (!snapshot.empty) {
      const product = snapshot.docs[0].data();
      if (quantity > 0) {
        if (action === 'add') {
          const newQuantity = product.quantity + quantity;
          await db.collection('inventory').doc(productId).update({ quantity: newQuantity });
          messages.push(`Added ${quantity} to ${product.name}. New quantity: ${newQuantity}`);
          await logActivity('batch_stock_update', `Product: ${product.name} quantity increased by ${quantity} (New: ${newQuantity})`, productId);
        } else if (action === 'remove') {
          if (product.quantity >= quantity) {
            const newQuantity = product.quantity - quantity;
            await db.collection('inventory').doc(productId).update({ quantity: newQuantity });
            messages.push(`Removed ${quantity} from ${product.name}. New quantity: ${newQuantity}`);
            await logActivity('batch_stock_update', `Product: ${product.name} quantity decreased by ${quantity} (New: ${newQuantity})`, productId);
          } else {
            messages.push(`Cannot remove ${quantity} from ${product.name}. Only ${product.quantity} available.`);
          }
        }
      } else {
        messages.push(`Invalid quantity for ${product.name}.`);
      }
    } else {
      messages.push(`Product ID ${productId} not found.`);
    }
  }
  if (messages.length > 0) {
    inventory = await inventoryManager.loadInventory();
    displayInventory(); // Refresh main inventory table
    updateInventoryDashboard(); // Refresh dashboard stats
    await updateToOrderTable(); // Refresh to-order table
    document.getElementById('batchUpdates').innerHTML = '';
    batchUpdates = [];
    alert(messages.join('\n'));
  } else {
    alert('No updates to process.');
  }
}

// Move Product
async function moveProduct() {
  const productId = document.getElementById('moveProductId').value.trim();
  const newLocation = document.getElementById('newLocation').value;
  const snapshot = await db.collection('inventory').where('id', '==', productId).get();
  if (!snapshot.empty) {
    const product = snapshot.docs[0].data();
    try {
      await db.collection('inventory').doc(productId).update({ location: newLocation });
      inventory = await inventoryManager.loadInventory();
      await updateToOrderTable();
      document.getElementById('moveProductId').value = '';
      await logActivity('product_moved', `Product: ${product.name} moved to ${newLocation}`, productId, product.name);
      uiEnhancementManager.showToast(`Product ${product.name} moved to ${newLocation}`, 'success');
    } catch (error) {
      console.error('Error moving product:', error);
      uiEnhancementManager.showToast('Failed to move product: ' + error.message, 'error');
    }
  } else {
    uiEnhancementManager.showToast('Product not found.', 'error');
  }
}

// NEW: Open Move Product Form - missing function that was being called
function openMoveProductForm(productId) {
  console.log(`Opening move product form for product: ${productId}`);
  const product = inventory.find(item => item.id === productId);
  if (!product) {
    return console.error('Product not found:', productId);
  }
  document.getElementById('moveProductId').value = productId;
  document.getElementById('newLocation').value = product.location || '';
  document.getElementById('currentLocationDisplay').textContent = product.location || 'N/A';
  document.getElementById('productNameDisplay').textContent = product.name;
  document.getElementById('productQuantityDisplay').textContent = product.quantity;
  document.getElementById('productMinQuantityDisplay').textContent = product.minQuantity;
  document.getElementById('productReorderQuantityDisplay').textContent = product.reorderQuantity;
  document.getElementById('supplierNameDisplay').textContent = product.supplier || 'Not specified';
  document.getElementById('moveProductForm').classList.remove('hidden');
  document.getElementById('appMainContainer').classList.add('blur');
  document.getElementById('appNavbar').classList.add('blur');
  setTimeout(() => {
    document.getElementById('newLocation').focus();
  }, 300);
}

// Close Move Product Form
function closeMoveProductForm() {
  document.getElementById('moveProductForm').classList.add('hidden');
  document.getElementById('appMainContainer').classList.remove('blur');
  document.getElementById('appNavbar').classList.remove('blur');
  document.getElementById('moveProductId').value = '';
  document.getElementById('newLocation').value = '';
  document.getElementById('currentLocationDisplay').textContent = '';
  document.getElementById('productNameDisplay').textContent = '';
  document.getElementById('productQuantityDisplay').textContent = '';
  document.getElementById('productMinQuantityDisplay').textContent = '';
  document.getElementById('productReorderQuantityDisplay').textContent = '';
  document.getElementById('supplierNameDisplay').textContent = '';
}

// Generate Supplier Order Summaries
async function generateSupplierOrderSummaries() {
  console.log('Generating supplier order summaries...');
  try {
    const db = firebase.firestore();
    const inventorySnapshot = await db.collection('inventory').get();
    const ordersSnapshot = await db.collection('orders').get();

    // Map to store supplier order data
    const supplierOrderData = {};

    // Process inventory data
    inventorySnapshot.docs.forEach(doc => {
      const item = doc.data();
      if (item.supplier) {
        if (!supplierOrderData[item.supplier]) {
          supplierOrderData[item.supplier] = {
            supplier: item.supplier,
            products: [],
            totalQuantity: 0
          };
        }
        supplierOrderData[item.supplier].products.push(item);
        supplierOrderData[item.supplier].totalQuantity += item.quantity;
      }
    });

    // Process orders data to adjust quantities
    ordersSnapshot.docs.forEach(doc => {
      const order = doc.data();
      if (order.productId && order.quantity) {
        const product = inventorySnapshot.docs.find(item => item.id === order.productId);
        if (product && product.data().supplier) {
          const supplierKey = product.data().supplier;
          if (supplierOrderData[supplierKey]) {
            const productInOrder = supplierOrderData[supplierKey].products.find(p => p.id === order.productId);
            if (productInOrder) {
              productInOrder.quantity -= order.quantity;
              supplierOrderData[supplierKey].totalQuantity -= order.quantity;
            }
          }
        }
      }
    });

    // Now generate the report in the desired format
    const reportData = Object.values(supplierOrderData).map(supplierData => {
      return {
        supplier: supplierData.supplier,
        totalQuantity: supplierData.totalQuantity,
        products: supplierData.products.map(product => {
          return {
            id: product.id,
            name: product.name,
            quantity: product.quantity,
            cost: product.cost
          };
        })
      };
    });

    console.log('Supplier order report data:', reportData);

    // Here you would typically create a PDF or other report format
    // For now, let's just log it and show a success message
    uiEnhancementManager.showToast('Supplier order summaries generated successfully!', 'success');
  } catch (error) {
    console.error('Error in generateSupplierOrderSummaries:', error);
  }
}

// Missing updateToOrderTable function
async function updateToOrderTable() {
    console.log('updateToOrderTable called');
    try {
        if (!inventory || inventory.length === 0) {
            console.log('No inventory data available for to-order table');
            return;
        }

        // Update both low stock table bodies
        const ordersViewTableBody = document.getElementById('ordersViewLowStockTableBody');
        const dashboardTableBody = document.getElementById('lowStockTableBody');
        
        if (!ordersViewTableBody && !dashboardTableBody) {
            console.log('No low stock table bodies found');
            return;
        }

        // Filter products that need ordering
        const productsToOrder = inventory.filter(item =>
            (item.quantity + (item.quantityOrdered || 0)) <= item.minQuantity && item.minQuantity > 0
        );

        console.log(`Found ${productsToOrder.length} products that need ordering`);

        // Function to update a table body
        const updateTableBody = (tableBody) => {
            if (!tableBody) return;
            
            // Clear existing table
            tableBody.innerHTML = '';

            if (productsToOrder.length === 0) {
                const row = tableBody.insertRow();
                row.innerHTML = `
                    <td colspan="7" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        <div class="flex flex-col items-center">
                            <svg class="w-12 h-12 mb-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <h3 class="text-lg font-semibold mb-2">All products are well stocked!</h3>
                            <p class="text-sm">No items currently need reordering</p>
                        </div>
                    </td>
                `;
            } else {
                // Group products by supplier
                const productsBySupplier = {};
                productsToOrder.forEach(item => {
                    const supplierName = item.supplier || 'No Supplier Specified';
                    if (!productsBySupplier[supplierName]) {
                        productsBySupplier[supplierName] = [];
                    }
                    productsBySupplier[supplierName].push(item);
                });

                // Sort suppliers alphabetically
                const sortedSuppliers = Object.keys(productsBySupplier).sort();

                // Render grouped products
                sortedSuppliers.forEach((supplierName, supplierIndex) => {
                    const supplierProducts = productsBySupplier[supplierName];
                    
                    // Add supplier header row
                    const headerRow = tableBody.insertRow();
                    headerRow.className = 'bg-base-200 dark:bg-slate-600';
                    headerRow.innerHTML = `
                        <td colspan="7" class="px-4 py-3 font-semibold text-base-content">
                            <div class="flex items-center gap-2">
                                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6"></path>
                                </svg>
                                ${supplierName} (${supplierProducts.length} item${supplierProducts.length !== 1 ? 's' : ''})
                            </div>
                        </td>
                    `;

                    // Add products for this supplier
                    supplierProducts.forEach(item => {
                        const row = tableBody.insertRow();
                        const quantityNeeded = Math.max(0, item.minQuantity - item.quantity - (item.quantityOrdered || 0));
                        const recommendedOrder = item.reorderQuantity || quantityNeeded;
                        
                        row.className = 'border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-750';
                        row.innerHTML = `
                            <td class="px-2 py-1 font-medium pl-8">${item.name}</td>
                            <td class="px-2 py-1 text-center">
                                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                    ${item.quantity}
                                </span>
                            </td>
                            <td class="px-2 py-1 text-center">${item.quantityOrdered || 0}</td>
                            <td class="px-2 py-1 text-center">${item.minQuantity || 0}</td>
                            <td class="px-2 py-1 text-gray-500 dark:text-gray-400 text-sm">${item.location || 'Not specified'}</td>
                            <td class="px-2 py-1 text-gray-500 dark:text-gray-400 text-sm">${item.supplier || 'Not specified'}</td>
                            <td class="px-2 py-1">
                                <div class="flex items-center gap-1">
                                    <button onclick="createOrder('${item.id}', ${recommendedOrder})" class="btn btn-primary btn-xs">
                                        Order ${recommendedOrder}
                                    </button>
                                    <button onclick="viewQRCode('${item.id}')" class="btn btn-secondary btn-xs">
                                        QR
                                    </button>
                                </div>
                            </td>
                        `;
                    });

                    // Add spacing between supplier groups (except for the last one)
                    if (supplierIndex < sortedSuppliers.length - 1) {
                        const spacerRow = tableBody.insertRow();
                        spacerRow.innerHTML = `<td colspan="7" class="py-2"></td>`;
                    }
                });
            }
        };

        // Update both table bodies
        updateTableBody(ordersViewTableBody);
        updateTableBody(dashboardTableBody);

        // Update reorder notification and badges
        const supplierCount = productsToOrder.length > 0 ? Object.keys(productsBySupplier || {}).length : 0;
        
        // Update notification bar
        const reorderNotificationBar = document.getElementById('reorderNotificationBar');
        if (reorderNotificationBar) {
            if (productsToOrder.length > 0) {
                reorderNotificationBar.textContent = `Products to reorder: ${productsToOrder.length} items from ${supplierCount} supplier${supplierCount !== 1 ? 's' : ''}`;
                reorderNotificationBar.classList.remove('hidden');
            } else {
                reorderNotificationBar.classList.add('hidden');
            }
        }

        // Update badge for orders view
        const ordersViewBadge = document.getElementById('ordersViewLowStockAlertBadge');
        if (ordersViewBadge) {
            if (productsToOrder.length > 0) {
                ordersViewBadge.textContent = `${productsToOrder.length} items from ${supplierCount} supplier${supplierCount !== 1 ? 's' : ''}`;
            } else {
                ordersViewBadge.textContent = 'All stocked';
            }
        }

        // Update badge for dashboard view
        const dashboardBadge = document.getElementById('dashboardLowStockAlertBadge');
        if (dashboardBadge) {
            if (productsToOrder.length > 0) {
                dashboardBadge.textContent = `${productsToOrder.length} items need attention`;
            } else {
                dashboardBadge.textContent = 'All stocked';
            }
        }

        console.log('Low stock tables updated successfully with supplier grouping');
    } catch (error) {
        console.error('Error in updateToOrderTable:', error);
    }
}

async function viewQRCode(productId) {
    console.log('viewQRCode called for product:', productId);
    try {
        // Find the product
        const product = inventory.find(item => item.id === productId);
        if (!product) {
            uiEnhancementManager.showToast('Product not found', 'error');
            return;
        }

        // Ensure QR code library is available
        await ensureQRCodeIsAvailable();

        // Create or get QR code modal
        let qrModal = document.getElementById('qrCodeModal');
        if (!qrModal) {
            // Create QR modal if it doesn't exist
            qrModal = document.createElement('div');
            qrModal.id = 'qrCodeModal';
            qrModal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            qrModal.innerHTML = `
                <div class="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold dark:text-white">Product QR Code</h3>
                        <button id="closeQRModal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="text-center">
                        <div id="qrCodeContainer" class="mb-4"></div>
                        <p id="qrProductName" class="font-medium dark:text-white mb-2"></p>
                        <p id="qrProductId" class="text-sm text-gray-600 dark:text-gray-400 mb-4"></p>
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
                uiEnhancementManager.showToast('QR code downloaded', 'success');
            }
        };

        // Show modal
        qrModal.classList.remove('hidden');
        qrModal.classList.add('flex');

        uiEnhancementManager.showToast(`QR code displayed for ${product.name}`, 'success');
    } catch (error) {
        console.error('Error in viewQRCode:', error);
        uiEnhancementManager.showToast('Failed to generate QR code: ' + error.message, 'error');
    }
}

// Strengthened updateInventoryDashboard function
function updateInventoryDashboard() {
    console.log('[updateInventoryDashboard] Called.'); // Log entry
    try {
        const totalProductsCountEl = document.getElementById('totalProductsCount');
        const lowStockCountEl = document.getElementById('lowStockCount');
        const outOfStockCountEl = document.getElementById('outOfStockCount');

        if (!totalProductsCountEl || !lowStockCountEl || !outOfStockCountEl) {
            console.error('[updateInventoryDashboard] One or more dashboard stat elements not found in the DOM.');
            // Attempt to set to 0 anyway if some exist, or just return.
            if (totalProductsCountEl) totalProductsCountEl.textContent = '0';
            if (lowStockCountEl) lowStockCountEl.textContent = '0';
            if (outOfStockCountEl) outOfStockCountEl.textContent = '0';
            return; // Exit if essential elements are missing
        }

        if (!inventory || inventory.length === 0) {
            console.log('[updateInventoryDashboard] No inventory data available or inventory is empty.');
            totalProductsCountEl.textContent = '0';
            lowStockCountEl.textContent = '0';
            outOfStockCountEl.textContent = '0';
            // updateLowStockAlerts(); // Call this to clear or show "no alerts" message
            // Ensure updateLowStockAlerts is defined and handles this case or check its existence before calling
            if (typeof updateLowStockAlerts === 'function') {
                 updateLowStockAlerts();
            } else {
                console.warn('[updateInventoryDashboard] updateLowStockAlerts function not found, cannot update alerts for empty inventory.');
            }
            return;
        }

        const totalProducts = inventory.length;
        const lowStockItems = inventory.filter(item => item.quantity <= item.minQuantity && item.minQuantity > 0);
        const outOfStockItems = inventory.filter(item => item.quantity === 0);
        // const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.cost || 0), 0); // This was for the enhanced dashboard

        console.log(`[updateInventoryDashboard] Calculated stats: Total=${totalProducts}, Low=${lowStockItems.length}, Out=${outOfStockItems.length}`);

        totalProductsCountEl.textContent = totalProducts;
        lowStockCountEl.textContent = lowStockItems.length;
        outOfStockCountEl.textContent = outOfStockItems.length;

        if (typeof updateLowStockAlerts === 'function') {
            updateLowStockAlerts(); // This updates another part of the UI
        } else {
            console.warn('[updateInventoryDashboard] updateLowStockAlerts function not found.');
        }

        console.log(`[updateInventoryDashboard] Successfully updated inventory stats in UI.`); // Final success log
    } catch (error) {
        console.error('[updateInventoryDashboard] Error caught:', error);
        // Fallback: try to set stats to 0 or placeholder if an error occurs
        try {
            const tpc = document.getElementById('totalProductsCount');
            if (tpc) tpc.textContent = '0 (err)';
            const lsc = document.getElementById('lowStockCount');
            if (lsc) lsc.textContent = '0 (err)';
            const oosc = document.getElementById('outOfStockCount');
            if (oosc) oosc.textContent = '0 (err)';
        } catch (e) {
            console.error('[updateInventoryDashboard] Error during fallback UI update:', e);
        }
    }
}

// Missing updateLowStockAlerts function (ensure it's defined elsewhere or handle its absence)
// Assuming updateLowStockAlerts is defined as it was in previous steps.
function updateLowStockAlerts() {
    console.log('updateLowStockAlerts called');
    try {
        if (!inventory || inventory.length === 0) {
            console.log('No inventory data available for low stock alerts');
             // Try to clear both potential table bodies if inventory is empty
            const tableBodyInventory = document.getElementById('lowStockTableBody'); // Original ID
            if (tableBodyInventory) tableBodyInventory.innerHTML = '<tr><td colspan="6" class="text-center p-4">No inventory data.</td></tr>';
            const tableBodyOrders = document.getElementById('ordersViewLowStockTableBody'); // New ID
            if (tableBodyOrders) tableBodyOrders.innerHTML = '<tr><td colspan="6" class="text-center p-4">No inventory data.</td></tr>';
            return;
        }

        const lowStockItems = inventory.filter(item => item.quantity <= item.minQuantity && item.minQuantity > 0);

        // Determine which table body and badge to update based on the currently visible view.
        // This is a bit of a heuristic. A better way might be to pass the target element IDs.
        let targetTableBodyId = 'lowStockTableBody'; // Default to original inventory view's table
        let targetBadgeId = 'lowStockAlert'; // Default to original inventory view's badge

        const ordersView = document.getElementById('ordersSectionContainer');
        if (ordersView && !ordersView.classList.contains('hidden')) {
            targetTableBodyId = 'ordersViewLowStockTableBody';
            targetBadgeId = 'ordersViewLowStockAlertBadge';
        }
        // Add similar check if it could also appear in inventoryViewContainer directly (though it was removed)
        // else if (document.getElementById('inventoryViewContainer') && !document.getElementById('inventoryViewContainer').classList.contains('hidden')) {
        //    targetTableBodyId = 'lowStockTableBody'; // Keep original if it's in inventory view
        //    targetBadgeId = 'lowStockAlert';
        // }


        const lowStockTableBody = document.getElementById(targetTableBodyId);
        const lowStockAlertBadge = document.getElementById(targetBadgeId);

        if (!lowStockTableBody) {
            console.warn(`Low stock table body with ID '${targetTableBodyId}' not found in the current view. Alerts will not be displayed there.`);
            // Optionally, clear the other table if it exists to avoid stale data
            const otherTableBodyId = targetTableBodyId === 'lowStockTableBody' ? 'ordersViewLowStockTableBody' : 'lowStockTableBody';
            const otherTableBody = document.getElementById(otherTableBodyId);
            if (otherTableBody) otherTableBody.innerHTML = '';
            return;
        }
         // Clear the other table if it exists, to prevent showing alerts in two places
        const inactiveTableBodyId = targetTableBodyId === 'lowStockTableBody' ? 'ordersViewLowStockTableBody' : 'lowStockTableBody';
        const inactiveTableBody = document.getElementById(inactiveTableBodyId);
        if (inactiveTableBody) inactiveTableBody.innerHTML = '';


        // Update alert badge
        if (lowStockAlertBadge) {
            if (lowStockItems.length > 0) {
                lowStockAlertBadge.textContent = `${lowStockItems.length} items need attention`;
                lowStockAlertBadge.classList.remove('hidden');
            } else {
                lowStockAlertBadge.textContent = '0 items need attention'; // Or clear it
                lowStockAlertBadge.classList.add('hidden'); // Or keep visible with 0
            }
        } else {
            console.warn(`Low stock alert badge with ID '${targetBadgeId}' not found.`);
        }

        // Clear existing table
        lowStockTableBody.innerHTML = '';

        if (lowStockItems.length === 0) {
            const row = lowStockTableBody.insertRow();
            row.innerHTML = `
                <td colspan="6" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
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
            lowStockItems.forEach(item => {
                const row = lowStockTableBody.insertRow();
                row.className = 'border-b dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900';
                row.innerHTML = `
                    <td class="px-4 py-2 font-medium text-amber-800 dark:text-amber-200">${item.name}</td>
                    <td class="px-4 py-2 text-center">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            ${item.quantity}
                        </span>
                    </td>
                    <td class="px-4 py-2 text-center text-amber-700 dark:text-amber-300">${item.minQuantity || 0}</td>
                    <td class="px-4 py-2 text-amber-700 dark:text-amber-300">${item.location || 'Not specified'}</td>
                    <td class="px-4 py-2 text-amber-700 dark:text-amber-300">${item.supplier || 'Not specified'}</td>
                    <td class="px-4 py-2 text-center">
                        <div class="flex items-center justify-center gap-2">
                            <button onclick="createOrder('${item.id}', ${item.reorderQuantity || item.minQuantity})" class="btn btn-warning btn-xs">
                                Order Now
                            </button>
                            <button onclick="openScanToEditModalAndLoadProduct('${item.id}')" class="btn btn-secondary btn-xs">
                                Edit
                            </button>
                        </div>
                    </td>
                `;
            });
        }

        console.log(`Low stock alerts updated for ${targetTableBodyId}: ${lowStockItems.length} items`);
    } catch (error) {
        console.error('Error in updateLowStockAlerts:', error);
    }
}

// Helper function to quickly open scan-to-edit modal and load product (used from alerts table)
async function openScanToEditModalAndLoadProduct(productId) {
    openScanToEditModal(); // Opens the modal in ID input state
    // Directly set the product ID and trigger the search/load
    const productIdInput = document.getElementById('scanToEditProductIdInput');
    if (productIdInput) {
        productIdInput.value = productId;
        await handleScanToEditProductIdSubmit(); // This will find the product and populate the form
    } else {
        console.error("Could not find Product ID input in Scan-to-Edit modal to auto-load product.");
    }
}


// Missing createOrder function
async function createOrder(productId, quantity) {
    console.log('createOrder called for product:', productId, 'quantity:', quantity);
    try {
        const product = inventory.find(item => item.id === productId);
        if (!product) {
            uiEnhancementManager.showToast('Product not found', 'error');
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            uiEnhancementManager.showToast('User not authenticated', 'error');
            return;
        }

        // Create order document
        const orderData = {
            productId: productId,
            productName: product.name,
            quantity: quantity,
            status: 'pending',
            orderDate: firebase.firestore.Timestamp.now(),
            userId: user.uid
        };

        await db.collection('orders').add(orderData);

        // Update product quantityOrdered
        const productDoc = await db.collection('inventory').doc(productId).get();
        if (productDoc.exists) {
            const currentOrdered = productDoc.data().quantityOrdered || 0;
            await db.collection('inventory').doc(productId).update({
                quantityOrdered: currentOrdered + quantity
            });
        }

        // Refresh data
        inventory = await inventoryManager.loadInventory();
        await updateToOrderTable();

        uiEnhancementManager.showToast(`Order created for ${quantity} units of ${product.name}`, 'success');
    } catch (error) {
        console.error('Error creating order:', error);
        uiEnhancementManager.showToast('Failed to create order: ' + error.message, 'error');
    }
}

// ENHANCED REAL-TIME FUNCTIONALITY AND UI FIXES

// Ensure real-time order filters work
function setupRealTimeOrderFilters() {
    console.log('Setting up real-time order filters');
    
    // Order status filter
    const orderStatusFilter = document.getElementById('filterOrderStatus');
    if (orderStatusFilter) {
        orderStatusFilter.addEventListener('change', () => {
            console.log('Order status filter changed to:', orderStatusFilter.value);
            loadAndDisplayOrders();
            if (typeof uiEnhancementManager !== 'undefined') {
                uiEnhancementManager.showToast(`Filtering orders by: ${orderStatusFilter.value || 'all'}`, 'info');
            }
        });
        console.log('Order status filter event listener added');
    }

    // Order supplier filter
    const orderSupplierFilter = document.getElementById('filterOrderSupplierDropdown');
    if (orderSupplierFilter) {
        orderSupplierFilter.addEventListener('change', () => {
            console.log('Order supplier filter changed to:', orderSupplierFilter.value);
            loadAndDisplayOrders();
            if (typeof uiEnhancementManager !== 'undefined') {
                uiEnhancementManager.showToast(`Filtering by supplier: ${orderSupplierFilter.value || 'all'}`, 'info');
            }
        });
        console.log('Order supplier filter event listener added');
    }
}

// Enhanced dark mode functionality
function setupEnhancedDarkMode() {
    console.log('Setting up enhanced dark mode toggle');
    
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        // Update button text based on current mode
        function updateDarkModeButton() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const isDark = currentTheme === DARK_THEME_NAME;
            darkModeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
            darkModeToggle.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        }
        
        // Initial button update - this will be called after initialDarkModeCheck sets the theme
        updateDarkModeButton();
        
        // The main event listener is already set up in DOMContentLoaded.
        // This function might be redundant if DOMContentLoaded always runs first and sets up the listener.
        // However, if it's called independently, it needs its own listener or ensure the one in DOMContentLoaded is robust.
        // For safety and to ensure it works if called separately, let's ensure it has its own,
        // but be mindful of potential duplicate listeners if not managed carefully.
        // The one in DOMContentLoaded should be sufficient. We can simplify this function
        // to mainly handle the toast if the listener is reliably set elsewhere.

        // If the listener in DOMContentLoaded is the primary one, this function might only be for the toast
        // or can be removed if the DOMContentLoaded listener handles the toast as well.
        // Let's assume the DOMContentLoaded listener is the primary one.
        // This function can be simplified or its logic merged.

        // The 'click' listener logic is now primarily in DOMContentLoaded.
        // This function, if still called by initializeAllEnhancements,
        // will re-run updateDarkModeButton which is fine.
        // The event listener itself should ideally be attached only once.
        // The current DOMContentLoaded code adds the listener correctly.
        // So, this function's listener part is duplicative if initializeAllEnhancements is called after DOMContentLoaded.

        // To avoid issues with duplicate listeners, we can ensure this only updates the button text,
        // assuming the event listener is already in place from DOMContentLoaded.
        // Or, ensure this function is self-contained if it might be called when the DOMContentLoaded one isn't.

        // Given the current structure, let's ensure this only updates the button if it exists
        // and let the DOMContentLoaded handle the event listener.
        // The toast logic is also in the DOMContentLoaded listener now (implicitly, it calls the same functions).

        // If this function is still being called by initializeAllEnhancements,
        // ensure it doesn't add a *new* event listener each time.
        // The current setup in DOMContentLoaded already handles the click.
        // So, this function could potentially be simplified or removed if setupEnhancedDarkMode
        // is only meant to be called once.

        // The `uiEnhancementManager.showToast` is now part of the main listener in DOMContentLoaded.
        // Let's adjust this function to mainly log and ensure button text is correct,
        // assuming the primary event listener is in DOMContentLoaded.

        console.log('Enhanced dark mode toggle setup (button text update part) complete.');
    } else {
        console.error('darkModeToggle element not found during setupEnhancedDarkMode call.');
    }
}

// Enhanced inventory update with automatic low stock alerts
function updateInventoryWithAlerts() {
    console.log('Updating inventory with automatic alerts');
    
    if (!inventory || inventory.length === 0) {
        console.log('No inventory data available');
        return;
    }
    
    // Update all related components
    updateInventoryDashboard();
    updateLowStockAlerts();
    updateToOrderTable();
    
    // Update enhanced dashboard if on that view
    const dashboardView = document.getElementById('dashboardViewContainer');
    if (dashboardView && !dashboardView.classList.contains('hidden')) {
        updateEnhancedDashboard();
    }
    
    console.log('Inventory update with alerts complete');
}

// Quick QR code features enhancement
function enhanceQuickQRFeatures() {
    console.log('Enhancing quick QR features');
    
    // Add QR code buttons to inventory table if not already present
    const inventoryTable = document.getElementById('inventoryTable');
    if (inventoryTable) {
        // QR features are already integrated in displayInventory function
        console.log('QR code features are integrated in inventory table');
    }
    
    // Add global QR code generation button
    const qrCodeSection = document.getElementById('qrCodeReportContainer');
    if (qrCodeSection) {
        const quickQRBtn = document.createElement('button');
        quickQRBtn.className = 'btn btn-primary btn-sm mt-2';
        quickQRBtn.innerHTML = `
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
        `;
        quickQRBtn.onclick = () => {
            if (inventory && inventory.length > 0) {
                const firstProduct = inventory[0];
                viewQRCode(firstProduct.id);
            } else {
                if (typeof uiEnhancementManager !== 'undefined') {
                    uiEnhancementManager.showToast('No products available for QR code generation', 'warning');
                }
            }
        };
        
        if (!qrCodeSection.querySelector('.btn-primary')) {
            qrCodeSection.appendChild(quickQRBtn);
        }
    }
    
    console.log('Quick QR features enhancement complete');
}

// Modal Global Variables
// let currentModalOrderId = null; // For the original larger modal (DEPRECATED)
let currentMiniModalOrderId = null; // For the new mini status update modal

// Function to open the order details modal (original - DEPRECATED)
/*
function openOrderDetailsModal() {
    const modal = document.getElementById('orderDetailsModal');
    if (modal) {
        modal.classList.remove('hidden');
        // modal.classList.add('flex'); // If using flex to center, already in HTML
    } else {
        console.error("Order details modal element not found.");
    }
}
*/

// Function to close the order details modal (original - DEPRECATED)
/*
function closeOrderDetailsModal() {
    const modal = document.getElementById('orderDetailsModal');
    if (modal) {
        modal.classList.add('hidden');
        currentModalOrderId = null;
    } else {
        console.error("Order details modal element not found.");
    }
}
*/

// Function to open the NEW mini status update modal
function openMiniStatusModal(orderId, currentStatus) {
    currentMiniModalOrderId = orderId; // Store the orderId

    const displayOrderIdElem = document.getElementById('miniModalDisplayOrderId');
    if (displayOrderIdElem) {
        displayOrderIdElem.textContent = orderId;
    } else {
        console.error("miniModalDisplayOrderId element not found.");
    }

    const statusSelectElem = document.getElementById('miniModalOrderStatusSelect');
    if (statusSelectElem) {
        statusSelectElem.value = currentStatus;
    } else {
        console.error("miniModalOrderStatusSelect element not found.");
    }

    // Initially hide quantity input, will be shown by dropdown listener if needed
    const quantityReceivedGroup = document.getElementById('miniModalQuantityReceivedGroup');
    if (quantityReceivedGroup) {
        quantityReceivedGroup.classList.add('hidden');
    }
    const quantityReceivedInput = document.getElementById('miniModalQuantityReceived');
    if (quantityReceivedInput) {
        quantityReceivedInput.value = ''; // Clear any previous value
    }

    // Trigger change event on status dropdown to set initial visibility of quantity input
    if (statusSelectElem) {
        statusSelectElem.dispatchEvent(new Event('change'));
    }


    const modal = document.getElementById('miniStatusUpdateModal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        console.error("miniStatusUpdateModal element not found.");
    }
}

// Function to close the NEW mini status update modal
function closeMiniStatusModal() {
    const modal = document.getElementById('miniStatusUpdateModal');
    if (modal) {
        modal.classList.add('hidden');
    } else {
        console.error("miniStatusUpdateModal element not found.");
    }
    currentMiniModalOrderId = null; // Clear the stored order ID
    // Also clear quantity input and hide its group on close
    const quantityReceivedGroup = document.getElementById('miniModalQuantityReceivedGroup');
    if (quantityReceivedGroup) {
        quantityReceivedGroup.classList.add('hidden');
    }
    const quantityReceivedInput = document.getElementById('miniModalQuantityReceived');
    if (quantityReceivedInput) {
        quantityReceivedInput.value = '';
    }
}


// Initialize all enhancements
function initializeAllEnhancements() {
    console.log('Initializing all enhancements');
    
    // Set up real-time filters
    setupRealTimeOrderFilters();
    
    // Set up enhanced dark mode
    setupEnhancedDarkMode();
    
    // Enhance QR features
    enhanceQuickQRFeatures();
    
    // Initialize inventory alerts if data is available
    if (inventory && inventory.length > 0) {
        updateInventoryWithAlerts();
    }
    
    console.log('All enhancements initialized');
}

// START: Add Product Modal Functions
function openAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (!modal) {
        console.error("Add Product Modal element not found.");
        return;
    }

    // Populate supplier and location dropdowns in the modal
    // These should ideally use the same functions as the main form if the structure is identical
    // For simplicity, directly populating here, assuming `suppliers` and `locations` arrays are globally available and loaded.

    const modalSupplierDropdown = document.getElementById('modalProductSupplier');
    if (modalSupplierDropdown) {
        modalSupplierDropdown.innerHTML = '<option value="">Select Supplier</option>'; // Reset
        suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier;
            option.textContent = supplier;
            modalSupplierDropdown.appendChild(option);
        });
    } else {
        console.warn("Modal supplier dropdown not found.");
    }

    const modalLocationDropdown = document.getElementById('modalProductLocation');
    if (modalLocationDropdown) {
        modalLocationDropdown.innerHTML = '<option value="">Select Location</option>'; // Reset
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.name; // Assuming location objects have a 'name' property
            option.textContent = location.name;
            modalLocationDropdown.appendChild(option);
        });
    } else {
        console.warn("Modal location dropdown not found.");
    }

    // Reset form fields in the modal
    document.getElementById('modalProductId').value = '';
    document.getElementById('modalProductName').value = '';
    document.getElementById('modalProductQuantity').value = '';
    document.getElementById('modalProductCost').value = '';
    document.getElementById('modalProductMinQuantity').value = '';
    document.getElementById('modalProductReorderQuantity').value = '';
    document.getElementById('modalProductQuantityOrdered').value = '';
    document.getElementById('modalProductQuantityBackordered').value = '';
    document.getElementById('modalProductSupplier').value = '';
    document.getElementById('modalProductLocation').value = '';
    document.getElementById('modalProductPhotoPreview').src = '';
    document.getElementById('modalProductPhotoPreview').classList.add('hidden');
    // Reset photo capture elements if they are part of the modal
    // This assumes similar photo capture logic setup for modal elements
    cancelModalPhoto(); // Call a modal-specific cancel photo function

    modal.classList.remove('hidden');
    modal.classList.add('flex'); // Assuming flex is used for centering
    document.getElementById('modalProductName').focus(); // Focus on the first input
}

function closeAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    cancelModalPhoto(); // Ensure camera is off if it was on
}

async function submitModalProduct() {
    const id = document.getElementById('modalProductId').value || generateUUID();
    const name = document.getElementById('modalProductName').value.trim();
    const quantity = parseInt(document.getElementById('modalProductQuantity').value) || 0;
    const cost = parseFloat(document.getElementById('modalProductCost').value) || 0;
    const minQuantity = parseInt(document.getElementById('modalProductMinQuantity').value) || 0;
    const reorderQuantity = parseInt(document.getElementById('modalProductReorderQuantity').value) || 0;
    const quantityOrdered = parseInt(document.getElementById('modalProductQuantityOrdered').value) || 0;
    const quantityBackordered = parseInt(document.getElementById('modalProductQuantityBackordered').value) || 0;
    const supplier = document.getElementById('modalProductSupplier').value;
    const location = document.getElementById('modalProductLocation').value;
    const currentPhotoSrc = document.getElementById('modalProductPhotoPreview').src;

    if (name && quantity >= 0 && cost >= 0 && minQuantity >= 0 && supplier && location) {
        const name_lowercase = name.toLowerCase();
        const name_words_lc = name_lowercase.split(' ').filter(word => word.length > 0);
        try {
            let photoUrlToSave = '';
            if (currentPhotoSrc && currentPhotoSrc.startsWith('data:image')) { // New photo captured
                photoUrlToSave = await uploadPhoto(id, currentPhotoSrc); // Use existing uploadPhoto function
            }
            // Note: This modal is for ADDING only, so no "editing existing photo" logic needed here.

            await db.collection('inventory').doc(id).set({
                id, name, name_lowercase, name_words_lc, quantity, cost, minQuantity,
                reorderQuantity, quantityOrdered, productQuantityBackordered: quantityBackordered, // Ensure field name matches Firestore
                supplier, location, photo: photoUrlToSave
            });

            closeAddProductModal();
            inventory = await inventoryManager.loadInventory(); // Refresh local inventory

            await logActivity('product_added_modal', `Product: ${name} added via dashboard modal.`, id);

            displayInventory();
            updateInventoryDashboard();
            updateToOrderTable();
            updateEnhancedDashboard(); // Also update the main dashboard stats

            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast(`Product "${name}" added successfully!`, 'success');
            }

        } catch (error) {
            console.error('Error submitting product from modal:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Failed to add product: ' + error.message, 'error');
            } else {
                alert('Failed to add product: ' + error.message);
            }
        }
    } else {
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast('Please fill all required fields with valid values.', 'warning');
        } else {
            alert('Please fill all required fields with valid values.');
        }
    }
}

// Photo functions specific to the modal to avoid ID conflicts
let modalPhotoStream = null;
async function startModalPhotoCapture() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera access not supported by this browser.');
    return;
  }
  try {
    modalPhotoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('modalPhotoVideo');
    video.srcObject = modalPhotoStream;
    video.play();
    video.classList.remove('hidden');
    document.getElementById('modalCapturePhotoBtn').classList.add('hidden');
    document.getElementById('modalTakePhotoBtn').classList.remove('hidden');
    document.getElementById('modalCancelPhotoBtn').classList.remove('hidden');
  } catch (err) {
    console.error('Error accessing camera for modal:', err);
    alert('Error accessing camera: ' + err.message);
  }
}

async function takeModalPhoto() {
  const video = document.getElementById('modalPhotoVideo');
  const canvas = document.getElementById('modalPhotoCanvas');
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const photoData = canvas.toDataURL('image/jpeg', 0.5);
  document.getElementById('modalProductPhotoPreview').src = photoData;
  document.getElementById('modalProductPhotoPreview').classList.remove('hidden');
  cancelModalPhoto();
}

function cancelModalPhoto() {
  if (modalPhotoStream) {
    modalPhotoStream.getTracks().forEach(track => track.stop());
    modalPhotoStream = null;
  }
  const video = document.getElementById('modalPhotoVideo');
  if(video) {
    video.srcObject = null;
    video.classList.add('hidden');
  }
  const captureBtn = document.getElementById('modalCapturePhotoBtn');
  if(captureBtn) captureBtn.classList.remove('hidden');
  const takeBtn = document.getElementById('modalTakePhotoBtn');
  if(takeBtn) takeBtn.classList.add('hidden');
  const cancelBtn = document.getElementById('modalCancelPhotoBtn');
  if(cancelBtn) cancelBtn.classList.add('hidden');
}
// END: Add Product Modal Functions

// START: Update Stock Modal Functions
let currentUpdateStockModalProductId = null;

function openUpdateStockModal() {
    const modal = document.getElementById('updateStockModal');
    if (!modal) {
        console.error("Update Stock Modal element not found.");
        return;
    }
    console.log("Opening Update Stock Modal");

    // Reset fields
    document.getElementById('updateStockProductIdInput').value = '';
    document.getElementById('updateStockScanResult').textContent = '';
    document.getElementById('updateStockScannedProductInfo').classList.add('hidden');
    document.getElementById('updateStockProductName').textContent = '';
    document.getElementById('updateStockCurrentStock').textContent = '';
    document.getElementById('updateStockAdjustQuantity').value = '1';
    document.getElementById('updateStockProductSpecificQR').innerHTML = '';
    document.getElementById('updateStockProductSpecificImage').classList.add('hidden');
    setUpdateStockModalStatus('Ready for Product ID input.', false);
    setUpdateStockModalLastActionFeedback('---', false);
    currentUpdateStockModalProductId = null;

    // Populate action QR codes
    displayUpdateStockModalActionQRCodes();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('updateStockProductIdInput').focus();
}

function closeUpdateStockModal() {
    const modal = document.getElementById('updateStockModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    currentUpdateStockModalProductId = null; // Clear context
    console.log("Update Stock Modal closed");
}

async function handleUpdateStockModalScan(productId) {
    console.log("Update Stock Modal: Processing Product ID:", productId);
    setUpdateStockModalStatus(`Processing ID: ${productId}...`, false);
    currentUpdateStockModalProductId = productId;

    const product = inventory.find(p => p.id === productId);

    const productNameEl = document.getElementById('updateStockProductName');
    const currentStockEl = document.getElementById('updateStockCurrentStock');
    const scannedProductInfoEl = document.getElementById('updateStockScannedProductInfo');
    const productSpecificQREl = document.getElementById('updateStockProductSpecificQR');
    const productSpecificImageEl = document.getElementById('updateStockProductSpecificImage');

    if (!productNameEl || !currentStockEl || !scannedProductInfoEl || !productSpecificQREl || !productSpecificImageEl) {
        console.error("Update Stock Modal: One or more UI elements for displaying product info are missing.");
        setUpdateStockModalStatus("UI error displaying product info.", true);
        return;
    }

    if (product) {
        productNameEl.textContent = product.name;
        currentStockEl.textContent = product.quantity;
        scannedProductInfoEl.classList.remove('hidden');

        setUpdateStockModalStatus(`Product: ${product.name}. Adjust quantity or scan action.`, false);
        setUpdateStockModalLastActionFeedback("Product identified.", false);

        productSpecificQREl.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(productSpecificQREl, {
                text: product.id, width: 80, height: 80,
                colorDark: document.documentElement.classList.contains('dark') ? "#FFFFFF" : "#000000",
                colorLight: document.documentElement.classList.contains('dark') ? "#4A5568" : "#FFFFFF",
            });
        }
        if (product.photo) {
            productSpecificImageEl.src = product.photo;
            productSpecificImageEl.classList.remove('hidden');
        } else {
            productSpecificImageEl.classList.add('hidden');
        }
    } else {
        productNameEl.textContent = 'N/A';
        currentStockEl.textContent = 'N/A';
        scannedProductInfoEl.classList.add('hidden');
        productSpecificQREl.innerHTML = '<span class="text-xs">N/A</span>';
        productSpecificImageEl.classList.add('hidden');
        setUpdateStockModalStatus(`Product ID "${productId}" not found in inventory.`, true);
        setUpdateStockModalLastActionFeedback(`Failed to find product: ${productId}`, true);
        currentUpdateStockModalProductId = null;
    }
}

async function adjustUpdateStockModalQuantity(adjustmentType) {
    const quantityToAdjustStr = document.getElementById('updateStockAdjustQuantity').value;
    const quantityToAdjust = parseInt(quantityToAdjustStr);

    const showToast = (message, type = 'info') => {
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast(message, type);
        } else {
            setUpdateStockModalLastActionFeedback(message, type === 'error' || type === 'warning');
        }
    };

    if (!currentUpdateStockModalProductId) {
        showToast("No active product selected for quantity adjustment.", 'error');
        return;
    }
    if (isNaN(quantityToAdjust) || quantityToAdjust <= 0) {
        showToast("Invalid quantity for adjustment. Must be a positive number.", 'error');
        return;
    }

    try {
        const productRef = db.collection('inventory').doc(currentUpdateStockModalProductId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            showToast(`Product ${currentUpdateStockModalProductId} not found.`, 'error');
            return;
        }

        const productData = productDoc.data();
        let currentQuantity = productData.quantity;
        let newQuantity;

        if (adjustmentType === 'increment') {
            newQuantity = currentQuantity + quantityToAdjust;
            await productRef.update({ quantity: newQuantity });
            showToast(`Added ${quantityToAdjust} to ${productData.name}. New stock: ${newQuantity}`, 'success');
            await logActivity('stock_adjusted_modal', `Product: ${productData.name} quantity increased by ${quantityToAdjust} (New: ${newQuantity}) via modal`, currentUpdateStockModalProductId, productData.name);
        } else if (adjustmentType === 'decrement') {
            if (currentQuantity >= quantityToAdjust) {
                newQuantity = currentQuantity - quantityToAdjust;
                await productRef.update({ quantity: newQuantity });
                showToast(`Removed ${quantityToAdjust} from ${productData.name}. New stock: ${newQuantity}`, 'success');
                await logActivity('stock_adjusted_modal', `Product: ${productData.name} quantity decreased by ${quantityToAdjust} (New: ${newQuantity}) via modal`, currentUpdateStockModalProductId, productData.name);
            } else {
                showToast(`Cannot remove ${quantityToAdjust}. Only ${currentQuantity} in stock for ${productData.name}.`, 'warning');
                return;
            }
        } else {
            showToast("Invalid adjustment type.", 'error');
            return;
        }

        // Update local inventory and UI
        const inventoryIndex = inventory.findIndex(p => p.id === currentUpdateStockModalProductId);
        if (inventoryIndex !== -1) {
            inventory[inventoryIndex].quantity = newQuantity;
        }
        document.getElementById('updateStockCurrentStock').textContent = newQuantity; // Update modal UI
        displayInventory(); // Refresh main inventory table if visible
        updateInventoryDashboard();
        updateToOrderTable();
        updateEnhancedDashboard(); // Update main dashboard stats

    } catch (error) {
        console.error("Error adjusting product quantity in modal:", error);
        showToast(`Error updating stock: ${error.message}`, 'error');
    }
}


async function displayUpdateStockModalActionQRCodes() {
  const container = document.getElementById('updateStockActionQRCodesContainer');
  if (!container) {
    console.error('Update Stock Modal Action QR Codes container not found.');
    return;
  }
  container.innerHTML = ''; // Clear previous QRs

  const actions = [
    { label: '+10', data: 'ACTION_ADD_10', type: 'add' }, { label: '+1', data: 'ACTION_ADD_1', type: 'add' },
    { label: '-10', data: 'ACTION_SUB_10', type: 'sub' }, { label: '-1', data: 'ACTION_SUB_1', type: 'sub' }
    // Add more actions as needed, e.g. +5, -5
  ];

  if (typeof QRCode === 'undefined') {
    container.innerHTML = '<p class="text-red-500 dark:text-red-400 col-span-full text-xs">Error: QRCode lib missing.</p>';
    return;
  }

  actions.forEach(action => {
    const actionDiv = document.createElement('div');
    actionDiv.className = `flex flex-col items-center p-1 border dark:border-slate-600 rounded-md shadow-sm
                           ${action.type === 'add' ? 'bg-green-50 hover:bg-green-100 dark:bg-green-800 dark:hover:bg-green-700' : 'bg-red-50 hover:bg-red-100 dark:bg-red-800 dark:hover:bg-red-700'}
                           transition-colors duration-150 cursor-pointer`;
    actionDiv.title = `Scan to ${action.label} units`;

    const qrCodeElem = document.createElement('div');
    actionDiv.appendChild(qrCodeElem);

    const labelElem = document.createElement('p');
    labelElem.textContent = action.label;
    labelElem.className = 'text-xs mt-1 dark:text-gray-200';
    actionDiv.appendChild(labelElem);

    actionDiv.addEventListener('click', async () => {
        // Simulate scanning this action QR code
        await processUpdateStockModalAction(action.data);
    });

    container.appendChild(actionDiv);

    try {
      new QRCode(qrCodeElem, {
        text: action.data, width: 60, height: 60, // Smaller QRs for modal
        colorDark: document.documentElement.classList.contains('dark') ? "#E2E8F0" : "#1E293B", // Adapting colors
        colorLight: document.documentElement.classList.contains('dark') ? "#334155" : "#F8FAFC",
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      qrCodeElem.textContent = 'Error';
    }
  });
}

async function processUpdateStockModalAction(actionData) {
    if (!currentUpdateStockModalProductId) {
        setUpdateStockModalStatus('Please scan a product ID first.', true);
        if (typeof uiEnhancementManager !== 'undefined') uiEnhancementManager.showToast('Scan product ID first.', 'warning');
        return;
    }
    if (!actionData.startsWith('ACTION_')) {
        setUpdateStockModalStatus(`Invalid action data: ${actionData}`, true);
        return;
    }

    const parts = actionData.split('_'); // e.g., ACTION_ADD_10
    if (parts.length === 3) {
        const operation = parts[1].toLowerCase(); // 'add' or 'sub'
        const quantity = parseInt(parts[2]);

        if (isNaN(quantity)) {
            setUpdateStockModalStatus(`Invalid quantity in action: ${actionData}`, true);
            return;
        }

        let adjustmentType;
        if (operation === 'add') adjustmentType = 'increment';
        else if (operation === 'sub') adjustmentType = 'decrement';
        else {
            setUpdateStockModalStatus(`Unknown operation in action: ${actionData}`, true);
            return;
        }

        // Temporarily set the modal's adjust quantity input to the action's quantity
        const originalAdjustQty = document.getElementById('updateStockAdjustQuantity').value;
        document.getElementById('updateStockAdjustQuantity').value = quantity.toString();

        await adjustUpdateStockModalQuantity(adjustmentType);

        // Restore original adjust quantity (or keep it as is, depending on desired UX)
        // For now, let's restore it. Or perhaps better, keep the scanned action's quantity.
        // Let's keep it, as it might be what the user wants for subsequent manual clicks.
        // document.getElementById('updateStockAdjustQuantity').value = originalAdjustQty;

        // Refocus on the Product ID input for the next scan
        document.getElementById('updateStockProductIdInput').focus();
        document.getElementById('updateStockProductIdInput').select();


    } else {
        setUpdateStockModalStatus(`Malformed action QR code: ${actionData}`, true);
    }
}


function setUpdateStockModalStatus(message, isError = false) {
    const statusEl = document.getElementById('updateStockScannerStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `p-2 rounded-md text-sm min-h-[36px] ${isError ? 'bg-red-100 dark:bg-red-700 text-red-700 dark:text-red-200' : 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200'}`;
    }
}

function setUpdateStockModalLastActionFeedback(message, isError = false) {
    const feedbackEl = document.getElementById('updateStockLastActionFeedback');
    if (feedbackEl) {
        feedbackEl.textContent = message;
        feedbackEl.className = `text-sm min-h-[20px] ${isError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`;
    }
}

// END: Update Stock Modal Functions

// START: Create Order Modal Functions
// Opens the Create Order modal and pre-selects product and quantity if provided
function openCreateOrderModalWithProduct(productId, reorderQty) {
    const modal = document.getElementById('createOrderModal');
    if (!modal) {
        console.error("Create Order Modal element not found.");
        return;
    }
    console.log("Opening Create Order Modal with product:", productId, "qty:", reorderQty);

    // Reset form fields
    const productDropdown = document.getElementById('modalOrderProductId');
    productDropdown.innerHTML = '<option value="">Loading products...</option>'; // Placeholder
    document.getElementById('modalOrderQuantity').value = '';
    document.getElementById('modalOrderSupplierInfo').classList.add('hidden');
    document.getElementById('modalOrderSelectedProductSupplier').textContent = 'N/A';

    // Populate product dropdown
    if (inventory && inventory.length > 0) {
        productDropdown.innerHTML = '<option value="">Select Product</option>';
        inventory.sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id)).forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} (Stock: ${product.quantity}, Min: ${product.minQuantity})`;
            option.dataset.supplier = product.supplier || 'N/A';
            productDropdown.appendChild(option);
        });
        // Pre-select product if provided
        if (productId) {
            productDropdown.value = productId;
            // Trigger change event to show supplier info
            productDropdown.dispatchEvent(new Event('change'));
        }
    } else {
        productDropdown.innerHTML = '<option value="">No products available</option>';
    }

    // Pre-fill quantity if provided
    if (reorderQty) {
        document.getElementById('modalOrderQuantity').value = reorderQty;
    }

    // Remove any previous modal hiding classes
    modal.classList.remove('hidden');
    modal.classList.remove('invisible');
    modal.classList.add('flex');
    if (typeof modal.showModal === 'function') {
        try {
            modal.showModal();
        } catch (e) {
            // If already open, ignore
        }
    }
    productDropdown.focus();
}
function openCreateOrderModal() {
    const modal = document.getElementById('createOrderModal');
    if (!modal) {
        console.error("Create Order Modal element not found.");
        return;
    }
    console.log("Opening Create Order Modal");

    // Reset form fields
    const productDropdown = document.getElementById('modalOrderProductId');
    productDropdown.innerHTML = '<option value="">Loading products...</option>'; // Placeholder
    document.getElementById('modalOrderQuantity').value = '';
    document.getElementById('modalOrderSupplierInfo').classList.add('hidden');
    document.getElementById('modalOrderSelectedProductSupplier').textContent = 'N/A';


    // Populate product dropdown
    // This should list all products, or perhaps only those needing reorder. For now, all.
    if (inventory && inventory.length > 0) {
        productDropdown.innerHTML = '<option value="">Select Product</option>';
        inventory.sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id)).forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = `${product.name} (Stock: ${product.quantity}, Min: ${product.minQuantity})`;
            option.dataset.supplier = product.supplier || 'N/A'; // Store supplier info
            productDropdown.appendChild(option);
        });
    } else {
        productDropdown.innerHTML = '<option value="">No products available</option>';
    }

    // Add event listener to product dropdown to show supplier info
    productDropdown.onchange = function() {
        const selectedOption = this.options[this.selectedIndex];
        const supplier = selectedOption.dataset.supplier;
        if (supplier && supplier !== 'N/A') {
            document.getElementById('modalOrderSelectedProductSupplier').textContent = supplier;
            document.getElementById('modalOrderSupplierInfo').classList.remove('hidden');
        } else {
            document.getElementById('modalOrderSupplierInfo').classList.add('hidden');
        }
    };


    // Remove any previous modal hiding classes
    modal.classList.remove('hidden');
    modal.classList.remove('invisible');
    modal.classList.add('flex');
    // For <dialog> elements, also call .showModal() if supported
    if (typeof modal.showModal === 'function') {
        try {
            modal.showModal();
        } catch (e) {
            // If already open, ignore
        }
    }
    productDropdown.focus();
}

function closeCreateOrderModal() {
    const modal = document.getElementById('createOrderModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    // Clear/reset fields if necessary, e.g., product dropdown selection might persist
    document.getElementById('modalOrderProductId').value = '';
    document.getElementById('modalOrderQuantity').value = '';
    document.getElementById('modalOrderSupplierInfo').classList.add('hidden');
}

async function submitModalOrder() {
    const productId = document.getElementById('modalOrderProductId').value;
    const quantityStr = document.getElementById('modalOrderQuantity').value;
    const quantity = parseInt(quantityStr);

    const showToast = (message, type = 'info') => {
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast(message, type);
        } else {
            alert(message); // Fallback
        }
    };

    if (!productId) {
        showToast("Please select a product.", 'warning');
        return;
    }
    if (isNaN(quantity) || quantity <= 0) {
        showToast("Please enter a valid quantity.", 'warning');
        return;
    }

    const product = inventory.find(p => p.id === productId);
    if (!product) {
        showToast("Selected product not found in local inventory data. Please refresh.", 'error');
        return;
    }

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            showToast("User not authenticated. Please log in.", "error");
            return;
        }

        const orderData = {
            productId: productId,
            productName: product.name, // Store product name for easier display
            quantity: quantity,
            status: 'pending', // Default status for new orders
            orderDate: firebase.firestore.Timestamp.now(), // Firebase server timestamp
            userId: user.uid, // Link order to the user who created it
            supplier: product.supplier || null // Store supplier if available
        };

        const orderRef = await db.collection('orders').add(orderData);
        console.log("Order created with ID:", orderRef.id);

        // Update the product's quantityOrdered in Firestore
        const productDocRef = db.collection('inventory').doc(productId);
        await db.runTransaction(async (transaction) => {
            const productDoc = await transaction.get(productDocRef);
            if (!productDoc.exists) {
                throw "Product document not found!";
            }
            const currentQuantityOrdered = productDoc.data().quantityOrdered || 0;
            transaction.update(productDocRef, { quantityOrdered: currentQuantityOrdered + quantity });
        });
        console.log(`Updated quantityOrdered for product ${productId}`);

        showToast(`Order for ${quantity} of ${product.name} created successfully!`, 'success');
        await logActivity('order_created_modal', `Order for ${quantity} of ${product.name} created via dashboard modal. Order ID: ${orderRef.id}`, orderRef.id, product.name);

        closeCreateOrderModal();

        // Refresh relevant data and UI components
        inventory = await inventoryManager.loadInventory(); // Refresh local inventory
        displayInventory(); // Refresh main inventory table if visible
        updateInventoryDashboard();
        updateToOrderTable();
        updateEnhancedDashboard(); // Update main dashboard stats
        // If the pending orders table is implemented on the dashboard, refresh it too
        if (typeof displayPendingOrdersOnDashboard === "function") {
            displayPendingOrdersOnDashboard();
        }


    } catch (error) {
        console.error("Error submitting order from modal:", error);
        showToast(`Error creating order: ${error.message}`, 'error');
    }
}
// END: Create Order Modal Functions

// START: Dashboard Pending Orders Table Functions
async function displayPendingOrdersOnDashboard() {
    const tableBody = document.getElementById('dashboardPendingOrdersTableBody');
    if (!tableBody) {
        console.error("Dashboard Pending Orders table body not found.");
        return;
    }
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">Loading pending orders...</td></tr>';

    try {
        const ordersSnapshot = await db.collection('orders').where('status', '==', 'pending').orderBy('orderDate', 'desc').limit(10).get();

        if (ordersSnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-gray-500 dark:text-gray-400">No pending orders found.</td></tr>';
            return;
        }

        tableBody.innerHTML = ''; // Clear loading message
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const row = tableBody.insertRow();
            row.className = 'hover'; // DaisyUI hover effect

            row.innerHTML = `
                <td class="text-xs whitespace-nowrap">${doc.id}</td>
                <td>${order.productName || 'N/A'}</td>
                <td class="text-center">${order.quantity}</td>
                <td class="text-xs whitespace-nowrap">${order.orderDate ? order.orderDate.toDate().toLocaleDateString() : 'N/A'}</td>
                <td><span class="badge badge-warning badge-sm">${order.status}</span></td>
                <td class="text-center">
                    <button class="btn btn-xs btn-ghost" onclick="openMiniStatusModal('${doc.id}', '${order.status}')" title="Edit Status">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    </button>
                </td>
            `;
        });
        console.log("Pending orders displayed on dashboard.");
    } catch (error) {
        console.error("Error fetching or displaying pending orders on dashboard:", error);
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-red-500 dark:text-red-400">Error loading pending orders.</td></tr>';
    }
}
// END: Dashboard Pending Orders Table Functions

// START: Scan to Edit Product Modal Functions
let scanToEditModalPhotoStream = null;
let scanToEditModalOriginalPhotoUrl = '';

function openScanToEditModal() {
    const modal = document.getElementById('scanToEditProductModal');
    if (!modal) {
        console.error("Scan to Edit Product Modal element not found.");
        return;
    }
    console.log("Opening Scan to Edit Modal");

    // Reset to initial ID input view
    document.getElementById('scanToEditIdInputView').classList.remove('hidden');
    document.getElementById('scanToEditFormView').classList.add('hidden');
    document.getElementById('scanToEditProductIdInput').value = '';
    document.getElementById('scanToEditStatusMessage').textContent = '';
    document.getElementById('scanToEditModalTitle').textContent = 'Scan or Enter Product ID to Edit';

    cancelScanToEditModalPhoto(); // Ensure camera is off if previously used

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('scanToEditProductIdInput').focus();
}

function closeScanToEditModal() {
    const modal = document.getElementById('scanToEditProductModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    cancelScanToEditModalPhoto(); // Ensure camera is off
    scanToEditModalOriginalPhotoUrl = ''; // Clear stored original photo URL
}

async function handleScanToEditProductIdSubmit() {
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
        const productDoc = await db.collection('inventory').doc(productId).get();
        if (productDoc.exists) {
            const product = productDoc.data();
            statusMessage.textContent = 'Product found. Loading details...';
            populateEditFormInModal(product);
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
}

function populateEditFormInModal(product) {
    document.getElementById('scanToEdit_productId').value = product.id;
    document.getElementById('scanToEdit_productName').value = product.name || '';
    document.getElementById('scanToEdit_productQuantity').value = product.quantity !== undefined ? product.quantity : '';
    document.getElementById('scanToEdit_productCost').value = product.cost !== undefined ? product.cost : '';
    document.getElementById('scanToEdit_productMinQuantity').value = product.minQuantity !== undefined ? product.minQuantity : '';
    document.getElementById('scanToEdit_productReorderQuantity').value = product.reorderQuantity !== undefined ? product.reorderQuantity : '';
    document.getElementById('scanToEdit_productQuantityOrdered').value = product.quantityOrdered !== undefined ? product.quantityOrdered : '';
    document.getElementById('scanToEdit_productQuantityBackordered').value = product.productQuantityBackordered !== undefined ? product.productQuantityBackordered : '';

    const supplierDropdown = document.getElementById('scanToEdit_productSupplier');
    supplierDropdown.innerHTML = '<option value="">Select Supplier</option>';
    suppliers.forEach(s => {
        const option = document.createElement('option');
        option.value = s;
        option.textContent = s;
        if (product.supplier === s) option.selected = true;
        supplierDropdown.appendChild(option);
    });
    if (!product.supplier && supplierDropdown.options.length > 0) supplierDropdown.value = ""; else supplierDropdown.value = product.supplier || "";


    const locationDropdown = document.getElementById('scanToEdit_productLocation');
    locationDropdown.innerHTML = '<option value="">Select Location</option>';
    locations.forEach(l => {
        const option = document.createElement('option');
        option.value = l.name;
        option.textContent = l.name;
        if (product.location === l.name) option.selected = true;
        locationDropdown.appendChild(option);
    });
     if (!product.location && locationDropdown.options.length > 0) locationDropdown.value = ""; else locationDropdown.value = product.location || "";


    const photoPreview = document.getElementById('scanToEdit_productPhotoPreview');
    if (product.photoURL || product.photo) {
        photoPreview.src = product.photoURL || product.photo;
        photoPreview.classList.remove('hidden'); // Make sure it's visible if there's a photo
        scanToEditModalOriginalPhotoUrl = product.photoURL || product.photo;
    } else {
        photoPreview.src = '#'; // Placeholder or default image
        photoPreview.classList.add('hidden'); // Hide if no photo, or use a placeholder
        scanToEditModalOriginalPhotoUrl = '';
    }
    cancelScanToEditModalPhoto(); // Reset photo capture state
}

async function submitEditProductFromModal() {
    const id = document.getElementById('scanToEdit_productId').value; // ID must exist for an edit
    if (!id) {
        uiEnhancementManager.showToast("Product ID is missing. Cannot update.", "error");
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
    const currentPhotoPreviewSrc = document.getElementById('scanToEdit_productPhotoPreview').src;

    if (!name || !supplier || !location) {
        uiEnhancementManager.showToast("Please fill all required fields (Name, Supplier, Location).", "warning");
        return;
    }
     if (quantity < 0 || cost < 0 || minQuantity < 0 || reorderQuantity < 0 || quantityOrdered < 0 || quantityBackordered < 0) {
        uiEnhancementManager.showToast("Numeric values (quantity, cost, etc.) cannot be negative.", "warning");
        return;
    }


    const name_lowercase = name.toLowerCase();
    const name_words_lc = name_lowercase.split(' ').filter(word => word.length > 0);

    try {
        let photoUrlToSave = scanToEditModalOriginalPhotoUrl; // Assume original photo unless changed

        // Check if a new photo was captured (src will be a data URL)
        if (currentPhotoPreviewSrc && currentPhotoPreviewSrc.startsWith('data:image')) {
            photoUrlToSave = await uploadPhoto(id, currentPhotoPreviewSrc); // uploadPhoto handles storage
        }
        // If currentPhotoPreviewSrc is '#' or empty and there was an originalPhotoUrl, it means user wants to remove photo.
        // However, current logic doesn't explicitly support photo removal via setting src to '#'.
        // For now, if src is not a data URL, it's assumed to be the original or unchanged.
        // If you want to support REMOVING a photo, you'd need a separate mechanism or check if photoPreview.src is empty/placeholder
        // and scanToEditModalOriginalPhotoUrl had a value, then set photoUrlToSave = ''

        const productDataToUpdate = {
            name, name_lowercase, name_words_lc, quantity, cost, minQuantity,
            reorderQuantity, quantityOrdered, productQuantityBackordered: quantityBackordered,
            supplier, location, photo: photoUrlToSave
            // ID is not part of the update data, it's the document key
        };

        await db.collection('inventory').doc(id).update(productDataToUpdate);

        uiEnhancementManager.showToast(`Product "${name}" updated successfully!`, 'success');
        await logActivity('product_updated_modal', `Product: ${name} (ID: ${id}) updated via Scan-to-Edit modal.`, id, name);

        closeScanToEditModal();

        // Refresh data and UI
        inventory = await inventoryManager.loadInventory();
        displayInventory();
        updateInventoryDashboard();
        updateToOrderTable();
        updateEnhancedDashboard();

    } catch (error) {
        console.error("Error updating product from modal:", error);
        uiEnhancementManager.showToast(`Error updating product: ${error.message}`, 'error');
    }
}


// Photo functions specific to the Scan to Edit modal
async function startScanToEditModalPhotoCapture() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera access not supported by this browser.');
    return;
  }
  try {
    scanToEditModalPhotoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('scanToEdit_photoVideo');
    video.srcObject = scanToEditModalPhotoStream;
    video.play();
    video.classList.remove('hidden');
    document.getElementById('scanToEdit_capturePhotoBtn').classList.add('hidden');
    document.getElementById('scanToEdit_takePhotoBtn').classList.remove('hidden');
    document.getElementById('scanToEdit_cancelPhotoBtn').classList.remove('hidden');
  } catch (err) {
    console.error('Error accessing camera for Scan to Edit modal:', err);
    alert('Error accessing camera: ' + err.message);
  }
}

async function takeScanToEditModalPhoto() {
  const video = document.getElementById('scanToEdit_photoVideo');
  const canvas = document.getElementById('scanToEdit_photoCanvas');
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const photoData = canvas.toDataURL('image/jpeg', 0.5); // Get as data URL
  document.getElementById('scanToEdit_productPhotoPreview').src = photoData; // Set preview to new data URL
  document.getElementById('scanToEdit_productPhotoPreview').classList.remove('hidden');
  cancelScanToEditModalPhoto();
}

function cancelScanToEditModalPhoto() {
  if (scanToEditModalPhotoStream) {
    scanToEditModalPhotoStream.getTracks().forEach(track => track.stop());
    scanToEditModalPhotoStream = null;
  }
  const video = document.getElementById('scanToEdit_photoVideo');
  if(video) {
    video.srcObject = null;
    video.classList.add('hidden');
  }
  document.getElementById('scanToEdit_capturePhotoBtn').classList.remove('hidden');
  document.getElementById('scanToEdit_takePhotoBtn').classList.add('hidden');
  document.getElementById('scanToEdit_cancelPhotoBtn').classList.add('hidden');
}
// END: Scan to Edit Product Modal Functions

// START: Move Product Modal Functions
let moveProductModal_currentProductId = null;

function openMoveProductModal() {
    const modal = document.getElementById('moveProductModal');
    if (!modal) {
        console.error("Move Product Modal element not found.");
        return;
    }
    console.log("Opening Move Product Modal");

    // Reset to initial ID input view
    document.getElementById('moveProductIdInputView').classList.remove('hidden');
    document.getElementById('moveProductFormView').classList.add('hidden');
    document.getElementById('moveProductModal_productIdInput').value = '';
    document.getElementById('moveProductModal_statusMessage').textContent = '';
    document.getElementById('moveProductModalTitle').textContent = 'Move Product';

    moveProductModal_currentProductId = null;

    // Remove any previous modal hiding classes
    modal.classList.remove('hidden');
    modal.classList.remove('invisible');
    modal.classList.add('flex');
    // For <dialog> elements, also call .showModal() if supported
    if (typeof modal.showModal === 'function') {
        try {
            modal.showModal();
        } catch (e) {
            // If already open, ignore
        }
    }
    // Focus the input
    const input = document.getElementById('moveProductModal_productIdInput');
    if (input) input.focus();
}

function closeMoveProductModal() {
    const modal = document.getElementById('moveProductModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    moveProductModal_currentProductId = null;
}

async function handleMoveProductModalIdSubmit() {
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
        const productDoc = await db.collection('inventory').doc(productId).get();
        if (productDoc.exists) {
            const product = productDoc.data();
            moveProductModal_currentProductId = product.id; // Store the found product ID

            document.getElementById('moveProductModal_productName').textContent = product.name || 'N/A';
            document.getElementById('moveProductModal_currentLocation').textContent = product.location || 'N/A';

            const locationDropdown = document.getElementById('moveProductModal_newLocation');
            locationDropdown.innerHTML = '<option value="">Select New Location</option>';
            locations.forEach(loc => { // Assuming 'locations' array is globally available and populated
                if (loc.name !== product.location) { // Don't list current location as an option
                    const option = document.createElement('option');
                    option.value = loc.name;
                    option.textContent = loc.name;
                    locationDropdown.appendChild(option);
                }
            });
            locationDropdown.value = ""; // Ensure no location is pre-selected

            document.getElementById('moveProductIdInputView').classList.add('hidden');
            document.getElementById('moveProductFormView').classList.remove('hidden');
            document.getElementById('moveProductModalTitle').textContent = `Move: ${product.name}`;
            statusMessage.textContent = ''; // Clear status message
        } else {
            statusMessage.textContent = `Product ID "${productId}" not found.`;
            statusMessage.className = 'text-sm text-center text-error-content';
            moveProductModal_currentProductId = null;
        }
    } catch (error) {
        console.error("Error fetching product for move:", error);
        statusMessage.textContent = 'Error fetching product. Please try again.';
        statusMessage.className = 'text-sm text-center text-error-content';
        moveProductModal_currentProductId = null;
    }
}

async function submitMoveProductFromModal() {
    if (!moveProductModal_currentProductId) {
        uiEnhancementManager.showToast("No product selected to move.", "error");
        return;
    }
    const newLocation = document.getElementById('moveProductModal_newLocation').value;
    if (!newLocation) {
        uiEnhancementManager.showToast("Please select a new location.", "warning");
        return;
    }

    try {
        const productRef = db.collection('inventory').doc(moveProductModal_currentProductId);
        await productRef.update({ location: newLocation });

        const productName = document.getElementById('moveProductModal_productName').textContent;
        uiEnhancementManager.showToast(`Product "${productName}" moved to ${newLocation}.`, "success");
        await logActivity('product_moved_modal', `Product: ${productName} (ID: ${moveProductModal_currentProductId}) moved to ${newLocation} via modal.`, moveProductModal_currentProductId, productName);

        closeMoveProductModal();

        // Refresh inventory data and UI
        inventory = await inventoryManager.loadInventory();
        displayInventory();
        updateInventoryDashboard();
        // updateToOrderTable(); // Not directly affected by move, but good practice if other stats depend on location
        updateEnhancedDashboard();


    } catch (error) {
        console.error("Error moving product from modal:", error);
        uiEnhancementManager.showToast(`Error moving product: ${error.message}`, 'error');
    }
}
// END: Move Product Modal Functions


// Call initialization on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('[DOMContentLoaded] Starting setup...');
    try {
        // Block 1: Navigation, Core UI, and Firebase Auth Listeners
        try {
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
            } else { console.warn('[DOMContentLoaded] logoutButton not found'); }

            const darkModeToggle = document.getElementById('darkModeToggle');
            if (darkModeToggle) {
                function updateDarkModeButtonText() {
                    const currentTheme = document.documentElement.getAttribute('data-theme');
                    const isDark = currentTheme === DARK_THEME_NAME;
                    darkModeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
                    darkModeToggle.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
                }
                updateDarkModeButtonText(); // Initial text based on initialDarkModeCheck

                darkModeToggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    const currentTheme = document.documentElement.getAttribute('data-theme');
                    if (currentTheme === DARK_THEME_NAME) {
                        removeDarkMode(); // This now applies LIGHT_THEME_NAME
                    } else {
                        applyDarkMode(); // This applies DARK_THEME_NAME
                    }
                    updateDarkModeButtonText(); // Update text after change
                    // The toast notification is handled by the setupEnhancedDarkMode function if it's also called.
                    // To avoid duplicate toasts if both run, we might only call showToast in one place.
                    // For now, let's assume setupEnhancedDarkMode handles its own toast.
                    // UPDATE: Adding toast here as setupEnhancedDarkMode was simplified.
                    if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                        uiEnhancementManager.showToast(currentTheme === DARK_THEME_NAME ? 'Light mode enabled' : 'Dark mode enabled', 'info');
                    }
                });
            } else { console.warn('[DOMContentLoaded] darkModeToggle not found'); }

            const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
            if (sidebarToggleBtn) {
                sidebarToggleBtn.addEventListener('click', toggleSidebar);
            } else { console.warn('[DOMContentLoaded] sidebarToggleBtn not found'); }

            // Navigation Menu Items
            const menuItemsToSetup = [
                'menuDashboard', 'menuInventory', 'menuSuppliers', 'menuOrders',
                'menuReports', 'menuQuickStockUpdate', 'menuUserManagement'
            ];
            const viewMappings = {
                'menuDashboard': 'dashboardViewContainer',
                'menuInventory': 'inventoryViewContainer',
                'menuSuppliers': 'suppliersAndLocationsContainer', // Corrected view ID
                'menuOrders': 'ordersSectionContainer',
                'menuReports': 'reportsSectionContainer',
                'menuQuickStockUpdate': 'quickStockUpdateContainer',
                'menuUserManagement': 'userManagementSectionContainer'
            };

            menuItemsToSetup.forEach(menuId => {
                const menuItemEl = document.getElementById(menuId);
                if (menuItemEl) {
                    menuItemEl.addEventListener('click', (e) => {
                        e.preventDefault();
                        const viewId = viewMappings[menuId];
                        if (viewId) {
                            showView(viewId, menuId);
                        } else {
                            console.warn(`[DOMContentLoaded] No view mapping for menu ID: ${menuId}`);
                        }
                    });
                } else {
                    console.warn(`[DOMContentLoaded] Menu item element not found: ${menuId}`);
                }
            });
            console.log('[DOMContentLoaded] Core UI, Auth, and Navigation listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching core UI/Auth/Nav listeners:', e);
        }

        // Block 2: Product Form & Management Listeners
        try {
            const productSubmitBtn = document.getElementById('productSubmitBtn');
            if (productSubmitBtn) productSubmitBtn.addEventListener('click', submitProduct);
            else console.warn("[DOMContentLoaded] productSubmitBtn not found");

            const cancelEditBtn = document.getElementById('cancelEditBtn');
            if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetProductForm);
            else console.warn("[DOMContentLoaded] cancelEditBtn not found");

            // Photo related buttons
            const capturePhotoBtn = document.getElementById('capturePhotoBtn');
            if (capturePhotoBtn) capturePhotoBtn.addEventListener('click', startPhotoCapture);
            else console.warn("[DOMContentLoaded] capturePhotoBtn not found");

            const takePhotoBtn = document.getElementById('takePhotoBtn');
            if (takePhotoBtn) takePhotoBtn.addEventListener('click', takePhoto);
            else console.warn("[DOMContentLoaded] takePhotoBtn not found");

            const cancelPhotoBtn = document.getElementById('cancelPhotoBtn');
            if (cancelPhotoBtn) cancelPhotoBtn.addEventListener('click', cancelPhoto);
            else console.warn("[DOMContentLoaded] cancelPhotoBtn not found");

            // QR Scan to Edit
            const scanToEditBtn = document.getElementById('scanToEditBtn');
            if (scanToEditBtn) scanToEditBtn.addEventListener('click', startEditScanner);
            else console.warn("[DOMContentLoaded] scanToEditBtn not found");

            const stopEditScannerBtn = document.getElementById('stopEditScannerBtn');
            if (stopEditScannerBtn) stopEditScannerBtn.addEventListener('click', stopEditScanner);
            else console.warn("[DOMContentLoaded] stopEditScannerBtn not found");

            console.log('[DOMContentLoaded] Product form listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching product form listeners:', e);
        }

        // Block 3: Supplier & Location Management
        try {
            const addSupplierBtn = document.getElementById('addSupplierBtn');
            if (addSupplierBtn) addSupplierBtn.addEventListener('click', addSupplier);
            else console.warn("[DOMContentLoaded] addSupplierBtn not found");

            const addLocationBtn = document.getElementById('addLocationBtn');
            if (addLocationBtn) addLocationBtn.addEventListener('click', addLocation);
            else console.warn("[DOMContentLoaded] addLocationBtn not found");
            console.log('[DOMContentLoaded] Supplier/Location listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching supplier/location listeners:', e);
        }

        // Block 4: Inventory Table Filters & Actions
        try {
            const filterSupplier = document.getElementById('filterSupplier');
            if (filterSupplier) filterSupplier.addEventListener('change', () => displayInventory());
            else console.warn("[DOMContentLoaded] filterSupplier dropdown not found");

            const filterLocation = document.getElementById('filterLocation');
            if (filterLocation) filterLocation.addEventListener('change', () => displayInventory());
            else console.warn("[DOMContentLoaded] filterLocation dropdown not found");

            const clearInventoryFiltersBtn = document.getElementById('clearInventoryFiltersBtn');
            if (clearInventoryFiltersBtn) {
                clearInventoryFiltersBtn.addEventListener('click', () => {
                    if(document.getElementById('filterSupplier')) document.getElementById('filterSupplier').value = '';
                    if(document.getElementById('filterLocation')) document.getElementById('filterLocation').value = '';
                    if(document.getElementById('inventorySearchInput')) document.getElementById('inventorySearchInput').value = '';
                    currentPage = 1; // Reset to first page
                    displayInventory();
                });
            } else { console.warn("[DOMContentLoaded] clearInventoryFiltersBtn not found"); }

            // Search input for inventory
            const inventorySearchInput = document.getElementById('inventorySearchInput');
            if (inventorySearchInput) {
                inventorySearchInput.addEventListener('input', debounce(() => {
                    currentPage = 1; // Reset to first page on new search
                    displayInventory(inventorySearchInput.value, document.getElementById('filterSupplier').value, document.getElementById('filterLocation').value);
                }, 300));
            } else { console.warn("[DOMContentLoaded] inventorySearchInput not found"); }

            // Pagination controls
            const prevPageBtn = document.getElementById('prevPageBtn');
            if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; displayInventory(); } });
            else console.warn("[DOMContentLoaded] prevPageBtn not found");

            const nextPageBtn = document.getElementById('nextPageBtn');
            if (nextPageBtn) nextPageBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(totalFilteredItems / ITEMS_PER_PAGE);
                if (currentPage < totalPages) { currentPage++; displayInventory(); }
            });
            else console.warn("[DOMContentLoaded] nextPageBtn not found");

            const refreshInventoryBtn = document.getElementById('refreshInventoryBtn');
            if (refreshInventoryBtn) {
                refreshInventoryBtn.addEventListener('click', handleRefreshInventory);
            } else { console.warn("[DOMContentLoaded] refreshInventoryBtn not found"); }

            console.log('[DOMContentLoaded] Inventory filter/search/pagination listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching inventory filter/search/pagination listeners:', e);
        }

        // Block 5: Batch Actions & Move Product
        try {
            // Batch Updates
            const addBatchEntryBtn = document.getElementById('addBatchEntryBtn');
            if (addBatchEntryBtn) addBatchEntryBtn.addEventListener('click', addBatchEntry);
            else console.warn("[DOMContentLoaded] addBatchEntryBtn not found");

            const startUpdateScannerBtn = document.getElementById('startUpdateScannerBtn');
            if (startUpdateScannerBtn) startUpdateScannerBtn.addEventListener('click', startUpdateScanner);
            else console.warn("[DOMContentLoaded] startUpdateScannerBtn not found");

            const stopUpdateScannerBtn = document.getElementById('stopUpdateScannerBtn');
            if (stopUpdateScannerBtn) stopUpdateScannerBtn.addEventListener('click', stopUpdateScanner);
            else console.warn("[DOMContentLoaded] stopUpdateScannerBtn not found");

            const submitBatchUpdatesBtn = document.getElementById('submitBatchUpdatesBtn');
            if (submitBatchUpdatesBtn) submitBatchUpdatesBtn.addEventListener('click', submitBatchUpdates);
            else console.warn("[DOMContentLoaded] submitBatchUpdatesBtn not found");

            // Move Product
            const toggleMoveProductFormBtn = document.getElementById('toggleMoveProductFormBtn'); // This might be an old ID or part of a different structure
            if (toggleMoveProductFormBtn) { /* attach listener */ }


            const startMoveScannerBtn = document.getElementById('startMoveScannerBtn');
            if (startMoveScannerBtn) startMoveScannerBtn.addEventListener('click', startMoveScanner);
            else console.warn("[DOMContentLoaded] startMoveScannerBtn not found");

            const stopMoveScannerBtn = document.getElementById('stopMoveScannerBtn');
            if (stopMoveScannerBtn) stopMoveScannerBtn.addEventListener('click', stopMoveScanner);
            else console.warn("[DOMContentLoaded] stopMoveScannerBtn not found");

            const moveProductBtn = document.getElementById('moveProductBtn');
            if (moveProductBtn) moveProductBtn.addEventListener('click', moveProduct);
            else console.warn("[DOMContentLoaded] moveProductBtn not found");

            console.log('[DOMContentLoaded] Batch/Move listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching batch/move listeners:', e);
        }

        // Block 6: Reports
        try {
            const generateOrderReportBtn = document.getElementById('generateOrderReportBtn');
            if (generateOrderReportBtn) generateOrderReportBtn.addEventListener('click', () => generateFastOrderReportPDF('jspdf')); // Assuming new combined function
            else console.warn("[DOMContentLoaded] generateOrderReportBtn not found");

            // The HTML has "generateDetailedOrderReportBtn" for the slow QR version
             const generateDetailedOrderReportBtn = document.getElementById('generateDetailedOrderReportBtn');
             if (generateDetailedOrderReportBtn) generateDetailedOrderReportBtn.addEventListener('click', () => generateOrderReportPDFWithQRCodes('jspdf'));
             else console.warn("[DOMContentLoaded] generateDetailedOrderReportBtn (for QR) not found");


            const emailOrderReportBtn = document.getElementById('emailOrderReportBtn');
            if (emailOrderReportBtn) emailOrderReportBtn.addEventListener('click', emailReport);
            else console.warn("[DOMContentLoaded] emailOrderReportBtn not found");

            const generateQRCodePDFBtn = document.getElementById('generateQRCodePDFBtn'); // For all locations
            if (generateQRCodePDFBtn) generateQRCodePDFBtn.addEventListener('click', () => generateAllQRCodesPDF('jspdf'));
            else console.warn("[DOMContentLoaded] generateQRCodePDFBtn not found");

            // Trend chart related (if any buttons)
            const trendProductSelect = document.getElementById('trendProductSelect');
            if(trendProductSelect) trendProductSelect.addEventListener('change', (event) => generateProductUsageChart(event.target.value));
            else console.warn("[DOMContentLoaded] trendProductSelect not found");

            console.log('[DOMContentLoaded] Report listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching report listeners:', e);
        }

        // Block 7: Modals
        try {
            const closeImageModalBtn = document.getElementById('closeImageModalBtn');
            if (closeImageModalBtn) closeImageModalBtn.addEventListener('click', closeImageModal);
            else console.warn("[DOMContentLoaded] closeImageModalBtn not found");

            const imageModalElement = document.getElementById('imageModal');
            if(imageModalElement) imageModalElement.addEventListener('click', (e) => { if (e.target === imageModalElement) closeImageModal(); });
            else console.warn("[DOMContentLoaded] imageModal element not found");

            // Order Details Modal Close Button (Original - DEPRECATED)
            /*
            const closeOrderModalBtn = document.getElementById('closeOrderModalBtn');
            if (closeOrderModalBtn) {
                closeOrderModalBtn.addEventListener('click', closeOrderDetailsModal);
            } else {
                console.warn("[DOMContentLoaded] closeOrderModalBtn not found");
            }
            */

            // Order Details Modal Save Button (Original - DEPRECATED)
            /*
            const saveOrderStatusBtn = document.getElementById('saveOrderStatusBtn');
            if (saveOrderStatusBtn) {
                saveOrderStatusBtn.addEventListener('click', async () => {
                    if (!currentModalOrderId) {
                        console.error("No currentModalOrderId set. Cannot save status.");
                        uiEnhancementManager.showToast("Error: No order selected to update.", "error");
                        return;
                    }

                    const newStatus = document.getElementById('modalOrderStatusSelect').value;
                    if (!newStatus) {
                        uiEnhancementManager.showToast("No status selected.", "warning");
                        return;
                    }

                    const orderRef = db.collection('orders').doc(currentModalOrderId);
                    try {
                        const doc = await orderRef.get();
                        if (doc.exists) {
                            const orderData = doc.data();
                            if (orderData.status !== newStatus) {
                                await orderRef.update({ status: newStatus });
                                uiEnhancementManager.showToast(`Order ${currentModalOrderId} status updated to ${newStatus}.`, "success");
                                console.log(`Order ${currentModalOrderId} status updated to ${newStatus} via modal.`);
                                if (typeof loadAndDisplayOrders === 'function') {
                                    loadAndDisplayOrders();
                                }
                                await logActivity('order_status_changed', `Order ${currentModalOrderId} status changed to ${newStatus} via modal`, currentModalOrderId, orderData.productName);
                            } else {
                                uiEnhancementManager.showToast(`Order status is already ${newStatus}. No change made.`, "info");
                            }
                        } else {
                            uiEnhancementManager.showToast(`Order ${currentModalOrderId} not found in database.`, "error");
                        }
                    } catch (error) {
                        console.error("Error updating order status from modal:", error);
                        uiEnhancementManager.showToast("Error updating status: " + error.message, "error");
                    }
                    closeOrderDetailsModal();
                });
            } else {
                console.warn("[DOMContentLoaded] saveOrderStatusBtn not found");
            }
            */

            // Allow closing order details modal by clicking outside of it (on the overlay) (Original - DEPRECATED)
            /*
            const orderDetailsModalElement = document.getElementById('orderDetailsModal');
            if (orderDetailsModalElement) {
                orderDetailsModalElement.addEventListener('click', (e) => {
                    if (e.target === orderDetailsModalElement) {
                        closeOrderDetailsModal();
                    }
                });
            } else {
                console.warn("[DOMContentLoaded] orderDetailsModal element not found for overlay click listener");
            }
            */

            // Mini Status Update Modal Elements and Event Listeners
            const miniModalCloseBtn = document.getElementById('miniModalCloseBtn');
            const miniStatusUpdateModalElement = document.getElementById('miniStatusUpdateModal');
            const miniModalOrderStatusSelect = document.getElementById('miniModalOrderStatusSelect');
            const miniModalQuantityReceivedGroup = document.getElementById('miniModalQuantityReceivedGroup');
            const miniModalQuantityReceivedInput = document.getElementById('miniModalQuantityReceived');
            const miniModalSaveStatusBtn = document.getElementById('miniModalSaveStatusBtn');

            if (miniModalCloseBtn) {
                miniModalCloseBtn.addEventListener('click', closeMiniStatusModal);
            } else {
                console.warn("[DOMContentLoaded] miniModalCloseBtn not found");
            }

            if (miniStatusUpdateModalElement) {
                miniStatusUpdateModalElement.addEventListener('click', (e) => {
                    if (e.target === miniStatusUpdateModalElement) { // Overlay click
                        closeMiniStatusModal();
                    }
                });
            } else {
                console.warn("[DOMContentLoaded] miniStatusUpdateModalElement not found for overlay click listener");
            }

            if (miniModalOrderStatusSelect && miniModalQuantityReceivedGroup && miniModalQuantityReceivedInput) {
                miniModalOrderStatusSelect.addEventListener('change', function() {
                    if (this.value === 'partially_received') {
                        miniModalQuantityReceivedGroup.classList.remove('hidden');
                        miniModalQuantityReceivedInput.focus();
                    } else {
                        miniModalQuantityReceivedGroup.classList.add('hidden');
                        miniModalQuantityReceivedInput.value = ''; // Clear value when hidden
                    }
                });
            } else {
                console.warn("[DOMContentLoaded] One or more elements for mini modal quantity input logic not found (order status select, qty group, qty input).");
            }

            if (miniModalSaveStatusBtn) {
                miniModalSaveStatusBtn.addEventListener('click', async () => {
                    if (!currentMiniModalOrderId) {
                        console.error("No currentMiniModalOrderId set. Cannot save status.");
                        uiEnhancementManager.showToast("Error: No order selected to update.", "error");
                        return;
                    }

                    const newStatus = document.getElementById('miniModalOrderStatusSelect').value;
                    const quantityReceivedInput = document.getElementById('miniModalQuantityReceived');
                    const quantityReceived = quantityReceivedInput ? parseInt(quantityReceivedInput.value) : 0;

                    if (!newStatus) {
                        uiEnhancementManager.showToast("No status selected.", "warning");
                        return;
                    }

                    const orderRef = db.collection('orders').doc(currentMiniModalOrderId);
                    try {
                        const orderDoc = await orderRef.get();
                        if (!orderDoc.exists) {
                            uiEnhancementManager.showToast(`Order ${currentMiniModalOrderId} not found.`, "error");
                            closeMiniStatusModal();
                            return;
                        }
                        const orderData = orderDoc.data();

                        // Fetch product data for inventory updates
                        let productData = null;
                        let productRef = null;
                        if (orderData.productId) {
                            productRef = db.collection('inventory').doc(orderData.productId);
                            const productDoc = await productRef.get();
                            if (productDoc.exists) {
                                productData = productDoc.data();
                            } else {
                                console.warn(`Product ${orderData.productId} for order ${currentMiniModalOrderId} not found in inventory.`);
                                // Proceed with status change but inventory updates might fail or be skipped
                            }
                        } else {
                            console.warn(`Order ${currentMiniModalOrderId} does not have a productId.`);
                             // Proceed with status change but inventory updates will be skipped
                        }


                        if (newStatus === 'received') {
                            console.log(`Calling processFullReceipt for order ${currentMiniModalOrderId}`);
                            await processFullReceipt(currentMiniModalOrderId, orderData, productData, productRef);
                        } else if (newStatus === 'fulfilled') {
                            // When order is fulfilled, it means the items were received - same as 'received' status
                            console.log(`Calling processFullReceipt for order ${currentMiniModalOrderId} (fulfilled status)`);
                            await processFullReceipt(currentMiniModalOrderId, orderData, productData, productRef, 'fulfilled');
                        } else if (newStatus === 'partially_received') {
                            if (isNaN(quantityReceived) || quantityReceived <= 0) {
                                uiEnhancementManager.showToast("Please enter a valid quantity received for partial receipt.", "warning");
                                return; // Don't close modal, let user correct
                            }
                            if (quantityReceived >= orderData.quantity) {
                                uiEnhancementManager.showToast("Quantity received is equal to or more than ordered. Use 'Received' status for full receipt.", "warning");
                                return; // Don't close modal
                            }
                            console.log(`Calling processPartialReceipt for order ${currentMiniModalOrderId} with quantity ${quantityReceived}`);
                            await processPartialReceipt(currentMiniModalOrderId, orderData, productData, productRef, quantityReceived);
                        } else { // Handle other simple status changes (Pending, Cancelled, Backordered)
                            if (orderData.status !== newStatus) {
                                await orderRef.update({ status: newStatus });
                                uiEnhancementManager.showToast(`Order ${currentMiniModalOrderId} status updated to ${newStatus}.`, "success");
                                console.log(`Order ${currentMiniModalOrderId} status updated to ${newStatus} via mini-modal.`);
                                await logActivity('order_status_changed', `Order ${currentMiniModalOrderId} status changed to ${newStatus} via mini-modal`, currentMiniModalOrderId, orderData.productName);
                            } else {
                                uiEnhancementManager.showToast(`Order status is already ${newStatus}. No change made.`, "info");
                            }
                        }

                        if (typeof loadAndDisplayOrders === 'function') {
                            loadAndDisplayOrders();
                        }
                        if (productData && (newStatus === 'received' || newStatus === 'partially_received')) { // Refresh inventory display if stock levels changed
                            if (typeof displayInventory === 'function') displayInventory();
                            if (typeof updateInventoryDashboard === 'function') updateInventoryDashboard();
                            if (typeof updateToOrderTable === 'function') updateToOrderTable();
                        }

                    } catch (error) {
                        console.error("Error processing order status update from mini-modal:", error);
                        uiEnhancementManager.showToast("Error updating status: " + error.message, "error");
                    }
                    closeMiniStatusModal();
                });
            } else {
                console.warn("[DOMContentLoaded] miniModalSaveStatusBtn not found");
            }

            console.log('[DOMContentLoaded] Modal listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching modal listeners:', e);
        }

        // Block 8: Quick Stock Update (QSU) View
        try {
            const qsuTabs = ['manualBatchModeTab', 'barcodeScannerModeTab', 'fileUploadModeTab'];
            qsuTabs.forEach(tabId => {
                const tabEl = document.getElementById(tabId);
                if (tabEl) tabEl.addEventListener('click', () => switchQuickUpdateTab(tabId));
                else console.warn(`[DOMContentLoaded] QSU Tab not found: ${tabId}`);
            });

            // Commented out camera scanner buttons
            // const qsuScanProductBtn = document.getElementById('qsuScanProductBtn');
            // if (qsuScanProductBtn) qsuScanProductBtn.addEventListener('click', startQuickStockBarcodeScanner);
            // else console.warn("[DOMContentLoaded] qsuScanProductBtn not found");

            // const qsuStopScanBtn = document.getElementById('qsuStopScanBtn');
            // if (qsuStopScanBtn) qsuStopScanBtn.addEventListener('click', stopQuickStockBarcodeScanner);
            // else console.warn("[DOMContentLoaded] qsuStopScanBtn not found");

            // Event listener for the new barcode input field
            const qsuBarcodeIdInput = document.getElementById('qsuBarcodeIdInput');
            if (qsuBarcodeIdInput) {
                qsuBarcodeIdInput.addEventListener('keypress', async (event) => {
                    if (event.key === 'Enter' || event.keyCode === 13) {
                        event.preventDefault();
                        const scannedValue = qsuBarcodeIdInput.value.trim();
                        qsuBarcodeIdInput.value = ''; // Clear input immediately

                        if (scannedValue) {
                            if (scannedValue.startsWith('ACTION_')) {
                                // Handle Action QR Code
                                if (!currentBarcodeModeProductId) {
                                    const msg = 'Please scan a product before scanning an action QR code.';
                                    setBarcodeStatus(msg, true);
                                    if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                                        uiEnhancementManager.showToast(msg, 'error');
                                    }
                                    return;
                                }
                                const parts = scannedValue.split('_'); // e.g., ACTION_ADD_10
                                if (parts.length === 3) {
                                    const action = parts[1].toLowerCase(); // 'add' or 'sub'
                                    const quantityStr = parts[2];

                                    let actionType;
                                    if (action === 'add') {
                                        actionType = 'increment';
                                    } else if (action === 'sub' || action === 'subtract') { // Allow "sub" or "subtract"
                                        actionType = 'decrement';
                                    } else {
                                        const errMsg = `Invalid action: ${action}`;
                                        setBarcodeStatus(errMsg, true);
                                        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                                            uiEnhancementManager.showToast(errMsg, 'error');
                                        }
                                        return;
                                    }
                                    await adjustScannedProductQuantity(actionType, quantityStr);
                                } else {
                                    const errMsg = `Malformed action QR code: ${scannedValue}`;
                                    setBarcodeStatus(errMsg, true);
                                    if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                                        uiEnhancementManager.showToast(errMsg, 'error');
                                    }
                                }
                            } else {
                                // Handle as Product ID
                                await handleQuickStockScan(scannedValue);
                            }
                        } else {
                            setBarcodeStatus('Please enter or scan a Product ID or Action Code.', true);
                             if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                                uiEnhancementManager.showToast('Input field was empty.', 'warning');
                            }
                        }
                        // Ensure focus remains or returns to the input field for chained scanning
                        qsuBarcodeIdInput.focus();
                    }
                });
            } else {
                console.warn("[DOMContentLoaded] qsuBarcodeIdInput not found");
            }

            const qsuAddManualEntryBtn = document.getElementById('qsuAddManualEntryBtn');
            if (qsuAddManualEntryBtn) qsuAddManualEntryBtn.addEventListener('click', addQuickStockManualEntry);
            else console.warn("[DOMContentLoaded] qsuAddManualEntryBtn not found");

            const qsuSubmitBatchBtn = document.getElementById('qsuSubmitBatchBtn');
            if (qsuSubmitBatchBtn) qsuSubmitBatchBtn.addEventListener('click', submitQuickStockBatch);
            else console.warn("[DOMContentLoaded] qsuSubmitBatchBtn not found");

            const qsuProductSearch = document.getElementById('qsuProductSearch');
            if (qsuProductSearch) qsuProductSearch.addEventListener('input', debounce(handleQuickStockProductSearch, 300));
            else console.warn("[DOMContentLoaded] qsuProductSearch not found");

            const qsuFileUpload = document.getElementById('qsuFileUpload');
            if (qsuFileUpload) qsuFileUpload.addEventListener('change', handleQuickStockFileUpload);
            else console.warn("[DOMContentLoaded] qsuFileUpload not found");

            const qsuProcessFileBtn = document.getElementById('qsuProcessFileBtn');
            if (qsuProcessFileBtn) qsuProcessFileBtn.addEventListener('click', processQuickStockUploadedFile);
            else console.warn("[DOMContentLoaded] qsuProcessFileBtn not found");

            // Listeners for QSU quantity adjustment buttons
            const qsuAdjustIncrementBtn = document.getElementById('qsuAdjustIncrementBtn');
            if (qsuAdjustIncrementBtn) {
                qsuAdjustIncrementBtn.addEventListener('click', () => {
                    const quantityToAdjust = document.getElementById('qsuAdjustQuantity').value;
                    adjustScannedProductQuantity('increment', quantityToAdjust);
                });
            } else { console.warn("[DOMContentLoaded] qsuAdjustIncrementBtn not found"); }

            const qsuAdjustDecrementBtn = document.getElementById('qsuAdjustDecrementBtn');
            if (qsuAdjustDecrementBtn) {
                qsuAdjustDecrementBtn.addEventListener('click', () => {
                    const quantityToAdjust = document.getElementById('qsuAdjustQuantity').value;
                    adjustScannedProductQuantity('decrement', quantityToAdjust);
                });
            } else { console.warn("[DOMContentLoaded] qsuAdjustDecrementBtn not found"); }

            console.log('[DOMContentLoaded] Quick Stock Update listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching Quick Stock Update listeners:', e);
        }

        // Block 9: Dashboard View specific buttons
        try {
            const refreshDashboardBtn = document.getElementById('refreshDashboardBtn');
                if(refreshDashboardBtn) {
                    refreshDashboardBtn.addEventListener('click', () => {
                        if (typeof updateEnhancedDashboard === 'function') updateEnhancedDashboard();
                        if (typeof displayPendingOrdersOnDashboard === 'function') displayPendingOrdersOnDashboard();
                    });
                } else console.warn("[DOMContentLoaded] refreshDashboardBtn not found");

                const viewAllOrdersBtn = document.getElementById('viewAllOrdersBtn');
                if(viewAllOrdersBtn) {
                    viewAllOrdersBtn.addEventListener('click', () => {
                        showView('ordersSectionContainer', 'menuOrders');
                    });
                } else console.warn("[DOMContentLoaded] viewAllOrdersBtn on dashboard not found");

            // Ensure the old quickAddProductBtn listener (if any was for view switching) is not active.
            // The new dashboardAddProductBtn handles opening the modal.
            // The console warning "quickAddProductBtn (view switcher) not found" is now expected and fine.

            const dashboardAddProductBtn = document.getElementById('dashboardAddProductBtn');
            if (dashboardAddProductBtn) {
                dashboardAddProductBtn.addEventListener('click', () => {
                    openAddProductModal();
                });
            } else console.warn("[DOMContentLoaded] dashboardAddProductBtn (modal opener) not found");

            const dashboardCreateOrderBtn = document.getElementById('dashboardCreateOrderBtn');
            if (dashboardCreateOrderBtn) dashboardCreateOrderBtn.addEventListener('click', openCreateOrderModal);
            else console.warn("[DOMContentLoaded] dashboardCreateOrderBtn not found");

            const dashboardScanToEditBtn = document.getElementById('dashboardScanToEditBtn');
            if(dashboardScanToEditBtn) dashboardScanToEditBtn.addEventListener('click', openScanToEditModal);
            else console.warn("[DOMContentLoaded] dashboardScanToEditBtn for modal not found");

            const dashboardMoveProductBtn = document.getElementById('dashboardMoveProductBtn');
            if(dashboardMoveProductBtn) dashboardMoveProductBtn.addEventListener('click', openMoveProductModal);
            else console.warn("[DOMContentLoaded] dashboardMoveProductBtn for modal not found");

            // Event listeners for the new Add Product Modal
            const closeAddProductModalBtnListener = document.getElementById('closeAddProductModalBtn');
            if (closeAddProductModalBtnListener) closeAddProductModalBtnListener.addEventListener('click', closeAddProductModal);
            else console.warn("[DOMContentLoaded] closeAddProductModalBtn for Add Product Modal not found");

            const modalProductSubmitBtn = document.getElementById('modalProductSubmitBtn');
            if (modalProductSubmitBtn) modalProductSubmitBtn.addEventListener('click', submitModalProduct);
            else console.warn("[DOMContentLoaded] modalProductSubmitBtn for Add Product Modal not found");

            const modalCancelProductBtn = document.getElementById('modalCancelProductBtn'); // Specific to Add Product Modal
            if (modalCancelProductBtn) modalCancelProductBtn.addEventListener('click', closeAddProductModal);
            else console.warn("[DOMContentLoaded] modalCancelProductBtn for Add Product Modal not found");

            // Event listeners for the new Create Order Modal
            const closeCreateOrderModalBtnListener = document.getElementById('closeCreateOrderModalBtn');
            if (closeCreateOrderModalBtnListener) closeCreateOrderModalBtnListener.addEventListener('click', closeCreateOrderModal);
            else console.warn("[DOMContentLoaded] closeCreateOrderModalBtn for Create Order Modal not found");

            const modalSubmitOrderBtn = document.getElementById('modalSubmitOrderBtn');
            if (modalSubmitOrderBtn) modalSubmitOrderBtn.addEventListener('click', submitModalOrder);
            else console.warn("[DOMContentLoaded] modalSubmitOrderBtn for Create Order Modal not found");

            const modalCancelOrderBtn = document.getElementById('modalCancelOrderBtn'); // Specific to Create Order Modal
            if (modalCancelOrderBtn) modalCancelOrderBtn.addEventListener('click', closeCreateOrderModal);
            else console.warn("[DOMContentLoaded] modalCancelOrderBtn for Create Order Modal not found");

            // Photo capture buttons for the Add Product modal
            const modalCapturePhotoBtn = document.getElementById('modalCapturePhotoBtn');
            if (modalCapturePhotoBtn) modalCapturePhotoBtn.addEventListener('click', startModalPhotoCapture);
            else console.warn("[DOMContentLoaded] modalCapturePhotoBtn not found");

            const modalTakePhotoBtn = document.getElementById('modalTakePhotoBtn');
            if (modalTakePhotoBtn) modalTakePhotoBtn.addEventListener('click', takeModalPhoto);
            else console.warn("[DOMContentLoaded] modalTakePhotoBtn not found");

            const modalCancelPhotoBtn = document.getElementById('modalCancelPhotoBtn');
            if (modalCancelPhotoBtn) modalCancelPhotoBtn.addEventListener('click', cancelModalPhoto);
            else console.warn("[DOMContentLoaded] modalCancelPhotoBtn for Add Product modal not found");

            // Event listeners for Scan to Edit Product Modal
            const closeScanToEditModalBtnListener = document.getElementById('closeScanToEditModalBtn');
            if(closeScanToEditModalBtnListener) closeScanToEditModalBtnListener.addEventListener('click', closeScanToEditModal);
            else console.warn("[DOMContentLoaded] closeScanToEditModalBtn not found");

            const scanToEditProductIdInput = document.getElementById('scanToEditProductIdInput');
            if(scanToEditProductIdInput) {
                scanToEditProductIdInput.addEventListener('keypress', (event) => {
                    if (event.key === 'Enter' || event.keyCode === 13) {
                        event.preventDefault();
                        handleScanToEditProductIdSubmit();
                    }
                });
            } else console.warn("[DOMContentLoaded] scanToEditProductIdInput not found");

            const scanToEditSubmitIdBtn = document.getElementById('scanToEditSubmitIdBtn');
            if(scanToEditSubmitIdBtn) scanToEditSubmitIdBtn.addEventListener('click', handleScanToEditProductIdSubmit);
            else console.warn("[DOMContentLoaded] scanToEditSubmitIdBtn not found");

            const scanToEdit_submitProductBtn = document.getElementById('scanToEdit_submitProductBtn');
            if(scanToEdit_submitProductBtn) scanToEdit_submitProductBtn.addEventListener('click', submitEditProductFromModal);
            else console.warn("[DOMContentLoaded] scanToEdit_submitProductBtn not found");

            const scanToEdit_cancelChangesBtn = document.getElementById('scanToEdit_cancelChangesBtn');
            if(scanToEdit_cancelChangesBtn) scanToEdit_cancelChangesBtn.addEventListener('click', closeScanToEditModal);
            else console.warn("[DOMContentLoaded] scanToEdit_cancelChangesBtn not found");

            // Photo capture buttons for Scan to Edit modal
            const scanToEdit_capturePhotoBtn = document.getElementById('scanToEdit_capturePhotoBtn');
            if(scanToEdit_capturePhotoBtn) scanToEdit_capturePhotoBtn.addEventListener('click', startScanToEditModalPhotoCapture);
            else console.warn("[DOMContentLoaded] scanToEdit_capturePhotoBtn not found");

            const scanToEdit_takePhotoBtn = document.getElementById('scanToEdit_takePhotoBtn');
            if(scanToEdit_takePhotoBtn) scanToEdit_takePhotoBtn.addEventListener('click', takeScanToEditModalPhoto);
            else console.warn("[DOMContentLoaded] scanToEdit_takePhotoBtn not found");

            const scanToEdit_cancelPhotoBtn = document.getElementById('scanToEdit_cancelPhotoBtn');
            if(scanToEdit_cancelPhotoBtn) scanToEdit_cancelPhotoBtn.addEventListener('click', cancelScanToEditModalPhoto);
            else console.warn("[DOMContentLoaded] scanToEdit_cancelPhotoBtn not found");

            // Event listeners for Move Product Modal
            const closeMoveProductModalBtnListener = document.getElementById('closeMoveProductModalBtn');
            if(closeMoveProductModalBtnListener) closeMoveProductModalBtnListener.addEventListener('click', closeMoveProductModal);
            else console.warn("[DOMContentLoaded] closeMoveProductModalBtn for Move Product Modal not found");

            const moveProductModal_productIdInput = document.getElementById('moveProductModal_productIdInput');
            if(moveProductModal_productIdInput) {
                moveProductModal_productIdInput.addEventListener('keypress', (event) => {
                    if (event.key === 'Enter' || event.keyCode === 13) {
                        event.preventDefault();
                        handleMoveProductModalIdSubmit();
                    }
                });
            } else console.warn("[DOMContentLoaded] moveProductModal_productIdInput not found");

            const moveProductModal_findBtn = document.getElementById('moveProductModal_findBtn');
            if(moveProductModal_findBtn) moveProductModal_findBtn.addEventListener('click', handleMoveProductModalIdSubmit);
            else console.warn("[DOMContentLoaded] moveProductModal_findBtn not found");

            const moveProductModal_submitBtn = document.getElementById('moveProductModal_submitBtn');
            if(moveProductModal_submitBtn) moveProductModal_submitBtn.addEventListener('click', submitMoveProductFromModal);
            else console.warn("[DOMContentLoaded] moveProductModal_submitBtn not found");

            const moveProductModal_cancelBtn = document.getElementById('moveProductModal_cancelBtn');
            if(moveProductModal_cancelBtn) moveProductModal_cancelBtn.addEventListener('click', closeMoveProductModal);
            else console.warn("[DOMContentLoaded] moveProductModal_cancelBtn not found");


            const quickStockUpdateBtn = document.getElementById('quickStockUpdateBtn'); // Button on dashboard
            if (quickStockUpdateBtn) {
                quickStockUpdateBtn.addEventListener('click', () => {
                    openUpdateStockModal();
                });
            } else console.warn("[DOMContentLoaded] quickStockUpdateBtn (dashboard modal opener) not found");

            // Event listeners for the new Update Stock Modal
            const closeUpdateStockModalBtn = document.getElementById('closeUpdateStockModalBtn');
            if (closeUpdateStockModalBtn) closeUpdateStockModalBtn.addEventListener('click', closeUpdateStockModal);
            else console.warn("[DOMContentLoaded] closeUpdateStockModalBtn not found");

            const updateStockDoneBtn = document.getElementById('updateStockDoneBtn');
            if (updateStockDoneBtn) updateStockDoneBtn.addEventListener('click', closeUpdateStockModal);
            else console.warn("[DOMContentLoaded] updateStockDoneBtn not found");

            const updateStockProductIdInput = document.getElementById('updateStockProductIdInput');
            if (updateStockProductIdInput) {
                updateStockProductIdInput.addEventListener('keypress', async (event) => {
                    if (event.key === 'Enter' || event.keyCode === 13) {
                        event.preventDefault();
                        const scannedValue = updateStockProductIdInput.value.trim();
                        updateStockProductIdInput.value = ''; // Clear input
                        if (scannedValue) {
                            if (scannedValue.startsWith('ACTION_')) {
                                await processUpdateStockModalAction(scannedValue);
                            } else {
                                await handleUpdateStockModalScan(scannedValue);
                            }
                        } else {
                            setUpdateStockModalStatus('Please enter or scan a Product ID or Action Code.', true);
                        }
                        updateStockProductIdInput.focus(); // Keep focus for next scan
                    }
                });
            } else console.warn("[DOMContentLoaded] updateStockProductIdInput not found");

            const updateStockAdjustIncrementBtn = document.getElementById('updateStockAdjustIncrementBtn');
            if (updateStockAdjustIncrementBtn) updateStockAdjustIncrementBtn.addEventListener('click', () => adjustUpdateStockModalQuantity('increment'));
            else console.warn("[DOMContentLoaded] updateStockAdjustIncrementBtn not found");

            const updateStockAdjustDecrementBtn = document.getElementById('updateStockAdjustDecrementBtn');
            if (updateStockAdjustDecrementBtn) updateStockAdjustDecrementBtn.addEventListener('click', () => adjustUpdateStockModalQuantity('decrement'));
            else console.warn("[DOMContentLoaded] updateStockAdjustDecrementBtn not found");


            const quickViewReportsBtn = document.getElementById('quickViewReportsBtn');
            if(quickViewReportsBtn) quickViewReportsBtn.addEventListener('click', () => showView('reportsSectionContainer', 'menuReports'));
            else console.warn("[DOMContentLoaded] quickViewReportsBtn not found");

            console.log('[DOMContentLoaded] Dashboard view listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching Dashboard view listeners:', e);
        }

        // Block 10: Orders View specific buttons
        try {
            const addOrderBtn = document.getElementById('addOrderBtn');
            if (addOrderBtn) addOrderBtn.addEventListener('click', handleAddOrder);
            else console.warn("[DOMContentLoaded] addOrderBtn not found");

            const filterOrderStatus = document.getElementById('filterOrderStatus');
            if (filterOrderStatus) filterOrderStatus.addEventListener('change', loadAndDisplayOrders);
            else console.warn("[DOMContentLoaded] filterOrderStatus dropdown not found");

            const filterOrderSupplierDropdown = document.getElementById('filterOrderSupplierDropdown');
            if (filterOrderSupplierDropdown) filterOrderSupplierDropdown.addEventListener('change', loadAndDisplayOrders);
            else console.warn("[DOMContentLoaded] filterOrderSupplierDropdown for orders not found");

            console.log('[DOMContentLoaded] Orders view listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching Orders view listeners:', e);
        }

        // Block 11: User Management specific buttons
        try {
            const selectAllUsersCheckbox = document.getElementById('selectAllUsersCheckbox');
            if (selectAllUsersCheckbox) selectAllUsersCheckbox.addEventListener('change', handleSelectAllUsers);
            else console.warn("[DOMContentLoaded] selectAllUsersCheckbox not found");

            const deleteSelectedUsersBtn = document.getElementById('deleteSelectedUsersBtn');
            if (deleteSelectedUsersBtn) {
                deleteSelectedUsersBtn.addEventListener('click', handleDeleteSelectedUsers);
                deleteSelectedUsersBtn.disabled = true; // Initially disable
            } else console.warn("[DOMContentLoaded] deleteSelectedUsersBtn not found");

            const updateRoleForSelectedUsersBtn = document.getElementById('updateRoleForSelectedUsersBtn');
            if (updateRoleForSelectedUsersBtn) {
                updateRoleForSelectedUsersBtn.addEventListener('click', handleUpdateRoleForSelectedUsers);
                updateRoleForSelectedUsersBtn.disabled = true; // Initially disable
            } else console.warn("[DOMContentLoaded] updateRoleForSelectedUsersBtn not found");

            console.log('[DOMContentLoaded] User Management bulk action listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching User Management bulk action listeners:', e);
        }

        // Initialize other things that don't involve listeners but need DOM ready
        try {
            loadSuppliers().then(loadLocations); // Load initial supplier/location data for dropdowns
            initiateImageModalVars(); // Initialize modal vars
            // Initial UI setup based on sidebar state preference
            const sidebarMinimized = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
            if (sidebarMinimized) {
                minimizeSidebar();
            } else {
                maximizeSidebar();
            }
        } catch(e) {
            console.error('[DOMContentLoaded] Error during miscellaneous initializations:', e);
        }

        // Block: Debug Orders Button
        try {
            const debugOrdersBtn = document.getElementById('debugOrdersBtn');
            if (debugOrdersBtn) {
                debugOrdersBtn.addEventListener('click', async () => {
                    console.log('=== ORDERS DEBUG START ===');
                    
                    try {
                        // Check authentication
                        const user = firebase.auth().currentUser;
                        console.log('Current user:', user ? { uid: user.uid, email: user.email } : 'No user logged in');
                        
                        if (!user) {
                            alert('Not authenticated. Please log in first.');
                            return;
                        }
                        
                        // Test direct database query
                        console.log('Testing direct Firestore query...');
                        const allOrdersSnapshot = await db.collection('orders').get();
                        console.log(`Total orders in database: ${allOrdersSnapshot.size}`);
                        
                        if (allOrdersSnapshot.size > 0) {
                            console.log('Sample orders from database:');
                            allOrdersSnapshot.docs.slice(0, 5).forEach(doc => {
                                const data = doc.data();
                                console.log(`- Order ${doc.id}: status="${data.status}", supplier="${data.supplier}"`);
                            });
                        }
                        
                        // Test orders manager
                        if (window.ordersManager) {
                            console.log('Testing orders manager...');
                            await window.ordersManager.loadOrders();
                            console.log(`Orders manager loaded ${window.ordersManager.orders.length} orders`);
                            
                            // Test filtering
                            const statusFilter = document.getElementById('filterOrderStatus').value;
                            console.log(`Current status filter: "${statusFilter}"`);
                            const filtered = window.ordersManager.applyOrderFilters(statusFilter, '');
                            console.log(`Filtered result: ${filtered.length} orders`);
                        } else {
                            console.log('Orders manager not available');
                        }
                        
                        // Test compatibility function
                        console.log('Testing loadAndDisplayOrders function...');
                        await loadAndDisplayOrders();
                        
                        alert('Debug complete! Check the console for detailed output.');
                        
                    } catch (error) {
                        console.error('Debug error:', error);
                        alert(`Debug error: ${error.message}`);
                    }
                    
                    console.log('=== ORDERS DEBUG END ===');
                });
            } else {
                console.warn('[DOMContentLoaded] debugOrdersBtn not found');
            }
        } catch(e) {
            console.error('[DOMContentLoaded] Error setting up debug orders button:', e);
        }


        // Delayed initialization of "enhancements" - this might be redundant if specific setups are done above
        setTimeout(() => {
            console.log('[DOMContentLoaded] Initializing enhancements (after 500ms delay)...');
            if (typeof initializeAllEnhancements === 'function') { // This function calls updateInventoryWithAlerts etc.
                initializeAllEnhancements();
            } else {
                console.error('[DOMContentLoaded] initializeAllEnhancements function not found for delayed init.');
            }
        }, 500); // This delay might still cause issues if inventory isn't loaded for initializeAllEnhancements

    } catch (error) {
        console.error('[DOMContentLoaded] A major error occurred during initial setup:', error);
    }
    console.log('[DOMContentLoaded] Setup finished.'); // Final confirmation
});