const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

exports.updateInventoryOnOrderCreation = onDocumentCreated(
  { region: "us-central1" },
  "orders/{orderId}",
  async (event) => {
    const snap = event.data;
    const orderData = snap.data();
    const productId = orderData.productId;
    const quantitySold = orderData.quantity;

    if (!productId || typeof quantitySold !== "number" || quantitySold <= 0) {
      console.log("Invalid order data: Missing productId or invalid quantitySold.", orderData);
      return null;
    }

    const inventoryRef = getFirestore().collection("inventory").doc(productId);

    try {
      await getFirestore().runTransaction(async (transaction) => {
        const productDoc = await transaction.get(inventoryRef);
        if (!productDoc.exists) {
          throw new Error(`Product with ID ${productId} not found in inventory.`);
        }

        transaction.update(inventoryRef, {
          quantity: FieldValue.increment(-quantitySold),
        });
      });
      console.log(`Inventory updated for product ${productId} by -${quantitySold}. OrderId: ${event.params.orderId}`);
      return null;
    } catch (error) {
      console.error(`Error updating inventory for product ${productId}:`, error);
      return null;
    }
  }
);

// Helper function to check for admin privileges
async function ensureAdmin(context) {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const callerUid = context.auth.uid;
  let userRoleDoc;
  try {
    userRoleDoc = await getFirestore().collection("user_roles").doc(callerUid).get();
  } catch (error) {
    console.error("Firestore error when checking admin role for caller:", callerUid, error);
    throw new HttpsError("internal", `Failed to retrieve user role information: ${error.message}`);
  }

  if (!userRoleDoc.exists || userRoleDoc.data().role !== "admin") {
    console.warn(
      `Permission denied for user ${callerUid}. Role: ${
        userRoleDoc.exists ? userRoleDoc.data().role : "document_does_not_exist"
      }`
    );
    throw new HttpsError("permission-denied", "Caller is not an admin.");
  }
  return true;
}

exports.bulkDeleteUsers = onCall(
  { region: "us-central1" },
  async (request) => {
    await ensureAdmin(request); // Check for admin privileges

    const uids = request.data.uids;
    if (!uids || !Array.isArray(uids) || uids.length === 0) {
      throw new HttpsError("invalid-argument", "UIDs must be a non-empty array.");
    }
    if (uids.length > 100) { // Firebase deleteUsers limit
        throw new HttpsError("invalid-argument", "Cannot delete more than 100 users at a time.");
    }

    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    try {
      const deleteUsersResult = await getAuth().deleteUsers(uids);
      successCount += deleteUsersResult.successCount;
      failureCount += deleteUsersResult.failureCount;
      deleteUsersResult.errors.forEach((err) => {
        console.error(`Failed to delete user ${uids[err.index]}: ${err.error.message}`);
        errors.push({ uid: uids[err.index], error: err.error.message });
      });
    } catch (error) {
      console.error("Error deleting users from Firebase Auth:", error);
      // If the entire batch failed, all UIDs are considered errors for this step
      uids.forEach(uid => errors.push({ uid: uid, error: `Auth deletion batch error: ${error.message}` }));
      failureCount = uids.length; // Assume all failed if batch call throws
    }

    // Delete corresponding user_roles from Firestore
    const firestore = getFirestore();
    const batch = firestore.batch();
    let firestoreDeletionsAttempted = 0;

    for (const uid of uids) {
      // Only attempt to delete from Firestore if Auth deletion was successful or not explicitly failed for this UID
      const authErrorForUid = errors.find(e => e.uid === uid && e.error.startsWith('Auth deletion batch error'));
      if (!authErrorForUid) { // If no batch error, or if it was a specific user error (already counted in failureCount)
        const userRoleRef = firestore.collection("user_roles").doc(uid);
        batch.delete(userRoleRef);
        firestoreDeletionsAttempted++;
      }
    }

    if (firestoreDeletionsAttempted > 0) {
        try {
            await batch.commit();
            console.log(`${firestoreDeletionsAttempted} user_roles documents successfully marked for deletion in Firestore batch.`);
            // Note: Batch commit success doesn't mean individual ops succeeded if rules deny, etc.
            // but for this scope, we assume it means the operation was accepted by Firestore.
        } catch (error) {
            console.error("Error committing batch delete for user_roles in Firestore:", error);
            // This is a general batch error, hard to attribute to specific UIDs
            // We can add a general error message.
            errors.push({ uid: "N/A", error: `Firestore user_roles batch delete error: ${error.message}` });
            // It's tricky to adjust success/failure counts here accurately without per-UID results from batch.
            // For simplicity, we'll report auth success/failure and this separate Firestore error.
        }
    }

    return {
      message: `Bulk delete process finished. Auth Success: ${successCount}, Auth Failure: ${failureCount}. Firestore roles deletion attempted for relevant UIDs.`,
      successCount: successCount, // Auth success
      failureCount: failureCount, // Auth failure
      errors: errors,
    };
  }
);

exports.bulkUpdateUserRoles = onCall(
  { region: "us-central1" },
  async (request) => {
    await ensureAdmin(request); // Check for admin privileges

    const uids = request.data.uids;
    const newRole = request.data.newRole;

    if (!uids || !Array.isArray(uids) || uids.length === 0) {
      throw new HttpsError("invalid-argument", "UIDs must be a non-empty array.");
    }
    if (!newRole || (newRole !== "admin" && newRole !== "staff")) {
      throw new HttpsError("invalid-argument", "New role must be 'admin' or 'staff'.");
    }
    if (uids.length > 500) { // Firestore batch write limit
        throw new HttpsError("invalid-argument", "Cannot update more than 500 user roles at a time.");
    }

    const firestore = getFirestore();
    const batch = firestore.batch();
    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    uids.forEach(uid => {
      if (typeof uid === 'string' && uid.length > 0) {
        const userRoleRef = firestore.collection("user_roles").doc(uid);
        batch.set(userRoleRef, { role: newRole }, { merge: true }); // Using merge:true to be safe, or set() if creating/overwriting
      } else {
        console.warn(`Invalid UID found in bulk update list: ${uid}`);
        failureCount++;
        errors.push({uid: uid, error: "Invalid UID format."});
      }
    });

    if (uids.length - failureCount > 0) { // Only commit if there are valid operations
        try {
            await batch.commit();
            successCount = uids.length - failureCount; // Assume all valid UIDs in batch were successful
            console.log(`Batch update for ${successCount} user roles to '${newRole}' committed successfully.`);
        } catch (error) {
            console.error("Error committing batch update for user_roles in Firestore:", error);
            // All operations in this batch are considered failed if commit fails
            failureCount = uids.length;
            successCount = 0;
            uids.forEach(uid => {
                if (!errors.some(e => e.uid === uid)) { // Avoid duplicating errors for already invalid UIDs
                    errors.push({ uid: uid, error: `Firestore batch update error: ${error.message}` });
                }
            });
        }
    }


    return {
      message: `Bulk role update to '${newRole}' process finished. Success: ${successCount}, Failure: ${failureCount}.`,
      successCount: successCount,
      failureCount: failureCount,
      errors: errors,
    };
  }
);

exports.listUsersAndRoles = onCall(
  { region: "us-central1" },
  async (context) => {
    if (!context.auth) {
      throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    const callerUid = context.auth.uid;

    let userRoleDoc;
    try {
      userRoleDoc = await getFirestore().collection("user_roles").doc(callerUid).get();
    } catch (error) {
      console.error("Firestore error when checking admin role for caller:", callerUid, error);
      throw new HttpsError("internal", `Failed to retrieve user role information: ${error.message}`);
    }

    if (!userRoleDoc.exists || userRoleDoc.data().role !== "admin") {
      console.warn(
        `Permission denied for user ${callerUid} attempting to list users. Role: ${
          userRoleDoc.exists ? userRoleDoc.data().role : "document_does_not_exist"
        }`
      );
      throw new HttpsError("permission-denied", "Caller is not an admin.");
    }

    try {
      const listUsersResult = await getAuth().listUsers(1000);
      const usersPromises = listUsersResult.users.map(async (userRecord) => {
        let userRole = "staff";
        try {
          const roleDoc = await getFirestore().collection("user_roles").doc(userRecord.uid).get();
          if (roleDoc.exists && roleDoc.data().role) {
            userRole = roleDoc.data().role;
          } else if (!roleDoc.exists) {
            console.log(`No role document found for user ${userRecord.uid}, defaulting to 'staff' in list.`);
          }
        } catch (roleError) {
          console.error(`Error fetching role for user ${userRecord.uid}:`, roleError);
        }
        return {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          currentRole: userRole,
          disabled: userRecord.disabled,
        };
      });

      const usersWithRoles = await Promise.all(usersPromises);
      return { users: usersWithRoles };
    } catch (error) {
      console.error("Error listing users or their roles:", error);
      // Check for common permission-denied error codes/messages from Firebase Admin SDK
      // Firebase Admin SDK often uses error.code like 'auth/insufficient-permission'
      // or sometimes a generic 'permission-denied' might appear in the message or code.
      if (error.code === 'auth/insufficient-permission' ||
          (error.message && error.message.toLowerCase().includes('permission denied')) ||
          (error.errorInfo && error.errorInfo.code && error.errorInfo.code.includes('auth/'))) { // Broader check for auth related errors
        console.error("Detailed error from Firebase Admin SDK (likely IAM):", JSON.stringify(error, null, 2));
        throw new HttpsError('permission-denied', `The function's service account has insufficient permission to list users. Please ensure it has a role like 'Firebase Authentication Admin' or specifically the 'firebaseauth.users.list' permission. Original error: ${error.message}`);
      }
      // Fallback for other types of errors
      throw new HttpsError('internal', `Unable to list users and their roles. Original error: ${error.message}`);
    }
  }
);