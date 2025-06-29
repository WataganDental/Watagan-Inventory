// Simple test script to verify UI components
console.log('=== UI Integration Test ===');

// Test 1: Check if UI enhancement manager is available
import { uiEnhancementManager } from './js/modules/ui-enhancements.js';

if (uiEnhancementManager) {
    console.log('✓ UI Enhancement Manager loaded successfully');
    
    // Test dashboard stats
    const testData = [
        { quantity: 5, minQuantity: 10 },
        { quantity: 0, minQuantity: 5 },
        { quantity: 15, minQuantity: 10 }
    ];
    
    uiEnhancementManager.updateDashboardStats(testData);
    console.log('✓ Dashboard stats test completed');
    
    // Test toast notification
    uiEnhancementManager.showToast('Integration test successful!', 'success');
    console.log('✓ Toast notification test completed');
    
    // Test table row generation
    const testItem = {
        id: 'test-123',
        productName: 'Test Product',
        quantity: 10,
        minQuantity: 5,
        cost: 25.99,
        supplier: 'Test Supplier',
        location: 'Test Location'
    };
    
    const rowHTML = uiEnhancementManager.generateModernTableRow(testItem, 0);
    if (rowHTML.includes('Test Product')) {
        console.log('✓ Table row generation test completed');
    } else {
        console.error('✗ Table row generation test failed');
    }
    
} else {
    console.error('✗ UI Enhancement Manager not available');
}

console.log('=== Test Complete ===');
