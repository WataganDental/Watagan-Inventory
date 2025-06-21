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

exports.listUsersAndRoles = functions.https.onCall(async (data, context) => {
  // Check if the user calling the function is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const callerUid = context.auth.uid;

  // Check if the calling user is an admin by reading their role from Firestore
  try {
    const userRoleDoc = await admin.firestore().collection('user_roles').doc(callerUid).get();
    if (!userRoleDoc.exists || userRoleDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Caller is not an admin.');
    }
  } catch (error) {
    console.error('Error checking admin role for caller:', callerUid, error);
    throw new functions.https.HttpsError('internal', 'Could not verify admin privileges.');
  }

  // If admin, proceed to list users
  try {
    const listUsersResult = await admin.auth().listUsers(1000); // Max 1000 users per page
    const usersPromises = listUsersResult.users.map(async (userRecord) => {
      let userRole = 'staff'; // Default role if not found in user_roles
      try {
        const roleDoc = await admin.firestore().collection('user_roles').doc(userRecord.uid).get();
        if (roleDoc.exists && roleDoc.data().role) {
          userRole = roleDoc.data().role;
        } else if (!roleDoc.exists) {
          // Optionally, if a user exists in Auth but not in user_roles,
          // you could assign a default here, but it's better handled by client or specific logic.
          // For now, just defaulting to 'staff' if no specific role is set.
          console.log(`No role document found for user ${userRecord.uid}, defaulting to 'staff' in list.`);
        }
      } catch (roleError) {
        console.error(`Error fetching role for user ${userRecord.uid}:`, roleError);
        // Keep default role 'staff' in case of error fetching individual role
      }
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName, // Good to have if available
        currentRole: userRole,
        disabled: userRecord.disabled // Good to know if account is disabled
      };
    });

    const usersWithRoles = await Promise.all(usersPromises);

    // TODO: Implement pagination if expecting more than 1000 users.
    // listUsersResult.pageToken can be used for the next page.

    return { users: usersWithRoles };

  } catch (error) {
    console.error('Error listing users or their roles:', error);
    throw new functions.https.HttpsError('internal', 'Unable to list users and their roles.');
  }
});
