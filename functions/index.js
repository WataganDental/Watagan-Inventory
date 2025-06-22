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