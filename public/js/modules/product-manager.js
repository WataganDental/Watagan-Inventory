/**
 * Product Management Module
 * Handles all product-related operations including CRUD, forms, display, and photo capture
 */

export class ProductManager {
    constructor() {
        this.isEditMode = false;
        this.editingProductId = null;
        this.capturedPhoto = null;
        this.videoStream = null;
        this.currentVideoElement = null;
        this.currentCanvasElement = null;
    }

    /**
     * Start photo capture process
     */
    async startPhotoCapture(videoId = 'photoVideo', canvasId = 'photoCanvas') {
        try {
            const video = document.getElementById(videoId);
            const canvas = document.getElementById(canvasId);
            
            if (!video || !canvas) {
                console.error('Video or canvas element not found for photo capture');
                return;
            }

            // Check if camera is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.error('Camera not supported in this browser');
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Camera not supported in this browser', 'error');
                } else {
                    alert('Camera not supported in this browser');
                }
                return;
            }

            this.currentVideoElement = video;
            this.currentCanvasElement = canvas;

            // Request camera access with progressive fallback
            try {
                console.log('[ProductManager] Trying rear-facing camera...');
                this.videoStream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'environment' // Use back camera if available
                    }
                });
                console.log('[ProductManager] Rear-facing camera successful');
            } catch (backCameraError) {
                console.log('[ProductManager] Rear-facing camera failed, trying front-facing...', backCameraError.message);
                try {
                    this.videoStream = await navigator.mediaDevices.getUserMedia({
                        video: { 
                            width: { ideal: 640 },
                            height: { ideal: 480 },
                            facingMode: 'user' // Use front camera as fallback
                        }
                    });
                    console.log('[ProductManager] Front-facing camera successful');
                } catch (frontCameraError) {
                    console.log('[ProductManager] Front-facing camera failed, trying any camera...', frontCameraError.message);
                    try {
                        this.videoStream = await navigator.mediaDevices.getUserMedia({
                            video: { 
                                width: { ideal: 640 },
                                height: { ideal: 480 }
                            }
                        });
                        console.log('[ProductManager] Any camera successful');
                    } catch (anyCameraError) {
                        console.error('[ProductManager] All camera attempts failed:', anyCameraError.message);
                        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                            uiEnhancementManager.showToast('No camera available: ' + anyCameraError.message, 'error');
                        } else {
                            alert('No camera available: ' + anyCameraError.message);
                        }
                        return;
                    }
                }
            }

            video.srcObject = this.videoStream;
            video.classList.remove('hidden');
            
            // Show take photo and cancel buttons
            const takeBtn = document.getElementById('takePhotoBtn');
            const cancelBtn = document.getElementById('cancelPhotoBtn');
            const captureBtn = document.getElementById('capturePhotoBtn');
            
            if (takeBtn) takeBtn.classList.remove('hidden');
            if (cancelBtn) cancelBtn.classList.remove('hidden');
            if (captureBtn) captureBtn.classList.add('hidden');

            // Also handle modal buttons
            const modalTakeBtn = document.getElementById('modalTakePhotoBtn');
            const modalCancelBtn = document.getElementById('modalCancelPhotoBtn');
            const modalCaptureBtn = document.getElementById('modalCapturePhotoBtn');
            
            if (modalTakeBtn) modalTakeBtn.classList.remove('hidden');
            if (modalCancelBtn) modalCancelBtn.classList.remove('hidden');
            if (modalCaptureBtn) modalCaptureBtn.classList.add('hidden');

            await video.play();
            console.log('Camera started successfully');

        } catch (error) {
            console.error('Error starting camera:', error);
            if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                window.uiEnhancementManager.showToast('Camera access denied or not available', 'error');
            } else {
                alert('Camera access denied or not available');
            }
        }
    }

    /**
     * Take a photo
     */
    takePhoto() {
        if (!this.currentVideoElement || !this.currentCanvasElement) {
            console.error('Video or canvas not available for photo capture');
            return;
        }

        const video = this.currentVideoElement;
        const canvas = this.currentCanvasElement;
        const context = canvas.getContext('2d');

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob
        canvas.toBlob((blob) => {
            if (blob) {
                this.capturedPhoto = blob;
                
                // Show preview
                const preview = document.getElementById('productPhotoPreview') || document.getElementById('modalProductPhotoPreview');
                if (preview) {
                    const url = URL.createObjectURL(blob);
                    preview.src = url;
                    preview.classList.remove('hidden');
                }

                console.log('Photo captured successfully');
                if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                    window.uiEnhancementManager.showToast('Photo captured successfully', 'success');
                }
            }
        }, 'image/jpeg', 0.8);

        // Stop camera and hide video
        this.cancelPhoto();
    }

    /**
     * Cancel photo capture
     */
    cancelPhoto() {
        // Stop video stream
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }

        // Hide video elements
        if (this.currentVideoElement) {
            this.currentVideoElement.classList.add('hidden');
            this.currentVideoElement.srcObject = null;
        }

        // Reset button states
        const takeBtn = document.getElementById('takePhotoBtn');
        const cancelBtn = document.getElementById('cancelPhotoBtn');
        const captureBtn = document.getElementById('capturePhotoBtn');
        
        if (takeBtn) takeBtn.classList.add('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');
        if (captureBtn) captureBtn.classList.remove('hidden');

        // Also handle modal buttons
        const modalTakeBtn = document.getElementById('modalTakePhotoBtn');
        const modalCancelBtn = document.getElementById('modalCancelPhotoBtn');
        const modalCaptureBtn = document.getElementById('modalCapturePhotoBtn');
        
        if (modalTakeBtn) modalTakeBtn.classList.add('hidden');
        if (modalCancelBtn) modalCancelBtn.classList.add('hidden');
        if (modalCaptureBtn) modalCaptureBtn.classList.remove('hidden');

        // Reset references
        this.currentVideoElement = null;
        this.currentCanvasElement = null;
    }

    /**
     * Upload photo to Firebase Storage
     */
    async uploadPhoto(productId, photoBlob = null) {
        const photoToUpload = photoBlob || this.capturedPhoto;
        
        if (!photoToUpload) {
            console.log('No photo to upload');
            return null;
        }

        if (!productId) {
            console.error('Product ID required for photo upload');
            return null;
        }

        try {
            if (!window.storage) {
                console.error('Firebase storage not available');
                return null;
            }

            const filename = `products/${productId}_${Date.now()}.jpg`;
            const storageRef = window.storage.ref().child(filename);
            
            const snapshot = await storageRef.put(photoToUpload);
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            console.log('Photo uploaded successfully:', downloadURL);
            return downloadURL;

        } catch (error) {
            console.error('Error uploading photo:', error);
            if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
                window.uiEnhancementManager.showToast('Error uploading photo: ' + error.message, 'error');
            }
            return null;
        }
    }

    /**
     * Create HTML for a single product row
     */
    createProductRowHtml(item) {
        let rowClass = 'hover:bg-gray-50 dark:hover:bg-slate-750';
        if (item.quantity === 0) {
            rowClass = 'bg-error/20 hover:bg-error/30';
        } else if (item.quantity <= item.minQuantity && item.minQuantity > 0) {
            rowClass = 'bg-warning/20 hover:bg-warning/30';
        }

        const photoUrl = item.photoURL || item.photo || `https://picsum.photos/seed/${item.id}/40/40`;
        const placeholderSvg = `<svg class="w-full h-full text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`;

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

    /**
     * Attach event listeners to product table elements
     */
    attachTableEventListeners() {
        // Edit product buttons
        document.querySelectorAll('.edit-product-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.currentTarget.dataset.productId;
                if (productId && typeof window.openEditProductModalWithProduct === 'function') {
                    window.openEditProductModalWithProduct(productId);
                } else if (productId) {
                    // Fallback to original edit method
                    this.editProduct(productId);
                }
            });
        });

        // Delete product buttons
        document.querySelectorAll('.delete-product-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.currentTarget.dataset.productId;
                if (productId && typeof window.deleteProduct === 'function') {
                    window.deleteProduct(productId);
                }
            });
        });

        // Move product buttons
        document.querySelectorAll('.move-product-action-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.currentTarget.dataset.productId;
                if (productId && typeof window.openMoveProductModalWithProduct === 'function') {
                    window.openMoveProductModalWithProduct(productId);
                } else if (productId && typeof window.openMoveProductForm === 'function') {
                    // Fallback to original move form
                    window.openMoveProductForm(productId);
                }
            });
        });

        // Product photo thumbnails
        document.querySelectorAll('.product-photo-thumb').forEach(img => {
            img.addEventListener('click', (e) => {
                const imageUrl = e.currentTarget.dataset.imgUrl;
                if (imageUrl && typeof window.openImageModal === 'function') {
                    window.openImageModal(imageUrl);
                }
            });
        });

        // View QR code buttons
        document.querySelectorAll('.view-qr-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.currentTarget.dataset.productId;
                if (typeof window.viewQRCode === 'function') {
                    window.viewQRCode(productId);
                } else {
                    console.error('viewQRCode function is not defined.');
                    if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                        uiEnhancementManager.showToast('Error: QR Code function not available.', 'error');
                    }
                }
            });
        });
    }

    /**
     * Edit a product by ID
     */
    async editProduct(productId) {
        if (!productId) {
            console.error('editProduct: No product ID provided');
            return;
        }

        try {
            const doc = await window.db.collection('inventory').doc(productId).get();
            if (doc.exists) {
                const productData = doc.data();
                this.populateProductForm(productData, productId);
                this.isEditMode = true;
                this.editingProductId = productId;

                // Show edit form and scroll to it
                if (typeof window.showView === 'function') {
                    window.showView('inventoryViewContainer', 'menuInventory');
                }
                
                // Scroll to form
                const formContainer = document.getElementById('productFormContainer');
                if (formContainer) {
                    formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                // Update form buttons
                this.updateFormButtonsForEdit();

                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast(`Editing product: ${productData.name}`, 'info');
                }
            } else {
                console.error('Product not found:', productId);
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Product not found', 'error');
                }
            }
        } catch (error) {
            console.error('Error loading product for edit:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error loading product: ' + error.message, 'error');
            }
        }
    }

    /**
     * Populate the product form with data
     */
    populateProductForm(productData, productId) {
        const fields = [
            { id: 'productName', value: productData.name || '' },
            { id: 'productQuantity', value: productData.quantity || 0 },
            { id: 'productMinQuantity', value: productData.minQuantity || 0 },
            { id: 'productReorderQuantity', value: productData.reorderQuantity || 0 },
            { id: 'productCost', value: productData.cost || 0 },
            { id: 'productSupplier', value: productData.supplier || '' },
            { id: 'productLocation', value: productData.location || '' }
        ];

        fields.forEach(({ id, value }) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        });

        // Handle photo preview
        const photoPreview = document.getElementById('photoPreview');
        if (photoPreview && productData.photo) {
            photoPreview.src = productData.photo;
            photoPreview.style.display = 'block';
        }

        // Store the photo URL for potential reuse
        this.capturedPhoto = productData.photoURL || null;
    }

    /**
     * Update form buttons for edit mode
     */
    updateFormButtonsForEdit() {
        const submitBtn = document.getElementById('productSubmitBtn');
        const cancelBtn = document.getElementById('cancelEditBtn');

        if (submitBtn) {
            submitBtn.textContent = 'Update Product';
            submitBtn.classList.remove('btn-primary');
            submitBtn.classList.add('btn-warning');
        }

        if (cancelBtn) {
            cancelBtn.style.display = 'inline-block';
        }
    }

    /**
     * Reset the product form
     */
    resetProductForm() {
        this.isEditMode = false;
        this.editingProductId = null;
        this.capturedPhoto = null;

        // Reset regular form fields
        const form = document.getElementById('productForm');
        if (form) {
            form.reset();
        }

        // Reset modal form fields
        const modalFields = [
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
        
        modalFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = false;
                } else {
                    field.value = '';
                }
            }
        });

        // Hide photo previews
        const photoPreview = document.getElementById('photoPreview');
        if (photoPreview) {
            photoPreview.style.display = 'none';
            photoPreview.src = '';
        }
        
        const productPhotoPreview = document.getElementById('productPhotoPreview');
        if (productPhotoPreview) {
            productPhotoPreview.classList.add('hidden');
            productPhotoPreview.src = '';
        }
        
        const modalPhotoPreview = document.getElementById('modalProductPhotoPreview');
        if (modalPhotoPreview) {
            modalPhotoPreview.classList.add('hidden');
            modalPhotoPreview.src = '';
        }

        // Reset form buttons
        const submitBtn = document.getElementById('productSubmitBtn');
        const cancelBtn = document.getElementById('cancelEditBtn');

        if (submitBtn) {
            submitBtn.textContent = 'Add Product';
            submitBtn.classList.remove('btn-warning');
            submitBtn.classList.add('btn-primary');
        }

        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }

        // Hide camera controls
        this.hideCameraControls();
    }

    /**
     * Submit product (add or update)
     */
    async submitProduct() {
        try {
            const productData = this.getFormData();
            
            if (!this.validateProductData(productData)) {
                return;
            }

            if (this.isEditMode && this.editingProductId) {
                await this.updateProduct(this.editingProductId, productData);
            } else {
                await this.addProduct(productData);
            }

            this.resetProductForm();
            
            // Close modal if we're in modal mode
            const modal = document.getElementById('addProductModal');
            if (modal) {
                modal.close();
            }
            
            // Refresh displays
            if (typeof window.loadInventory === 'function') {
                await window.loadInventory();
            }
            if (typeof window.displayInventory === 'function') {
                window.displayInventory();
            }
            if (typeof window.updateInventoryDashboard === 'function') {
                window.updateInventoryDashboard();
            }

        } catch (error) {
            console.error('Error submitting product:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error saving product: ' + error.message, 'error');
            }
        }
    }

    /**
     * Get form data
     */
    getFormData() {
        // Check if we're in modal mode or regular form mode
        const isModal = document.getElementById('modalProductName') !== null;
        const prefix = isModal ? 'modal' : '';
        
        const getName = () => {
            const modalName = document.getElementById('modalProductName')?.value.trim();
            const regularName = document.getElementById('productName')?.value.trim();
            return modalName || regularName || '';
        };
        
        const getQuantity = () => {
            const modalQty = document.getElementById('modalProductQuantity')?.value;
            const regularQty = document.getElementById('productQuantity')?.value;
            return parseInt(modalQty || regularQty) || 0;
        };
        
        const getMinQuantity = () => {
            const modalMin = document.getElementById('modalProductMinQuantity')?.value;
            const regularMin = document.getElementById('productMinQuantity')?.value;
            return parseInt(modalMin || regularMin) || 0;
        };
        
        const getReorderQuantity = () => {
            const modalReorder = document.getElementById('modalProductReorderQuantity')?.value;
            const regularReorder = document.getElementById('productReorderQuantity')?.value;
            return parseInt(modalReorder || regularReorder) || 0;
        };
        
        const getCost = () => {
            const modalCost = document.getElementById('modalProductCost')?.value;
            const regularCost = document.getElementById('productCost')?.value;
            return parseFloat(modalCost || regularCost) || 0;
        };
        
        const getSupplier = () => {
            const modalSupplier = document.getElementById('modalProductSupplier')?.value.trim();
            const regularSupplier = document.getElementById('productSupplier')?.value.trim();
            return modalSupplier || regularSupplier || '';
        };
        
        const getLocation = () => {
            const modalLocation = document.getElementById('modalProductLocation')?.value.trim();
            const regularLocation = document.getElementById('productLocation')?.value.trim();
            return modalLocation || regularLocation || '';
        };
        
        const getQuantityOrdered = () => {
            const modalOrdered = document.getElementById('modalProductQuantityOrdered')?.value;
            const regularOrdered = document.getElementById('productQuantityOrdered')?.value;
            return parseInt(modalOrdered || regularOrdered) || 0;
        };
        
        const getQuantityBackordered = () => {
            const modalBackordered = document.getElementById('modalProductQuantityBackordered')?.value;
            const regularBackordered = document.getElementById('productQuantityBackordered')?.value;
            return parseInt(modalBackordered || regularBackordered) || 0;
        };

        return {
            name: getName(),
            quantity: getQuantity(),
            minQuantity: getMinQuantity(),
            reorderQuantity: getReorderQuantity(),
            cost: getCost(),
            supplier: getSupplier(),
            location: getLocation(),
            photoURL: this.capturedPhoto || '',
            lastUpdated: new Date(),
            quantityOrdered: getQuantityOrdered(),
            productQuantityBackordered: getQuantityBackordered()
        };
    }

    /**
     * Validate product data
     */
    validateProductData(productData) {
        if (!productData.name) {
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Product name is required', 'error');
            }
            return false;
        }

        if (productData.quantity < 0) {
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Quantity cannot be negative', 'error');
            }
            return false;
        }

        if (productData.cost < 0) {
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Cost cannot be negative', 'error');
            }
            return false;
        }

        return true;
    }

    /**
     * Add new product
     */
    async addProduct(productData) {
        try {
            // Handle photo upload if there's a photo captured
            if (this.capturedPhoto) {
                console.log('[ProductManager] Uploading photo for new product...');
                
                // Create a temporary ID for the photo filename
                const tempId = Date.now().toString();
                
                // Convert data URL to blob if needed
                let photoBlob;
                if (typeof this.capturedPhoto === 'string' && this.capturedPhoto.startsWith('data:')) {
                    // Convert data URL to blob
                    const response = await fetch(this.capturedPhoto);
                    photoBlob = await response.blob();
                } else {
                    photoBlob = this.capturedPhoto;
                }
                
                const photoURL = await this.uploadPhoto(tempId, photoBlob);
                if (photoURL) {
                    productData.photoURL = photoURL;
                    console.log('[ProductManager] Photo uploaded for new product:', photoURL);
                } else {
                    console.warn('[ProductManager] Photo upload failed for new product');
                    // Continue without photo
                    productData.photoURL = '';
                }
            }
            
            const docRef = await window.db.collection('inventory').add(productData);
            
            if (typeof window.logActivity === 'function') {
                await window.logActivity('product_added', `Product "${productData.name}" added`, docRef.id, productData.name);
            }

            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast(`Product "${productData.name}" added successfully`, 'success');
            }

            console.log('Product added with ID:', docRef.id);
        } catch (error) {
            console.error('Error adding product:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error adding product: ' + error.message, 'error');
            }
            throw error;
        }
    }

    /**
     * Update existing product
     */
    async updateProduct(productId, productData) {
        try {
            let photoUpdated = false;
            
            // Handle photo upload if there's a new photo captured
            if (this.editModalPhotoBlob) {
                console.log('[ProductManager] Uploading new photo for product update...');
                const photoURL = await this.uploadPhoto(productId, this.editModalPhotoBlob);
                if (photoURL) {
                    productData.photoURL = photoURL;
                    photoUpdated = true;
                    console.log('[ProductManager] Photo uploaded for product update:', photoURL);
                } else {
                    console.warn('[ProductManager] Photo upload failed during product update');
                }
                // Clear the photo blob after use
                this.editModalPhotoBlob = null;
            }

            await window.db.collection('inventory').doc(productId).update(productData);
            
            if (typeof window.logActivity === 'function') {
                const updateDetails = photoUpdated ? 
                    `Product "${productData.name}" updated (including new photo)` : 
                    `Product "${productData.name}" updated`;
                await window.logActivity('product_updated', updateDetails, productId, productData.name);
            }

            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                const successMessage = photoUpdated ? 
                    `Product "${productData.name}" updated successfully with new photo` : 
                    `Product "${productData.name}" updated successfully`;
                uiEnhancementManager.showToast(successMessage, 'success');
            }

            console.log('Product updated:', productId);

        } catch (error) {
            console.error('Error updating product:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error updating product: ' + error.message, 'error');
            }
            throw error;
        }
    }

    /**
     * Delete product
     */
    async deleteProduct(productId) {
        if (!productId) {
            console.error('deleteProduct: No product ID provided');
            return;
        }

        try {
            // Get product data before deletion for logging
            const doc = await window.db.collection('inventory').doc(productId).get();
            const productData = doc.exists ? doc.data() : null;
            const productName = productData ? productData.name : 'Unknown Product';

            // Confirm deletion
            const confirmed = confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`);
            if (!confirmed) {
                return;
            }

            // Delete from Firestore
            await window.db.collection('inventory').doc(productId).delete();

            // Log activity
            if (typeof window.logActivity === 'function') {
                await window.logActivity('product_deleted', `Product "${productName}" deleted`, productId, productName);
            }

            // Show success message
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast(`Product "${productName}" deleted successfully`, 'success');
            }

            // Refresh displays
            if (typeof window.loadInventory === 'function') {
                await window.loadInventory();
            }
            if (typeof window.displayInventory === 'function') {
                window.displayInventory();
            }
            if (typeof window.updateInventoryDashboard === 'function') {
                window.updateInventoryDashboard();
            }

            console.log('Product deleted:', productId);

        } catch (error) {
            console.error('Error deleting product:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error deleting product: ' + error.message, 'error');
            }
        }
    }

    /**
     * Start photo capture for main form
     */
    async startPhotoCapture() {
        const video = document.getElementById('photoVideo');
        const canvas = document.getElementById('photoCanvas');
        const captureBtn = document.getElementById('capturePhotoBtn');
        const takeBtn = document.getElementById('takePhotoBtn');
        const cancelBtn = document.getElementById('cancelPhotoBtn');

        console.log('[ProductManager] startPhotoCapture: Looking for elements:', {
            video: !!video,
            canvas: !!canvas,
            captureBtn: !!captureBtn,
            takeBtn: !!takeBtn,
            cancelBtn: !!cancelBtn
        });

        if (!video || !canvas || !captureBtn || !takeBtn || !cancelBtn) {
            console.error('[ProductManager] startPhotoCapture: Camera elements not found');
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Camera elements not found', 'error');
            }
            return;
        }

        // Check if camera is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('[ProductManager] startPhotoCapture: Camera not supported in this browser');
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Camera not supported in this browser', 'error');
            } else {
                alert('Camera not supported in this browser');
            }
            return;
        }

        // Start camera with progressive fallback
        async function startCamera() {
            try {
                console.log('[ProductManager] startPhotoCapture: Trying rear-facing camera...');
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                console.log('[ProductManager] startPhotoCapture: Rear-facing camera successful');
                return stream;
            } catch (backCameraError) {
                console.log('[ProductManager] startPhotoCapture: Rear-facing camera failed, trying front-facing...', backCameraError.message);
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                    console.log('[ProductManager] startPhotoCapture: Front-facing camera successful');
                    return stream;
                } catch (frontCameraError) {
                    console.log('[ProductManager] startPhotoCapture: Front-facing camera failed, trying any camera...', frontCameraError.message);
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                        console.log('[ProductManager] startPhotoCapture: Any camera successful');
                        return stream;
                    } catch (anyCameraError) {
                        console.error('[ProductManager] startPhotoCapture: All camera attempts failed:', anyCameraError.message);
                        throw new Error('No camera available: ' + anyCameraError.message);
                    }
                }
            }
        }

        try {
            const stream = await startCamera();
            video.srcObject = stream;
            video.classList.remove('hidden');
            
            // Debug: Check video element visibility
            const computedStyle = window.getComputedStyle(video);
            console.log('[ProductManager] startPhotoCapture: Video element visibility debug:', {
                hasHiddenClass: video.classList.contains('hidden'),
                displayStyle: computedStyle.display,
                visibilityStyle: computedStyle.visibility,
                opacityStyle: computedStyle.opacity,
                offsetHeight: video.offsetHeight,
                offsetWidth: video.offsetWidth
            });
            
            // Ensure video plays and is visible
            video.play().catch(playError => {
                console.warn('[ProductManager] startPhotoCapture: Video play failed:', playError);
                // Continue anyway, some browsers don't require explicit play
            });
            
            captureBtn.classList.add('hidden');
            takeBtn.classList.remove('hidden');
            cancelBtn.classList.remove('hidden');
            
            console.log('[ProductManager] startPhotoCapture: Camera started successfully, video should be visible');
            
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Camera activated. Click "Take Photo" when ready.', 'info');
            }
        } catch (error) {
            console.error('[ProductManager] startPhotoCapture: Error accessing camera:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error accessing camera: ' + error.message, 'error');
            } else {
                alert('Error accessing camera: ' + error.message);
            }
        }
    }

    /**
     * Take photo for main form
     */
    takePhoto() {
        const video = document.getElementById('photoVideo');
        const canvas = document.getElementById('photoCanvas');
        const preview = document.getElementById('productPhotoPreview');

        console.log('[ProductManager] takePhoto: Looking for elements:', {
            video: !!video,
            canvas: !!canvas,
            preview: !!preview
        });

        if (!video || !canvas || !preview) {
            console.error('[ProductManager] takePhoto: Camera elements not found');
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Camera elements not found', 'error');
            }
            return;
        }

        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        this.capturedPhoto = canvas.toDataURL('image/jpeg');
        preview.src = this.capturedPhoto;
        preview.classList.remove('hidden');

        this.cancelPhoto(); // Hide camera controls

        console.log('[ProductManager] takePhoto: Photo captured successfully');
        
        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast('Photo captured successfully', 'success');
        }
    }

    /**
     * Cancel photo capture for main form
     */
    cancelPhoto() {
        const video = document.getElementById('photoVideo');
        const captureBtn = document.getElementById('capturePhotoBtn');
        const takeBtn = document.getElementById('takePhotoBtn');
        const cancelBtn = document.getElementById('cancelPhotoBtn');

        console.log('[ProductManager] cancelPhoto: Stopping camera');

        // Stop camera stream
        if (video && video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            video.srcObject = null;
        }

        // Hide video and controls
        if (video) video.classList.add('hidden');
        if (captureBtn) captureBtn.classList.remove('hidden');
        if (takeBtn) takeBtn.classList.add('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');

        console.log('[ProductManager] cancelPhoto: Camera controls hidden');
    }

    /**
     * Hide camera controls
     */
    hideCameraControls() {
        // Hide main form camera elements
        const video = document.getElementById('photoVideo');
        const canvas = document.getElementById('photoCanvas');
        const captureBtn = document.getElementById('capturePhotoBtn');
        const takeBtn = document.getElementById('takePhotoBtn');
        const cancelBtn = document.getElementById('cancelPhotoBtn');

        if (video) {
            video.classList.add('hidden');
            if (video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                video.srcObject = null;
            }
        }
        if (canvas) canvas.classList.add('hidden');
        if (captureBtn) captureBtn.classList.remove('hidden');
        if (takeBtn) takeBtn.classList.add('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');

        // Also hide legacy camera controls if they exist
        const legacyVideo = document.getElementById('cameraVideo');
        const legacyControls = document.getElementById('photoControls');

        if (legacyVideo) {
            legacyVideo.style.display = 'none';
        }
        if (legacyControls) {
            legacyControls.style.display = 'none';
        }
    }

    /**
     * Move product to different location
     */
    async moveProduct(productId, newLocation) {
        if (!productId || !newLocation) {
            console.error('moveProduct: Missing required parameters');
            return;
        }

        try {
            const productRef = window.db.collection('inventory').doc(productId);
            const doc = await productRef.get();

            if (!doc.exists) {
                if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                    uiEnhancementManager.showToast('Product not found', 'error');
                }
                return;
            }

            const productData = doc.data();
            const oldLocation = productData.location;

            await productRef.update({
                location: newLocation,
                lastUpdated: new Date()
            });

            if (typeof window.logActivity === 'function') {
                await window.logActivity(
                    'product_moved',
                    `Product "${productData.name}" moved from "${oldLocation}" to "${newLocation}"`,
                    productId,
                    productData.name
                );
            }

            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast(
                    `Product "${productData.name}" moved to ${newLocation}`,
                    'success'
                );
            }

            // Refresh displays
            if (typeof window.loadInventory === 'function') {
                await window.loadInventory();
            }
            if (typeof window.displayInventory === 'function') {
                window.displayInventory();
            }

        } catch (error) {
            console.error('Error moving product:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error moving product: ' + error.message, 'error');
            }
        }
    }

    /**
     * Start photo capture for modal
     */
    async startModalPhotoCapture() {
        const video = document.getElementById('modalPhotoVideo');
        const canvas = document.getElementById('modalPhotoCanvas');
        const captureBtn = document.getElementById('modalCapturePhotoBtn');
        const takeBtn = document.getElementById('modalTakePhotoBtn');
        const cancelBtn = document.getElementById('modalCancelPhotoBtn');

        console.log('[ProductManager] startModalPhotoCapture: Elements found:', {
            video: !!video,
            canvas: !!canvas,
            captureBtn: !!captureBtn,
            takeBtn: !!takeBtn,
            cancelBtn: !!cancelBtn
        });

        if (!video || !canvas || !captureBtn || !takeBtn || !cancelBtn) {
            console.error('Modal camera elements not found');
            return;
        }

        // Check if camera is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('Camera not supported in this browser');
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Camera not supported in this browser', 'error');
            } else {
                alert('Camera not supported in this browser');
            }
            return;
        }

        // Start camera with progressive fallback
        async function startCamera() {
            try {
                console.log('[ProductManager] startModalPhotoCapture: Trying rear-facing camera...');
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                console.log('[ProductManager] startModalPhotoCapture: Rear-facing camera successful');
                return stream;
            } catch (backCameraError) {
                console.log('[ProductManager] startModalPhotoCapture: Rear-facing camera failed, trying front-facing...', backCameraError.message);
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                    console.log('[ProductManager] startModalPhotoCapture: Front-facing camera successful');
                    return stream;
                } catch (frontCameraError) {
                    console.log('[ProductManager] startModalPhotoCapture: Front-facing camera failed, trying any camera...', frontCameraError.message);
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                        console.log('[ProductManager] startModalPhotoCapture: Any camera successful');
                        return stream;
                    } catch (anyCameraError) {
                        console.error('[ProductManager] startModalPhotoCapture: All camera attempts failed:', anyCameraError.message);
                        throw new Error('No camera available: ' + anyCameraError.message);
                    }
                }
            }
        }

        try {
            const stream = await startCamera();
            video.srcObject = stream;
            video.classList.remove('hidden');
            
            // Ensure video starts playing
            try {
                await video.play();
                console.log('[ProductManager] Modal video playing successfully');
            } catch (playError) {
                console.warn('[ProductManager] Video autoplay failed (browser policy), user interaction needed:', playError.message);
            }
            
            captureBtn.classList.add('hidden');
            takeBtn.classList.remove('hidden');
            cancelBtn.classList.remove('hidden');
            
            console.log('[ProductManager] Modal camera UI updated - video should be visible now');
            
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Camera activated. Click "Take Photo" when ready.', 'info');
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error accessing camera: ' + error.message, 'error');
            } else {
                alert('Error accessing camera: ' + error.message);
            }
        }
    }

    /**
     * Take photo in modal
     */
    takeModalPhoto() {
        const video = document.getElementById('modalPhotoVideo');
        const canvas = document.getElementById('modalPhotoCanvas');
        const preview = document.getElementById('modalProductPhotoPreview');

        if (!video || !canvas || !preview) {
            console.error('Modal camera elements not found');
            return;
        }

        if (!video.srcObject || video.videoWidth === 0) {
            console.error('Video stream not ready');
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Camera not ready. Please try again.', 'warning');
            }
            return;
        }

        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        this.capturedPhoto = canvas.toDataURL('image/jpeg');
        preview.src = this.capturedPhoto;
        preview.classList.remove('hidden');

        // Stop the camera stream and hide video
        this.cancelModalPhoto();

        if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
            uiEnhancementManager.showToast('Photo captured successfully! ✅', 'success');
        }

        console.log('[ProductManager] Photo captured and camera stopped');
    }

    /**
     * Cancel photo capture in modal
     */
    cancelModalPhoto() {
        const video = document.getElementById('modalPhotoVideo');
        const captureBtn = document.getElementById('modalCapturePhotoBtn');
        const takeBtn = document.getElementById('modalTakePhotoBtn');
        const cancelBtn = document.getElementById('modalCancelPhotoBtn');

        // Stop camera stream
        if (video && video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(track => {
                track.stop();
                console.log('[ProductManager] Stopped video track');
            });
            video.srcObject = null;
        }

        // Clear stored video stream reference
        if (this.videoStream) {
            const tracks = this.videoStream.getTracks();
            tracks.forEach(track => track.stop());
            this.videoStream = null;
        }

        // Hide camera and show capture button
        if (video) video.classList.add('hidden');
        if (captureBtn) captureBtn.classList.remove('hidden');
        if (takeBtn) takeBtn.classList.add('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');

        console.log('[ProductManager] Modal camera canceled and cleaned up');
    }

    /**
     * Start photo capture for Edit Product modal (scanToEdit)
     */
    async startScanToEditModalPhotoCapture() {
        const video = document.getElementById('scanToEdit_photoVideo');
        const canvas = document.getElementById('scanToEdit_photoCanvas');
        const captureBtn = document.getElementById('scanToEdit_capturePhotoBtn');
        const takeBtn = document.getElementById('scanToEdit_takePhotoBtn');
        const cancelBtn = document.getElementById('scanToEdit_cancelPhotoBtn');

        console.log('[ProductManager] startScanToEditModalPhotoCapture: Elements found:', {
            video: !!video,
            canvas: !!canvas,
            captureBtn: !!captureBtn,
            takeBtn: !!takeBtn,
            cancelBtn: !!cancelBtn
        });

        if (!video || !canvas || !captureBtn || !takeBtn || !cancelBtn) {
            console.error('Edit modal camera elements not found');
            return;
        }

        // Check if camera is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('Camera not supported in this browser');
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Camera not supported in this browser', 'error');
            } else {
                alert('Camera not supported in this browser');
            }
            return;
        }

        // Start camera with progressive fallback
        async function startCamera() {
            try {
                console.log('[ProductManager] startScanToEditModalPhotoCapture: Trying rear-facing camera...');
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                console.log('[ProductManager] startScanToEditModalPhotoCapture: Rear-facing camera successful');
                return stream;
            } catch (backCameraError) {
                console.log('[ProductManager] startScanToEditModalPhotoCapture: Rear-facing camera failed, trying front-facing...', backCameraError.message);
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                    console.log('[ProductManager] startScanToEditModalPhotoCapture: Front-facing camera successful');
                    return stream;
                } catch (frontCameraError) {
                    console.log('[ProductManager] startScanToEditModalPhotoCapture: Front-facing camera failed, trying any camera...', frontCameraError.message);
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                        console.log('[ProductManager] startScanToEditModalPhotoCapture: Any camera successful');
                        return stream;
                    } catch (anyCameraError) {
                        console.error('[ProductManager] startScanToEditModalPhotoCapture: All camera attempts failed:', anyCameraError.message);
                        throw new Error('No camera available: ' + anyCameraError.message);
                    }
                }
            }
        }

        try {
            const stream = await startCamera();
            video.srcObject = stream;
            video.classList.remove('hidden');
            
            // Ensure video starts playing
            try {
                await video.play();
                console.log('[ProductManager] Edit modal video playing successfully');
            } catch (playError) {
                console.warn('[ProductManager] Edit modal video autoplay failed (browser policy), user interaction needed:', playError.message);
            }
            
            captureBtn.classList.add('hidden');
            takeBtn.classList.remove('hidden');
            cancelBtn.classList.remove('hidden');
            
            console.log('[ProductManager] Edit modal camera UI updated - video should be visible now');
            
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Camera activated. Click "Take Photo" when ready.', 'info');
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error accessing camera: ' + error.message, 'error');
            } else {
                alert('Error accessing camera: ' + error.message);
            }
        }
    }

    /**
     * Take photo in Edit Product modal (scanToEdit)
     */
    takeScanToEditModalPhoto() {
        const video = document.getElementById('scanToEdit_photoVideo');
        const canvas = document.getElementById('scanToEdit_photoCanvas');
        const preview = document.getElementById('scanToEdit_productPhotoPreview');
        const captureBtn = document.getElementById('scanToEdit_capturePhotoBtn');
        const takeBtn = document.getElementById('scanToEdit_takePhotoBtn');
        const cancelBtn = document.getElementById('scanToEdit_cancelPhotoBtn');

        if (!video || !canvas || !preview) {
            console.error('Edit modal photo elements not found');
            return;
        }

        try {
            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw video frame to canvas
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert to blob and create URL
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    preview.src = url;
                    preview.classList.remove('hidden');
                    
                    // Store the blob for later use in form submission
                    preview.dataset.photoBlob = URL.createObjectURL(blob);
                    this.editModalPhotoBlob = blob;

                    console.log('[ProductManager] Edit modal photo captured and preview shown');
                    
                    if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                        uiEnhancementManager.showToast('Photo captured successfully!', 'success');
                    }
                } else {
                    console.error('[ProductManager] Failed to create photo blob');
                    if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                        uiEnhancementManager.showToast('Failed to capture photo', 'error');
                    }
                }
            }, 'image/jpeg', 0.9);

            // Stop camera and reset UI
            this.cancelScanToEditModalPhoto();

        } catch (error) {
            console.error('[ProductManager] Error capturing edit modal photo:', error);
            if (typeof uiEnhancementManager !== 'undefined' && uiEnhancementManager.showToast) {
                uiEnhancementManager.showToast('Error capturing photo: ' + error.message, 'error');
            }
        }
    }

    /**
     * Cancel photo capture in Edit Product modal (scanToEdit)
     */
    cancelScanToEditModalPhoto() {
        const video = document.getElementById('scanToEdit_photoVideo');
        const captureBtn = document.getElementById('scanToEdit_capturePhotoBtn');
        const takeBtn = document.getElementById('scanToEdit_takePhotoBtn');
        const cancelBtn = document.getElementById('scanToEdit_cancelPhotoBtn');

        // Stop video stream
        if (video && video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(track => {
                track.stop();
                console.log('[ProductManager] Stopped edit modal video track');
            });
            video.srcObject = null;
        }

        // Hide video and reset UI
        if (video) video.classList.add('hidden');
        if (captureBtn) captureBtn.classList.remove('hidden');
        if (takeBtn) takeBtn.classList.add('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');

        console.log('[ProductManager] Edit modal camera canceled and cleaned up');
    }
}

// Export singleton instance
export const productManager = new ProductManager();
