const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.updateInventoryOnOrderCreation = functions.firestore
  .document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    const orderData = snap.data();
    const productId = orderData.productId;
    const quantitySold = orderData.quantity;

    if (!productId || typeof quantitySold !== 'number' || quantitySold <= 0) {
      console.log('Invalid order data: Missing productId or invalid quantitySold.', orderData);
      return null;
    }

    const inventoryRef = admin.firestore().collection('inventory').doc(productId);

    try {
      await admin.firestore().runTransaction(async (transaction) => {
        const productDoc = await transaction.get(inventoryRef);
        if (!productDoc.exists) {
          throw new Error(`Product with ID ${productId} not found in inventory.`);
        }

        // Using FieldValue.increment for atomic update
        transaction.update(inventoryRef, {
          quantity: admin.firestore.FieldValue.increment(-quantitySold)
        });
      });
      console.log(`Inventory updated for product ${productId} by -${quantitySold}. OrderId: ${context.params.orderId}`);
      return null;
    } catch (error) {
      console.error(`Error updating inventory for product ${productId}:`, error);
      // Optional: Add custom error reporting or retry logic
      // Re-throw the error if you want the function to report a failure
      // throw error;
      return null; // Or return a specific error response
    }
  });
