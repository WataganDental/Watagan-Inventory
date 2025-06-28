// Integration test for all modules
import { InventoryManager } from './public/js/modules/inventory.js';
import { QRCodeManager } from './public/js/modules/qrcode.js';
import { NotificationManager } from './public/js/modules/notifications.js';
import { PerformanceOptimizer } from './public/js/modules/performance.js';
import { SearchEngine } from './public/js/modules/search.js';
import { TestUtils, PerformanceMonitor } from './public/js/modules/testing.js';

// Mock Firebase and Storage
const mockFirebase = {
    collection: (name) => ({
        get: async () => ({
            docs: [
                {
                    data: () => ({
                        id: 'test-1',
                        name: 'Test Product 1',
                        quantity: 10,
                        cost: 25.99,
                        minQuantity: 5,
                        supplier: 'Test Supplier',
                        location: 'Surgery 1'
                    })
                },
                {
                    data: () => ({
                        id: 'test-2',
                        name: 'Test Product 2',
                        quantity: 3,
                        cost: 45.50,
                        minQuantity: 8,
                        supplier: 'Another Supplier',
                        location: 'Surgery 2'
                    })
                }
            ]
        }),
        doc: (id) => ({
            set: async (data) => {
                console.log(`Mock: Setting document ${id}`, data);
                return { id };
            },
            update: async (data) => {
                console.log(`Mock: Updating document ${id}`, data);
                return { id };
            },
            delete: async () => {
                console.log(`Mock: Deleting document ${id}`);
                return { id };
            }
        })
    })
};

const mockStorage = {
    ref: (path) => ({
        delete: async () => {
            console.log(`Mock: Deleting file at ${path}`);
            return true;
        }
    })
};

async function runIntegrationTests() {
    console.log('🧪 Starting Integration Tests...\n');
    
    let testResults = {
        passed: 0,
        failed: 0,
        total: 0
    };
    
    try {
        // Test 1: Initialize all modules
        console.log('1. Testing module initialization...');
        const inventoryManager = new InventoryManager(mockFirebase, mockStorage);
        const qrManager = new QRCodeManager();
        const notificationManager = new NotificationManager();
        const performanceOptimizer = new PerformanceOptimizer();
        const searchEngine = new SearchEngine();
        const testUtils = new TestUtils();
        const performanceMonitor = new PerformanceMonitor();
        
        console.log('✅ All modules initialized successfully');
        testResults.passed++;
        testResults.total++;
        
        // Test 2: Load inventory and test search integration
        console.log('\n2. Testing inventory loading and search integration...');
        const inventory = await inventoryManager.loadInventory();
        searchEngine.indexItems(inventory);
        
        const searchResults = searchEngine.search('Test Product', inventory);
        if (searchResults.length > 0) {
            console.log('✅ Search integration working');
            testResults.passed++;
        } else {
            console.log('❌ Search integration failed');
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 3: Test performance monitoring
        console.log('\n3. Testing performance monitoring...');
        performanceMonitor.startTimer('inventory-operation');
        await inventoryManager.loadInventory();
        const performanceTime = performanceMonitor.endTimer('inventory-operation');
        
        if (performanceTime > 0) {
            console.log(`✅ Performance monitoring working (${performanceTime}ms)`);
            testResults.passed++;
        } else {
            console.log('❌ Performance monitoring failed');
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 4: Test QR code generation
        console.log('\n4. Testing QR code generation...');
        try {
            const qrData = qrManager.generateQRData('test-product-1', 'Test Product', 10);
            if (qrData && qrData.id) {
                console.log('✅ QR code generation working');
                testResults.passed++;
            } else {
                console.log('❌ QR code generation failed');
                testResults.failed++;
            }
        } catch (error) {
            console.log('❌ QR code generation error:', error.message);
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 5: Test notification system
        console.log('\n5. Testing notification system...');
        try {
            const notification = notificationManager.createNotification('Test notification', 'info');
            if (notification && notification.message) {
                console.log('✅ Notification system working');
                testResults.passed++;
            } else {
                console.log('❌ Notification system failed');
                testResults.failed++;
            }
        } catch (error) {
            console.log('❌ Notification system error:', error.message);
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 6: Test filtering and pagination integration
        console.log('\n6. Testing filtering and pagination...');
        const filteredItems = inventoryManager.filterInventory({ search: 'Test' });
        const pagedResults = inventoryManager.getPagedResults(filteredItems);
        
        if (pagedResults.length > 0) {
            console.log('✅ Filtering and pagination working');
            testResults.passed++;
        } else {
            console.log('❌ Filtering and pagination failed');
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 7: Test CRUD operations
        console.log('\n7. Testing CRUD operations...');
        try {
            const newProductId = await inventoryManager.addProduct({
                name: 'Integration Test Product',
                quantity: 50,
                cost: 100,
                minQuantity: 10,
                supplier: 'Test Supplier',
                location: 'Test Location'
            });
            
            await inventoryManager.updateProduct(newProductId, { quantity: 45 });
            await inventoryManager.deleteProduct(newProductId);
            
            console.log('✅ CRUD operations working');
            testResults.passed++;
        } catch (error) {
            console.log('❌ CRUD operations failed:', error.message);
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 8: Test testing utilities
        console.log('\n8. Testing utilities...');
        try {
            const mockData = testUtils.generateMockProduct();
            if (mockData && mockData.name && mockData.id) {
                console.log('✅ Testing utilities working');
                testResults.passed++;
            } else {
                console.log('❌ Testing utilities failed');
                testResults.failed++;
            }
        } catch (error) {
            console.log('❌ Testing utilities error:', error.message);
            testResults.failed++;
        }
        testResults.total++;
        
    } catch (error) {
        console.error('❌ Integration test error:', error);
        testResults.failed++;
        testResults.total++;
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('🧪 INTEGRATION TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Total: ${testResults.total}`);
    console.log(`📈 Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
    
    if (testResults.failed === 0) {
        console.log('\n🎉 All integration tests passed! The modular system is working correctly.');
    } else {
        console.log('\n⚠️  Some integration tests failed. Please review the issues above.');
    }
    
    return testResults;
}

// Run the tests
runIntegrationTests().catch(console.error);
