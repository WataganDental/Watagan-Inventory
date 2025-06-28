// Enhanced Firebase functions with better error handling and performance
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

// Audit logging function
async function logAuditEvent(eventType, collection, documentId, data, userId) {
  try {
    await getFirestore().collection('audit_logs').add({
      eventType,
      collection,
      documentId,
      data: data || null,
      userId,
      timestamp: FieldValue.serverTimestamp(),
      ip: null // Would need to be passed from client context in real scenario
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging shouldn't break main functionality
  }
}

// Enhanced inventory update with audit logging
exports.updateInventoryOnOrderCreation = onDocumentCreated(
  { region: "us-central1" },
  "orders/{orderId}",
  async (event) => {
    const snap = event.data;
    const orderData = snap.data();
    const { productId, quantity: quantitySold, userId } = orderData;

    if (!productId || typeof quantitySold !== "number" || quantitySold <= 0) {
      console.error("Invalid order data:", orderData);
      return null;
    }

    const inventoryRef = getFirestore().collection("inventory").doc(productId);

    try {
      await getFirestore().runTransaction(async (transaction) => {
        const productDoc = await transaction.get(inventoryRef);
        if (!productDoc.exists) {
          throw new Error(`Product with ID ${productId} not found in inventory.`);
        }

        const currentData = productDoc.data();
        const newQuantity = (currentData.quantity || 0) - quantitySold;

        if (newQuantity < 0) {
          console.warn(`Order ${event.params.orderId} would result in negative inventory for product ${productId}`);
          // Still allow the transaction but log the warning
        }

        transaction.update(inventoryRef, {
          quantity: newQuantity,
          lastUpdated: FieldValue.serverTimestamp(),
          lastUpdatedBy: userId || 'system'
        });

        // Log the audit event
        await logAuditEvent('inventory_update', 'inventory', productId, {
          oldQuantity: currentData.quantity,
          newQuantity,
          changeAmount: -quantitySold,
          reason: 'order_fulfillment',
          orderId: event.params.orderId
        }, userId || 'system');
      });

      console.log(`Inventory updated for product ${productId} by -${quantitySold}. OrderId: ${event.params.orderId}`);
      return null;
    } catch (error) {
      console.error(`Error updating inventory for product ${productId}:`, error);
      
      // Log the error for monitoring
      await logAuditEvent('inventory_update_error', 'inventory', productId, {
        error: error.message,
        orderId: event.params.orderId,
        quantitySold
      }, userId || 'system');
      
      return null;
    }
  }
);

// Enhanced user management with better error handling
exports.listUsersAndRoles = onCall(
  { region: "us-central1" },
  async (context) => {
    // Validate authentication
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const callerUid = context.auth.uid;

    try {
      // Check caller permissions
      const userRoleDoc = await getFirestore().collection("user_roles").doc(callerUid).get();
      
      if (!userRoleDoc.exists || userRoleDoc.data().role !== "admin") {
        console.warn(`Unauthorized access attempt by user ${callerUid}`);
        await logAuditEvent('unauthorized_access_attempt', 'user_roles', callerUid, {
          action: 'list_users_and_roles',
          currentRole: userRoleDoc.exists ? userRoleDoc.data().role : 'no_role'
        }, callerUid);
        throw new HttpsError("permission-denied", "Admin privileges required.");
      }

      // List users with pagination for better performance
      const listUsersResult = await getAuth().listUsers(1000);
      
      // Batch fetch user roles for efficiency
      const roleRefs = listUsersResult.users.map(user => 
        getFirestore().collection("user_roles").doc(user.uid)
      );
      
      const roleDocs = await getFirestore().getAll(...roleRefs);
      const roleMap = new Map();
      
      roleDocs.forEach(doc => {
        if (doc.exists) {
          roleMap.set(doc.id, doc.data().role);
        }
      });

      const usersWithRoles = listUsersResult.users.map(userRecord => ({
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        currentRole: roleMap.get(userRecord.uid) || 'staff',
        disabled: userRecord.disabled,
        emailVerified: userRecord.emailVerified,
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime
      }));

      // Log successful admin action
      await logAuditEvent('admin_action', 'users', 'list_all', {
        userCount: usersWithRoles.length,
        action: 'list_users_and_roles'
      }, callerUid);

      return { 
        users: usersWithRoles,
        hasNextPage: !!listUsersResult.pageToken
      };
      
    } catch (error) {
      console.error("Error in listUsersAndRoles:", error);
      
      // Log the error
      await logAuditEvent('function_error', 'users', 'list_all', {
        error: error.message,
        function: 'listUsersAndRoles'
      }, callerUid);

      // Re-throw HttpsErrors as-is, wrap other errors
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError('internal', `Failed to list users: ${error.message}`);
    }
  }
);

// New function for updating user roles with validation
exports.updateUserRole = onCall(
  { region: "us-central1" },
  async (context) => {
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { targetUserId, newRole } = context.data;
    const callerUid = context.auth.uid;

    // Validate input
    if (!targetUserId || !newRole) {
      throw new HttpsError("invalid-argument", "Target user ID and new role are required.");
    }

    if (!['admin', 'staff'].includes(newRole)) {
      throw new HttpsError("invalid-argument", "Role must be 'admin' or 'staff'.");
    }

    try {
      // Check caller permissions
      const userRoleDoc = await getFirestore().collection("user_roles").doc(callerUid).get();
      
      if (!userRoleDoc.exists || userRoleDoc.data().role !== "admin") {
        throw new HttpsError("permission-denied", "Admin privileges required.");
      }

      // Prevent self-demotion from admin
      if (callerUid === targetUserId && newRole !== 'admin') {
        throw new HttpsError("permission-denied", "Cannot remove your own admin privileges.");
      }

      // Update the role
      const targetRoleRef = getFirestore().collection("user_roles").doc(targetUserId);
      await targetRoleRef.set({ role: newRole }, { merge: true });

      // Log the role change
      await logAuditEvent('role_change', 'user_roles', targetUserId, {
        newRole,
        changedBy: callerUid
      }, callerUid);

      return { success: true, message: `User role updated to ${newRole}` };
      
    } catch (error) {
      console.error("Error updating user role:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError('internal', `Failed to update user role: ${error.message}`);
    }
  }
);

// Function to clean up old audit logs (run periodically)
exports.cleanupAuditLogs = onCall(
  { region: "us-central1" },
  async (context) => {
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const callerUid = context.auth.uid;
    
    try {
      // Check caller permissions
      const userRoleDoc = await getFirestore().collection("user_roles").doc(callerUid).get();
      
      if (!userRoleDoc.exists || userRoleDoc.data().role !== "admin") {
        throw new HttpsError("permission-denied", "Admin privileges required.");
      }

      // Delete audit logs older than 90 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const oldLogsQuery = getFirestore()
        .collection('audit_logs')
        .where('timestamp', '<', cutoffDate)
        .limit(500); // Process in batches

      const snapshot = await oldLogsQuery.get();
      
      if (snapshot.empty) {
        return { success: true, deletedCount: 0, message: 'No old logs to delete' };
      }

      const batch = getFirestore().batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      await logAuditEvent('audit_cleanup', 'audit_logs', 'batch_delete', {
        deletedCount: snapshot.size,
        cutoffDate: cutoffDate.toISOString()
      }, callerUid);

      return { 
        success: true, 
        deletedCount: snapshot.size,
        message: `Deleted ${snapshot.size} old audit logs`
      };
      
    } catch (error) {
      console.error("Error cleaning up audit logs:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError('internal', `Failed to cleanup audit logs: ${error.message}`);
    }
  }
);
