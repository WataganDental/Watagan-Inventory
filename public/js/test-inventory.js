// Basic test setup for the inventory module
import { InventoryManager } from './modules/inventory.js';

// Mock Firebase for testing
const mockFirebase = {
    collection: (name) => ({
        get: () => Promise.resolve({
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
                        cost: 15.50,
                        minQuantity: 8,
                        supplier: 'Another Supplier',
                        location: 'Storage'
                    })
                }
            ]
        }),
        doc: (id) => ({
            set: (data) => {
                console.log('Mock: Setting document', id, data);
                return Promise.resolve();
            },
            update: (data) => {
                console.log('Mock: Updating document', id, data);
                return Promise.resolve();
            },
            delete: () => {
                console.log('Mock: Deleting document', id);
                return Promise.resolve();
            }
        })
    })
};

const mockStorage = {
    ref: (path) => ({
        delete: () => {
            console.log('Mock: Deleting file at', path);
            return Promise.resolve();
        }
    })
};

// Test the InventoryManager
async function testInventoryManager() {
    console.log('=== Testing InventoryManager ===');
    
    const inventoryManager = new InventoryManager(mockFirebase, mockStorage);
    
    try {
        // Test loading inventory
        console.log('\n1. Testing loadInventory...');
        const inventory = await inventoryManager.loadInventory();
        console.log('✅ Loaded inventory:', inventory.length, 'items');
        console.log('First item:', inventory[0]);
        
        // Test filtering
        console.log('\n2. Testing filterInventory...');
        const filtered = inventoryManager.filterInventory({
            supplier: 'Test Supplier'
        });
        console.log('✅ Filtered by supplier:', filtered.length, 'items');
        
        const searchFiltered = inventoryManager.filterInventory({
            search: 'product 1'
        });
        console.log('✅ Search filtered:', searchFiltered.length, 'items');
        
        // Test pagination
        console.log('\n3. Testing pagination...');
        const paged = inventoryManager.getPagedResults(inventory);
        console.log('✅ Paged results:', paged.length, 'items');
        
        // Test adding product
        console.log('\n4. Testing addProduct...');
        const newProductId = await inventoryManager.addProduct({
            name: 'New Test Product',
            quantity: 20,
            cost: 30.00,
            minQuantity: 10,
            supplier: 'New Supplier',
            location: 'Surgery 2'
        });
        console.log('✅ Added product with ID:', newProductId);
        
        // Test updating product
        console.log('\n5. Testing updateProduct...');
        await inventoryManager.updateProduct('test-1', {
            quantity: 15,
            cost: 28.99
        });
        console.log('✅ Updated product test-1');
        
        // Test deleting product
        console.log('\n6. Testing deleteProduct...');
        await inventoryManager.deleteProduct('test-2');
        console.log('✅ Deleted product test-2');
        
        console.log('\n🎉 All InventoryManager tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Test UUID generation
function testUUIDGeneration() {
    console.log('\n=== Testing UUID Generation ===');
    
    const inventoryManager = new InventoryManager(mockFirebase, mockStorage);
    
    const uuid1 = inventoryManager.generateUUID();
    const uuid2 = inventoryManager.generateUUID();
    
    console.log('UUID 1:', uuid1);
    console.log('UUID 2:', uuid2);
    
    // Check format
    const uuidPattern = /^[0-9a-f]{4}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}$/i;
    
    if (uuidPattern.test(uuid1) && uuidPattern.test(uuid2) && uuid1 !== uuid2) {
        console.log('✅ UUID generation works correctly');
    } else {
        console.error('❌ UUID generation failed');
        throw new Error('UUID generation test failed');
    }
}

// Run all tests
async function runTests() {
    try {
        await testInventoryManager();
        testUUIDGeneration();
        console.log('\n🚀 All tests completed successfully!');
    } catch (error) {
        console.error('\n💥 Tests failed:', error);
    }
}

// Export for use in browser console or test runner
if (typeof window !== 'undefined') {
    window.runInventoryTests = runTests;
    console.log('Tests loaded! Run window.runInventoryTests() to execute.');
} else {
    // Run tests if in Node.js environment
    runTests();
}
