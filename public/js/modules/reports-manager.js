/**
 * Reports Management Module
 * Handles all report generation including PDF reports and charts
 */

export class ReportsManager {
    constructor() {
        this.inventory = [];
        this.orders = [];
        this.suppliers = [];
        this.locations = [];
    }

    /**
     * Set data for reports
     */
    setData(inventory, orders, suppliers, locations) {
        this.inventory = inventory || [];
        this.orders = orders || [];
        this.suppliers = suppliers || [];
        this.locations = locations || [];
    }

    /**
     * Generate Fast Order Report PDF
     */
    async generateFastOrderReportPDF() {
        try {
            // Robust jsPDF detection (supports both window.jsPDF and window.jspdf.jsPDF)
            const jsPDF = window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
            if (!jsPDF) {
                console.error('jsPDF library not available');
                this.showError('PDF library not loaded. Please refresh the page.');
                return;
            }

            const doc = new jsPDF();

            // Title
            doc.setFontSize(20);
            doc.text('Fast Order Report', 20, 20);
            
            // Date
            doc.setFontSize(12);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 35);
            
            // Calculate pending quantities for each product from orders
            const pendingQuantities = {};
            if (this.orders) {
                this.orders.forEach(order => {
                    if (order.status === 'pending' && order.productId) {
                        pendingQuantities[order.productId] = (pendingQuantities[order.productId] || 0) + (parseInt(order.quantity) || 0);
                    }
                });
            }
            
            // Low stock items that need to be ordered
            const lowStockItems = this.inventory.filter(item => {
                const currentQuantity = parseInt(item.quantity) || 0;
                const quantityOrdered = pendingQuantities[item.id] || 0; // Use calculated pending quantities
                const minQuantity = parseInt(item.minQuantity) || 0;
                const totalAvailable = currentQuantity + quantityOrdered;
                
                // Show in low stock if: current quantity is low AND total available (including orders) is still below minimum
                return currentQuantity <= minQuantity && totalAvailable <= minQuantity && minQuantity > 0;
            }).sort((a, b) => a.quantity - b.quantity);

            doc.setFontSize(16);
            doc.text('Items to Order (Low Stock)', 20, 55);
            
            let yPosition = 70;
            doc.setFontSize(10);
            
            if (lowStockItems.length === 0) {
                doc.text('No items currently below minimum stock levels.', 20, yPosition);
            } else {
                // Table headers
                doc.text('Product Name', 20, yPosition);
                doc.text('Current Qty', 100, yPosition);
                doc.text('Min Qty', 135, yPosition);
                doc.text('Reorder Qty', 165, yPosition);
                doc.text('Supplier', 200, yPosition);
                
                yPosition += 10;
                
                lowStockItems.forEach(item => {
                    if (yPosition > 270) {
                        doc.addPage();
                        yPosition = 20;
                    }
                    
                    const name = (item.name || '').substring(0, 25);
                    doc.text(name, 20, yPosition);
                    doc.text((item.quantity || 0).toString(), 100, yPosition);
                    doc.text((item.minQuantity || 0).toString(), 135, yPosition);
                    doc.text((item.reorderQuantity || 0).toString(), 165, yPosition);
                    doc.text((item.supplier || '').substring(0, 15), 200, yPosition);
                    
                    yPosition += 8;
                });
            }

            // Save the PDF
            doc.save(`fast-order-report-${new Date().toISOString().split('T')[0]}.pdf`);
            
            this.showSuccess('Fast Order Report PDF generated successfully!');
            
        } catch (error) {
            console.error('Error generating Fast Order Report PDF:', error);
            this.showError('Error generating PDF: ' + error.message);
        }
    }

    /**
     * Generate Order Report PDF with QR Codes (improved)
     */
    async generateOrderReportPDFWithQRCodes() {
        try {
            // Robust jsPDF detection (supports both window.jsPDF and window.jspdf.jsPDF)
            const jsPDF = window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
            if (!jsPDF || !window.QRCode) {
                console.error('Required libraries not available');
                this.showError('Required libraries not loaded. Please refresh the page.');
                return;
            }

            const doc = new jsPDF();

            // Title with improved formatting
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text('Order Report with QR Codes', 105, 20, { align: 'center' });
            
            // Date and summary
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 35);
            
            // Recent orders
            const recentOrders = this.orders
                .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
                .slice(0, 15);

            doc.text(`Total Recent Orders: ${recentOrders.length}`, 20, 42);
            
            // Add separator line
            doc.setLineWidth(0.5);
            doc.line(20, 48, 190, 48);

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('Recent Orders', 20, 60);
            
            let yPosition = 75;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');

            if (recentOrders.length === 0) {
                doc.text('No recent orders found.', 20, yPosition);
            } else {
                for (let index = 0; index < recentOrders.length; index++) {
                    const order = recentOrders[index];
                    
                    // Check if we need a new page
                    if (yPosition > 240) {
                        doc.addPage();
                        yPosition = 20;
                    }

                    // Order details with improved layout
                    doc.setFont(undefined, 'bold');
                    doc.text(`Order #${index + 1}`, 20, yPosition);
                    
                    doc.setFont(undefined, 'normal');
                    doc.text(`Product: ${order.productName || 'Unknown Product'}`, 20, yPosition + 8);
                    doc.text(`Quantity: ${order.quantity || 0}`, 20, yPosition + 16);
                    doc.text(`Status: ${(order.status || 'pending').toUpperCase()}`, 20, yPosition + 24);
                    doc.text(`Date: ${new Date(order.dateCreated).toLocaleString()}`, 20, yPosition + 32);
                    
                    if (order.supplier) {
                        doc.text(`Supplier: ${order.supplier}`, 20, yPosition + 40);
                    }

                    // Generate QR code for order with better data
                    let qrValue = order.productId || order.id || order.productName || 'Order';
                    try {
                        const qrCodeData = await this.generateQRCodeImage(qrValue, 35);
                        if (qrCodeData) {
                            doc.addImage(qrCodeData, 'PNG', 140, yPosition, 35, 35);
                        } else {
                            // Fallback rectangle
                            doc.setDrawColor(200, 200, 200);
                            doc.rect(140, yPosition, 35, 35);
                            doc.setFontSize(8);
                            doc.text('QR Error', 150, yPosition + 18);
                        }
                        
                        // QR code label
                        doc.setFontSize(7);
                        doc.text(`QR: ${qrValue.substring(0, 15)}...`, 140, yPosition + 42);
                        
                    } catch (qrErr) {
                        console.warn('QR generation failed for order:', order.id, qrErr);
                        doc.setDrawColor(200, 200, 200);
                        doc.rect(140, yPosition, 35, 35);
                        doc.setFontSize(8);
                        doc.text('QR Error', 150, yPosition + 18);
                    }

                    // Add separator line between orders
                    doc.setLineWidth(0.2);
                    doc.line(20, yPosition + 50, 190, yPosition + 50);
                    
                    yPosition += 60;
                }
            }

            // Save the PDF
            doc.save(`order-report-qr-${new Date().toISOString().split('T')[0]}.pdf`);
            
            this.showSuccess('Order Report with QR Codes generated successfully!');
            
        } catch (error) {
            console.error('Error generating Order Report PDF:', error);
            this.showError('Error generating PDF: ' + error.message);
        }
    }

    /**
     * Generate All QR Codes PDF with improved layout and embedded QR codes
     */
    async generateAllQRCodesPDF() {
        try {
            // Robust jsPDF detection (supports both window.jsPDF and window.jspdf.jsPDF)
            const jsPDF = window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
            if (!jsPDF || !window.QRCode) {
                console.error('Required libraries not available');
                this.showError('Required libraries not loaded. Please refresh the page.');
                return;
            }

            const doc = new jsPDF();

            // Title with company info
            doc.setFontSize(22);
            doc.setFont(undefined, 'bold');
            doc.text('Product QR Code Directory', 105, 20, { align: 'center' });
            
            // Date and info
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 35);
            doc.text(`Total Products: ${this.inventory.length}`, 20, 42);
            
            // Add a line separator
            doc.setLineWidth(0.5);
            doc.line(20, 48, 190, 48);
            
            let yPosition = 60;
            let xPosition = 20;
            const qrSize = 45;
            const itemsPerRow = 3;
            const itemSpacing = 65;
            const rowSpacing = 75;
            let itemCount = 0;

            if (this.inventory.length === 0) {
                doc.setFontSize(12);
                doc.text('No products found.', 105, yPosition, { align: 'center' });
            } else {
                // Sort inventory by name for better organization
                const sortedInventory = [...this.inventory].sort((a, b) => 
                    (a.name || '').localeCompare(b.name || '')
                );

                for (let index = 0; index < sortedInventory.length; index++) {
                    const item = sortedInventory[index];
                    
                    // Check if we need a new page
                    if (yPosition > 240) {
                        doc.addPage();
                        yPosition = 20;
                        xPosition = 20;
                        itemCount = 0;
                    }

                    // Product name (truncated to fit)
                    doc.setFontSize(9);
                    doc.setFont(undefined, 'bold');
                    const name = (item.name || '').substring(0, 18);
                    doc.text(name, xPosition + (qrSize / 2), yPosition, { align: 'center' });

                    // Generate QR code for product ID with better error handling
                    try {
                        const qrCodeData = await this.generateQRCodeImage(item.id || '', qrSize);
                        if (qrCodeData) {
                            doc.addImage(qrCodeData, 'PNG', xPosition, yPosition + 5, qrSize, qrSize);
                        } else {
                            // Fallback rectangle if QR generation fails
                            doc.setDrawColor(200, 200, 200);
                            doc.rect(xPosition, yPosition + 5, qrSize, qrSize);
                            doc.setFontSize(8);
                            doc.text('QR Error', xPosition + (qrSize / 2), yPosition + (qrSize / 2) + 5, { align: 'center' });
                        }
                    } catch (qrErr) {
                        console.warn('QR generation failed for item:', item.id, qrErr);
                        doc.setDrawColor(200, 200, 200);
                        doc.rect(xPosition, yPosition + 5, qrSize, qrSize);
                        doc.setFontSize(8);
                        doc.text('QR Error', xPosition + (qrSize / 2), yPosition + (qrSize / 2) + 5, { align: 'center' });
                    }

                    // Product ID and additional info
                    doc.setFontSize(7);
                    doc.setFont(undefined, 'normal');
                    doc.text(`ID: ${item.id || 'N/A'}`, xPosition + (qrSize / 2), yPosition + qrSize + 12, { align: 'center' });
                    doc.text(`Qty: ${item.quantity || 0}`, xPosition + (qrSize / 2), yPosition + qrSize + 18, { align: 'center' });

                    itemCount++;
                    if (itemCount >= itemsPerRow) {
                        yPosition += rowSpacing;
                        xPosition = 20;
                        itemCount = 0;
                    } else {
                        xPosition += itemSpacing;
                    }
                }
            }

            // Save the PDF
            doc.save(`all-qr-codes-${new Date().toISOString().split('T')[0]}.pdf`);
            
            this.showSuccess('All QR Codes PDF generated successfully!');
            
        } catch (error) {
            console.error('Error generating All QR Codes PDF:', error);
            this.showError('Error generating PDF: ' + error.message);
        }
    }

    /**
     * Generate QR Codes PDF by Location
     */
    async generateQRCodesByLocationPDF(locationName = '') {
        try {
            const jsPDF = window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
            if (!jsPDF || !window.QRCode) {
                console.error('Required libraries not available');
                this.showError('Required libraries not loaded. Please refresh the page.');
                return;
            }

            // Filter inventory by location
            const locationItems = locationName ? 
                this.inventory.filter(item => item.location === locationName) :
                this.inventory;

            if (locationItems.length === 0) {
                this.showError(`No products found${locationName ? ` in location: ${locationName}` : ''}`);
                return;
            }

            const doc = new jsPDF();

            // Title
            doc.setFontSize(22);
            doc.setFont(undefined, 'bold');
            const title = locationName ? `QR Codes - ${locationName}` : 'QR Codes - All Locations';
            doc.text(title, 105, 20, { align: 'center' });
            
            // Date and info
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 35);
            doc.text(`Products in ${locationName || 'All Locations'}: ${locationItems.length}`, 20, 42);
            
            // Add a line separator
            doc.setLineWidth(0.5);
            doc.line(20, 48, 190, 48);
            
            let yPosition = 60;
            let xPosition = 20;
            const qrSize = 45;
            const itemsPerRow = 3;
            const itemSpacing = 65;
            const rowSpacing = 75;
            let itemCount = 0;

            // Sort items by name
            const sortedItems = [...locationItems].sort((a, b) => 
                (a.name || '').localeCompare(b.name || '')
            );

            for (let index = 0; index < sortedItems.length; index++) {
                const item = sortedItems[index];
                
                // Check if we need a new page
                if (yPosition > 240) {
                    doc.addPage();
                    yPosition = 20;
                    xPosition = 20;
                    itemCount = 0;
                }

                // Product name
                doc.setFontSize(9);
                doc.setFont(undefined, 'bold');
                const name = (item.name || '').substring(0, 18);
                doc.text(name, xPosition + (qrSize / 2), yPosition, { align: 'center' });

                // Generate QR code
                try {
                    const qrCodeData = await this.generateQRCodeImage(item.id || '', qrSize);
                    if (qrCodeData) {
                        doc.addImage(qrCodeData, 'PNG', xPosition, yPosition + 5, qrSize, qrSize);
                    } else {
                        // Fallback rectangle
                        doc.setDrawColor(200, 200, 200);
                        doc.rect(xPosition, yPosition + 5, qrSize, qrSize);
                        doc.setFontSize(8);
                        doc.text('QR Error', xPosition + (qrSize / 2), yPosition + (qrSize / 2) + 5, { align: 'center' });
                    }
                } catch (qrErr) {
                    console.warn('QR generation failed for item:', item.id, qrErr);
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(xPosition, yPosition + 5, qrSize, qrSize);
                    doc.setFontSize(8);
                    doc.text('QR Error', xPosition + (qrSize / 2), yPosition + (qrSize / 2) + 5, { align: 'center' });
                }

                // Product details
                doc.setFontSize(7);
                doc.setFont(undefined, 'normal');
                doc.text(`ID: ${item.id || 'N/A'}`, xPosition + (qrSize / 2), yPosition + qrSize + 12, { align: 'center' });
                doc.text(`Qty: ${item.quantity || 0}`, xPosition + (qrSize / 2), yPosition + qrSize + 18, { align: 'center' });

                itemCount++;
                if (itemCount >= itemsPerRow) {
                    yPosition += rowSpacing;
                    xPosition = 20;
                    itemCount = 0;
                } else {
                    xPosition += itemSpacing;
                }
            }

            // Save the PDF
            const fileName = locationName ? 
                `qr-codes-${locationName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf` :
                `qr-codes-all-locations-${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            
            this.showSuccess(`QR Codes PDF generated for ${locationName || 'all locations'}!`);
            
        } catch (error) {
            console.error('Error generating QR Codes by Location PDF:', error);
            this.showError('Error generating PDF: ' + error.message);
        }
    }

    /**
     * Generate QR codes using HTML print view (easier and better quality)
     */
    generateQRCodesHTMLPrint(locationName = '') {
        try {
            // Validate inventory data is available
            if (!this.inventory || this.inventory.length === 0) {
                this.showError('No inventory data available. Please wait for data to load and try again.');
                console.warn('Reports Manager: No inventory data available for QR generation');
                return;
            }

            // Filter inventory by location if specified
            const inventoryData = locationName ? 
                this.inventory.filter(item => item.location === locationName) :
                this.inventory;

            if (inventoryData.length === 0) {
                this.showError(`No products found${locationName ? ` in location: ${locationName}` : ''}`);
                return;
            }

            console.log(`Preparing QR print for ${inventoryData.length} items${locationName ? ` in location: ${locationName}` : ''}`);
            
            // Debug: Check what image fields are available in the first few items
            console.log('Sample inventory items for image analysis:', inventoryData.slice(0, 3).map(item => ({
                id: item.id,
                name: item.name,
                allKeys: Object.keys(item),
                imageFields: {
                    image: item.image,
                    imageUrl: item.imageUrl,
                    imageURL: item.imageURL,
                    img: item.img,
                    photo: item.photo
                }
            })));
            const printData = inventoryData.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                location: item.location,
                cost: item.cost,
                supplier: item.supplier,
                image: item.image || item.imageUrl || item.imageURL || item.img || item.photo || '', // Multiple image field fallbacks
                category: item.category,
                minQuantity: item.minQuantity
            }));

            // Store data in localStorage for the print view
            localStorage.setItem('printData', JSON.stringify(printData));
            
            // Debug: Log what's being stored
            console.log('Storing QR print data:', {
                totalItems: printData.length,
                sampleItem: printData[0] || 'No items',
                locationFilter: locationName || 'All Locations',
                fullData: printData.slice(0, 2) // Show first 2 items for debugging
            });

            // Verify data was stored correctly
            const storedData = localStorage.getItem('printData');
            console.log('Verification - Data stored successfully:', {
                dataExists: !!storedData,
                dataLength: storedData ? JSON.parse(storedData).length : 0
            });

            // Open enhanced print view in new window
            const printWindow = window.open(
                `qr-print-view.html?location=${encodeURIComponent(locationName || 'All Locations')}&timestamp=${Date.now()}`,
                '_blank',
                'width=1200,height=800,scrollbars=yes,resizable=yes'
            );

            if (printWindow) {
                this.showSuccess('Enhanced QR print view opened! Use Ctrl+P or Cmd+P to print as PDF');
                
                // Optional: Log for debugging
                console.log('QR Print data prepared:', {
                    totalItems: printData.length,
                    location: locationName || 'All Locations',
                    itemsWithImages: printData.filter(item => {
                        const hasImage = item.image && item.image.trim() !== '' && item.image !== 'undefined';
                        return hasImage;
                    }).length,
                    sampleImageFields: printData.slice(0, 3).map(item => ({
                        id: item.id,
                        name: item.name,
                        hasImage: !!(item.image && item.image.trim() !== '' && item.image !== 'undefined'),
                        imageValue: item.image
                    }))
                });
            } else {
                this.showError('Could not open print view. Please check your popup blocker settings.');
            }

        } catch (error) {
            console.error('Error generating HTML print view:', error);
            this.showError('Error generating print view: ' + error.message);
        }
    }

    /**
     * Generate order report using HTML print view
     */
    generateOrderReportHTMLPrint() {
        try {
            const recentOrders = this.orders
                .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
                .slice(0, 15);

            if (recentOrders.length === 0) {
                this.showError('No orders found');
                return;
            }

            // Create HTML content for order report
            const orderData = recentOrders.map(order => ({
                id: order.id,
                productId: order.productId,
                productName: order.productName,
                quantity: order.quantity,
                status: order.status,
                dateCreated: order.dateCreated,
                supplier: order.supplier
            }));

            // Store data for print view
            localStorage.setItem('orderPrintData', JSON.stringify(orderData));

            // Open order print view
            const printWindow = window.open(
                `order-print-view.html?timestamp=${Date.now()}`,
                '_blank',
                'width=1200,height=800,scrollbars=yes,resizable=yes'
            );

            if (printWindow) {
                this.showSuccess('Order report print view opened!');
            } else {
                this.showError('Could not open print view. Please check your popup blocker settings.');
            }

        } catch (error) {
            console.error('Error generating order HTML print view:', error);
            this.showError('Error generating order print view: ' + error.message);
        }
    }

    /**
     * Generate inventory report using HTML print view
     */
    generateInventoryReportHTMLPrint(filters = {}) {
        try {
            console.log('[ReportsManager] Generating inventory HTML print view...');
            
            // Apply filters to inventory data
            let filteredInventory = this.inventory;
            
            if (filters.category && filters.category !== 'all') {
                filteredInventory = filteredInventory.filter(item => 
                    item.category && item.category.toLowerCase() === filters.category.toLowerCase()
                );
            }
            
            if (filters.location && filters.location !== 'all') {
                filteredInventory = filteredInventory.filter(item => 
                    item.location && item.location.toLowerCase() === filters.location.toLowerCase()
                );
            }
            
            if (filters.supplier && filters.supplier !== 'all') {
                filteredInventory = filteredInventory.filter(item => 
                    item.supplier && item.supplier.toLowerCase() === filters.supplier.toLowerCase()
                );
            }
            
            if (filters.stockStatus && filters.stockStatus !== 'all') {
                filteredInventory = filteredInventory.filter(item => {
                    const quantity = parseInt(item.quantity) || 0;
                    const minQuantity = parseInt(item.minQuantity) || 0;
                    
                    switch (filters.stockStatus) {
                        case 'low':
                            return minQuantity > 0 && quantity <= minQuantity && quantity > 0;
                        case 'out':
                            return quantity === 0;
                        case 'adequate':
                            return quantity > minQuantity || minQuantity === 0;
                        default:
                            return true;
                    }
                });
            }

            // Store data in localStorage for the print view
            localStorage.setItem('inventoryPrintData', JSON.stringify(filteredInventory));
            localStorage.setItem('inventoryPrintFilters', JSON.stringify(filters));

            // Open print view in new window
            const printWindow = window.open('inventory-print-view.html', 'inventoryPrint', 
                'width=1200,height=800,scrollbars=yes,resizable=yes');

            if (!printWindow) {
                this.showError('Please allow popups to generate the print view');
                return;
            }

            this.showSuccess('Inventory report print view opened successfully!');

        } catch (error) {
            console.error('Error generating inventory HTML print view:', error);
            this.showError('Error generating inventory print view: ' + error.message);
        }
    }

    /**
     * Generate low stock report using HTML print view
     */
    generateLowStockReportHTMLPrint() {
        try {
            console.log('[ReportsManager] Generating low stock HTML print view...');
            
            // Filter for low stock items
            const lowStockItems = this.inventory.filter(item => {
                const quantity = parseInt(item.quantity) || 0;
                const minQuantity = parseInt(item.minQuantity) || 0;
                return quantity === 0 || (minQuantity > 0 && quantity <= minQuantity);
            });

            // Store data in localStorage for the print view
            localStorage.setItem('lowStockPrintData', JSON.stringify(lowStockItems));

            // Open print view in new window
            const printWindow = window.open('low-stock-print-view.html', 'lowStockPrint', 
                'width=1200,height=800,scrollbars=yes,resizable=yes');

            if (!printWindow) {
                this.showError('Please allow popups to generate the print view');
                return;
            }

            this.showSuccess('Low stock report print view opened successfully!');

        } catch (error) {
            console.error('Error generating low stock HTML print view:', error);
            this.showError('Error generating low stock print view: ' + error.message);
        }
    }

    /**
     * Generate supplier report using HTML print view
     */
    generateSupplierReportHTMLPrint() {
        try {
            console.log('[ReportsManager] Generating supplier HTML print view...');

            // Store data in localStorage for the print view
            localStorage.setItem('supplierPrintData', JSON.stringify(this.inventory));

            // Open print view in new window
            const printWindow = window.open('supplier-print-view.html', 'supplierPrint', 
                'width=1200,height=800,scrollbars=yes,resizable=yes');

            if (!printWindow) {
                this.showError('Please allow popups to generate the print view');
                return;
            }

            this.showSuccess('Supplier report print view opened successfully!');

        } catch (error) {
            console.error('Error generating supplier HTML print view:', error);
            this.showError('Error generating supplier print view: ' + error.message);
        }
    }

    /**
     * Generate fast order report using HTML print view (replaces PDF version)
     */
    generateFastOrderReportHTMLPrint() {
        try {
            console.log('[ReportsManager] Generating fast order HTML print view...');
            
            // Filter for items that need to be ordered
            const orderItems = this.inventory.filter(item => {
                const quantity = parseInt(item.quantity) || 0;
                const minQuantity = parseInt(item.minQuantity) || 0;
                return quantity === 0 || (minQuantity > 0 && quantity <= minQuantity);
            }).sort((a, b) => {
                // Sort by urgency: out of stock first, then by shortage percentage
                const aQty = parseInt(a.quantity) || 0;
                const bQty = parseInt(b.quantity) || 0;
                if (aQty === 0 && bQty > 0) return -1; // a is out of stock, prioritize
                if (bQty === 0 && aQty > 0) return 1;  // b is out of stock, prioritize
                return aQty - bQty; // Both have stock, show lowest first
            });

            if (orderItems.length === 0) {
                this.showError('No items need to be ordered');
                return;
            }

            // Prepare data for printing
            const printData = orderItems.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                minQuantity: item.minQuantity,
                location: item.location,
                supplier: item.supplier,
                cost: item.cost,
                shortage: Math.max(0, (item.minQuantity || 0) - (item.quantity || 0))
            }));

            // Store data for print view
            localStorage.setItem('fastOrderPrintData', JSON.stringify(printData));

            // Open print view
            const printWindow = window.open(
                `fast-order-print-view.html?timestamp=${Date.now()}`,
                '_blank',
                'width=1200,height=800,scrollbars=yes,resizable=yes'
            );

            if (printWindow) {
                this.showSuccess('Fast order report print view opened successfully!');
            } else {
                this.showError('Failed to open print window. Please check popup blocker settings.');
            }

        } catch (error) {
            console.error('Error generating fast order HTML print view:', error);
            this.showError('Error generating fast order print view: ' + error.message);
        }
    }

    /**
     * Generate QR codes for ordered products by supplier using HTML print view
     */
    generateOrderQRCodesBySupplierHTMLPrint(supplierName = '') {
        try {
            // Validate data availability
            if (!this.orders || this.orders.length === 0) {
                this.showError('No order data available. Please wait for data to load and try again.');
                console.warn('Reports Manager: No order data available for Order QR generation');
                return;
            }

            if (!this.inventory || this.inventory.length === 0) {
                this.showError('No inventory data available. Please wait for data to load and try again.');
                console.warn('Reports Manager: No inventory data available for Order QR generation');
                return;
            }

            // Filter orders by supplier if specified, and only include pending/backordered orders
            const relevantOrders = this.orders.filter(order => {
                const orderSupplier = order.supplier || 'Unknown';
                const matchesSupplier = !supplierName || orderSupplier === supplierName;
                const isPendingOrBackordered = ['pending', 'backordered', 'ordered'].includes(order.status?.toLowerCase());
                return matchesSupplier && isPendingOrBackordered && order.productId;
            });

            if (relevantOrders.length === 0) {
                this.showError(`No pending or backordered orders found${supplierName ? ` for supplier: ${supplierName}` : ''}`);
                return;
            }

            // Get product IDs from orders and find corresponding inventory items
            const productIds = [...new Set(relevantOrders.map(order => order.productId))];
            const orderedProducts = this.inventory.filter(item => productIds.includes(item.id));

            if (orderedProducts.length === 0) {
                this.showError('No matching products found for the selected orders');
                return;
            }

            console.log(`Preparing Order QR print for ${orderedProducts.length} products${supplierName ? ` from supplier: ${supplierName}` : ''}`);

            const printData = orderedProducts.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                location: item.location,
                cost: item.cost,
                supplier: item.supplier,
                image: item.image || item.imageUrl || item.imageURL || item.img || item.photo || '',
                category: item.category,
                minQuantity: item.minQuantity,
                orderStatus: 'Ordered'
            }));

            // Store data in localStorage for the print view
            localStorage.setItem('printData', JSON.stringify(printData));

            console.log('Storing Order QR print data:', {
                totalItems: printData.length,
                supplier: supplierName || 'All Suppliers',
                sampleItem: printData[0] || 'No items'
            });

            // Open print view in new window
            const printWindow = window.open(
                `qr-print-view.html?type=orders&supplier=${encodeURIComponent(supplierName || 'All Suppliers')}&timestamp=${Date.now()}`,
                '_blank',
                'width=1200,height=800,scrollbars=yes,resizable=yes'
            );

            if (printWindow) {
                this.showSuccess(`Order QR print view opened for ${orderedProducts.length} products! Use Ctrl+P or Cmd+P to print as PDF`);
            } else {
                this.showError('Failed to open print window. Please check popup blocker settings.');
            }

        } catch (error) {
            console.error('Error generating Order QR codes by supplier:', error);
            this.showError('Error generating Order QR codes: ' + error.message);
        }
    }

    /**
     * Generate QR codes for all pending/backordered items using HTML print view
     */
    generatePendingOrdersQRHTMLPrint() {
        try {
            // Validate data availability
            if (!this.orders || this.orders.length === 0) {
                this.showError('No order data available. Please wait for data to load and try again.');
                console.warn('Reports Manager: No order data available for Pending Orders QR generation');
                return;
            }

            if (!this.inventory || this.inventory.length === 0) {
                this.showError('No inventory data available. Please wait for data to load and try again.');
                console.warn('Reports Manager: No inventory data available for Pending Orders QR generation');
                return;
            }

            // Filter orders for pending and backordered status
            const pendingOrders = this.orders.filter(order => {
                const status = order.status?.toLowerCase();
                return ['pending', 'backordered', 'ordered'].includes(status) && order.productId;
            });

            if (pendingOrders.length === 0) {
                this.showError('No pending or backordered orders found');
                return;
            }

            // Get unique product IDs from pending orders
            const productIds = [...new Set(pendingOrders.map(order => order.productId))];
            const pendingProducts = this.inventory.filter(item => productIds.includes(item.id));

            if (pendingProducts.length === 0) {
                this.showError('No matching products found for pending/backordered orders');
                return;
            }

            console.log(`Preparing Pending Orders QR print for ${pendingProducts.length} products`);

            const printData = pendingProducts.map(item => {
                // Find the corresponding order to get additional context
                const order = pendingOrders.find(o => o.productId === item.id);
                return {
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    location: item.location,
                    cost: item.cost,
                    supplier: item.supplier,
                    image: item.image || item.imageUrl || item.imageURL || item.img || item.photo || '',
                    category: item.category,
                    minQuantity: item.minQuantity,
                    orderStatus: order?.status || 'Pending',
                    orderQuantity: order?.quantity || 'Unknown'
                };
            });

            // Store data in localStorage for the print view
            localStorage.setItem('printData', JSON.stringify(printData));

            console.log('Storing Pending Orders QR print data:', {
                totalItems: printData.length,
                pendingOrdersCount: pendingOrders.length,
                sampleItem: printData[0] || 'No items'
            });

            // Open print view in new window
            const printWindow = window.open(
                `qr-print-view.html?type=pending&timestamp=${Date.now()}`,
                '_blank',
                'width=1200,height=800,scrollbars=yes,resizable=yes'
            );

            if (printWindow) {
                this.showSuccess(`Pending/Backordered QR print view opened for ${pendingProducts.length} products! Use Ctrl+P or Cmd+P to print as PDF`);
            } else {
                this.showError('Failed to open print window. Please check popup blocker settings.');
            }

        } catch (error) {
            console.error('Error generating Pending Orders QR codes:', error);
            this.showError('Error generating Pending Orders QR codes: ' + error.message);
        }
    }

    /**
     * Generate product usage chart (for trends section)
     */
    generateProductUsageChart(productId) {
        try {
            console.log('[ReportsManager] Generating product usage chart for:', productId);
            
            if (!productId) {
                console.warn('[ReportsManager] No product ID provided for usage chart');
                return;
            }

            // Find the product in inventory
            const product = this.inventory.find(item => item.id === productId);
            if (!product) {
                console.warn('[ReportsManager] Product not found:', productId);
                this.showError('Product not found');
                return;
            }

            // For now, we'll create a simple chart showing current vs minimum quantity
            // In a real implementation, you'd track usage history over time
            const chartData = {
                labels: ['Current Stock', 'Minimum Stock', 'Recommended Stock'],
                datasets: [{
                    label: product.name || 'Product',
                    data: [
                        parseInt(product.quantity) || 0,
                        parseInt(product.minQuantity) || 0,
                        Math.max(parseInt(product.minQuantity) || 0, parseInt(product.quantity) || 0) * 1.5
                    ],
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)'
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)'
                    ],
                    borderWidth: 1
                }]
            };

            // Try to find chart canvas element
            const chartCanvas = document.getElementById('productUsageChart');
            if (!chartCanvas) {
                console.warn('[ReportsManager] Chart canvas not found');
                this.showError('Chart canvas not available');
                return;
            }

            // Check if Chart.js is available
            if (typeof Chart === 'undefined') {
                console.warn('[ReportsManager] Chart.js library not available');
                this.showError('Chart library not loaded');
                return;
            }

            // Destroy existing chart if it exists
            if (window.productUsageChartInstance) {
                window.productUsageChartInstance.destroy();
            }

            // Create new chart
            window.productUsageChartInstance = new Chart(chartCanvas, {
                type: 'bar',
                data: chartData,
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: `Stock Analysis: ${product.name || 'Product'}`
                        },
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Quantity'
                            }
                        }
                    }
                }
            });

            console.log('[ReportsManager] Product usage chart created successfully');
            this.showSuccess(`Chart generated for ${product.name}`);

        } catch (error) {
            console.error('[ReportsManager] Error generating product usage chart:', error);
            this.showError('Error generating chart: ' + error.message);
        }
    }

    /**
     * Email inventory report as HTML
     */
    emailInventoryReport() {
        try {
            console.log('[ReportsManager] Preparing inventory report for email...');
            
            // Generate HTML content for email
            const inventoryHTML = this.generateInventoryHTMLForEmail();
            
            if (!inventoryHTML) {
                this.showError('Failed to generate inventory report for email');
                return;
            }

            // Create email content
            const emailContent = {
                subject: `Inventory Report - ${new Date().toLocaleDateString()}`,
                body: inventoryHTML
            };

            this.sendEmailReport(emailContent);

        } catch (error) {
            console.error('[ReportsManager] Error emailing inventory report:', error);
            this.showError('Error emailing inventory report: ' + error.message);
        }
    }

    /**
     * Email low stock report as HTML
     */
    emailLowStockReport() {
        try {
            console.log('[ReportsManager] Preparing low stock report for email...');
            
            const lowStockItems = this.inventory.filter(item => {
                const quantity = parseInt(item.quantity) || 0;
                const minQuantity = parseInt(item.minQuantity) || 0;
                return quantity === 0 || (minQuantity > 0 && quantity <= minQuantity);
            });

            if (lowStockItems.length === 0) {
                this.showError('No low stock items found');
                return;
            }

            const lowStockHTML = this.generateLowStockHTMLForEmail(lowStockItems);
            
            const emailContent = {
                subject: `Low Stock Alert - ${lowStockItems.length} Items - ${new Date().toLocaleDateString()}`,
                body: lowStockHTML
            };

            this.sendEmailReport(emailContent);

        } catch (error) {
            console.error('[ReportsManager] Error emailing low stock report:', error);
            this.showError('Error emailing low stock report: ' + error.message);
        }
    }

    /**
     * Email order report as HTML
     */
    emailOrderReport() {
        try {
            console.log('[ReportsManager] Preparing order report for email...');
            
            const recentOrders = this.orders
                .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
                .slice(0, 15);

            if (recentOrders.length === 0) {
                this.showError('No orders found');
                return;
            }

            const orderHTML = this.generateOrderHTMLForEmail(recentOrders);
            
            const emailContent = {
                subject: `Order Report - ${recentOrders.length} Recent Orders - ${new Date().toLocaleDateString()}`,
                body: orderHTML
            };

            this.sendEmailReport(emailContent);

        } catch (error) {
            console.error('[ReportsManager] Error emailing order report:', error);
            this.showError('Error emailing order report: ' + error.message);
        }
    }

    /**
     * Email supplier report as HTML
     */
    emailSupplierReport() {
        try {
            console.log('[ReportsManager] Preparing supplier report for email...');
            
            const supplierHTML = this.generateSupplierHTMLForEmail();
            
            const emailContent = {
                subject: `Supplier Report - ${new Date().toLocaleDateString()}`,
                body: supplierHTML
            };

            this.sendEmailReport(emailContent);

        } catch (error) {
            console.error('[ReportsManager] Error emailing supplier report:', error);
            this.showError('Error emailing supplier report: ' + error.message);
        }
    }

    /**
     * Email fast order report as HTML
     */
    emailFastOrderReport() {
        try {
            console.log('[ReportsManager] Preparing fast order report for email...');
            
            const orderItems = this.inventory.filter(item => {
                const quantity = parseInt(item.quantity) || 0;
                const minQuantity = parseInt(item.minQuantity) || 0;
                return quantity === 0 || (minQuantity > 0 && quantity <= minQuantity);
            });

            if (orderItems.length === 0) {
                this.showError('No items need to be ordered');
                return;
            }

            const fastOrderHTML = this.generateFastOrderHTMLForEmail(orderItems);
            
            const emailContent = {
                subject: `Fast Order Report - ${orderItems.length} Items Need Ordering - ${new Date().toLocaleDateString()}`,
                body: fastOrderHTML
            };

            this.sendEmailReport(emailContent);

        } catch (error) {
            console.error('[ReportsManager] Error emailing fast order report:', error);
            this.showError('Error emailing fast order report: ' + error.message);
        }
    }

    /**
     * Send email report using mailto (browser default)
     */
    sendEmailReport(emailContent) {
        try {
            // Create mailto link
            const subject = encodeURIComponent(emailContent.subject);
            const body = encodeURIComponent(emailContent.body);
            const mailtoLink = `mailto:?subject=${subject}&body=${body}`;

            // Open email client
            window.open(mailtoLink);
            
            this.showSuccess('Email client opened with report content. You can modify recipients and send.');

        } catch (error) {
            console.error('[ReportsManager] Error opening email client:', error);
            this.showError('Error opening email client: ' + error.message);
        }
    }

    /**
     * Generate inventory HTML for email
     */
    generateInventoryHTMLForEmail() {
        const date = new Date().toLocaleDateString();
        let html = `INVENTORY REPORT - ${date}\n\n`;
        html += `Total Products: ${this.inventory.length}\n\n`;
        html += `INVENTORY DETAILS:\n`;
        html += `${'='.repeat(50)}\n\n`;

        this.inventory.slice(0, 50).forEach((item, index) => {
            html += `${index + 1}. ${item.name || 'Unnamed Product'}\n`;
            html += `   ID: ${item.id || 'N/A'}\n`;
            html += `   Quantity: ${item.quantity || 0}\n`;
            html += `   Location: ${item.location || 'N/A'}\n`;
            html += `   Supplier: ${item.supplier || 'N/A'}\n`;
            html += `   Cost: $${item.cost || '0.00'}\n\n`;
        });

        if (this.inventory.length > 50) {
            html += `... and ${this.inventory.length - 50} more items\n\n`;
        }

        html += `Report generated on ${new Date().toLocaleString()}\n`;
        return html;
    }

    /**
     * Generate low stock HTML for email
     */
    generateLowStockHTMLForEmail(lowStockItems) {
        const date = new Date().toLocaleDateString();
        let html = `LOW STOCK ALERT - ${date}\n\n`;
        html += `URGENT: ${lowStockItems.length} items are low on stock or out of stock!\n\n`;
        html += `LOW STOCK ITEMS:\n`;
        html += `${'='.repeat(50)}\n\n`;

        lowStockItems.forEach((item, index) => {
            const status = (item.quantity || 0) === 0 ? 'OUT OF STOCK' : 'LOW STOCK';
            html += `${index + 1}. ${item.name || 'Unnamed Product'} - ${status}\n`;
            html += `   Current Quantity: ${item.quantity || 0}\n`;
            html += `   Minimum Required: ${item.minQuantity || 0}\n`;
            html += `   Supplier: ${item.supplier || 'N/A'}\n`;
            html += `   Location: ${item.location || 'N/A'}\n\n`;
        });

        html += `Please review and place orders as needed.\n`;
        html += `Report generated on ${new Date().toLocaleString()}\n`;
        return html;
    }

    /**
     * Generate order HTML for email
     */
    generateOrderHTMLForEmail(orders) {
        const date = new Date().toLocaleDateString();
        let html = `ORDER REPORT - ${date}\n\n`;
        html += `Recent Orders: ${orders.length}\n\n`;
        html += `ORDER DETAILS:\n`;
        html += `${'='.repeat(50)}\n\n`;

        orders.forEach((order, index) => {
            html += `${index + 1}. Order ID: ${order.id || 'N/A'}\n`;
            html += `   Product: ${order.productName || 'Unknown Product'}\n`;
            html += `   Quantity: ${order.quantity || 0}\n`;
            html += `   Status: ${(order.status || 'pending').toUpperCase()}\n`;
            html += `   Date: ${new Date(order.dateCreated).toLocaleString()}\n`;
            html += `   Supplier: ${order.supplier || 'N/A'}\n\n`;
        });

        html += `Report generated on ${new Date().toLocaleString()}\n`;
        return html;
    }

    /**
     * Generate supplier HTML for email
     */
    generateSupplierHTMLForEmail() {
        const date = new Date().toLocaleDateString();
        let html = `SUPPLIER REPORT - ${date}\n\n`;
        
        // Group inventory by supplier
        const supplierData = {};
        this.inventory.forEach(item => {
            const supplier = item.supplier || 'Unknown';
            if (!supplierData[supplier]) {
                supplierData[supplier] = [];
            }
            supplierData[supplier].push(item);
        });

        html += `SUPPLIER BREAKDOWN:\n`;
        html += `${'='.repeat(50)}\n\n`;

        Object.keys(supplierData).forEach(supplier => {
            const items = supplierData[supplier];
            const totalValue = items.reduce((sum, item) => sum + (parseFloat(item.cost) || 0) * (parseInt(item.quantity) || 0), 0);
            
            html += `${supplier} (${items.length} products, $${totalValue.toFixed(2)} total value)\n`;
            html += `-`.repeat(30) + `\n`;
            
            items.slice(0, 10).forEach(item => {
                html += `  • ${item.name || 'Unnamed'} - Qty: ${item.quantity || 0} - $${item.cost || '0.00'}\n`;
            });
            
            if (items.length > 10) {
                html += `  ... and ${items.length - 10} more items\n`;
            }
            html += `\n`;
        });

        html += `Report generated on ${new Date().toLocaleString()}\n`;
        return html;
    }

    /**
     * Generate fast order HTML for email
     */
    generateFastOrderHTMLForEmail(orderItems) {
        const date = new Date().toLocaleDateString();
        let html = `FAST ORDER REPORT - ${date}\n\n`;
        html += `ITEMS TO ORDER: ${orderItems.length}\n\n`;
        html += `ORDER LIST:\n`;
        html += `${'='.repeat(50)}\n\n`;

        orderItems.forEach((item, index) => {
            const shortage = Math.max(0, (item.minQuantity || 0) - (item.quantity || 0));
            html += `${index + 1}. ${item.name || 'Unnamed Product'}\n`;
            html += `   Current Stock: ${item.quantity || 0}\n`;
            html += `   Minimum Required: ${item.minQuantity || 0}\n`;
            html += `   Shortage: ${shortage}\n`;
            html += `   Supplier: ${item.supplier || 'N/A'}\n`;
            html += `   Cost per unit: $${item.cost || '0.00'}\n`;
            html += `   Location: ${item.location || 'N/A'}\n\n`;
        });

        html += `Please place orders for the above items.\n`;
        html += `Report generated on ${new Date().toLocaleString()}\n`;
        return html;
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
            window.uiEnhancementManager.showToast(message, 'success');
        } else {
            console.log('Success:', message);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        if (typeof window.uiEnhancementManager !== 'undefined' && window.uiEnhancementManager.showToast) {
            window.uiEnhancementManager.showToast(message, 'error');
        } else {
            console.error('Error:', message);
            alert('Error: ' + message);
        }
    }
}

export const reportsManager = new ReportsManager();
