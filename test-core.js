// Simple integration test focusing on Node.js compatible modules
import { InventoryManager } from './public/js/modules/inventory.js';

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

async function runCoreTests() {
    console.log('🧪 Starting Core Module Tests...\n');
    
    let testResults = {
        passed: 0,
        failed: 0,
        total: 0
    };
    
    try {
        // Test 1: Initialize inventory manager
        console.log('1. Testing InventoryManager initialization...');
        const inventoryManager = new InventoryManager(mockFirebase, mockStorage);
        console.log('✅ InventoryManager initialized successfully');
        testResults.passed++;
        testResults.total++;
        
        // Test 2: Load inventory
        console.log('\n2. Testing inventory loading...');
        const inventory = await inventoryManager.loadInventory();
        if (inventory.length === 2) {
            console.log('✅ Inventory loaded successfully:', inventory.length, 'items');
            testResults.passed++;
        } else {
            console.log('❌ Inventory loading failed');
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 3: Test filtering
        console.log('\n3. Testing inventory filtering...');
        const filteredItems = inventoryManager.filterInventory({ search: 'Test Product' });
        if (filteredItems.length === 2) {
            console.log('✅ Filtering working correctly');
            testResults.passed++;
        } else {
            console.log('❌ Filtering failed, expected 2 items, got:', filteredItems.length);
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 4: Test supplier filtering
        console.log('\n4. Testing supplier filtering...');
        const supplierFiltered = inventoryManager.filterInventory({ supplier: 'Test Supplier' });
        if (supplierFiltered.length === 1) {
            console.log('✅ Supplier filtering working correctly');
            testResults.passed++;
        } else {
            console.log('❌ Supplier filtering failed');
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 5: Test pagination
        console.log('\n5. Testing pagination...');
        const pagedResults = inventoryManager.getPagedResults(inventory);
        if (pagedResults.length === 2) {
            console.log('✅ Pagination working correctly');
            testResults.passed++;
        } else {
            console.log('❌ Pagination failed');
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 6: Test UUID generation
        console.log('\n6. Testing UUID generation...');
        const uuid1 = inventoryManager.generateUUID();
        const uuid2 = inventoryManager.generateUUID();
        if (uuid1 && uuid2 && uuid1 !== uuid2 && uuid1.includes('-')) {
            console.log('✅ UUID generation working correctly');
            console.log('Sample UUIDs:', uuid1, uuid2);
            testResults.passed++;
        } else {
            console.log('❌ UUID generation failed');
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 7: Test add product
        console.log('\n7. Testing add product...');
        const newProductId = await inventoryManager.addProduct({
            name: 'Integration Test Product',
            quantity: 50,
            cost: 100,
            minQuantity: 10,
            supplier: 'Test Supplier',
            location: 'Test Location'
        });
        if (newProductId) {
            console.log('✅ Add product working correctly, ID:', newProductId);
            testResults.passed++;
        } else {
            console.log('❌ Add product failed');
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 8: Test update product
        console.log('\n8. Testing update product...');
        try {
            await inventoryManager.updateProduct('test-1', { quantity: 45 });
            console.log('✅ Update product working correctly');
            testResults.passed++;
        } catch (error) {
            console.log('❌ Update product failed:', error.message);
            testResults.failed++;
        }
        testResults.total++;
        
        // Test 9: Test delete product
        console.log('\n9. Testing delete product...');
        try {
            await inventoryManager.deleteProduct('test-2');
            console.log('✅ Delete product working correctly');
            testResults.passed++;
        } catch (error) {
            console.log('❌ Delete product failed:', error.message);
            testResults.failed++;
        }
        testResults.total++;
        
    } catch (error) {
        console.error('❌ Core test error:', error);
        testResults.failed++;
        testResults.total++;
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('🧪 CORE MODULE TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Total: ${testResults.total}`);
    console.log(`📈 Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
    
    if (testResults.failed === 0) {
        console.log('\n🎉 All core tests passed! The InventoryManager is working correctly.');
        console.log('📝 Note: Browser-specific modules (QR, Notifications, etc.) need to be tested in a browser environment.');
    } else {
        console.log('\n⚠️  Some core tests failed. Please review the issues above.');
    }
    
    return testResults;
}

// Run the tests
runCoreTests().catch(console.error);
