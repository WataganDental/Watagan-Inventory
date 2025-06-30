// Enhanced Firebase functions with better error handling and performance
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https"); // Changed onCall to onRequest
const { HttpsError } = require("firebase-functions/v2/https"); // HttpsError is still useful
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const cors = require("cors")({ origin: true }); // Import and configure cors

initializeApp();

// Audit logging function
async function logAuditEvent(eventType, collection, documentId, data, userId, ipAddress = null) {
  try {
    await getFirestore().collection('audit_logs').add({
      eventType,
      collection,
      documentId,
      data: data || null,
      userId,
      timestamp: FieldValue.serverTimestamp(),
      ip: ipAddress
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
exports.listUsersAndRoles = onRequest(
  { region: "us-central1" },
  (req, res) => {
    // Aggressively handle OPTIONS requests first
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*'); // Or specific origin
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // Adjust as needed
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type'); // Adjust as needed
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }

    // For non-OPTIONS requests, proceed with CORS and then the main logic
    cors(req, res, async () => {
      // Authentication
      let callerUid;
      let decodedIdToken;
      const idToken = req.headers.authorization?.split("Bearer ")[1];

      if (!idToken) {
        console.warn("No ID token provided.");
        res.status(401).send({ error: "Unauthorized", message: "Authentication token required." });
        return;
      }

      try {
        decodedIdToken = await getAuth().verifyIdToken(idToken);
        callerUid = decodedIdToken.uid;
      } catch (error) {
        console.error("Error verifying ID token:", error);
        res.status(401).send({ error: "Unauthorized", message: "Invalid authentication token." });
        return;
      }
      
      const userIpAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      try {
        // Check caller permissions
        const userRoleDoc = await getFirestore().collection("user_roles").doc(callerUid).get();

        if (!userRoleDoc.exists || userRoleDoc.data().role !== "admin") {
          console.warn(`Unauthorized access attempt by user ${callerUid}`);
          await logAuditEvent('unauthorized_access_attempt', 'user_roles', callerUid, {
            action: 'list_users_and_roles',
            currentRole: userRoleDoc.exists ? userRoleDoc.data().role : 'no_role'
          }, callerUid, userIpAddress);
          res.status(403).send({ error: "Forbidden", message: "Admin privileges required." });
          return;
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
        }, callerUid, userIpAddress);

        res.status(200).send({
          users: usersWithRoles,
          hasNextPage: !!listUsersResult.pageToken
        });

      } catch (error) {
        console.error("Error in listUsersAndRoles:", error);

        // Log the error
        await logAuditEvent('function_error', 'users', 'list_all', {
          error: error.message,
          function: 'listUsersAndRoles'
        }, callerUid, userIpAddress);

        if (error.code === 'auth/insufficient-permission' || (error.message && error.message.toLowerCase().includes('permission denied'))) {
            res.status(500).send({ error: "Internal Server Error", message: "The function's service account has insufficient permission to list users." });
        } else {
            res.status(500).send({ error: "Internal Server Error", message: `Failed to list users: ${error.message}` });
        }
      }
    });
  }
);

// New function for updating user roles with validation
// Note: If this function is called from the client, it might also need CORS.
// For now, keeping it as onCall as per original structure, assuming client uses Firebase SDK.
// If it's also called via direct HTTP, it will need conversion to onRequest + CORS.
exports.updateUserRole = onRequest( // Changed to onRequest for consistency if client calls directly
  { region: "us-central1" }, // Manual CORS handling
  (req, res) => { // Non-async for initial CORS handling
    cors(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }
      let callerUid;
      let decodedIdToken;
      const idToken = req.headers.authorization?.split("Bearer ")[1];

      if (!idToken) {
        console.warn("No ID token provided for updateUserRole.");
        res.status(401).send({ error: "Unauthorized", message: "Authentication token required." });
        return;
      }

      try {
        decodedIdToken = await getAuth().verifyIdToken(idToken);
        callerUid = decodedIdToken.uid;
      } catch (error) {
        console.error("Error verifying ID token for updateUserRole:", error);
        res.status(401).send({ error: "Unauthorized", message: "Invalid authentication token." });
        return;
      }

      const { targetUserId, newRole } = req.body.data || req.body; // onRequest uses req.body
      const userIpAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Validate input
    if (!targetUserId || !newRole) {
      throw new HttpsError("invalid-argument", "Target user ID and new role are required.");
    }

    if (!['admin', 'staff'].includes(newRole)) {
      res.status(400).send({ error: "Invalid Argument", message: "Role must be 'admin' or 'staff'." });
      return;
    }

    try {
      // Check caller permissions
      const userRoleDoc = await getFirestore().collection("user_roles").doc(callerUid).get();
      
      if (!userRoleDoc.exists || userRoleDoc.data().role !== "admin") {
        await logAuditEvent('unauthorized_role_change_attempt', 'user_roles', targetUserId, {
          attemptedRole: newRole, attemptedBy: callerUid, reason: 'Caller not admin'
        }, callerUid, userIpAddress);
        res.status(403).send({ error: "Forbidden", message: "Admin privileges required." });
        return;
      }

      // Prevent self-demotion from admin
      if (callerUid === targetUserId && newRole !== 'admin') {
         await logAuditEvent('self_demotion_attempt', 'user_roles', targetUserId, {
          attemptedRole: newRole
        }, callerUid, userIpAddress);
        res.status(403).send({ error: "Forbidden", message: "Cannot remove your own admin privileges." });
        return;
      }

      // Update the role
      const targetRoleRef = getFirestore().collection("user_roles").doc(targetUserId);
      await targetRoleRef.set({ role: newRole }, { merge: true });

      // Log the role change
      await logAuditEvent('role_change', 'user_roles', targetUserId, {
        newRole,
        changedBy: callerUid
      }, callerUid, userIpAddress);

      res.status(200).send({ success: true, message: `User role updated to ${newRole}` });
      
    } catch (error) {
      console.error("Error updating user role:", error);
       await logAuditEvent('update_role_error', 'user_roles', targetUserId, {
        error: error.message, newRole, changedBy: callerUid
      }, callerUid, userIpAddress);
      res.status(500).send({ error: "Internal Server Error", message: `Failed to update user role: ${error.message}` });
    }
    });
  }
);

// Function to clean up old audit logs (run periodically)
// This function is likely called via a scheduler or manually, not direct client HTTP.
// If it were to be called via HTTP by a client, it would also need conversion to onRequest + CORS.
// For now, keeping it as onCall, assuming it's triggered by other means (e.g. PubSub scheduler, another function).
// For consistency and if there's any chance of direct HTTP call, converting it too.
exports.cleanupAuditLogs = onRequest(
  { region: "us-central1" }, // Manual CORS handling
  (req, res) => { // Non-async for initial CORS handling
    cors(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }
      let callerUid;
      let decodedIdToken;
      const idToken = req.headers.authorization?.split("Bearer ")[1];

      if (!idToken) {
        console.warn("No ID token provided for cleanupAuditLogs.");
        res.status(401).send({ error: "Unauthorized", message: "Authentication token required." });
        return;
      }

      try {
        decodedIdToken = await getAuth().verifyIdToken(idToken);
        callerUid = decodedIdToken.uid;
      } catch (error) {
        console.error("Error verifying ID token for cleanupAuditLogs:", error);
        res.status(401).send({ error: "Unauthorized", message: "Invalid authentication token." });
        return;
      }
      const userIpAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    try {
      // Check caller permissions
      const userRoleDoc = await getFirestore().collection("user_roles").doc(callerUid).get();
      
      if (!userRoleDoc.exists || userRoleDoc.data().role !== "admin") {
        await logAuditEvent('unauthorized_cleanup_attempt', 'audit_logs', 'all', {
            attemptedBy: callerUid
          }, callerUid, userIpAddress);
        res.status(403).send({ error: "Forbidden", message: "Admin privileges required." });
        return;
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
        res.status(200).send({ success: true, deletedCount: 0, message: 'No old logs to delete' });
        return;
      }

      const batch = getFirestore().batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      await logAuditEvent('audit_cleanup', 'audit_logs', 'batch_delete', {
        deletedCount: snapshot.size,
        cutoffDate: cutoffDate.toISOString()
      }, callerUid, userIpAddress);

      res.status(200).send({
        success: true, 
        deletedCount: snapshot.size,
        message: `Deleted ${snapshot.size} old audit logs`
      });
      
    } catch (error) {
      console.error("Error cleaning up audit logs:", error);
      await logAuditEvent('cleanup_logs_error', 'audit_logs', 'batch_delete', {
         error: error.message
        }, callerUid, userIpAddress);
      res.status(500).send({ error: "Internal Server Error", message: `Failed to cleanup audit logs: ${error.message}` });
    }
    });
  }
);
