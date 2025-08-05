/**
 * Barcode Scanner Module
 * Handles camera-based barcode scanning and QR code generation for inventory management
 */
class BarcodeScannerModule {
    constructor() {
        this.isActive = false;
        this.currentVideoStream = null;
        this.currentProductId = null;
        this.scannerType = null; // 'quickstock' or 'updatestock'
        
        // Action configurations for QR codes
        this.actionConfigs = [
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
        
        this.init();
    }

    init() {
        this.setupGlobalFunctions();
        this.loadJsQRLibrary();
    }

    setupGlobalFunctions() {
        // Setup global barcode scanner functions for backward compatibility
        window.loadQuaggaScript = this.loadQuaggaScript.bind(this);
        window.initBarcodeScanner = this.initBarcodeScanner.bind(this);
        window.stopBarcodeScanner = this.stopBarcodeScanner.bind(this);
        
        // Quick stock scanner functions
        window.handleQuickStockScan = this.handleQuickStockScan.bind(this);
        window.adjustScannedProductQuantity = this.adjustScannedProductQuantity.bind(this);
        window.displayBarcodeModeActionQRCodes = this.displayBarcodeModeActionQRCodes.bind(this);
        window.setBarcodeStatus = this.setBarcodeStatus.bind(this);
        window.setLastActionFeedback = this.setLastActionFeedback.bind(this);
        
        // Camera-based scanning functions
        window.startQuickStockBarcodeScanner = this.startCameraScanner.bind(this);
        window.stopQuickStockBarcodeScanner = this.stopCameraScanner.bind(this);
    }

    /**
     * Load jsQR library for camera-based scanning
     */
    async loadJsQRLibrary() {
        if (typeof jsQR !== 'undefined') {
            console.log('[BarcodeScannerModule] jsQR already loaded');
            return;
        }

        try {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
            script.onload = () => {
                console.log('[BarcodeScannerModule] jsQR library loaded successfully');
            };
            script.onerror = () => {
                console.error('[BarcodeScannerModule] Failed to load jsQR library');
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('[BarcodeScannerModule] Error loading jsQR:', error);
        }
    }

    /**
     * Load QuaggaJS library for enhanced barcode scanning
     */
    async loadQuaggaScript() {
        if (typeof Quagga !== 'undefined') {
            console.log('[BarcodeScannerModule] QuaggaJS already loaded');
            return;
        }

        try {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/quagga@0.12.1/dist/quagga.min.js';
            script.onload = () => {
                console.log('[BarcodeScannerModule] QuaggaJS loaded successfully');
            };
            script.onerror = () => {
                console.error('[BarcodeScannerModule] Failed to load QuaggaJS');
                window.app && window.app.showError('Failed to load barcode scanner library (QuaggaJS)');
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('[BarcodeScannerModule] Error loading QuaggaJS:', error);
        }
    }

    /**
     * Initialize QuaggaJS barcode scanner
     */
    initBarcodeScanner({ inputId, onScan, videoId = 'barcodeScannerVideo' }) {
        if (this.isActive) {
            this.stopBarcodeScanner();
        }

        const input = document.getElementById(inputId);
        const video = document.getElementById(videoId);
        
        if (!input || !video) {
            console.error('[BarcodeScannerModule] Required elements not found:', { inputId, videoId });
            return;
        }

        if (typeof Quagga === 'undefined') {
            console.error('[BarcodeScannerModule] QuaggaJS not loaded');
            return;
        }

        try {
            video.style.display = 'block';
            video.innerHTML = '<span style="color:#fff;position:absolute;top:8px;left:8px;font-size:14px;">Barcode Scanner</span>';

            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: video,
                    constraints: {
                        width: 480,
                        height: 320,
                        facingMode: "environment"
                    }
                },
                decoder: {
                    readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader"]
                }
            }, (err) => {
                if (err) {
                    console.error('[BarcodeScannerModule] Quagga init error:', err);
                    window.app && window.app.showError('Barcode scanner error: ' + err.message);
                    return;
                }
                
                this.isActive = true;
                Quagga.start();
                
                Quagga.onDetected((result) => {
                    const code = result.codeResult.code;
                    if (code && onScan) {
                        onScan(code);
                        input.value = code;
                        this.stopBarcodeScanner();
                    }
                });
            });
        } catch (error) {
            console.error('[BarcodeScannerModule] Error initializing scanner:', error);
        }
    }

    /**
     * Stop QuaggaJS barcode scanner
     */
    stopBarcodeScanner() {
        if (typeof Quagga !== 'undefined' && this.isActive) {
            Quagga.stop();
            this.isActive = false;
        }
        
        const video = document.getElementById('barcodeScannerVideo');
        if (video) {
            video.style.display = 'none';
            video.innerHTML = '';
        }
    }

    /**
     * Start camera-based barcode scanner using jsQR
     */
    async startCameraScanner() {
        console.log('[BarcodeScannerModule] Starting camera-based barcode scanner');
        
        if (this.currentVideoStream) {
            this.stopCameraScanner();
        }

        // Check if camera is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('[BarcodeScannerModule] Camera not supported in this browser');
            this.updateStatus('error', 'Camera not supported in this browser');
            return;
        }

        try {
            // Try back camera first, with fallbacks
            try {
                this.currentVideoStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } 
                });
            } catch (backCameraError) {
                console.warn('Back camera not available, trying front camera:', backCameraError);
                try {
                    this.currentVideoStream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: 'user' } 
                    });
                } catch (frontCameraError) {
                    console.warn('Front camera not available, trying any camera:', frontCameraError);
                    this.currentVideoStream = await navigator.mediaDevices.getUserMedia({ 
                        video: true 
                    });
                }
            }
            
            const video = document.createElement('video');
            video.style.width = '100%';
            video.style.height = 'auto';
            video.setAttribute('playsinline', true);
            video.srcObject = this.currentVideoStream;
            video.play();

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            const scanFrame = () => {
                if (!this.currentVideoStream) return;

                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.height = video.videoHeight;
                    canvas.width = video.videoWidth;
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    
                    if (typeof jsQR !== 'undefined') {
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "dontInvert",
                        });

                        if (code) {
                            console.log('[BarcodeScannerModule] QR Code detected:', code.data);
                            this.handleQuickStockScan(code.data);
                            this.stopCameraScanner();
                            return;
                        }
                    }
                }
                
                requestAnimationFrame(scanFrame);
            };

            // Add video to UI container
            const scannerContainer = document.getElementById('qrScannerContainer');
            if (scannerContainer) {
                scannerContainer.innerHTML = '';
                scannerContainer.appendChild(video);
                scanFrame();
            }

            this.setBarcodeStatus('Camera scanner active. Point camera at QR code or barcode.', false);
            
        } catch (error) {
            console.error('[BarcodeScannerModule] Camera access error:', error);
            this.setBarcodeStatus('Camera access denied or not available.', true);
        }
    }

    /**
     * Stop camera-based scanner
     */
    stopCameraScanner() {
        console.log('[BarcodeScannerModule] Stopping camera-based barcode scanner');
        
        if (this.currentVideoStream) {
            this.currentVideoStream.getTracks().forEach(track => track.stop());
            this.currentVideoStream = null;
        }

        const scannerContainer = document.getElementById('qrScannerContainer');
        if (scannerContainer) {
            scannerContainer.innerHTML = '';
        }

        this.setBarcodeStatus('Camera scanner stopped.', false);
    }

    /**
     * Handle product ID scan for quick stock updates
     */
    async handleQuickStockScan(productId) {
        console.log("[BarcodeScannerModule] handleQuickStockScan called with Product ID:", productId);
        this.setBarcodeStatus(`Processing ID: ${productId}...`, false);

        this.currentProductId = productId;

        // Get product from inventory
        const product = window.inventory ? window.inventory.find(p => p.id === productId) : null;

        const productNameEl = document.getElementById('qsuProductName');
        const currentStockEl = document.getElementById('qsuCurrentStock');
        const scannedProductInfoEl = document.getElementById('qsuScannedProductInfo');
        const productSpecificQREl = document.getElementById('barcodeProductSpecificQR');
        const productSpecificImageEl = document.getElementById('barcodeProductSpecificImage');

        if (!productNameEl || !currentStockEl || !scannedProductInfoEl || !productSpecificQREl || !productSpecificImageEl) {
            console.error("[BarcodeScannerModule] One or more UI elements for displaying product info are missing.");
            this.setBarcodeStatus("UI error displaying product info.", true);
            return;
        }

        if (product) {
            productNameEl.textContent = product.name;
            currentStockEl.textContent = product.quantity;
            scannedProductInfoEl.classList.remove('hidden');

            this.setBarcodeStatus(`Product: ${product.name}. Adjust quantity or scan action.`, false);
            this.setLastActionFeedback("Product identified.", false);

            // Generate product-specific QR code
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

            // Display product image if available
            if (product.photo) {
                productSpecificImageEl.src = product.photo;
                productSpecificImageEl.classList.remove('hidden');
            } else {
                productSpecificImageEl.classList.add('hidden');
            }

            // Display action QR codes
            await this.displayBarcodeModeActionQRCodes();

        } else {
            productNameEl.textContent = 'N/A';
            currentStockEl.textContent = 'N/A';
            scannedProductInfoEl.classList.add('hidden');
            productSpecificQREl.innerHTML = '<span class="text-xs">N/A</span>';
            productSpecificImageEl.classList.add('hidden');

            this.setBarcodeStatus(`Product ID "${productId}" not found in inventory.`, true);
        }
    }

    /**
     * Display action QR codes for quantity adjustments
     */
    async displayBarcodeModeActionQRCodes() {
        const container = document.getElementById('barcodeModeActionQRCodesContainer');
        if (!container) {
            console.error('[BarcodeScannerModule] Barcode Mode Action QR Codes container not found.');
            return;
        }
        container.innerHTML = ''; // Clear previous QRs

        if (typeof QRCode === 'undefined') {
            console.error('[BarcodeScannerModule] QRCode library is not loaded. Cannot display action QR codes.');
            container.innerHTML = '<p class="text-red-500 dark:text-red-400 col-span-full">Error: QRCode library not loaded.</p>';
            return;
        }

        this.actionConfigs.forEach(action => {
            const actionDiv = document.createElement('div');
            let bgColorClass = 'bg-gray-100 dark:bg-gray-700'; // Default
            
            if (action.type === 'add') {
                bgColorClass = 'bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-600';
            } else if (action.type === 'subtract') {
                bgColorClass = 'bg-red-100 hover:bg-red-200 dark:bg-red-700 dark:hover:bg-red-600';
            }
            
            actionDiv.className = `flex flex-col items-center p-2 border dark:border-slate-600 rounded-md shadow ${bgColorClass} transition-colors duration-150`;

            const qrCodeElem = document.createElement('div');
            qrCodeElem.id = `barcode-mode-action-qr-${action.data}`;
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
                console.error(`[BarcodeScannerModule] Error generating QR code for action ${action.label}:`, e);
                qrCodeElem.textContent = 'Error';
            }
        });
        
        console.log('[BarcodeScannerModule] Action QR codes displayed.');
    }

    /**
     * Adjust scanned product quantity based on action
     */
    async adjustScannedProductQuantity(adjustmentType, quantityToAdjustStr) {
        const quantityToAdjust = parseInt(quantityToAdjustStr);
        
        const showToast = (message, type = 'info') => {
            if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                window.uiEnhancementManager.showToast(message, type);
            } else {
                console.warn('[BarcodeScannerModule] uiEnhancementManager.showToast not available. Message:', message);
                this.setLastActionFeedback(message, type === 'error' || type === 'warning');
            }
        };

        if (!this.currentProductId) {
            showToast("No active product selected for quantity adjustment.", 'error');
            this.setLastActionFeedback("No active product selected for quantity adjustment.", true);
            return;
        }
        
        if (isNaN(quantityToAdjust) || quantityToAdjust <= 0) {
            showToast("Invalid quantity for adjustment. Must be a positive number.", 'error');
            this.setLastActionFeedback("Invalid quantity for adjustment.", true);
            return;
        }

        try {
            const db = firebase.firestore();
            const productRef = db.collection('inventory').doc(this.currentProductId);
            const productDoc = await productRef.get();

            if (!productDoc.exists) {
                const msg = `Product ${this.currentProductId} not found in database.`;
                showToast(msg, 'error');
                this.setLastActionFeedback(msg, true);
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
                this.setLastActionFeedback(successMessage, false);
                
                if (window.logActivity) {
                    await window.logActivity('stock_adjusted_scan', 
                        `Product: ${productData.name} quantity increased by ${quantityToAdjust} (New: ${newQuantity})`, 
                        this.currentProductId, productData.name);
                }
            } else if (adjustmentType === 'decrement') {
                if (currentQuantity >= quantityToAdjust) {
                    newQuantity = currentQuantity - quantityToAdjust;
                    await productRef.update({ quantity: newQuantity });
                    successMessage = `Removed ${quantityToAdjust} from ${productData.name}. New stock: ${newQuantity}`;
                    showToast(successMessage, 'success');
                    this.setLastActionFeedback(successMessage, false);
                    
                    if (window.logActivity) {
                        await window.logActivity('stock_adjusted_scan', 
                            `Product: ${productData.name} quantity decreased by ${quantityToAdjust} (New: ${newQuantity})`, 
                            this.currentProductId, productData.name);
                    }
                } else {
                    const errMsg = `Cannot remove ${quantityToAdjust}. Only ${currentQuantity} in stock for ${productData.name}.`;
                    showToast(errMsg, 'warning');
                    this.setLastActionFeedback(errMsg, true);
                    return;
                }
            } else {
                const errMsg = "Invalid adjustment type specified.";
                showToast(errMsg, 'error');
                this.setLastActionFeedback(errMsg, true);
                return;
            }

            // Update local inventory array if available
            if (window.inventory) {
                const inventoryIndex = window.inventory.findIndex(p => p.id === this.currentProductId);
                if (inventoryIndex !== -1) {
                    window.inventory[inventoryIndex].quantity = newQuantity;
                }
            }

            // Update UI elements
            const currentStockEl = document.getElementById('qsuCurrentStock');
            if (currentStockEl) {
                currentStockEl.textContent = newQuantity;
            }

            // Refresh inventory display if function exists
            if (window.displayInventory) {
                await window.displayInventory();
            }

        } catch (error) {
            console.error('[BarcodeScannerModule] Error adjusting quantity:', error);
            showToast(`Error adjusting quantity: ${error.message}`, 'error');
            this.setLastActionFeedback(`Error adjusting quantity: ${error.message}`, true);
        }
    }

    /**
     * Process action data from scanned QR codes
     */
    async processActionData(actionData) {
        if (!actionData.startsWith('ACTION_')) {
            this.setBarcodeStatus(`Invalid action data: ${actionData}`, true);
            return;
        }

        const parts = actionData.split('_'); // e.g., ACTION_ADD_10
        if (parts.length === 3) {
            const operation = parts[1].toLowerCase(); // 'add' or 'sub'
            const quantity = parseInt(parts[2]);

            if (isNaN(quantity)) {
                this.setBarcodeStatus(`Invalid quantity in action: ${actionData}`, true);
                return;
            }

            let adjustmentType;
            if (operation === 'add') {
                adjustmentType = 'increment';
            } else if (operation === 'sub' || operation === 'subtract') {
                adjustmentType = 'decrement';
            } else {
                this.setBarcodeStatus(`Unknown operation in action: ${actionData}`, true);
                return;
            }

            await this.adjustScannedProductQuantity(adjustmentType, quantity.toString());
        } else {
            this.setBarcodeStatus(`Malformed action QR code: ${actionData}`, true);
        }
    }

    /**
     * Set status message for barcode scanner
     */
    setBarcodeStatus(message, isError = false) {
        const statusEl = document.getElementById('barcodeScannerStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `p-2 rounded-md text-sm min-h-[36px] ${isError ? 'bg-red-100 dark:bg-red-700 text-red-700 dark:text-red-200' : 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200'}`;
        }
        console.log(`[BarcodeScannerModule] Status: ${message}`);
    }

    /**
     * Set last action feedback
     */
    setLastActionFeedback(message, isError = false) {
        const feedbackEl = document.getElementById('barcodeLastActionFeedback');
        if (feedbackEl) {
            feedbackEl.textContent = message;
            feedbackEl.className = `text-sm ${isError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`;
        }
    }

    /**
     * Initialize event listeners for barcode input handling
     */
    initializeEventListeners() {
        // Quick Stock barcode input
        const qsuBarcodeIdInput = document.getElementById('qsuBarcodeIdInput');
        if (qsuBarcodeIdInput) {
            qsuBarcodeIdInput.addEventListener('keydown', async (event) => {
                if (event.key === 'Enter' || event.keyCode === 13) {
                    event.preventDefault();
                    const scannedValue = qsuBarcodeIdInput.value.trim();
                    qsuBarcodeIdInput.value = ''; // Clear input immediately

                    if (scannedValue) {
                        if (scannedValue.startsWith('ACTION_')) {
                            // Handle Action QR Code
                            if (!this.currentProductId) {
                                const msg = 'Please scan a product before scanning an action QR code.';
                                this.setBarcodeStatus(msg, true);
                                if (window.uiEnhancementManager && window.uiEnhancementManager.showToast) {
                                    window.uiEnhancementManager.showToast(msg, 'error');
                                }
                                return;
                            }
                            await this.processActionData(scannedValue);
                        } else {
                            // Handle as Product ID
                            await this.handleQuickStockScan(scannedValue);
                        }
                    } else {
                        this.setBarcodeStatus('Please enter or scan a Product ID or Action Code.', true);
                        if (window.uiEnhancementManager && window.uiEnhancementManager.showToast) {
                            window.uiEnhancementManager.showToast('Input field was empty.', 'warning');
                        }
                    }
                    
                    // Ensure focus remains on input field for chained scanning
                    qsuBarcodeIdInput.focus();
                }
            });
        }

        // Camera scanner start button
        const startCameraScanBtn = document.getElementById('qsuStartCameraScanBtn');
        if (startCameraScanBtn) {
            startCameraScanBtn.addEventListener('click', () => {
                this.startCameraScanner();
                startCameraScanBtn.classList.add('hidden');
                const stopBtn = document.getElementById('qsuStopCameraScanBtn');
                if (stopBtn) stopBtn.classList.remove('hidden');
                
                const scannerContainer = document.getElementById('qrScannerContainer');
                if (scannerContainer) scannerContainer.classList.remove('hidden');
            });
        }

        // Camera scanner stop button
        const stopCameraScanBtn = document.getElementById('qsuStopCameraScanBtn');
        if (stopCameraScanBtn) {
            stopCameraScanBtn.addEventListener('click', () => {
                this.stopCameraScanner();
                stopCameraScanBtn.classList.add('hidden');
                const startBtn = document.getElementById('qsuStartCameraScanBtn');
                if (startBtn) startBtn.classList.remove('hidden');
                
                const scannerContainer = document.getElementById('qrScannerContainer');
                if (scannerContainer) scannerContainer.classList.add('hidden');
            });
        }
    }

    /**
     * Cleanup function
     */
    cleanup() {
        this.stopBarcodeScanner();
        this.stopCameraScanner();
    }
}

// Initialize the barcode scanner module
let barcodeScannerModule;
if (typeof window !== 'undefined') {
    barcodeScannerModule = new BarcodeScannerModule();
    window.barcodeScannerModule = barcodeScannerModule;
}

export default BarcodeScannerModule;
