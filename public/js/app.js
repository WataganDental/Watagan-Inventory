const SIDEBAR_STATE_KEY = 'sidebarMinimized';

// Global variables for edit scan mode
let isEditScanModeActive = false;
let editScanInputBuffer = "";

let stream = null;
let photoStream = null;
let inventory = []; // Holds the full inventory list, populated by loadInventory()
let suppliers = [];
let locations = []; // Added for location management
let batchUpdates = [];
let db; // Declare db globally
let storage; // Declare storage globally
let originalPhotoUrlForEdit = ''; // Stores the original photo URL when editing a product

// Global variables for Quick Stock Update
let quickStockBarcodeBuffer = ""; // Used by Manual Batch (indirectly via keypress), and Barcode Scanner modes

// Global State Variables for Barcode Scanner Mode
let currentBarcodeModeProductId = null;
let isBarcodeScannerModeActive = false;

// Pagination Global Variables
let currentPage = 1;
const ITEMS_PER_PAGE = 25;
let totalFilteredItems = 0;

// Lazy Loading Global Variable
let imageObserver = null;

let currentUserRole = null; // Ensure this is global for access by updateUserInterfaceForRole and auth changes

function updateUserInterfaceForRole(role) {
  console.log("Updating UI for role:", role);

  const menuSuppliers = document.getElementById('menuSuppliers');
  const addSupplierBtn = document.getElementById('addSupplierBtn');
  const addLocationBtn = document.getElementById('addLocationBtn');
  const supplierFormContent = document.getElementById('supplierFormContent');
  const locationFormContent = document.getElementById('locationFormContent');
  const menuUserManagement = document.getElementById('menuUserManagement');

  // Default to hiding elements that require admin role
  if (menuSuppliers && menuSuppliers.parentElement) menuSuppliers.parentElement.classList.add('hidden'); // Assuming hidden on <li>
  if (addSupplierBtn) addSupplierBtn.classList.add('hidden');
  if (addLocationBtn) addLocationBtn.classList.add('hidden');
  if (supplierFormContent) supplierFormContent.classList.add('hidden');
  if (locationFormContent) locationFormContent.classList.add('hidden');
  if (menuUserManagement && menuUserManagement.parentElement) menuUserManagement.parentElement.classList.add('hidden');


  if (role === 'admin') {
    if (menuSuppliers && menuSuppliers.parentElement) menuSuppliers.parentElement.classList.remove('hidden');
    if (addSupplierBtn) addSupplierBtn.classList.remove('hidden');
    if (addLocationBtn) addLocationBtn.classList.remove('hidden');
    if (supplierFormContent) supplierFormContent.classList.remove('hidden');
    if (locationFormContent) locationFormContent.classList.remove('hidden');
    if (menuUserManagement && menuUserManagement.parentElement) menuUserManagement.parentElement.classList.remove('hidden');
  } else if (role === 'staff') {
    // Staff-specific UI adjustments can go here if needed.
    // Most are covered by default hiding.
  } else {
    console.warn("Unknown or null role for UI update:", role, "Applying most restrictive UI.");
  }
}


// Moved showView function here to ensure it's defined before being called by onAuthStateChanged
function showView(viewIdToShow, clickedMenuId) {
  // This function relies on allViewContainers and setActiveMenuItem (which uses menuItems)
  // being initialized. If this is called before DOMContentLoaded completes and these variables are set,
  // it will cause errors. The ReferenceError for showView itself is fixed by this move,
  // but dependency errors might arise if not called at the right time.
  console.log(`Attempting to show view: ${viewIdToShow} triggered by ${clickedMenuId}`);

  // These would ideally be passed as parameters or ensured to be globally available and initialized.
  // For now, re-querying them or hoping they are global. This is a potential refactor point.
  const allViewContainers = [
    document.getElementById('inventoryViewContainer'),
    document.getElementById('suppliersSectionContainer'),
    document.getElementById('ordersSectionContainer'),
    document.getElementById('reportsSectionContainer'),
    document.getElementById('quickStockUpdateContainer'),
    document.getElementById('userManagementSectionContainer') // Added User Management
  ].filter(container => container !== null);

  let viewFound = false;
  allViewContainers.forEach(container => {
      if (container.id === viewIdToShow) {
          container.classList.remove('hidden');
          viewFound = true;
          console.log(`Showing: ${container.id}`);
          if (container.id === 'quickStockUpdateContainer') {
            const initialTabToSelect = document.getElementById('barcodeScannerModeTab') ? 'barcodeScannerModeTab' : 'manualBatchModeTab';
            if (typeof switchQuickUpdateTab === 'function') { // Defensive check
                switchQuickUpdateTab(initialTabToSelect);
            } else {
                console.error("switchQuickUpdateTab is not defined or available when trying to show quickStockUpdateContainer");
            }
          } else if (container.id === 'ordersSectionContainer') {
            // When showing the orders section, populate products and load orders
            console.log('Orders section is being shown. Calling populateProductsDropdown and loadAndDisplayOrders.');
            if (typeof populateProductsDropdown === 'function') populateProductsDropdown(); else console.error("populateProductsDropdown is not defined");
            if (typeof loadAndDisplayOrders === 'function') loadAndDisplayOrders(); else console.error("loadAndDisplayOrders is not defined");
          } else if (container.id === 'reportsSectionContainer') {
            if (typeof updateInventoryDashboard === 'function') updateInventoryDashboard(); else console.error("updateInventoryDashboard is not defined");
            if (typeof generateSupplierOrderSummaries === 'function') generateSupplierOrderSummaries(); else console.error("generateSupplierOrderSummaries is not defined");
            if (typeof populateTrendProductSelect === 'function') populateTrendProductSelect(); else console.error("populateTrendProductSelect is not defined");
            if (typeof generateProductUsageChart === 'function') generateProductUsageChart(''); else console.error("generateProductUsageChart is not defined");
            // Also load orders when reports view is shown, as per instructions
            if (typeof loadAndDisplayOrders === 'function') loadAndDisplayOrders(); else console.error("loadAndDisplayOrders is not defined for reports view");
          } else if (container.id === 'userManagementSectionContainer') {
            if (typeof displayUserRoleManagement === 'function') displayUserRoleManagement(); else console.error("displayUserRoleManagement is not defined");
          }
      } else {
          if (container.id === 'quickStockUpdateContainer') {
              if(typeof quickStockBarcodeBuffer !== 'undefined') quickStockBarcodeBuffer = "";
              if(typeof isBarcodeScannerModeActive !== 'undefined') isBarcodeScannerModeActive = false;

              if (typeof stream !== 'undefined' && stream) { // Ensure stream is defined
                  if (typeof stopUpdateScanner === 'function' && document.getElementById('updateVideo') && !document.getElementById('updateVideo').classList.contains('hidden')) stopUpdateScanner();
                  if (typeof stopMoveScanner === 'function' && document.getElementById('moveVideo') && !document.getElementById('moveVideo').classList.contains('hidden')) stopMoveScanner();
                  if (typeof stopEditScanner === 'function' && document.getElementById('editVideo') && !document.getElementById('editVideo').classList.contains('hidden')) stopEditScanner();
              }
          }
          container.classList.add('hidden');
          console.log(`Hiding: ${container.id}`);
      }
  });

  if (viewFound) {
      // setActiveMenuItem needs to be globally available or passed.
      // This is a simplified version assuming menuItems are queryable here.
      const menuItems = [
          document.getElementById('menuInventory'),
          document.getElementById('menuSuppliers'),
          document.getElementById('menuOrders'),
          document.getElementById('menuReports'),
          document.getElementById('menuQuickStockUpdate'),
          document.getElementById('menuUserManagement') // Added User Management
      ].filter(item => item !== null);
      const activeMenuClasses = ['bg-gray-300', 'dark:bg-slate-700', 'font-semibold', 'text-gray-900', 'dark:text-white'];
      const inactiveMenuClasses = ['text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-300', 'dark:hover:bg-slate-700'];

      menuItems.forEach(item => {
          if (item.id === clickedMenuId) {
              inactiveMenuClasses.forEach(cls => item.classList.remove(cls));
              activeMenuClasses.forEach(cls => item.classList.add(cls));
              const icon = item.querySelector('svg');
              if (icon) {
                  icon.classList.remove('text-gray-500', 'dark:text-gray-400', 'group-hover:text-gray-700', 'dark:group-hover:text-gray-200');
                  icon.classList.add('text-gray-700', 'dark:text-gray-100');
              }
          } else {
              activeMenuClasses.forEach(cls => item.classList.remove(cls));
              inactiveMenuClasses.forEach(cls => item.classList.add(cls));
              const icon = item.querySelector('svg');
              if (icon) {
                  icon.classList.remove('text-gray-700', 'dark:text-gray-100');
                  icon.classList.add('text-gray-500', 'dark:text-gray-400', 'group-hover:text-gray-700', 'dark:group-hover:text-gray-200');
              }
          }
      });
  } else if (viewIdToShow) {
      console.warn(`View with ID '${viewIdToShow}' not found among registered containers.`);
  }
}

// Helper functions for Barcode Scanner Mode UI
function setBarcodeStatus(message, isError = false) {
    const statusEl = document.getElementById('barcodeScannerStatus');
    if (statusEl) {
        statusEl.textContent = message;
        if (isError) {
            statusEl.classList.remove('bg-blue-100', 'dark:bg-blue-800', 'text-blue-700', 'dark:text-blue-200');
            statusEl.classList.add('bg-red-100', 'dark:bg-red-700', 'text-red-700', 'dark:text-red-200');
        } else {
            statusEl.classList.remove('bg-red-100', 'dark:bg-red-700', 'text-red-700', 'dark:text-red-200');
            statusEl.classList.add('bg-blue-100', 'dark:bg-blue-800', 'text-blue-700', 'dark:text-blue-200');
        }
    }
}

function setLastActionFeedback(message, isError = false) {
    const lastActionEl = document.getElementById('barcodeLastActionFeedback');
    if (lastActionEl) {
        lastActionEl.textContent = message;
        if (isError) {
            lastActionEl.classList.remove('text-green-600', 'dark:text-green-400');
            lastActionEl.classList.add('text-red-600', 'dark:text-red-400');
        } else {
            lastActionEl.classList.remove('text-red-600', 'dark:text-red-400');
            lastActionEl.classList.add('text-green-600', 'dark:text-green-400');
        }
    }
}

// START OF FUNCTIONS TO ADD

async function displayBarcodeModeActionQRCodes() {
  const container = document.getElementById('barcodeModeActionQRCodesContainer');
  if (!container) {
    console.error('Barcode Mode Action QR Codes container (barcodeModeActionQRCodesContainer) not found.');
    return;
  }
  container.innerHTML = ''; // Clear previous QRs

  const actions = [
    { label: '+10 Units', data: 'ACTION_ADD_10', type: 'add' },
    { label: '+1 Unit', data: 'ACTION_ADD_1', type: 'add' },
    { label: '-10 Units', data: 'ACTION_SUB_10', type: 'subtract' },
    { label: '-1 Unit', data: 'ACTION_SUB_1', type: 'subtract' },

    { label: '+2 Units', data: 'ACTION_ADD_2', type: 'add' },
    { label: '+3 Units', data: 'ACTION_ADD_3', type: 'add' },
    { label: '-2 Units', data: 'ACTION_SUB_2', type: 'subtract' },
    { label: '-3 Units', data: 'ACTION_SUB_3', type: 'subtract' },

    { label: '+4 Units', data: 'ACTION_ADD_4', type: 'add' },
    { label: '+5 Units', data: 'ACTION_ADD_5', type: 'add' },
    { label: '-4 Units', data: 'ACTION_SUB_4', type: 'subtract' },
    { label: '-5 Units', data: 'ACTION_SUB_5', type: 'subtract' },

    { label: '+6 Units', data: 'ACTION_ADD_6', type: 'add' },
    { label: '+7 Units', data: 'ACTION_ADD_7', type: 'add' },
    { label: '-6 Units', data: 'ACTION_SUB_6', type: 'subtract' },
    { label: '-7 Units', data: 'ACTION_SUB_7', type: 'subtract' },

    { label: '+8 Units', data: 'ACTION_ADD_8', type: 'add' },
    { label: '+9 Units', data: 'ACTION_ADD_9', type: 'add' },
    { label: '-8 Units', data: 'ACTION_SUB_8', type: 'subtract' },
    { label: '-9 Units', data: 'ACTION_SUB_9', type: 'subtract' }
  ];

  if (typeof QRCode === 'undefined') {
    console.error('QRCode library is not loaded. Cannot display action QR codes for Barcode Mode.');
    container.innerHTML = '<p class="text-red-500 dark:text-red-400 col-span-full">Error: QRCode library not loaded.</p>';
    return;
  }

  actions.forEach(action => {
    const actionDiv = document.createElement('div');
    let bgColorClass = 'bg-gray-100 dark:bg-gray-700'; // Default/cancel
    if (action.type === 'add') {
      bgColorClass = 'bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-600';
    } else if (action.type === 'subtract') {
      bgColorClass = 'bg-red-100 hover:bg-red-200 dark:bg-red-700 dark:hover:bg-red-600';
    } else if (action.type === 'set') {
      bgColorClass = 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-700 dark:hover:bg-blue-600';
    } else if (action.type === 'complete') {
      bgColorClass = 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-700 dark:hover:bg-yellow-600';
    }
    actionDiv.className = `flex flex-col items-center p-2 border dark:border-slate-600 rounded-md shadow ${bgColorClass} transition-colors duration-150`;

    const qrCodeElem = document.createElement('div');
    qrCodeElem.id = `barcode-mode-action-qr-${action.data}`; // Ensure unique IDs if necessary
    actionDiv.appendChild(qrCodeElem);

    const labelElem = document.createElement('p');
    labelElem.textContent = action.label;
    labelElem.className = 'text-sm mt-1 dark:text-gray-200';
    actionDiv.appendChild(labelElem);

    container.appendChild(actionDiv);

    try {
      new QRCode(qrCodeElem, {
        text: action.data,
        width: 80,
        height: 80,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      console.error(`Error generating QR code for action ${action.label} in Barcode Mode:`, e);
      qrCodeElem.textContent = 'Error';
    }
  });
  console.log('Barcode Mode Action QR codes displayed in single container.');
}

// END OF FUNCTIONS TO ADD

// START - Placeholder functions for Orders section
async function populateProductsDropdown() {
  try {
    const db = firebase.firestore(); // Ensures db is from the correct Firebase instance
    const snapshot = await db.collection('inventory').get();
    const dropdown = document.getElementById('orderProductId'); // Adjusted ID to match HTML for orders section
    if (!dropdown) {
      console.error('Dropdown element with ID "orderProductId" not found in orders section'); // Updated error message
      return;
    }
    dropdown.innerHTML = ''; // Clear existing options
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.text = "Select a Product";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    dropdown.appendChild(defaultOption);

    snapshot.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc.id; // Use document ID as value
      option.text = doc.data().name || doc.id; // Use 'name' field or ID as display text
      dropdown.appendChild(option);
    });
    console.log('Products dropdown populated successfully');
  } catch (error) {
    console.error('Error populating products dropdown:', error);
  }
}

async function loadAndDisplayOrders() {
  console.log('[loadAndDisplayOrders] Attempting to load and display orders.');
  const ordersTableBody = document.getElementById('ordersTableBody');
  const ordersContainerFallback = document.getElementById('ordersContainer'); // Fallback if table body not found or for general messages

  if (!ordersTableBody) {
    console.error('[loadAndDisplayOrders] Critical: HTML element with ID "ordersTableBody" not found.');
    if (ordersContainerFallback) {
        ordersContainerFallback.innerHTML = '<p class="text-red-500 dark:text-red-400">Error: UI element for orders missing (ordersTableBody). Cannot display orders.</p>';
    }
    return;
  }

  try {
    const user = firebase.auth().currentUser;
    console.log('[loadAndDisplayOrders] Current user:', user ? { uid: user.uid, email: user.email, role: currentUserRole } : 'No user logged in');

    if (!user) {
      console.error('[loadAndDisplayOrders] No authenticated user found.');
      ordersTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-red-500 dark:text-red-400">Error: You must be logged in to view orders.</td></tr>';
      return;
    }

    console.log(`[loadAndDisplayOrders] Current user UID: ${user.uid}, Role: ${currentUserRole}`);

    const db = firebase.firestore();
    const filterStatusDropdown = document.getElementById('filterOrderStatus');
    const selectedStatus = filterStatusDropdown ? filterStatusDropdown.value : '';

    console.log(`[loadAndDisplayOrders] Fetching orders from Firestore collection "orders". Selected status: '${selectedStatus}'`);

    let ordersQuery = db.collection('orders');

    if (selectedStatus) {
      ordersQuery = ordersQuery.where('status', '==', selectedStatus);
    }
    // Example: ordersQuery = ordersQuery.orderBy('createdAt', 'desc'); // You might want to add ordering

    const snapshot = await ordersQuery.get();

    console.log(`[loadAndDisplayOrders] Snapshot received. Empty: ${snapshot.empty}, Size: ${snapshot.size}`);

    ordersTableBody.innerHTML = ''; // Clear existing content (like "Loading orders...")

    if (snapshot.empty) {
      ordersTableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-gray-500 dark:text-gray-400">No orders found in the database.</td></tr>';
      console.log('[loadAndDisplayOrders] No orders found in the database.');
      return;
    }

    snapshot.forEach(doc => {
      const orderData = doc.data();
      console.log(`[loadAndDisplayOrders] Processing order doc ID: ${doc.id}, Data:`, JSON.stringify(orderData));

      const row = ordersTableBody.insertRow();
      row.className = 'border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-750'; // Added hover effect

      // Matching the table structure in public/index.html for orders
      // Order ID, Product Name, Quantity, Status, Order Date, Actions
      const cellOrderId = row.insertCell();
      cellOrderId.className = 'px-4 py-2 whitespace-nowrap';
      cellOrderId.textContent = doc.id;

      const cellProductName = row.insertCell();
      cellProductName.className = 'px-4 py-2';
      // Assuming product name needs to be fetched or is stored with the order.
      // For now, using productId, will need adjustment if product name is expected.
      cellProductName.textContent = orderData.productName || orderData.productId || 'N/A'; // Prefer productName if available

      const cellQuantity = row.insertCell();
      cellQuantity.className = 'px-4 py-2 text-center';
      cellQuantity.textContent = orderData.quantity || 'N/A';

      const cellStatus = row.insertCell();
      cellStatus.className = 'px-4 py-2';
      const status = orderData.status || 'Pending'; // Default to 'Pending' if no status
      cellStatus.textContent = status;

      // Apply styling based on status
      if (status === 'Pending') {
        cellStatus.classList.add('status-pending');
      } else if (status === 'Fulfilled' || status === 'fulfilled') { // Handle potential case variations
        cellStatus.classList.add('status-fulfilled');
      } else if (status === 'Cancelled' || status === 'cancelled') {
        cellStatus.classList.add('status-cancelled');
      } else {
        cellStatus.classList.add('status-other');
      }

      const cellOrderDate = row.insertCell();
      cellOrderDate.className = 'px-4 py-2 whitespace-nowrap';
      cellOrderDate.textContent = orderData.createdAt && orderData.createdAt.toDate
                                  ? orderData.createdAt.toDate().toLocaleDateString()
                                  : 'N/A';

      const cellActions = row.insertCell();
      cellActions.className = 'px-4 py-2 text-center whitespace-nowrap';
      // Add action buttons if needed, e.g., view details, update status
      cellActions.innerHTML = `<button class="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs" onclick="viewOrderDetails('${doc.id}')">View</button>`;
      // Note: viewOrderDetails function would need to be implemented.
    });
    console.log('[loadAndDisplayOrders] Orders loaded and displayed successfully into ordersTableBody.');

  } catch (error) {
    console.error('[loadAndDisplayOrders] Error loading and displaying orders:', error.message, error.stack ? error.stack : '');
    ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-500 dark:text-red-400">Error loading orders. Details: ${error.message}. Check console.</td></tr>`;
    if (ordersContainerFallback && ordersTableBody !== ordersContainerFallback) { // If using a different general container for high-level errors
        ordersContainerFallback.innerHTML = `<p class="text-red-500 dark:text-red-400">Error loading orders. Please check console.</p>`;
    }
  }
}
// END - Placeholder functions for Orders section

async function displayUserRoleManagement() {
  const tableBody = document.getElementById('userRolesTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Loading users...</td></tr>';

  try {
    // IMPORTANT: This will call a Cloud Function that needs to be created in a later step.
    // For now, we define the call. The Cloud Function will be named 'listUsersAndRoles'.
    const listUsersAndRolesCallable = firebase.functions().httpsCallable('listUsersAndRoles');
    const result = await listUsersAndRolesCallable(); // Call the function
    const users = result.data.users; // Assuming CF returns { users: [...] }

    tableBody.innerHTML = ''; // Clear loading message

    if (!users || users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No users found.</td></tr>';
      return;
    }

    users.forEach(user => {
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">${user.email || 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-xs">${user.uid}</td>
        <td class="px-6 py-4 whitespace-nowrap">${user.currentRole || 'No Role Assigned'}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <select id="roleSelect-${user.uid}" class="border dark:border-gray-600 p-2 rounded dark:bg-slate-700 dark:text-gray-200">
            <option value="staff" ${(user.currentRole === 'staff' || !user.currentRole) ? 'selected' : ''}>Staff</option>
            <option value="admin" ${user.currentRole === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td class="px-6 py-4 text-center">
          <button data-uid="${user.uid}" class="save-role-btn bg-blue-500 hover:bg-blue-600 text-white p-2 rounded text-xs">Save Role</button>
        </td>
      `;
    });

    // Add event listeners to new "Save Role" buttons
    document.querySelectorAll('.save-role-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const userId = event.target.dataset.uid;
        const newRole = document.getElementById(`roleSelect-${userId}`).value;
        await handleSaveUserRole(userId, newRole);
      });
    });

  } catch (error) {
    console.error("Error fetching or displaying users for role management:", error);
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-500">Error loading users: ${error.message}</td></tr>`;
  }
}

async function handleSaveUserRole(userId, newRole) {
  if (!userId || !newRole) {
    alert('User ID or new role is missing.');
    return;
  }
  console.log(`Attempting to set role for ${userId} to ${newRole}`);
  try {
    await db.collection('user_roles').doc(userId).set({ role: newRole });
    alert(`Role for user ${userId} successfully updated to ${newRole}.`);
    // Refresh the user list to show updated role
    displayUserRoleManagement();
  } catch (error) {
    console.error("Error saving user role:", error);
    alert(`Failed to save role for user ${userId}: ${error.message}`);
  }
}

function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

// Modal DOM element variables (module-scoped)
let imageModal = null;
let modalImage = null;
let closeImageModalBtn = null;

// Dark Mode Toggle Functionality
const userPreference = localStorage.getItem('darkMode');
const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyDarkMode = () => {
  document.documentElement.classList.add('dark');
  localStorage.setItem('darkMode', 'enabled');
};

const removeDarkMode = () => {
  document.documentElement.classList.remove('dark');
  localStorage.setItem('darkMode', 'disabled');
};

const initialDarkModeCheck = () => {
  if (userPreference === 'enabled') {
    applyDarkMode();
  } else if (userPreference === 'disabled') {
    removeDarkMode();
  } else if (systemPreference) {
    applyDarkMode();
  } else {
    removeDarkMode();
  }
};

// Firebase Initialization
const firebaseConfig = {
  apiKey: "AIzaSyC4I5X1Gca4VEvqRspnitNFSLu8C0jH7sQ",
  authDomain: "watagandental-inventory-e6e7b.firebaseapp.com",
  projectId: "watagandental-inventory-e6e7b",
  storageBucket: "watagandental-inventory-e6e7b.firebasestorage.app",
  messagingSenderId: "309417981178",
  appId: "1:309417981178:web:8fa5239801426e8b428543",
  measurementId: "G-PVQTBS5BSH"
};

try {
  let app;
  if (firebase.apps.length === 0) {
    app = firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully:', app.name);
  } else {
    app = firebase.app();
    console.log('Using existing Firebase app:', app.name);
  }
  db = firebase.firestore();
  storage = firebase.storage();
  const auth = firebase.auth(); // Added Firebase Auth
  const ui = new firebaseui.auth.AuthUI(auth); // FirebaseUI instance
  console.log('Firestore instance created:', !!db);
  console.log('Storage instance created:', !!storage);
  console.log('Auth instance created:', !!auth);
  console.log('FirebaseUI instance created:', !!ui);

    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
      const logoutBtn = document.getElementById('logoutButton');
      const authContainer = document.getElementById('authContainer'); // This is the main container for login screen
      const appNavbar = document.getElementById('appNavbar');
      const appMainContainer = document.getElementById('appMainContainer');
      const userProfileImage = document.getElementById('userProfileImage'); // Get profile image element
      const customLoginForm = document.getElementById('loginForm'); // The old custom form
      const customGoogleSignInSection = document.getElementById('customGoogleSignInSection'); // The old Google Sign In button section

      if (user) {
        console.log('Auth state changed: User is signed in', user.email || user.uid, 'Photo URL:', user.photoURL);
        if (authContainer) authContainer.classList.add('hidden'); // Hide the entire login screen
        if (appNavbar) appNavbar.classList.remove('hidden');
        if (appMainContainer) appMainContainer.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');

        if (userProfileImage) {
          if (user.photoURL) {
            userProfileImage.src = user.photoURL;
            userProfileImage.alt = user.displayName || user.email || 'User profile';
            userProfileImage.src = user.photoURL;
            userProfileImage.alt = user.displayName || user.email || 'User profile';
            userProfileImage.classList.remove('hidden');
          } else {
            // Use a generic SVG icon as a data URI if no photoURL
            const defaultUserIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clip-rule="evenodd" /></svg>';
            userProfileImage.src = `data:image/svg+xml;base64,${btoa(defaultUserIconSvg)}`;
            userProfileImage.alt = user.displayName || user.email || 'User profile (default icon)';
            userProfileImage.classList.remove('hidden'); // Ensure it's visible
          }
        }

        loadInventory();
        loadSuppliers();
        loadLocations();

        const userRoleRef = db.collection('user_roles').doc(user.uid);
        userRoleRef.get().then(docSnapshot => {
          if (docSnapshot.exists) {
            currentUserRole = docSnapshot.data().role;
            console.log('User role loaded:', currentUserRole);
          } else {
            // If it's a new user (e.g., via Google Sign-In and no role doc yet), default to 'staff'.
            // The Google Sign-In logic should ideally create this doc.
            currentUserRole = 'staff';
            console.log('No specific role found for user, defaulting to:', currentUserRole);
          }
          updateUserInterfaceForRole(currentUserRole);

          const menuInventoryEl = document.getElementById('menuInventory');
          if (menuInventoryEl) {
              showView('inventoryViewContainer', menuInventoryEl.id);
          } else {
              console.warn("Default menu item 'menuInventory' not found after login.");
          }
        }).catch(error => {
          console.error("Error fetching user role:", error);
          currentUserRole = 'staff'; // Fallback
          updateUserInterfaceForRole(currentUserRole);
          const menuInventoryEl = document.getElementById('menuInventory');
          if (menuInventoryEl) {
              showView('inventoryViewContainer', menuInventoryEl.id);
          }
        });

      } else {
        // User is signed out.
        console.log('Auth state changed: User is signed out');
        if (appNavbar) appNavbar.classList.add('hidden');
        if (appMainContainer) appMainContainer.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (authContainer) authContainer.classList.remove('hidden'); // Show the login screen container

        // Hide custom form elements if they were not already hidden via HTML
        if (customLoginForm && !customLoginForm.classList.contains('hidden')) {
            customLoginForm.classList.add('hidden');
        }
        if (customGoogleSignInSection && !customGoogleSignInSection.classList.contains('hidden')) {
            customGoogleSignInSection.classList.add('hidden');
        }

        currentUserRole = null;
        updateUserInterfaceForRole(null);
        if (userProfileImage) { // Hide and reset profile image on logout
          userProfileImage.classList.add('hidden');
          userProfileImage.src = '#';
          userProfileImage.alt = 'User';
        }

        const uiConfig = {
          callbacks: {
            signInSuccessWithAuthResult: function(authResult, redirectUrl) {
              // User successfully signed in.
              // Return true to automatically redirect (if signInSuccessUrl is set)
              // Return false to handle manually (e.g. if you want to stay on the page or do something else)
              console.log('FirebaseUI: signInSuccessWithAuthResult', authResult);
              // The onAuthStateChanged listener will handle UI changes, so we don't need to do much here.
              // If a role needs to be set for new users immediately, this might be a place.
              // For now, just let onAuthStateChanged handle it.
              return false; // Let onAuthStateChanged handle UI changes
            },
            uiShown: function() {
              // The widget is rendered.
              // Maybe hide a loader if you have one.
              console.log('FirebaseUI: uiShown');
              document.getElementById('authErrorMessage').classList.add('hidden'); // Hide any previous custom error
            },
            signInFailure: function(error) {
                // Handle sign-in errors (e.g., account_exists_with_different_credential).
                console.error('FirebaseUI: signInFailure', error);
                const authErrorMessage = document.getElementById('authErrorMessage');
                if (authErrorMessage) {
                    authErrorMessage.textContent = `Login Error: ${error.message} (Code: ${error.code})`;
                    authErrorMessage.classList.remove('hidden');
                }
                // You might want to return a promise that resolves to false to prevent redirect on error.
                return Promise.resolve();
            }
          },
          signInFlow: 'popup', // Use 'popup' for Google, Facebook, etc. 'redirect' is another option.
          signInSuccessUrl: null, // Disable automatic redirect, handled by onAuthStateChanged
          signInOptions: [
            firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            firebase.auth.EmailAuthProvider.PROVIDER_ID,
            // Add other providers like:
            // firebase.auth.FacebookAuthProvider.PROVIDER_ID,
            // firebase.auth.TwitterAuthProvider.PROVIDER_ID,
            // firebase.auth.GithubAuthProvider.PROVIDER_ID,
            // firebase.auth.PhoneAuthProvider.PROVIDER_ID,
          ],
          // Terms of service url.
          tosUrl: '<your-tos-url>', // Replace with your TOS URL or remove if not needed
          // Privacy policy url.
          privacyPolicyUrl: '<your-privacy-policy-url>' // Replace with your Privacy Policy URL or remove
        };

        // Start the FirebaseUI Auth interface.
        // It will listen for user input and display the appropriate UI.
        // The #firebaseui-auth-container element must be present in your HTML.
        ui.start('#firebaseui-auth-container', uiConfig);
      }
    });

    // Initial check if a user is already signed in (e.g. page refresh)
    // If not, Firebase will handle anonymous sign-in if configured, or user needs to log in.
    // The onAuthStateChanged listener will manage UI updates based on the auth state.
    // No explicit signInAnonymously call here unless onAuthStateChanged logic is insufficient.
    // The existing onAuthStateChanged handles the anonymous sign-in if user is null.
    if (!auth.currentUser) {
        console.log("No current user on app load, anonymous sign-in call REMOVED."); // MODIFIED Log
        // auth.signInAnonymously() // Commented out as per requirement
        //     .then(() => {
        //         console.log("Initial anonymous sign-in successful.");
        //     })
        //     .catch((error) => {
        //         console.error("Initial anonymous sign-in error:", error.code, error.message);
        //          alert("Initial Authentication failed: " + error.message + "\nPlease ensure Anonymous sign-in is enabled in your Firebase project's Authentication settings and that your Firebase configuration is correct, and that the domains are correctly whitelisted if running locally for testing.");
        //     });
    }
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

// Utility to load jsPDF dynamically with polling
async function loadJsPDF(scriptSrc = '/js/jspdf.umd.min.js') {
  return new Promise((resolve, reject) => {
    if (window.jspdf && typeof window.jspdf.jsPDF === 'function') {
      console.log(`jsPDF already available at window.jspdf.jsPDF (when trying to load ${scriptSrc})`);
      resolve(window.jspdf.jsPDF);
      return;
    }
    if (typeof window.jsPDF === 'function') {
      console.log(`jsPDF already available at window.jsPDF (when trying to load ${scriptSrc})`);
      resolve(window.jsPDF);
      return;
    }

    console.log(`Dynamically loading jsPDF from ${scriptSrc}...`);
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;

    script.onload = () => {
      console.log(`jsPDF script from ${scriptSrc} onload event fired.`);
      let startTime = Date.now();
      const maxWaitTime = 2000;
      const pollInterval = 50;

      const intervalId = setInterval(() => {
        console.log(`Polling for jsPDF library (from ${scriptSrc})...`);
        if (window.jspdf && typeof window.jspdf.jsPDF === 'function') {
          console.log(`Found jsPDF constructor at window.jspdf.jsPDF (polling from ${scriptSrc})`);
          clearInterval(intervalId);
          resolve(window.jspdf.jsPDF);
        } else if (typeof window.jsPDF === 'function') {
          console.log(`Found jsPDF constructor at window.jsPDF (polling from ${scriptSrc})`);
          clearInterval(intervalId);
          resolve(window.jsPDF);
        } else if (Date.now() - startTime > maxWaitTime) {
          console.error(`jsPDF library not found after polling timeout for ${scriptSrc}.`);
          clearInterval(intervalId);
          reject(new Error(`jsPDF library not found after polling timeout for ${scriptSrc}`));
        }
      }, pollInterval);
    };

    script.onerror = (error) => {
      console.error(`Failed to load jsPDF script from ${scriptSrc}:`, error);
      reject(new Error(`Failed to load jsPDF script from ${scriptSrc}`));
    };

    document.head.appendChild(script);
  });
}

// Utility to wait for jsPDF to be available
async function waitForJsPDF() {
  const localScriptPath = '/js/jspdf.umd.min.js';
  const cdnUrl = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';

  try {
    console.log(`Attempting to load jsPDF from local path: ${localScriptPath}`);
    const JsPDF = await loadJsPDF(localScriptPath);
    console.log('jsPDF loaded successfully from local path.');
    return JsPDF;
  } catch (error) {
    console.warn(`Initial jsPDF load from ${localScriptPath} failed:`, error.message);
    console.log(`Attempting to load jsPDF from fallback CDN: ${cdnUrl}...`);
    try {
      const JsPDF = await loadJsPDF(cdnUrl);
      console.log('jsPDF loaded successfully from CDN fallback.');
      return JsPDF;
    } catch (cdnError) {
      console.error(`Failed to load jsPDF from CDN fallback (${cdnUrl}):`, cdnError.message);
      throw new Error(`Failed to load jsPDF from both local path and CDN: ${cdnError.message}`);
    }
  }
}

// Utility to load PDFLib dynamically with polling
async function loadPdfLib(scriptSrc = '/js/pdf-lib.min.js') {
  return new Promise((resolve, reject) => {
    // Check if PDFLib is already available
    if (window.PDFLib) {
      console.log(`PDFLib already available (when trying to load ${scriptSrc})`);
      resolve(window.PDFLib);
      return;
    }

    console.log(`Dynamically loading PDFLib from ${scriptSrc}...`);
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true; // Keep async for non-blocking load

    script.onload = () => {
      console.log(`PDFLib script from ${scriptSrc} onload event fired.`);
      let startTime = Date.now();
      const maxWaitTime = 10000; // Use the 10-second timeout
      const pollInterval = 100;  // Polling interval

      const intervalId = setInterval(() => {
        console.log(`Polling for PDFLib library (from ${scriptSrc})...`);
        if (window.PDFLib) {
          console.log(`Found PDFLib on window object (polling from ${scriptSrc})`);
          clearInterval(intervalId);
          resolve(window.PDFLib);
        } else if (Date.now() - startTime > maxWaitTime) {
          console.error(`PDFLib library not found on window object after polling timeout for ${scriptSrc}.`);
          clearInterval(intervalId);
          reject(new Error(`PDFLib library not found on window object after polling timeout for ${scriptSrc}`));
        }
      }, pollInterval);
    };

    script.onerror = (error) => {
      console.error(`Failed to load PDFLib script from ${scriptSrc}:`, error);
      reject(new Error(`Failed to load PDFLib script from ${scriptSrc}`));
    };

    document.head.appendChild(script);
  });
}

// Collapsible Section Functionality
function setupCollapsibleSection(buttonId, contentId, isInitiallyExpanded) {
  const button = document.getElementById(buttonId);
  const content = document.getElementById(contentId);

  if (!button) {
    console.error(`Collapsible section button not found for ID: ${buttonId}`);
    return;
  }
  if (!content) {
    console.error(`Collapsible section content not found for ID: ${contentId}`);
    return;
  }

  button.addEventListener('click', () => {
    button.classList.toggle('active');
    content.classList.toggle('hidden');
  });

  if (isInitiallyExpanded) {
    content.classList.remove('hidden');
    button.classList.add('active');
  } else {
    content.classList.add('hidden');
    button.classList.remove('active');
  }
}

// Utility to Generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function ensureQRCodeIsAvailable(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkQRCode = () => {
      if (typeof window.QRCode === 'function') {
        console.log('QRCode library is available.');
        resolve();
      } else if (Date.now() - startTime > timeout) {
        console.error('QRCode library did not load within timeout.');
        reject(new Error('QRCode library failed to load in time.'));
      } else {
        setTimeout(checkQRCode, 100);
      }
    };
    checkQRCode();
  });
}

// Ensures PDFLib is available, attempting to load it if necessary.
async function ensurePDFLibIsAvailable(timeout = 10000) { // Timeout in loadPdfLib is primary
  if (window.PDFLib) {
    console.log('PDFLib library is already available on window.');
    return Promise.resolve();
  }
  console.log('ensurePDFLibIsAvailable: PDFLib not found, attempting to load dynamically...');
  try {
    await loadPdfLib('/js/pdf-lib.min.js'); // loadPdfLib has its own timeout
    console.log('ensurePDFLibIsAvailable: PDFLib loaded successfully.');
  } catch (error) {
    console.error('ensurePDFLibIsAvailable: Failed to load PDFLib.', error);
    // Rethrow the error so calling functions (like generateFastOrderReportPDF) can catch it.
    throw error;
  }
}

// Supplier Management
async function addSupplier() {
  const name = document.getElementById('supplierName').value.trim();
  if (!name) {
    alert('Please enter a supplier name.');
    return;
  }
  if (suppliers.includes(name)) {
    alert('Supplier already exists.');
    return;
  }
  try {
    await db.collection('suppliers').doc(name).set({ name });
    document.getElementById('supplierName').value = '';
    await loadSuppliers();
  } catch (error) {
    console.error('Error adding supplier:', error);
    alert('Failed to add supplier: ' + error.message);
  }
}

async function deleteSupplier(supplierName) {
  const products = await db.collection('inventory').where('supplier', '==', supplierName).get();
  if (!products.empty) {
    alert('Cannot delete supplier: in use by products.');
    return;
  }
  try {
    await db.collection('suppliers').doc(supplierName).delete();
    await loadSuppliers();
  } catch (error) {
    console.error('Error deleting supplier:', error);
    alert('Failed to delete supplier: ' + error.message);
  }
}

async function loadSuppliers() {
  try {
    console.log('Fetching suppliers from Firestore...');
    const snapshot = await db.collection('suppliers').get();
    console.log('Suppliers snapshot:', snapshot.size, 'documents');
    suppliers = snapshot.docs.map(doc => doc.data().name);
    console.log('Suppliers loaded:', suppliers);
    updateSupplierList();
    updateSupplierDropdown();
  } catch (error) {
    console.error('Error loading suppliers:', error);
    alert('Failed to load suppliers: ' + error.message);
  }
}

function updateSupplierList() {
  const supplierList = document.getElementById('supplierList');
  console.log('Updating supplier list with:', suppliers);
  supplierList.innerHTML = '';
  suppliers.forEach(supplier => {
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center';
    li.innerHTML = `${supplier} <button data-supplier="${supplier}" class="deleteSupplierBtn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>`;
    supplierList.appendChild(li);
  });
  console.log('Supplier list updated, items:', supplierList.children.length);
  document.querySelectorAll('.deleteSupplierBtn').forEach(button => {
    button.addEventListener('click', () => deleteSupplier(button.getAttribute('data-supplier')));
  });
}

function updateSupplierDropdown() {
  const productSupplierDropdown = document.getElementById('productSupplier');
  const filterSupplierDropdown = document.getElementById('filterSupplier');
  const filterToOrderSupplierDropdown = document.getElementById('filterToOrderSupplier');
  const filterOrderSupplierDropdown = document.getElementById('filterOrderSupplierDropdown'); // Added this line

  const populate = (dropdown, includeAllOption) => {
    if (!dropdown) return;
    const currentValue = dropdown.value;
    dropdown.innerHTML = includeAllOption ? '<option value="">All Suppliers</option>' : '<option value="">Select Supplier</option>';
    suppliers.forEach(supplier => {
      const option = document.createElement('option');
      option.value = supplier;
      option.textContent = supplier;
      dropdown.appendChild(option);
    });
    if (suppliers.includes(currentValue)) {
      dropdown.value = currentValue;
    }
  };

  populate(productSupplierDropdown, false);
  populate(filterSupplierDropdown, true);
  populate(filterToOrderSupplierDropdown, true);
  populate(filterOrderSupplierDropdown, true); // Added this line
  console.log('Supplier dropdowns updated.');
}

// Location Management
async function loadLocations() {
  try {
    console.log('Fetching locations from Firestore...');
    const snapshot = await db.collection('locations').orderBy('name').get();
    locations = snapshot.docs.map(doc => doc.data());
    console.log('Locations loaded:', locations);
    updateLocationList();
    updateLocationDropdowns();
  } catch (error) {
    console.error('Error loading locations:', error);
    alert('Failed to load locations: ' + error.message);
  }
}

function updateLocationList() {
  const locationList = document.getElementById('locationList');
  if (!locationList) return;
  locationList.innerHTML = '';
  locations.forEach(location => {
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center dark:text-gray-200';
    li.innerHTML = `${location.name} <button data-location-name="${location.name}" class="deleteLocationBtn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>`;
    locationList.appendChild(li);
  });
  document.querySelectorAll('.deleteLocationBtn').forEach(button => {
    button.addEventListener('click', () => deleteLocation(button.getAttribute('data-location-name')));
  });
}

async function addLocation() {
  const nameInput = document.getElementById('locationName');
  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) {
    alert('Please enter a location name.');
    return;
  }
  if (locations.some(loc => loc.name.toLowerCase() === name.toLowerCase())) {
    alert('Location already exists.');
    return;
  }
  try {
    await db.collection('locations').doc(name).set({ name });
    nameInput.value = '';
    await loadLocations();
  } catch (error) {
    console.error('Error adding location:', error);
    alert('Failed to add location: ' + error.message);
  }
}

async function deleteLocation(locationName) {
  try {
    const productsQuery = await db.collection('inventory').where('location', '==', locationName).get();
    if (!productsQuery.empty) {
      alert(`Cannot delete location "${locationName}": it is currently in use by ${productsQuery.size} product(s).`);
      return;
    }
    if (confirm(`Are you sure you want to delete location "${locationName}"?`)) {
      await db.collection('locations').doc(locationName).delete();
      await loadLocations();
    }
  } catch (error) {
    console.error('Error deleting location:', error);
    alert('Failed to delete location: ' + error.message);
  }
}

function updateLocationDropdowns() {
  const productLocationDropdown = document.getElementById('productLocation');
  const newLocationDropdown = document.getElementById('newLocation');
  const filterLocationDropdown = document.getElementById('filterLocation');

  const populate = (dropdown, includeAllOption) => {
    if (!dropdown) return;
    const currentValue = dropdown.value;
    dropdown.innerHTML = includeAllOption ? '<option value="">All Locations</option>' : '<option value="">Select Location</option>';
    locations.forEach(location => {
      const option = document.createElement('option');
      option.value = location.name;
      option.textContent = location.name;
      dropdown.appendChild(option);
    });
    if (locations.some(loc => loc.name === currentValue)) {
      dropdown.value = currentValue;
    }
     else if (dropdown.id === 'productLocation' && !currentValue && locations.length > 0 && !includeAllOption) {
     }
  };

  populate(productLocationDropdown, false);
  populate(newLocationDropdown, false);
  populate(filterLocationDropdown, true);
  console.log('Location dropdowns updated.');
}

// Product Photo Capture
async function startPhotoCapture() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera access not supported by this browser.');
    return;
  }
  try {
    photoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('photoVideo');
    video.srcObject = photoStream;
    video.classList.remove('hidden');
    document.getElementById('capturePhotoBtn').classList.add('hidden');
    document.getElementById('takePhotoBtn').classList.remove('hidden');
    document.getElementById('cancelPhotoBtn').classList.remove('hidden');
  } catch (err) {
    console.error('Error accessing camera:', err);
    alert('Error accessing camera: ' + err.message);
  }
}

async function takePhoto() {
  const video = document.getElementById('photoVideo');
  const canvas = document.getElementById('photoCanvas');
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const photoData = canvas.toDataURL('image/jpeg', 0.5);
  document.getElementById('productPhotoPreview').src = photoData;
  document.getElementById('productPhotoPreview').classList.remove('hidden');
  cancelPhoto();
}

function cancelPhoto() {
  if (photoStream) {
    photoStream.getTracks().forEach(track => track.stop());
    photoStream = null;
    document.getElementById('photoVideo').srcObject = null;
    document.getElementById('photoVideo').classList.add('hidden');
    document.getElementById('capturePhotoBtn').classList.remove('hidden');
    document.getElementById('takePhotoBtn').classList.add('hidden');
    document.getElementById('cancelPhotoBtn').classList.add('hidden');
  }
}

async function uploadPhoto(id, photoData) {
  if (!photoData || photoData === '') return '';
  try {
    const blob = await (await fetch(photoData)).blob();
    const storageRef = storage.ref(`products/${id}.jpg`);
    await storageRef.put(blob);
    return await storageRef.getDownloadURL();
  } catch (error) {
    console.error('Error uploading photo:', error);
    return '';
  }
}

// Product Management
async function submitProduct() {
  const id = document.getElementById('productId').value || generateUUID();
  const name = document.getElementById('productName').value.trim();
  const quantity = parseInt(document.getElementById('productQuantity').value) || 0;
  const cost = parseFloat(document.getElementById('productCost').value) || 0;
  const minQuantity = parseInt(document.getElementById('productMinQuantity').value) || 0;
  const quantityOrdered = parseInt(document.getElementById('productQuantityOrdered').value) || 0;
  const quantityBackordered = parseInt(document.getElementById('productQuantityBackordered').value) || 0;
  const reorderQuantity = parseInt(document.getElementById('productReorderQuantity').value) || 0;
  const supplier = document.getElementById('productSupplier').value;
  const location = document.getElementById('productLocation').value;
  const currentPhotoSrc = document.getElementById('productPhotoPreview').src;

  if (name && quantity >= 0 && cost >= 0 && minQuantity >= 0 && supplier && location) {
    const name_lowercase = name.toLowerCase();
    const name_words_lc = name_lowercase.split(' ').filter(word => word.length > 0); // Create word array
    try {
      let photoUrlToSave;
      const productIdValue = document.getElementById('productId').value;

      if (currentPhotoSrc.startsWith('data:image')) {
        photoUrlToSave = await uploadPhoto(id, currentPhotoSrc);
      } else if (productIdValue && currentPhotoSrc === originalPhotoUrlForEdit) {
        photoUrlToSave = originalPhotoUrlForEdit;
      } else if (!currentPhotoSrc) {
        photoUrlToSave = ''; 
      } else {
        photoUrlToSave = await uploadPhoto(id, currentPhotoSrc);
      }

      await db.collection('inventory').doc(id).set({
        id,
        name,
        name_lowercase,
        name_words_lc, // Add this new field
        quantity,
        cost,
        minQuantity,
        quantityOrdered,
        quantityBackordered,
        reorderQuantity,
        supplier,
        location,
        photo: photoUrlToSave
      });
      resetProductForm();
      await loadInventory();
    } catch (error) {
      console.error('Error submitting product:', error);
      alert('Failed to submit product: ' + error.message);
    }
  } else {
    alert('Please fill all fields with valid values.');
  }
}

async function editProduct(id) {
  const snapshot = await db.collection('inventory').where('id', '==', id).get();
  if (!snapshot.empty) {
    const product = snapshot.docs[0].data();
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productQuantity').value = product.quantity;
    document.getElementById('productCost').value = product.cost;
    document.getElementById('productMinQuantity').value = product.minQuantity;
    document.getElementById('productQuantityOrdered').value = product.quantityOrdered || 0;
    document.getElementById('productQuantityBackordered').value = product.quantityBackordered || 0;
    document.getElementById('productReorderQuantity').value = product.reorderQuantity || 0;
    document.getElementById('productSupplier').value = product.supplier;
    document.getElementById('productLocation').value = product.location;
    if (product.photo) {
      originalPhotoUrlForEdit = product.photo;
      document.getElementById('productPhotoPreview').src = product.photo;
      document.getElementById('productPhotoPreview').classList.remove('hidden');
    } else {
      originalPhotoUrlForEdit = '';
    }
    document.getElementById('toggleProductFormBtn').textContent = 'Edit Product';
    document.getElementById('productSubmitBtn').textContent = 'Update Product';
    document.getElementById('cancelEditBtn').classList.remove('hidden');
  }
}

function resetProductForm() {
  document.getElementById('productId').value = '';
  document.getElementById('productName').value = '';
  document.getElementById('productQuantity').value = '';
  document.getElementById('productCost').value = '';
  document.getElementById('productMinQuantity').value = '';
  document.getElementById('productQuantityOrdered').value = '';
  document.getElementById('productQuantityBackordered').value = '';
  document.getElementById('productReorderQuantity').value = '';
  document.getElementById('productSupplier').value = '';
  document.getElementById('productLocation').value = 'Surgery 1';
  document.getElementById('productPhotoPreview').src = '';
  document.getElementById('productPhotoPreview').classList.add('hidden');
  originalPhotoUrlForEdit = '';
  document.getElementById('toggleProductFormBtn').textContent = 'Add New Product';
  document.getElementById('productSubmitBtn').textContent = 'Add Product';
  document.getElementById('cancelEditBtn').classList.add('hidden');
  cancelPhoto();
}

async function deleteProduct(id) {
  if (confirm('Are you sure you want to delete this product?')) {
    try {
      await db.collection('inventory').doc(id).delete();
      try {
        await storage.ref(`products/${id}.jpg`).delete();
      } catch (err) {
        console.log('No photo to delete:', err);
      }
      await loadInventory();
      await updateToOrderTable();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product: ' + error.message);
    }
  }
}

// Batch Updates
function addBatchEntry() {
  const batchUpdatesDiv = document.getElementById('batchUpdates');
  const entryId = `batch-${batchUpdates.length}`;
  const entryDiv = document.createElement('div');
  entryDiv.className = 'flex gap-2 items-center'; // Keep this class for overall row alignment
  entryDiv.innerHTML = `
    <input id="${entryId}-id" type="text" placeholder="Product ID (from scan)" class="border dark:border-gray-600 p-2 rounded flex-1 dark:bg-slate-700 dark:text-gray-200 dark:placeholder-gray-400" style="min-width: 150px;">
    <span id="${entryId}-name" class="text-sm text-gray-700 dark:text-gray-300 w-48 truncate" title="Product name will appear here" style="line-height: 2.5rem;"></span>
    <input id="${entryId}-quantity" type="number" placeholder="Quantity" class="border dark:border-gray-600 p-2 rounded w-24 dark:bg-slate-700 dark:text-gray-200 dark:placeholder-gray-400">
    <select id="${entryId}-action" class="border dark:border-gray-600 p-2 rounded w-32 dark:bg-slate-700 dark:text-gray-200">
      <option value="add">Add</option>
      <option value="remove">Remove</option>
    </select>
    <button data-entry-id="${entryId}" class="removeBatchEntryBtn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Remove</button>
  `;
  batchUpdatesDiv.appendChild(entryDiv);
  batchUpdates.push(entryId);

  const productIdInput = document.getElementById(`${entryId}-id`);
  if (productIdInput) {
    productIdInput.focus();

    productIdInput.addEventListener('keypress', function(event) {
      if ((event.key === 'Enter' || event.keyCode === 13) && productIdInput.value.trim() !== '') {
        event.preventDefault();
        const currentProductId = productIdInput.value.trim();
        const currentEntryId = productIdInput.id.replace('-id', '');
        const nameSpan = document.getElementById(`${currentEntryId}-name`);

        if (nameSpan) {
          db.collection('inventory').doc(currentProductId).get().then(doc => {
            if (doc.exists) {
              nameSpan.textContent = doc.data().name;
              nameSpan.title = doc.data().name;
            } else {
              nameSpan.textContent = 'Not Found';
              nameSpan.title = 'Product Not Found';
            }
          }).catch(err => {
            console.error("Error fetching product name for batch manual entry:", err);
            nameSpan.textContent = 'Error';
            nameSpan.title = 'Error fetching name';
          });
        }

        stopUpdateScanner(); // Ensure any camera scanner for this batch is stopped
        console.log('Enter in batch Product ID ' + entryId + '. Value: ' + currentProductId + '. Adding new row.');
        // Logic to focus next or add new row
        const quantityInput = document.getElementById(`${currentEntryId}-quantity`);
        if (quantityInput) {
            quantityInput.focus();
        } else {
            addBatchEntry(); // Fallback if quantity input somehow not found, though unlikely
        }
        // To decide whether to add a new row or just move focus, we might need more context
        // For now, let's assume if we are on the last item, we add a new one.
        // This part of the logic might need to be the same as what was there before,
        // or adjusted based on whether this is the *last* entry.
        // The original code just called addBatchEntry(); which might be too aggressive if not the last line.
        // Let's refine to: focus quantity, and if it's the last entry, then add new.

        // Check if this is the last entry in batchUpdates
        const isLastEntry = batchUpdates.indexOf(currentEntryId) === batchUpdates.length - 1;
        if (isLastEntry) {
            // If quantity is filled, or if user presses enter again from quantity,
            // then consider adding new row. For now, just focusing quantity is enough.
            // The original 'addBatchEntry()' call here might have been for quick multi-add.
            // Replicating previous behavior for now:
            // addBatchEntry(); // This might be too aggressive if not the last line.
            // Let's make it focus quantity first, then if enter on quantity of last line, add new.
            // For now, just focus quantity. The original code was: addBatchEntry();
            // The original logic was: stopUpdateScanner(); console.log(...); addBatchEntry();
            // This means after typing ID and enter, it immediately added a new blank row.
            // Let's keep that original behavior for adding a new row for speed.
             addBatchEntry();
        }


      }
    });
  }

  const clearToOrderFilterBtnEl = document.getElementById('clearToOrderFilterBtn');
  if (clearToOrderFilterBtnEl) {
    clearToOrderFilterBtnEl.addEventListener('click', () => {
      const filterToOrderSupplierDropdown = document.getElementById('filterToOrderSupplier');
      if (filterToOrderSupplierDropdown) {
        filterToOrderSupplierDropdown.value = "";
      }
      updateToOrderTable();
    });
  }


  const newRemoveButton = entryDiv.querySelector('.removeBatchEntryBtn');
  if (newRemoveButton) {
      newRemoveButton.addEventListener('click', () => {
          removeBatchEntry(newRemoveButton.getAttribute('data-entry-id'));
      });
  }

}

function removeBatchEntry(entryId) {
  const idInput = document.getElementById('batchUpdates').querySelector(`[id="${entryId}-id"]`);
  if (idInput && idInput.parentElement) {
      idInput.parentElement.remove();
      batchUpdates = batchUpdates.filter(id => id !== entryId);
  } else {
      console.error(`Could not find element or its parent to remove for entryId: ${entryId}. idInput found: ${!!idInput}`);
  }
}

async function submitBatchUpdates() {
  let messages = [];
  for (const entryId of batchUpdates) {
    const productId = document.getElementById(`${entryId}-id`).value.trim();
    const quantity = parseInt(document.getElementById(`${entryId}-quantity`).value) || 0;
    const action = document.getElementById(`${entryId}-action`).value;
    const snapshot = await db.collection('inventory').where('id', '==', productId).get();
    if (!snapshot.empty) {
      const product = snapshot.docs[0].data();
      if (quantity > 0) {
        if (action === 'add') {
          const newQuantity = product.quantity + quantity;
          await db.collection('inventory').doc(productId).update({ quantity: newQuantity });
          messages.push(`Added ${quantity} to ${product.name}. New quantity: ${newQuantity}`);
        } else if (action === 'remove') {
          if (product.quantity >= quantity) {
            const newQuantity = product.quantity - quantity;
            await db.collection('inventory').doc(productId).update({ quantity: newQuantity });
            messages.push(`Removed ${quantity} from ${product.name}. New quantity: ${newQuantity}`);
          } else {
            messages.push(`Cannot remove ${quantity} from ${product.name}. Only ${product.quantity} available.`);
          }
        }
      } else {
        messages.push(`Invalid quantity for ${product.name}.`);
      }
    } else {
      messages.push(`Product ID ${productId} not found.`);
    }
  }
  if (messages.length > 0) {
    await loadInventory();
    await updateToOrderTable();
    document.getElementById('batchUpdates').innerHTML = '';
    batchUpdates = [];
    alert(messages.join('\n'));
  } else {
    alert('No updates to process.');
  }
}

// Move Product
async function moveProduct() {
  const productId = document.getElementById('moveProductId').value.trim();
  const newLocation = document.getElementById('newLocation').value;
  const snapshot = await db.collection('inventory').where('id', '==', productId).get();
  if (!snapshot.empty) {
    const product = snapshot.docs[0].data();
    try {
      await db.collection('inventory').doc(productId).update({ location: newLocation });
      await loadInventory();
      await updateToOrderTable();
      document.getElementById('moveProductId').value = '';
      alert(`Product ${product.name} moved to ${newLocation}`);
    } catch (error) {
      console.error('Error moving product:', error);
      alert('Failed to move product: ' + error.message);
    }
  } else {
    alert('Product not found.');
  }
}

// Inventory Management
let productIdsWithPendingOrders = []; // Global or module-scoped variable

async function loadInventory() {
  try {
    console.log('Fetching inventory from Firestore...');
    const inventorySnapshot = await db.collection('inventory').get();
    console.log('Inventory snapshot:', inventorySnapshot.size, 'documents');
    inventory = inventorySnapshot.docs.map(doc => doc.data());
    console.log('Inventory loaded:', inventory);

    // Fetch pending orders to identify products
    console.log('Fetching pending orders...');
    const ordersSnapshot = await db.collection('orders').where('status', '==', 'Pending').get();
    productIdsWithPendingOrders = ordersSnapshot.docs.map(doc => doc.data().productId);
    // Remove duplicates, if any product has multiple pending orders
    productIdsWithPendingOrders = [...new Set(productIdsWithPendingOrders)];
    console.log('Product IDs with pending orders:', productIdsWithPendingOrders);

    currentPage = 1; // Reset to page 1 on initial load
    applyAndRenderInventoryFilters(); // This will call updateInventoryTable, which now needs access to productIdsWithPendingOrders
    await updateToOrderTable();
  } catch (error) {
    console.error('Error loading inventory or pending orders:', error);
    alert('Failed to load inventory: ' + error.message);
  }
}

function applyAndRenderInventoryFilters() {
  const supplierFilter = document.getElementById('filterSupplier') ? document.getElementById('filterSupplier').value : '';
  const locationFilter = document.getElementById('filterLocation') ? document.getElementById('filterLocation').value : '';
  const searchTerm = document.getElementById('inventorySearchInput') ? document.getElementById('inventorySearchInput').value.toLowerCase().trim() : '';

  let filteredInventory = inventory;

  if (supplierFilter) {
    filteredInventory = filteredInventory.filter(item => item.supplier === supplierFilter);
  }
  if (locationFilter) {
    filteredInventory = filteredInventory.filter(item => item.location === locationFilter);
  }
  if (searchTerm) {
    filteredInventory = filteredInventory.filter(item => {
        return (item.name && item.name.toLowerCase().includes(searchTerm)) ||
               (item.id && item.id.toLowerCase().includes(searchTerm)) ||
               (item.supplier && item.supplier.toLowerCase().includes(searchTerm)); 
    });
  }

  totalFilteredItems = filteredInventory.length;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const itemsToDisplayOnPage = filteredInventory.slice(startIndex, endIndex);

  updateInventoryTable(itemsToDisplayOnPage);
  updatePaginationUI();
}

function updatePaginationUI() {
    const pageInfo = document.getElementById('pageInfo');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    if (!pageInfo || !prevPageBtn || !nextPageBtn) {
        console.warn("Pagination UI elements not found.");
        return;
    }

    const totalPages = Math.ceil(totalFilteredItems / ITEMS_PER_PAGE);

    pageInfo.textContent = `Page ${currentPage} of ${totalPages > 0 ? totalPages : 1}`;

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;

    observeLazyLoadImages();
}

function handlePreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        applyAndRenderInventoryFilters();
    }
}

function handleNextPage() {
    const totalPages = Math.ceil(totalFilteredItems / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        applyAndRenderInventoryFilters();
    }
}

function updateInventoryTable(itemsToDisplay) {
  const tableBody = document.getElementById('inventoryTable');
  console.log('Updating inventory table with:', itemsToDisplay);
  tableBody.innerHTML = '';

  if (!itemsToDisplay || itemsToDisplay.length === 0) {
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 13;
    cell.textContent = 'No products found matching your criteria.';
    cell.className = 'text-center p-4 dark:text-gray-400';
    return;
  }

  itemsToDisplay.forEach(item => {
    const row = document.createElement('tr');
    const isLowStock = item.quantity <= item.minQuantity;
    const hasPendingOrder = productIdsWithPendingOrders.includes(item.id);

    if (isLowStock) {
      row.className = 'bg-red-100 dark:bg-red-800/60';
    } else if (hasPendingOrder) {
      row.className = 'inventory-row-pending-order'; // New class for pending order background
    }

    // NOTE: Images are displayed as w-16 h-16 thumbnails via CSS.
    // However, the item.photo URL likely points to the original uploaded image.
    // For optimal performance and reduced data usage, it is highly recommended
    // to implement backend image resizing (e.g., using a Firebase Extension like "Resize Images")
    // to generate and serve actual thumbnail URLs. Lazy loading (implemented) helps,
    // but serving smaller images is key.
    const placeholderSrc = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    row.innerHTML = `
      <td class="border dark:border-slate-600 p-2 id-column hidden">${item.id}</td>
      <td class="border dark:border-slate-600 p-2">${item.name}</td>
      <td class="border dark:border-slate-600 p-2">${item.quantity}</td>
      <td class="border dark:border-slate-600 p-2">${item.minQuantity}</td>
      <td class="border dark:border-slate-600 p-2">${item.reorderQuantity || 0}</td>
      <td class="border dark:border-slate-600 p-2">${item.cost.toFixed(2)}</td>
      <td class="border dark:border-slate-600 p-2">${item.supplier}</td>
      <td class="border dark:border-slate-600 p-2">${item.location}</td>
      <td class="border dark:border-slate-600 p-2">${item.quantityOrdered || 0}</td>
      <td class="border dark:border-slate-600 p-2">${item.quantityBackordered || 0}</td>
      <td class="border dark:border-slate-600 p-2">${item.photo ? `<img data-src="${item.photo}" src="${placeholderSrc}" alt="Product Photo: ${item.name}" class="w-16 h-16 object-cover mx-auto cursor-pointer inventory-photo-thumbnail lazy-load-image">` : 'No Photo'}</td>
      <td class="border dark:border-slate-600 p-2"><div id="qrcode-${item.id}" class="mx-auto w-24 h-24"></div></td>
      <td class="border dark:border-slate-600 p-2">
        <button data-id="${item.id}" class="editProductBtn text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mr-2">Edit</button>
        <button data-id="${item.id}" class="deleteProductBtn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);

    if (item.photo) {
      const thumbnailImg = row.querySelector('.inventory-photo-thumbnail');
      if (thumbnailImg) {
        thumbnailImg.addEventListener('click', () => {
          if (imageModal && modalImage) { 
            modalImage.src = item.photo;
            imageModal.classList.remove('hidden');
            console.log('Opening image modal for:', item.photo);
          } else {
            console.error('Modal elements not available for image click.');
          }
        });
      }
    }

    const qrCodeDiv = document.getElementById(`qrcode-${item.id}`);
    try {
      console.log('QRCode check:', typeof window.QRCode);
      if (typeof window.QRCode !== 'function') {
        throw new Error('QRCode is not a constructor');
      }
      new window.QRCode(qrCodeDiv, {
        text: item.id,
        width: 96,
        height: 96,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.L
      });
    } catch (error) {
      console.error('QR Code generation failed for ID', item.id, ':', error);
      qrCodeDiv.innerHTML = `<p class="text-red-500 dark:text-red-400">QR Code generation failed: ${error.message}</p>`;
    }
  });
  console.log('Inventory table updated, rows:', tableBody.children.length);
  document.querySelectorAll('.editProductBtn').forEach(button => {
    button.addEventListener('click', () => editProduct(button.getAttribute('data-id')));
  });
  document.querySelectorAll('.deleteProductBtn').forEach(button => {
    button.addEventListener('click', () => deleteProduct(button.getAttribute('data-id')));
  });
}

async function updateToOrderTable() {
  const snapshot = await db.collection('inventory').get();
  let toOrderItems = snapshot.docs.map(doc => doc.data()).filter(item => (item.quantity + (item.quantityOrdered || 0)) <= item.minQuantity);
  const toOrderTable = document.getElementById('toOrderTable');
  toOrderTable.innerHTML = '';

  const filterToOrderSupplierDropdown = document.getElementById('filterToOrderSupplier');
  const selectedSupplier = filterToOrderSupplierDropdown ? filterToOrderSupplierDropdown.value : "";
  if (selectedSupplier) {
    toOrderItems = toOrderItems.filter(item => item.supplier === selectedSupplier);
  }

  const reorderNotificationBar = document.getElementById('reorderNotificationBar');
  reorderNotificationBar.dataset.reorderCount = toOrderItems.length; // Store the count

  if (toOrderItems.length > 0) {
    // Text content will be set by applySidebarState or based on current sidebar state
    reorderNotificationBar.classList.remove('hidden');
  } else {
    reorderNotificationBar.classList.add('hidden');
    // Text content will be set by applySidebarState or based on current sidebar state
  }
  // Call applySidebarState to update text based on current view
  applySidebarState(localStorage.getItem(SIDEBAR_STATE_KEY) === 'true');

  toOrderItems.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="border dark:border-slate-600 p-2 to-order-id-column hidden">${item.id}</td>
      <td class="border dark:border-slate-600 p-2">${item.name}</td>
      <td class="border dark:border-slate-600 p-2">${item.quantity}</td>
      <td class="border dark:border-slate-600 p-2">${item.minQuantity}</td>
      <td class="border dark:border-slate-600 p-2">${item.reorderQuantity || 0}</td>
      <td class="border dark:border-slate-600 p-2">${item.supplier}</td>
      <td class="border dark:border-slate-600 p-2">${item.quantityOrdered || 0}</td>
      <td class="border dark:border-slate-600 p-2">${item.quantityBackordered || 0}</td>
    `;
    toOrderTable.appendChild(row);
  });
}

// QR Code PDF Generation
async function generateQRCodePDF() {
  try {
    if (typeof window.QRCode !== 'function') {
      throw new Error('QRCode library is not loaded');
    }

    const JsPDF = await waitForJsPDF();
    const filterLocationDropdown = document.getElementById('filterLocation');
    const selectedLocationFilter = filterLocationDropdown ? filterLocationDropdown.value : '';

    let allProductsForPDF = [];
    let preliminaryProductGroups = {}; // Used to hold structure for counting

    if (selectedLocationFilter) {
      const snapshot = await db.collection('inventory').where('location', '==', selectedLocationFilter).get();
      allProductsForPDF = snapshot.docs.map(doc => doc.data());
      if (allProductsForPDF.length > 0) {
        preliminaryProductGroups[selectedLocationFilter] = allProductsForPDF; // Keep structure for grouping later
      }
    } else {
      const snapshot = await db.collection('inventory').get();
      allProductsForPDF = snapshot.docs.map(doc => doc.data());
      // For "All Locations", we group them now to correctly count unique products if some are multi-location (though current model is 1 loc/product)
      // and to prepare for the main productGroups logic later.
      if (allProductsForPDF.length > 0) {
        preliminaryProductGroups = allProductsForPDF.reduce((acc, product) => {
          const location = product.location || 'Unassigned';
          if (!acc[location]) {
            acc[location] = [];
          }
          acc[location].push(product);
          return acc;
        }, {});
      }
    }

    // Calculate total number of products from the fetched data
    let totalNumberOfProductsInPDF = 0;
    if (selectedLocationFilter) {
        totalNumberOfProductsInPDF = allProductsForPDF.length;
    } else {
        // If not filtered, count all products that were fetched and grouped
        Object.values(preliminaryProductGroups).forEach(group => {
            totalNumberOfProductsInPDF += group.length;
        });
    }

    const LARGE_PDF_THRESHOLD = 200;

    if (totalNumberOfProductsInPDF > LARGE_PDF_THRESHOLD) {
      const userConfirmed = confirm(
        `You are about to generate a PDF with ${totalNumberOfProductsInPDF} QR codes. ` +
        `This might take a long time and result in a large file. ` +
        `It's recommended to filter by location for smaller, more manageable PDFs. ` +
        `Do you want to proceed?`
      );
      if (!userConfirmed) {
        alert("PDF generation cancelled by user.");
        return;
      }
    }

    // Now, finalize productGroups based on what was fetched for the warning
    let productGroups = {};
    if (selectedLocationFilter) {
        if (allProductsForPDF.length > 0) {
            productGroups[selectedLocationFilter] = allProductsForPDF;
        }
    } else {
        // Use the already grouped products from preliminaryProductGroups
        productGroups = { ...preliminaryProductGroups }; // Shallow copy is fine here

        // Sort productGroups if it was for "All Locations"
        const sortedLocationNames = Object.keys(productGroups).sort();
        const sortedProductGroups = {};
        for (const locationName of sortedLocationNames) {
          sortedProductGroups[locationName] = productGroups[locationName];
        }
        productGroups = sortedProductGroups;
    }

    if (Object.keys(productGroups).length === 0 && totalNumberOfProductsInPDF === 0) { // Adjusted condition
      alert('No products found for the selected location or in inventory to generate QR codes for.');
      return;
    }

    const doc = new JsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const COLS = 4;
    const ROWS = 3;
    const PRODUCTS_PER_PAGE = COLS * ROWS;
    const MARGIN = 40;
    const QR_SIZE = 60;
    const NAME_FONT_SIZE = 8;
    const TEXT_AREA_HEIGHT = 20;
    const ADDITIONAL_VERTICAL_PADDING_POINTS = 158.4;
    const CELL_PADDING_VERTICAL = 10 + ADDITIONAL_VERTICAL_PADDING_POINTS;

    const IMAGE_HEIGHT = 40;
    const IMAGE_WIDTH = QR_SIZE;

    const USABLE_WIDTH = pageWidth - 2 * MARGIN;
    const QR_SPACING_HORIZONTAL = (USABLE_WIDTH - COLS * QR_SIZE) / (COLS - 1);
    
    // Correct CELL_HEIGHT calculation: QR_SIZE + TEXT_AREA_HEIGHT + (padding for name) + IMAGE_HEIGHT + (padding for image) + CELL_PADDING_VERTICAL
    // The TEXT_AREA_HEIGHT already includes space for the name.
    // The 5 points are for padding between text area and image.
    const CELL_HEIGHT = QR_SIZE + TEXT_AREA_HEIGHT + IMAGE_HEIGHT + 5 + CELL_PADDING_VERTICAL;

    let pageNumber = 0;

    const drawPageHeaders = (docInstance, locationName, genDate) => {
      docInstance.setFontSize(16);
      docInstance.text('Watagan Dental QR Codes', MARGIN, MARGIN);
      docInstance.setFontSize(10);
      docInstance.text(`Generated: ${genDate}`, MARGIN, MARGIN + 15);
      if (locationName) {
        docInstance.setFontSize(12);
        docInstance.setFont('helvetica', 'bold');
        docInstance.text(`Location: ${locationName}`, MARGIN, MARGIN + 35);
        docInstance.setFont('helvetica', 'normal');
      }
      return MARGIN + 55;
    };
    
    const generationDate = new Date().toLocaleDateString();
    const locationNames = Object.keys(productGroups);
    console.log('Final product groups for PDF generation:', productGroups); // Added console log

    for (let i = 0; i < locationNames.length; i++) {
      const locationName = locationNames[i];
      const productsInLocation = productGroups[locationName];

      // Sort productsInLocation by name alphabetically
      productsInLocation.sort((a, b) => a.name.localeCompare(b.name));

      let productCountInLocationOnPage = 0;
      let currentYOffset = 0;

      for (let j = 0; j < productsInLocation.length; j++) {
        const product = productsInLocation[j];
        console.log('Processing product for PDF QR:', product); // Added console log

        if (productCountInLocationOnPage === 0) {
          pageNumber++;
          if (pageNumber > 1) {
            doc.addPage();
          }
          currentYOffset = drawPageHeaders(doc, locationName, generationDate);
        }

        const col = productCountInLocationOnPage % COLS;
        const row = Math.floor(productCountInLocationOnPage / COLS);

        const x = MARGIN + col * (QR_SIZE + QR_SPACING_HORIZONTAL);
        const y = currentYOffset + row * CELL_HEIGHT;

        if (!product.id || !product.name) {
          console.warn('Skipping product with missing ID or name:', product);
          productCountInLocationOnPage++;
          if (productCountInLocationOnPage >= PRODUCTS_PER_PAGE) {
            productCountInLocationOnPage = 0;
          }
          continue;
        }
        
        const detachedQrContainer = document.createElement('div');
        // We don't append detachedQrContainer to the live DOM.
        // Set its size if QRCode.js relies on parent dimensions for sizing, though options usually control this.
        // detachedQrContainer.style.width = QR_SIZE + 'px'; // May not be needed if options.width is set
        // detachedQrContainer.style.height = QR_SIZE + 'px'; // May not be needed if options.height is set

        let qrImageFromCanvas = '';
        try {
            const qrOptions = {
                text: product.id,
                width: QR_SIZE, // QR_SIZE is a variable in the existing code
                height: QR_SIZE,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: window.QRCode.CorrectLevel.L
            };

            new window.QRCode(detachedQrContainer, qrOptions); // QRCode will append a canvas or img to detachedQrContainer

            const qrCanvas = detachedQrContainer.querySelector('canvas');
            if (qrCanvas) {
                qrImageFromCanvas = qrCanvas.toDataURL('image/png');
            } else {
                const qrImgTag = detachedQrContainer.querySelector('img');
                if (qrImgTag) {
                    // If it's an img, we might need to draw it to a temporary canvas to get a data URL
                    // if jsPDF cannot directly use the img.src (e.g. if src is also a data URL but jsPDF has issues)
                    // For now, assume qrImgTag.src is usable or can be made usable.
                    // jsPDF's addImage can often handle data URLs directly from img.src.
                    qrImageFromCanvas = qrImgTag.src;
                } else {
                    console.error('QRCode.js did not create a canvas or img in detached container for product: ' + product.id);
                    // continue; // Or handle error appropriately
                }
            }

            if (qrImageFromCanvas) {
                doc.addImage(qrImageFromCanvas, 'PNG', x, y, QR_SIZE, QR_SIZE);
            } else {
                console.warn(`Skipping addImage for product ${product.id} due to missing QR image data (detached method).`);
            }

        } catch (qrError) {
            console.error('Error generating QR code for product ID', product.id, ' (detached method):', qrError);
            doc.setFontSize(8);
            doc.text('QR Error', x + QR_SIZE / 2, y + QR_SIZE / 2, { align: 'center' });
        }
        // detachedQrContainer will be garbage collected as it's not in the DOM and no longer referenced after the loop iteration.

        doc.setFontSize(NAME_FONT_SIZE);
        const textYPosition = y + QR_SIZE + (TEXT_AREA_HEIGHT + NAME_FONT_SIZE) / 2; // y for product name
        doc.text(product.name, x + QR_SIZE / 2, textYPosition, {
            align: 'center',
            maxWidth: QR_SIZE
        });

        // Add product image
        console.log(`Product ${product.name} - Photo URL: ${product.photo ? product.photo : 'No photo URL'}`);
        if (product.photo) {
          const yForImage = y + QR_SIZE + TEXT_AREA_HEIGHT + 5; // Position for image
          const imageX = x + (QR_SIZE - IMAGE_WIDTH) / 2;   // Centered X for image
          let imagePath = ''; // Defined to be accessible in catch

          try {
            imagePath = `products/${product.id}.jpg`;
            console.log(`Processing image for ${product.name}. Path: ${imagePath}. Original photo URL in DB: ${product.photo || 'N/A'}`);

            const imageRef = storage.ref(imagePath);
            const downloadURL = await imageRef.getDownloadURL();
            console.log(`Successfully got download URL for ${product.name}: ${downloadURL}`);

            const response = await fetch(downloadURL);
            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }
            const blob = await response.blob();

            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject; // Pass the error to the promise's reject
              reader.readAsDataURL(blob);
            });

            doc.addImage(dataUrl, undefined, imageX, yForImage, IMAGE_WIDTH, IMAGE_HEIGHT);

          } catch (err) {
            console.error(`Error processing or adding image for ${product.name} (ID: ${product.id}, Path: ${imagePath}, Original URL in DB: ${product.photo || 'N/A'}): ${err.message}`, err);
            // Ensure imageX and yForImage are defined in this scope if an error happens early
            const currentXForErrorText = imageX || (x + (QR_SIZE - (IMAGE_WIDTH || QR_SIZE)) / 2);
            const currentYForErrorText = yForImage || (y + QR_SIZE + TEXT_AREA_HEIGHT + 5 + (IMAGE_HEIGHT || 40) / 2);
            doc.setFontSize(6);
            doc.text('Image Error', currentXForErrorText + (IMAGE_WIDTH || QR_SIZE) / 2, currentYForErrorText, { align: 'center' });
          }
        }

        productCountInLocationOnPage++;
        if (productCountInLocationOnPage >= PRODUCTS_PER_PAGE) {
          productCountInLocationOnPage = 0;
        }
      }
    }
    doc.save('Watagan_Dental_QR_Codes.pdf');
  } catch (error) {
    console.error('Failed to generate QR Code PDF:', error, error.stack);
    alert('Failed to generate QR Code PDF: ' + error.message);
  }
}

// Order Reports
async function generateDetailedOrderReportPDFWithQRCodes() {
  console.log('[QR Order Report] Function started.'); // LOG START
  try {
    // Fetch data early for warning and reuse
    console.log('[QR Order Report] Fetching inventory for report...'); // LOG
    const snapshot = await db.collection('inventory').get();
    let toOrderItems = snapshot.docs.map(doc => doc.data()).filter(item => item.quantity <= item.minQuantity);
    console.log(`[QR Order Report] Initial toOrderItems count: ${toOrderItems.length}`); // LOG COUNT

    const filterToOrderSupplierDropdownEarly = document.getElementById('filterToOrderSupplier');
    const selectedSupplierFilterEarly = filterToOrderSupplierDropdownEarly ? filterToOrderSupplierDropdownEarly.value : "";
    if (selectedSupplierFilterEarly) {
      toOrderItems = toOrderItems.filter(item => item.supplier === selectedSupplierFilterEarly);
      console.log(`[QR Order Report] Filtered toOrderItems by supplier '${selectedSupplierFilterEarly}', count: ${toOrderItems.length}`); // LOG COUNT AFTER FILTER
    }

    // Log a sample of items
    if (toOrderItems.length > 0) {
      console.log('[QR Order Report] Sample of toOrderItems (first 2):', JSON.stringify(toOrderItems.slice(0, 2)));
    }


    const totalNumberOfItemsInReport = toOrderItems.length;
    const LARGE_REPORT_THRESHOLD = 100;

    if (totalNumberOfItemsInReport > LARGE_REPORT_THRESHOLD) {
      console.log(`[QR Order Report] Report has ${totalNumberOfItemsInReport} items, showing confirmation.`); // LOG
      const userConfirmed = confirm(
        `You are about to generate a detailed order report with ${totalNumberOfItemsInReport} items (including QR codes). ` +
        `This might take a very long time and result in a large file. ` +
        `Do you want to proceed?`
      );
      if (!userConfirmed) {
        alert("Detailed order report generation cancelled by user.");
        console.log('[QR Order Report] User cancelled generation due to large report size.'); // LOG
        return;
      }
    }

    if (toOrderItems.length === 0) {
      alert('No products need reordering.');
      console.log('[QR Order Report] No products to reorder, exiting.'); // LOG
      return;
    }

    console.log('[QR Order Report] Ensuring QRCode.js is available...'); // LOG
    await ensureQRCodeIsAvailable();
    console.log('[QR Order Report] Ensuring jsPDF is available...'); // LOG
    const JsPDF = await waitForJsPDF();
    const doc = new JsPDF();
    console.log('[QR Order Report] jsPDF instance created.'); // LOG

    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const bottomMargin = 20;
    const QR_CODE_SIZE_IN_PDF = 30;
    const ROW_HEIGHT = QR_CODE_SIZE_IN_PDF + 5; // Ensure this is enough
    const TEXT_FONT_SIZE = 10;
    const HEADER_FONT_SIZE = 12;
    const SUPPLIER_HEADER_FONT_SIZE = 14;

    let xQr = margin;
    let xName = xQr + QR_CODE_SIZE_IN_PDF + 5;
    // Adjust other x positions based on expected content width
    let xQty = xName + 80 + 5; // Name width: 80
    let xQtyOrdered = xQty + 30 + 5; // Qty width: 30
    let xQtyBackordered = xQtyOrdered + 40 + 5; // Qty Ord width: 40
    let xReorderQty = xQtyBackordered + 40 + 5; // Backorder width: 40
    let xSupplier = xReorderQty + 40 + 5; // ReorderQty width: 40


    let y = margin + 20;

    function drawPageHeaders(docInstance, currentY) {
        console.log(`[QR Order Report] Drawing page headers at Y: ${currentY}`); // LOG
        docInstance.setFontSize(16);
        docInstance.text('Watagan Dental Order Report', margin, margin);
        docInstance.setFontSize(TEXT_FONT_SIZE);
        docInstance.text(`Date: ${new Date().toLocaleDateString()}`, margin, margin + 10);
        
        currentY = margin + 30;
        docInstance.setFont("helvetica", "bold");
        docInstance.setFontSize(HEADER_FONT_SIZE);
        docInstance.text('QR Code', xQr, currentY);
        docInstance.text('Name', xName, currentY);
        docInstance.text('Qty', xQty, currentY, { align: 'right' });
        docInstance.text('Qty Ord', xQtyOrdered, currentY, { align: 'right' });
        // Corrected header text for backordered quantity
        docInstance.text('Backorder', xQtyBackordered, currentY, { align: 'right' });
        docInstance.text('ReorderQ', xReorderQty, currentY, { align: 'right' });
        docInstance.text('Supplier', xSupplier, currentY);
        docInstance.setFont("helvetica", "normal");
        
        currentY += 7; // Space after headers
        docInstance.setLineWidth(0.5);
        docInstance.line(margin, currentY, pageWidth - margin, currentY); // Line under headers
        currentY += 10; // Space after line
        return currentY;
    }

    y = drawPageHeaders(doc, y);

    const itemsBySupplierGroup = toOrderItems.reduce((acc, item) => {
      const supplierName = item.supplier || 'Supplier Not Assigned';
      if (!acc[supplierName]) {
        acc[supplierName] = [];
      }
      acc[supplierName].push(item);
      return acc;
    }, {});
    console.log('[QR Order Report] Items grouped by supplier.'); // LOG

    const sortedSupplierNames = Object.keys(itemsBySupplierGroup).sort();

    for (const supplierName of sortedSupplierNames) {
        const items = itemsBySupplierGroup[supplierName];
        if (items.length === 0) continue;
        console.log(`[QR Order Report] Processing supplier: ${supplierName}, items: ${items.length}`); // LOG

        if (y + 20 + (items.length * ROW_HEIGHT) > pageHeight - bottomMargin) { // Rough check, might need refinement
            console.log(`[QR Order Report] Adding new page for supplier ${supplierName}. Current Y: ${y}`); // LOG
            doc.addPage();
            y = drawPageHeaders(doc, margin + 30); // Reset Y to top after headers
        }
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(SUPPLIER_HEADER_FONT_SIZE);
        doc.text(supplierName, margin, y);
        y += SUPPLIER_HEADER_FONT_SIZE; 
        doc.setFont("helvetica", "normal");
        doc.setFontSize(TEXT_FONT_SIZE);

        for (const item of items) {
            console.log(`[QR Order Report] Processing item: ${item.name} (ID: ${item.id}) at Y: ${y}`); // LOG ITEM
            if (y + ROW_HEIGHT > pageHeight - bottomMargin) {
                console.log(`[QR Order Report] Adding new page for item ${item.name}. Current Y: ${y}`); // LOG
                doc.addPage();
                y = drawPageHeaders(doc, margin + 30); // Reset Y to top after headers
                // Redraw supplier header if it's a continued section
                doc.setFont("helvetica", "bold");
                doc.setFontSize(SUPPLIER_HEADER_FONT_SIZE);
                doc.text(`${supplierName} (continued)`, margin, y);
                y += SUPPLIER_HEADER_FONT_SIZE;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(TEXT_FONT_SIZE);
            }

            const tempDivId = `temp-qr-order-${item.id}`;
            const tempDiv = document.createElement('div');
            tempDiv.id = tempDivId;
            // Make it invisible but attach to DOM for QRCode.js to work reliably
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.style.top = '-9999px';
            tempDiv.style.width = `${QR_CODE_SIZE_IN_PDF}px`; // Ensure size for QR generation
            tempDiv.style.height = `${QR_CODE_SIZE_IN_PDF}px`;
            document.body.appendChild(tempDiv);
            console.log(`[QR Order Report] Temporary div for QR code created for item ${item.id}`);


            let qrImageFromCanvas = '';
            try {
                console.log(`[QR Order Report] Generating QR for item: ${item.id}`); // LOG QR
                new window.QRCode(tempDiv, {
                    text: item.id,
                    width: QR_CODE_SIZE_IN_PDF, // Use defined size
                    height: QR_CODE_SIZE_IN_PDF,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: window.QRCode.CorrectLevel.L // L is fine for IDs
                });
                const qrCanvas = tempDiv.querySelector('canvas');
                if (qrCanvas) {
                    qrImageFromCanvas = qrCanvas.toDataURL('image/png');
                    console.log(`[QR Order Report] QR canvas toDataURL successful for ${item.id}`); // LOG
                } else {
                     console.error(`[QR Order Report] QR Canvas not found for item: ${item.id}`);
                     doc.text('QR Error', xQr + QR_CODE_SIZE_IN_PDF / 2, y + QR_CODE_SIZE_IN_PDF / 2, { align: 'center' });
                }
            } catch (qrError) {
                console.error(`[QR Order Report] Error generating QR code for order report, item ID ${item.id}:`, qrError);
                doc.text('QR Error', xQr + QR_CODE_SIZE_IN_PDF / 2, y + QR_CODE_SIZE_IN_PDF / 2, { align: 'center' });
            } finally {
                // Clean up the temporary div
                if (document.getElementById(tempDivId)) {
                    document.body.removeChild(tempDiv);
                    console.log(`[QR Order Report] Temporary div for QR code removed for item ${item.id}`);
                }
            }
            
            if (qrImageFromCanvas) {
                try {
                    console.log(`[QR Order Report] Adding QR image to PDF for ${item.id} at X:${xQr}, Y:${y}`); // LOG
                    doc.addImage(qrImageFromCanvas, 'PNG', xQr, y, QR_CODE_SIZE_IN_PDF, QR_CODE_SIZE_IN_PDF);
                } catch (pdfAddImageError) {
                    console.error(`[QR Order Report] Error adding QR image to PDF for ${item.id}:`, pdfAddImageError);
                    doc.text('QR Img Err', xQr + QR_CODE_SIZE_IN_PDF / 2, y + QR_CODE_SIZE_IN_PDF / 2, { align: 'center' });
                }
            }

            // Adjust textY to be vertically centered relative to the QR code image if desired,
            // or simply placed below it. For simplicity, let's place it aligned with top of QR + some offset.
            const textY = y + (TEXT_FONT_SIZE / 2) + 2; // Adjust this as needed for vertical alignment
            console.log(`[QR Order Report] Adding text for ${item.name} at X:${xName}, Y:${textY}`); // LOG

            doc.text(item.name || 'N/A', xName, textY, {maxWidth: xQty - xName - 10}); // Added maxWidth
            doc.text((item.quantity === undefined ? 'N/A' : item.quantity).toString(), xQty, textY, { align: 'right' });
            doc.text((item.quantityOrdered === undefined ? 'N/A' : item.quantityOrdered).toString(), xQtyOrdered, textY, { align: 'right' });
            // Corrected field for backordered quantity
            doc.text((item.quantityBackordered === undefined ? 'N/A' : item.quantityBackordered).toString(), xQtyBackordered, textY, { align: 'right' });
            doc.text((item.reorderQuantity === undefined ? 'N/A' : item.reorderQuantity).toString(), xReorderQty, textY, { align: 'right' });
            doc.text(item.supplier || 'N/A', xSupplier, textY, {maxWidth: pageWidth - xSupplier - margin - 5}); // Added maxWidth
            
            y += ROW_HEIGHT;
        }
        y += 10; // Extra space between supplier groups
    }

    console.log('[QR Order Report] Attempting to save PDF...'); // LOG
    doc.save('Watagan_Dental_Order_Report_With_QR.pdf');
    console.log('[QR Order Report] PDF save initiated.'); // LOG
  } catch (error) {
    console.error('[QR Order Report] Failed to generate Order Report PDF (jsPDF):', error.message, error.stack);
    alert('Failed to generate Order Report PDF (jsPDF): ' + error.message);
  }
}


// Order Reports - Alternative PDF generation with pdf-lib.js
async function generateFastOrderReportPDF() {
  try {
    await ensurePDFLibIsAvailable();
    // The old check can be removed or commented out:
    // if (!window.PDFLib) {
    //   alert('Error: PDFLib library is not loaded. Cannot generate PDF.');
    //   console.error('PDFLib library not found on window object.');
    //   return;
    // }

    const { PDFDocument, StandardFonts, rgb, PageSizes } = window.PDFLib;

    // Fetch data early for warning and reuse
    const snapshot = await db.collection('inventory').get();
    let toOrderItems = snapshot.docs.map(doc => doc.data()).filter(item => item.quantity <= item.minQuantity);

    const filterToOrderSupplierDropdown = document.getElementById('filterToOrderSupplier');
    const selectedSupplier = filterToOrderSupplierDropdown ? filterToOrderSupplierDropdown.value : "";

    if (selectedSupplier) {
      toOrderItems = toOrderItems.filter(item => item.supplier === selectedSupplier);
    }

    const totalNumberOfItemsInReport = toOrderItems.length;
    const LARGE_REPORT_THRESHOLD = 100; // Adjustable

    if (totalNumberOfItemsInReport > LARGE_REPORT_THRESHOLD) {
      const userConfirmed = confirm(
        `You are about to generate an order report with ${totalNumberOfItemsInReport} items. ` +
        `This might take some time. Do you want to proceed?`
      );
      if (!userConfirmed) {
        alert("Order report generation cancelled by user.");
        return;
      }
    }
    
    if (toOrderItems.length === 0) {
      alert('No products need reordering for the selected supplier (pdf-lib).');
      return;
    }
    // Data (`toOrderItems`) is already fetched and filtered.
    // We just need to group it now.
    const itemsBySupplier = toOrderItems.reduce((acc, item) => {
      const supplierName = item.supplier || 'Supplier Not Assigned';
      if (!acc[supplierName]) {
        acc[supplierName] = [];
      }
      acc[supplierName].push(item);
      return acc;
    }, {});

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    const idColX = margin;
    const nameColX = margin + 70; // X start for Name (gives ID 70 points width from margin)
    const qtyColX = margin + 330; // X start for Qty (gives Name 330-70 = 260 points width)
    const minQtyColX = margin + 380; // X start for Min Qty (gives Qty 50 points width)
    const effectiveMaxNameWidth = qtyColX - nameColX - 10; // Max width for name text before it hits Qty col, with 10 points padding

    let yPosition = height - margin;
    const lineHeight = 14;
    const titleFontSize = 18;
    const headerFontSize = 14;
    const regularFontSize = 10;

    page.drawText('Watagan Dental Order Report (pdf-lib)', { 
      x: margin, 
      y: yPosition, 
      font: boldFont, 
      size: titleFontSize 
    });
    yPosition -= (titleFontSize + 10);

    page.drawText(`Date: ${new Date().toLocaleDateString()}`, { 
      x: margin, 
      y: yPosition, 
      font: font, 
      size: regularFontSize 
    });
    yPosition -= (regularFontSize + 15);

    const supplierNames = Object.keys(itemsBySupplier).sort();

    for (const supplierName of supplierNames) {
      const items = itemsBySupplier[supplierName];
      if (items.length === 0) continue;

      if (yPosition < margin + (headerFontSize + lineHeight * 2)) {
        page = pdfDoc.addPage(PageSizes.A4);
        yPosition = height - margin;
         page.drawText(`Watagan Dental Order Report (pdf-lib) - Page ${pdfDoc.getPageCount()}`, { 
            x: margin, y: yPosition, font: boldFont, size: titleFontSize 
        });
        yPosition -= (titleFontSize + 10);
      }

      page.drawText(supplierName, { 
        x: margin, 
        y: yPosition, 
        font: boldFont, 
        size: headerFontSize 
      });
      yPosition -= (headerFontSize + 5);

      page.drawText("ID", { x: idColX, y: yPosition, font: boldFont, size: regularFontSize });
      page.drawText("Name", { x: nameColX, y: yPosition, font: boldFont, size: regularFontSize });
      page.drawText("Qty", { x: qtyColX, y: yPosition, font: boldFont, size: regularFontSize });
      page.drawText("Min Qty", { x: minQtyColX, y: yPosition, font: boldFont, size: regularFontSize });
      yPosition -= (lineHeight + 2);
      page.drawLine({
          start: { x: margin, y: yPosition },
          end: { x: width - margin, y: yPosition },
          thickness: 0.5,
          color: rgb(0, 0, 0),
      });
      yPosition -= (lineHeight / 2);


      for (const item of items) {
        const itemName = item.name || 'Unnamed Product';
        const nameLines = [];
        const maxNameWidth = effectiveMaxNameWidth;
        if (font.widthOfTextAtSize(itemName, regularFontSize) > maxNameWidth) {
            let currentLine = '';
            const words = itemName.split(' ');
            for (const word of words) {
                if (font.widthOfTextAtSize(currentLine + word, regularFontSize) > maxNameWidth) {
                    if(currentLine.trim() !== '') nameLines.push(currentLine.trim());
                    currentLine = word + ' ';
                } else {
                    currentLine += word + ' ';
                }
            }
            if(currentLine.trim() !== '') nameLines.push(currentLine.trim());
            if(nameLines.length === 0 && currentLine.trim() !== '') nameLines.push(currentLine.trim()); 
        } else {
            nameLines.push(itemName);
        }

        if (yPosition < margin + (lineHeight * nameLines.length)) { 
          page = pdfDoc.addPage(PageSizes.A4);
          yPosition = height - margin; 
          page.drawText(`Watagan Dental Order Report (pdf-lib) - Page ${pdfDoc.getPageCount()} (cont.)`, { 
            x: margin, y: yPosition, font: boldFont, size: titleFontSize 
          });
          yPosition -= (titleFontSize + 10);
          page.drawText(`${supplierName} (continued)`, { 
            x: margin, 
            y: yPosition, 
            font: boldFont, 
            size: headerFontSize 
          });
          yPosition -= (headerFontSize + 5);
          
          page.drawText("ID", { x: idColX, y: yPosition, font: boldFont, size: regularFontSize });
          page.drawText("Name", { x: nameColX, y: yPosition, font: boldFont, size: regularFontSize });
          page.drawText("Qty", { x: qtyColX, y: yPosition, font: boldFont, size: regularFontSize });
          page.drawText("Min Qty", { x: minQtyColX, y: yPosition, font: boldFont, size: regularFontSize });
          yPosition -= (lineHeight + 2);
           page.drawLine({
              start: { x: margin, y: yPosition },
              end: { x: width - margin, y: yPosition },
              thickness: 0.5,
              color: rgb(0, 0, 0),
          });
          yPosition -= (lineHeight/2);
        }
        
        let currentLineY = yPosition;
        page.drawText(item.id, { x: idColX, y: currentLineY, font: font, size: regularFontSize, maxWidth: nameColX - idColX - 5 }); // Added maxWidth for ID
        nameLines.forEach((line, index) => {
            page.drawText(line, { x: nameColX, y: currentLineY, font: font, size: regularFontSize, maxWidth: maxNameWidth }); // Use new x and maxWidth
            if (index < nameLines.length -1) currentLineY -= lineHeight;
        });
        // yPosition for Qty and MinQty is correct as it's the top of the current item's row.
        page.drawText(item.quantity.toString(), { x: qtyColX, y: yPosition, font: font, size: regularFontSize });
        page.drawText(item.minQuantity.toString(), { x: minQtyColX, y: yPosition, font: font, size: regularFontSize });
        
        yPosition -= (lineHeight * nameLines.length); 
        
        if (nameLines.length > 1) {
            yPosition -= (lineHeight / 2); 
        }
      }
      yPosition -= (lineHeight); 
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Watagan_Dental_Order_Report_Alternative.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

  } catch (error) {
    console.error('Failed to generate Order Report PDF with pdf-lib:', error.message, error.stack);
    alert('Failed to generate Fast Order Report PDF: ' + error.message);
  }
}

async function generateSupplierOrderQRCodePDF() {
  console.log('generateSupplierOrderQRCodePDF() called');
  try {
    await ensureQRCodeIsAvailable();
    const JsPDF = await waitForJsPDF();

    const supplierDropdown = document.getElementById('filterOrderSupplierDropdown');
    const selectedSupplier = supplierDropdown ? supplierDropdown.value : "";

    console.log(`Selected supplier for PDF: '${selectedSupplier}'`);

    const inventorySnapshot = await db.collection('inventory').get();
    let filteredProducts = inventorySnapshot.docs.map(doc => doc.data());

    if (selectedSupplier) {
      filteredProducts = filteredProducts.filter(p => p.supplier === selectedSupplier);
    }

    // New filtering logic
    const productsToRender = filteredProducts.filter(item =>
      ((item.quantity || 0) <= (item.minQuantity || 0)) ||
      ((item.minQuantity || 0) === 0 && (item.quantity || 0) === 0)
    );

    if (productsToRender.length === 0) {
      alert('No products found for the selected supplier that meet the reordering criteria.');
      return;
    }

    // Sort products by name for consistent report generation
    // Ensure sorting happens on productsToRender, which is the list being used for the PDF
    productsToRender.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 30;
    const bottomMargin = 40; // For page number
    let y = margin;
    const lineHeight = 18; // Increased line height for readability
    const qrCodeSize = 40; // QR code size in PDF units
    const fontSize = 9;
    const titleFontSize = 16;
    const headerFontSize = 10;

    // Function to add headers and manage page breaks
    const addHeaders = (docInstance, startY) => {
      docInstance.setFontSize(titleFontSize);
      docInstance.setFont('helvetica', 'bold');
      docInstance.text('Watagan Dental - Supplier Order QR Codes', margin, startY);
      startY += titleFontSize + 5;

      docInstance.setFontSize(fontSize);
      docInstance.setFont('helvetica', 'normal');
      docInstance.text(`Generated: ${new Date().toLocaleDateString()}`, margin, startY);

      if (selectedSupplier) {
        startY += lineHeight;
        docInstance.setFont('helvetica', 'italic');
        docInstance.text(`Filtered by Supplier: ${selectedSupplier}`, margin, startY);
      }
      startY += lineHeight * 1.5; // Extra space before table headers

      // Define column X positions
      const colPositions = {
        qr: margin,
        product: margin + qrCodeSize + 10,
        onHand: margin + qrCodeSize + 150, // Increased width for product name
        toOrder: margin + qrCodeSize + 210,
        backordered: margin + qrCodeSize + 270,
        cost: margin + qrCodeSize + 340,
        totalCost: margin + qrCodeSize + 400,
        supplier: margin + qrCodeSize + 470
      };

      docInstance.setFontSize(headerFontSize);
      docInstance.setFont('helvetica', 'bold');
      docInstance.text("QR", colPositions.qr, startY);
      docInstance.text("Product", colPositions.product, startY);
      docInstance.text("On Hand", colPositions.onHand, startY, {align: 'right'});
      docInstance.text("To Order", colPositions.toOrder, startY, {align: 'right'});
      docInstance.text("Backorder", colPositions.backordered, startY, {align: 'right'});
      docInstance.text("Unit Cost", colPositions.cost, startY, {align: 'right'});
      docInstance.text("Total Cost", colPositions.totalCost, startY, {align: 'right'});
      docInstance.text("Supplier", colPositions.supplier, startY);
      startY += headerFontSize + 5;
      docInstance.setDrawColor(0);
      docInstance.line(margin, startY, pageWidth - margin, startY); // Horizontal line
      startY += 5;
      docInstance.setFontSize(fontSize);
      docInstance.setFont('helvetica', 'normal');
      return startY;
    };

    y = addHeaders(doc, y);
    let pageNumber = 1;
    doc.setFontSize(fontSize); // Reset font size for content

    for (const product of productsToRender) { // Changed products to productsToRender
      let qtyToOrder;
      let qtyToOrderText;
      let numericQtyToOrderForCostCalc = 0;

      if (!product.reorderQuantity || product.reorderQuantity <= 0) {
        qtyToOrderText = "custom"; // Placeholder for custom reorder
        numericQtyToOrderForCostCalc = 0; // For cost calculation, custom means 0 for now
      } else {
        qtyToOrder = Math.max(0, (product.reorderQuantity || 0) - (product.quantity || 0));
        qtyToOrderText = qtyToOrder.toString();
        numericQtyToOrderForCostCalc = qtyToOrder;
      }

      const totalCost = numericQtyToOrderForCostCalc * (product.cost || 0);

      // Check for page break
      // Estimate row height: QR code size is largest element, add some padding
      const estimatedRowHeight = qrCodeSize + 10;
      if (y + estimatedRowHeight > pageHeight - bottomMargin) {
        doc.setFontSize(8);
        doc.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - (bottomMargin / 2), { align: 'center' });
        doc.addPage();
        pageNumber++;
        y = addHeaders(doc, margin); // Reset y and draw headers on new page
        doc.setFontSize(fontSize); // Reset font size for content
      }

      // QR Code generation
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px'; // Off-screen
      document.body.appendChild(tempDiv);
      let qrImageData = '';
      try {
        new window.QRCode(tempDiv, {
          text: product.id,
          width: qrCodeSize * 2, // Generate larger QR for better quality when scaled down
          height: qrCodeSize * 2,
          correctLevel: window.QRCode.CorrectLevel.M
        });
        const canvas = tempDiv.querySelector('canvas');
        if (canvas) {
          qrImageData = canvas.toDataURL('image/png');
        }
      } catch (qrError) {
        console.error(`Error generating QR for product ${product.id}:`, qrError);
        qrImageData = ''; // Handle error, maybe draw placeholder text
      } finally {
        document.body.removeChild(tempDiv);
      }

      const colPositions = { // Redefine here for access if needed, or pass as param
        qr: margin,
        product: margin + qrCodeSize + 10,
        onHand: margin + qrCodeSize + 150,
        toOrder: margin + qrCodeSize + 210,
        backordered: margin + qrCodeSize + 270,
        cost: margin + qrCodeSize + 340,
        totalCost: margin + qrCodeSize + 400,
        supplier: margin + qrCodeSize + 470
      };
      const textYAlign = y + (qrCodeSize / 2) + (fontSize / 2) - 2; // Try to vertically center text with QR

      if (qrImageData) {
        doc.addImage(qrImageData, 'PNG', colPositions.qr, y, qrCodeSize, qrCodeSize);
      } else {
        doc.text("QR Err", colPositions.qr + qrCodeSize/2, textYAlign, {align: 'center'});
      }

      // Product Name with wrapping (basic)
      const productNameLines = doc.splitTextToSize(product.name || 'N/A', colPositions.onHand - colPositions.product - 5);
      let textYOffset = 0;
      if (productNameLines.length > 1) {
         // Adjust Y for multi-line text to keep QR centered, or adjust QR's Y
         // For simplicity, we'll let the text flow down.
         doc.text(productNameLines, colPositions.product, y + fontSize); // Start text lower for multi-line
      } else {
         doc.text(productNameLines, colPositions.product, textYAlign);
      }


      doc.text((product.quantity || 0).toString(), colPositions.onHand, textYAlign, {align: 'right'});
      doc.text(qtyToOrderText, colPositions.toOrder, textYAlign, {align: 'right'});
      doc.text((product.quantityBackordered || 0).toString(), colPositions.backordered, textYAlign, {align: 'right'});
      doc.text((product.cost || 0).toFixed(2), colPositions.cost, textYAlign, {align: 'right'});
      doc.text(totalCost.toFixed(2), colPositions.totalCost, textYAlign, {align: 'right'});

      // Supplier Name with wrapping
      const supplierNameLines = doc.splitTextToSize(product.supplier || 'N/A', pageWidth - colPositions.supplier - margin);
      doc.text(supplierNameLines, colPositions.supplier, y + fontSize);


      y += qrCodeSize + 10; // Move Y for next row (QR size + padding)
    }

    // Add final page number
    doc.setFontSize(8);
    doc.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - (bottomMargin / 2), { align: 'center' });

    let pdfFileName = 'Supplier_Order_QR_Codes.pdf';
    if (selectedSupplier) {
      pdfFileName = `Supplier_Order_QR_${selectedSupplier.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    }
    doc.save(pdfFileName);

  } catch (error) {
    console.error('Failed to generate Supplier Order QR PDF:', error);
    alert('Failed to generate Supplier Order QR PDF: ' + error.message);
  }
}

async function emailSupplierOrder() {
  console.log('emailSupplierOrder() called');
  try {
    // 1. Trigger PDF Generation (and download for user)
    await generateSupplierOrderQRCodePDF(); // Assumes this function now correctly filters and generates the PDF the user just saw/downloaded.

    // 2. Get Selected Supplier
    const supplierDropdown = document.getElementById('filterOrderSupplierDropdown');
    const selectedSupplierName = supplierDropdown ? supplierDropdown.value : "";
    console.log(`Selected supplier for email: '${selectedSupplierName}'`);

    // 3. Fetch and Filter Products (Re-filter as per logic for email body consistency)
    const inventorySnapshot = await db.collection('inventory').get();
    let allProducts = inventorySnapshot.docs.map(doc => doc.data());

    let filteredBySupplierProducts = allProducts;
    if (selectedSupplierName) {
      filteredBySupplierProducts = allProducts.filter(p => p.supplier === selectedSupplierName);
    }

    const productsToEmail = filteredBySupplierProducts.filter(item =>
      ((item.quantity || 0) <= (item.minQuantity || 0)) ||
      ((item.minQuantity || 0) === 0 && (item.quantity || 0) === 0)
    );

    // Sort products by name for the email body
    productsToEmail.sort((a, b) => (a.name || '').localeCompare(b.name || ''));


    // 4. Handle No Products for Email
    // This check might seem redundant if generateSupplierOrderQRCodePDF already alerted,
    // but it's good practice if this function could be called independently or if PDF function's alert is removed.
    if (productsToEmail.length === 0) {
      alert('No products to include in the email based on the selected supplier and reordering criteria.');
      return;
    }

    // 5. Construct Email Subject
    let subject = "Order for Supplier: ";
    if (selectedSupplierName) {
      subject += selectedSupplierName;
    } else {
      subject += "Multiple Suppliers / All Requiring Reorder";
    }

    // 6. Construct Email Body
    let body = "";
    body += "Supplier: " + (selectedSupplierName || "All Suppliers Requiring Reorder") + "\n\n";
    body += "Products to Order:\n";

    productsToEmail.forEach(product => {
      let qtyToOrderText;
      if (!product.reorderQuantity || product.reorderQuantity <= 0) {
        qtyToOrderText = "custom";
      } else {
        const qtyToOrder = Math.max(0, (product.reorderQuantity || 0) - (product.quantity || 0));
        qtyToOrderText = qtyToOrder.toString();
      }
      body += `- ${product.name} - Quantity to Order: ${qtyToOrderText}\n`;
    });

    body += "\n\nPlease remember to attach the generated PDF (e.g., Supplier_Order_QR_Codes.pdf or Supplier_Order_QR_[SupplierName].pdf) that was downloaded moments ago.\n";

    // 7. Create and Trigger mailto: Link
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;

  } catch (error) {
    console.error('Failed to prepare email for supplier order:', error);
    alert('Failed to prepare email for supplier order: ' + error.message);
  }
}


async function emailOrderReport() {
  try {
    const snapshot = await db.collection('inventory').get();
    const toOrderItems = snapshot.docs.map(doc => doc.data()).filter(item => item.quantity <= item.minQuantity);
    if (toOrderItems.length === 0) {
      alert('No products need reordering.');
      return;
    }

    let emailBody = 'Watagan Dental Order Report\n\n';
    emailBody += `Date: ${new Date().toLocaleDateString()}\n\n`;
    emailBody += 'QR Codes are included in the PDF version of this report.\n\n';

    const itemsBySupplier = toOrderItems.reduce((acc, item) => {
      const supplierName = item.supplier || 'Supplier Not Assigned';
      if (!acc[supplierName]) {
        acc[supplierName] = [];
      }
      acc[supplierName].push(item);
      return acc;
    }, {});

    const sortedSupplierNames = Object.keys(itemsBySupplier).sort();

    for (const supplierName of sortedSupplierNames) {
      emailBody += `--- ${supplierName} ---\n`;
      emailBody += 'Name | Qty | Qty Ordered | Qty Backordered | Reorder Qty | Supplier\n';
      emailBody += '---------------------------------------------------------------------------\n';
      const items = itemsBySupplier[supplierName];
      items.forEach(item => {
        emailBody += `${item.name} | Qty: ${item.quantity} | Ordered: ${item.quantityOrdered || 0} | Backordered: ${item.quantityBackordered || 0} | Reorder: ${item.reorderQuantity || 0} | Supp: ${item.supplier}\n`;
      });
      emailBody += '\n';
    }

    const subject = encodeURIComponent('Watagan Dental Order Report');
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  } catch (error) {
    console.error('Failed to email Order Report:', error, error.stack);
    alert('Failed to email Order Report: ' + error.message);
  }
}

// Barcode Scanning
async function startMoveScanner() {
  document.getElementById('moveProductId').focus();
  if (typeof jsQR === 'undefined' && typeof window.jsQR === 'undefined') {
    console.error('jsQR library not found.');
    alert('QR code scanning library (jsQR) is not available. Please check the console for errors.');
    return;
  }
  const qrScanner = typeof jsQR !== 'undefined' ? jsQR : window.jsQR;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera access not supported by this browser.');
    return;
  }

  const video = document.getElementById('moveVideo');
  const canvasElement = document.createElement('canvas');
  const canvas = canvasElement.getContext('2d', { willReadFrequently: true });
  let animationFrameId;

  function scanMoveQR() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvasElement.height = video.videoHeight;
      canvasElement.width = video.videoWidth;
      canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
      const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
      
      const code = qrScanner(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code) {
        document.getElementById('moveProductId').value = code.data;
        document.getElementById('moveScanResult').textContent = `Scanned Code: ${code.data}`;
        stopMoveScanner();
      } else {
        animationFrameId = requestAnimationFrame(scanMoveQR);
      }
    } else {
      animationFrameId = requestAnimationFrame(scanMoveQR);
    }
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.classList.remove('hidden');
    video.setAttribute('playsinline', true);
    video.play();
    animationFrameId = requestAnimationFrame(scanMoveQR); 
    window.moveScannerAnimationFrameId = animationFrameId; 
  } catch (err) {
    console.error('Error accessing camera:', err);
    alert('Error accessing camera: ' + err.message);
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
  }
}

function stopMoveScanner() {
  console.log('stopMoveScanner called. Stream and UI cleanup executed.');
  if (window.moveScannerAnimationFrameId) {
    cancelAnimationFrame(window.moveScannerAnimationFrameId);
    window.moveScannerAnimationFrameId = null;
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    const video = document.getElementById('moveVideo');
    if (video) {
        video.srcObject = null;
        video.classList.add('hidden');
    }
    const scanResult = document.getElementById('moveScanResult');
    if (scanResult) {
        scanResult.textContent = '';
    }
  }
}

async function startUpdateScanner() {
  if (batchUpdates.length === 0) {
    addBatchEntry();
  } else {
    const lastEntryArrayId = batchUpdates[batchUpdates.length - 1];
    const lastProductIdInput = document.getElementById(`${lastEntryArrayId}-id`);
    if (lastProductIdInput) {
      lastProductIdInput.focus();
    } else {
      addBatchEntry();
    }
  }

  if (typeof jsQR === 'undefined' && typeof window.jsQR === 'undefined') {
    console.error('jsQR library not found.');
    alert('QR code scanning library (jsQR) is not available. Please check the console for errors.');
    return;
  }
  const qrScanner = typeof jsQR !== 'undefined' ? jsQR : window.jsQR;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera access not supported by this browser.');
    return;
  }

  const video = document.getElementById('updateVideo');
  const canvasElement = document.createElement('canvas');
  const canvas = canvasElement.getContext('2d', { willReadFrequently: true });
  let animationFrameId;

  function scanUpdateQR() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvasElement.height = video.videoHeight;
      canvasElement.width = video.videoWidth;
      canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
      const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
      
      const code = qrScanner(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        document.getElementById('updateScanResult').textContent = `Scanned Code: ${code.data}`;
        
        if (batchUpdates.length > 0) {
          const lastEntryArrayId = batchUpdates[batchUpdates.length - 1];
          const targetInputId = `${lastEntryArrayId}-id`;
          const targetInput = document.getElementById(targetInputId);
          if (targetInput) {
            targetInput.value = code.data;

            // Fetch and display product name
            const nameSpan = document.getElementById(`${lastEntryArrayId}-name`);
            if (nameSpan) {
              db.collection('inventory').doc(code.data).get().then(doc => {
                if (doc.exists) {
                  nameSpan.textContent = doc.data().name;
                  nameSpan.title = doc.data().name;
                } else {
                  nameSpan.textContent = 'Not Found';
                  nameSpan.title = 'Product Not Found';
                }
              }).catch(err => {
                console.error("Error fetching product name for batch scan:", err);
                nameSpan.textContent = 'Error';
                nameSpan.title = 'Error fetching name';
              });
            }

            const quantityInput = document.getElementById(`${lastEntryArrayId}-quantity`);
            if (quantityInput) {
              quantityInput.focus();
            }
          } else {
            console.warn(`Target input ${targetInputId} not found for scanned QR code.`);
          }
        }
        
        stopUpdateScanner();
      } else {
        animationFrameId = requestAnimationFrame(scanUpdateQR);
      }
    } else {
      animationFrameId = requestAnimationFrame(scanUpdateQR);
    }
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.classList.remove('hidden');
    video.setAttribute('playsinline', true);
    video.play();
    animationFrameId = requestAnimationFrame(scanUpdateQR);
    window.updateScannerAnimationFrameId = animationFrameId;
  } catch (err) {
    console.error('Error accessing camera:', err);
    alert('Error accessing camera: ' + err.message);
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
  }
}

function stopUpdateScanner() {
  console.log('stopUpdateScanner called. Stream and UI cleanup executed.');
  if (window.updateScannerAnimationFrameId) {
    cancelAnimationFrame(window.updateScannerAnimationFrameId);
    window.updateScannerAnimationFrameId = null;
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    const video = document.getElementById('updateVideo');
    if (video) {
        video.srcObject = null;
        video.classList.add('hidden');
    }
    const scanResult = document.getElementById('updateScanResult');
    if (scanResult) {
        scanResult.textContent = '';
    }
  }
}

function applySidebarState(isMinimized) {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
    const reorderNotificationBar = document.getElementById('reorderNotificationBar');

    if (!sidebar || !mainContent || !sidebarToggleIcon || !reorderNotificationBar) {
        console.error('Sidebar, main content, toggle icon, or reorder notification bar not found for state application.');
        return;
    }

    const count = reorderNotificationBar.dataset.reorderCount !== undefined ? parseInt(reorderNotificationBar.dataset.reorderCount) : 0;

    if (isMinimized) {
        sidebar.classList.add('sidebar-minimized');
        mainContent.classList.add('main-content-expanded');
        reorderNotificationBar.textContent = count; // Display only count
        sidebarToggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5" />';
        localStorage.setItem(SIDEBAR_STATE_KEY, 'true');
    } else {
        sidebar.classList.remove('sidebar-minimized');
        mainContent.classList.remove('main-content-expanded');
        reorderNotificationBar.textContent = `Products to reorder: ${count}`; // Display full text
        sidebarToggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5" />';
        localStorage.setItem(SIDEBAR_STATE_KEY, 'false');
    }
}

function toggleSidebar() {
    let isMinimized = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
    applySidebarState(!isMinimized);
}

function exportInventoryToCSV() {
    const supplierFilter = document.getElementById('filterSupplier') ? document.getElementById('filterSupplier').value : '';
    const locationFilter = document.getElementById('filterLocation') ? document.getElementById('filterLocation').value : '';
    const searchInput = document.getElementById('inventorySearchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let itemsToExport = [...inventory];

    if (supplierFilter) {
        itemsToExport = itemsToExport.filter(item => item.supplier === supplierFilter);
    }
    if (locationFilter) {
        itemsToExport = itemsToExport.filter(item => item.location === locationFilter);
    }
    if (searchTerm) {
        itemsToExport = itemsToExport.filter(item => {
            return (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                   (item.id && item.id.toLowerCase().includes(searchTerm)) ||
                   (item.supplier && item.supplier.toLowerCase().includes(searchTerm));
        });
    }

    if (itemsToExport.length === 0) {
        alert("No inventory data to export based on current filters.");
        return;
    }

    const headers = [
        "ID", "Name", "Quantity", "Cost", "Min Quantity", 
        "Quantity Ordered", "Quantity Backordered", "Reorder Quantity",
        "Supplier", "Location", "Photo URL"
    ];
    const keys = [
        "id", "name", "quantity", "cost", "minQuantity",
        "quantityOrdered", "quantityBackordered", "reorderQuantity",
        "supplier", "location", "photo"
    ];

    let csvContent = headers.join(",") + "\n";

    itemsToExport.forEach(item => {
        const row = keys.map(key => {
            let cellValue = item[key] === undefined || item[key] === null ? '' : item[key];
            if (typeof cellValue === 'string' && cellValue.includes(',')) {
                cellValue = `"${cellValue.replace(/"/g, '""')}"`;
            }
            return cellValue;
        });
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "inventory_export.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        alert("CSV export is not supported by your browser.");
    }
}

async function updateInventoryDashboard() {
    console.log("Updating inventory dashboard...");
    const lowStockAlertsTableBody = document.getElementById('lowStockAlertsTableBody');
    if (!lowStockAlertsTableBody) {
        console.error("Dashboard's lowStockAlertsTableBody not found.");
        return;
    }

    const lowStockItems = inventory.filter(item => item.quantity <= item.minQuantity);

    lowStockAlertsTableBody.innerHTML = '';

    if (lowStockItems.length === 0) {
        const row = lowStockAlertsTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.textContent = 'No low-stock items currently.';
        cell.className = 'text-center p-4';
        return;
    }

    lowStockItems.forEach(item => {
        const row = lowStockAlertsTableBody.insertRow();
        row.innerHTML = `
            <td class="border-b dark:border-slate-700 p-2">${item.name}</td>
            <td class="border-b dark:border-slate-700 p-2">${item.id}</td>
            <td class="border-b dark:border-slate-700 p-2 text-center">${item.quantity}</td>
            <td class="border-b dark:border-slate-700 p-2 text-center">${item.minQuantity}</td>
            <td class="border-b dark:border-slate-700 p-2">${item.location || 'N/A'}</td>
            <td class="border-b dark:border-slate-700 p-2">${item.supplier || 'N/A'}</td>
        `;
    });
    console.log(`Dashboard updated with ${lowStockItems.length} low-stock items.`);
}

// Lazy Loading Functions
function initializeImageObserver() {
    if (imageObserver) {
        imageObserver.disconnect();
    }

    imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const dataSrc = img.getAttribute('data-src');
                if (dataSrc) {
                    img.src = dataSrc;
                    img.removeAttribute('data-src');
                }
                img.classList.remove('lazy-load-image');
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '0px 0px 50px 0px',
        threshold: 0.01
    });

    observeLazyLoadImages();
}

function observeLazyLoadImages() {
    if (!imageObserver) return;
    const imagesToObserve = document.querySelectorAll('img.lazy-load-image');
    imagesToObserve.forEach(img => imageObserver.observe(img));
}

async function startEditScanner() {
  isEditScanModeActive = true;
  editScanInputBuffer = "";
  console.log('Edit scan mode activated, listening for barcode scanner.');
  const scanResultP = document.getElementById('editScanResult');
  if (scanResultP) scanResultP.textContent = 'Scanning with camera OR use barcode scanner...';

  console.log('[EditScanner] Starting startEditScanner...');
  if (typeof jsQR === 'undefined' && typeof window.jsQR === 'undefined') {
    console.error('jsQR library not found.');
    alert('QR code scanning library (jsQR) is not available. Please check the console for errors.');
    return;
  }
  const qrScanner = typeof jsQR !== 'undefined' ? jsQR : window.jsQR;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera access not supported by this browser.');
    return;
  }

  const video = document.getElementById('editVideo');
  const stopBtn = document.getElementById('stopEditScannerBtn');
  const startBtn = document.getElementById('scanToEditBtn');
  console.log('[EditScanner] DOM elements obtained:', { video, stopBtn, startBtn, scanResultP });

  const canvasElement = document.createElement('canvas'); 
  const canvas = canvasElement.getContext('2d', { willReadFrequently: true });


  function scanEditQR() {
    console.log('[EditScanner Loop] scanEditQR called. Video readyState:', video.readyState, 'videoWidth:', video.videoWidth);
    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      canvasElement.height = video.videoHeight;
      canvasElement.width = video.videoWidth;
      console.log('[EditScanner Loop] Drawing to canvas. Canvas dimensions:', canvasElement.width, 'x', canvasElement.height);
      canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
      const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
      console.log('[EditScanner Loop] Getting image data and calling jsQR.');
      const code = qrScanner(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        console.log('[EditScanner Loop] QR code detected:', code);
        if (scanResultP) scanResultP.textContent = `Scanned Code: ${code.data}`;
        editProduct(code.data);
        stopEditScanner();
        return;
      } else {
        console.log('[EditScanner Loop] No QR code found in this frame.');
      }
    }
    window.editScannerAnimationFrameId = requestAnimationFrame(scanEditQR);
  }

  try {
    console.log('[EditScanner] Requesting camera access...');
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    console.log('[EditScanner] Camera access granted. Stream:', stream);
    video.srcObject = stream;
    console.log('[EditScanner] Video properties before play:', { srcObject: video.srcObject, videoWidth: video.videoWidth, videoHeight: video.videoHeight, readyState: video.readyState });
    video.setAttribute('playsinline', true);
    video.play();
    console.log('[EditScanner] video.play() resolved. Video properties after play:', { videoWidth: video.videoWidth, videoHeight: video.videoHeight, readyState: video.readyState });

    video.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');
    if (startBtn) startBtn.classList.add('hidden');
    if (scanResultP) scanResultP.textContent = 'Scanning...';

    window.editScannerAnimationFrameId = requestAnimationFrame(scanEditQR);

  } catch (err) {
    console.error('[EditScanner] Error during scanner setup or operation:', err, 'Error name:', err.name, 'Error message:', err.message);
    alert('Error starting QR scanner: ' + err.message);
    if (window.editScannerAnimationFrameId) {
      cancelAnimationFrame(window.editScannerAnimationFrameId);
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    video.classList.add('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    if (startBtn) startBtn.classList.remove('hidden');
    if (scanResultP) scanResultP.textContent = 'Error starting scanner.';
  }
}

function stopEditScanner() {
  if (isEditScanModeActive) {
    isEditScanModeActive = false;
    editScanInputBuffer = "";
    console.log('Edit scan mode deactivated.');
  }

  if (window.editScannerAnimationFrameId) {
    cancelAnimationFrame(window.editScannerAnimationFrameId);
    window.editScannerAnimationFrameId = null;
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  const video = document.getElementById('editVideo');
  const stopBtn = document.getElementById('stopEditScannerBtn');
  const startBtn = document.getElementById('scanToEditBtn');
  const scanResultP = document.getElementById('editScanResult');

  if (video) {
    video.srcObject = null;
    video.classList.add('hidden');
  }
  if (stopBtn) stopBtn.classList.add('hidden');
  if (startBtn) startBtn.classList.remove('hidden');
  if (scanResultP) scanResultP.textContent = ''; 
}

// --- TAB SWITCHING LOGIC FOR QUICK STOCK UPDATE & BATCH ENTRY ---
function switchQuickUpdateTab(selectedTabId) {
    const manualBatchModeTabBtn = document.getElementById('manualBatchModeTab');
    const barcodeScannerModeTabBtn = document.getElementById('barcodeScannerModeTab');
    const manualBatchModeContentPane = document.getElementById('manualBatchModeContent');
    const barcodeScannerModeContentPane = document.getElementById('barcodeScannerModeContent');
    // const quickStockUpdateFeedbackElem = document.getElementById('quickStockUpdateFeedback'); // Potentially unused now

    if (!manualBatchModeTabBtn || !barcodeScannerModeTabBtn || !manualBatchModeContentPane || !barcodeScannerModeContentPane) {
        console.error("Tab switching UI elements not all found for Manual Batch/Barcode Scanner. Tab switching aborted.");
        return;
    }

    const activeSpecificClasses = ['border-blue-600', 'text-blue-600', 'dark:border-blue-500', 'dark:text-blue-500', 'font-semibold'];
    const inactiveSpecificClasses = ['border-transparent', 'text-gray-500', 'dark:text-gray-400'];
    const hoverClasses = ['hover:text-gray-700', 'hover:border-gray-300', 'dark:hover:text-gray-300', 'dark:hover:border-gray-600'];

    if (selectedTabId === 'manualBatchModeTab' || selectedTabId === 'manualBatchModeContent') {
        manualBatchModeTabBtn.setAttribute('aria-selected', 'true');
        barcodeScannerModeTabBtn.setAttribute('aria-selected', 'false');

        manualBatchModeTabBtn.classList.remove(...inactiveSpecificClasses);
        manualBatchModeTabBtn.classList.add(...activeSpecificClasses);
        hoverClasses.forEach(hc => manualBatchModeTabBtn.classList.add(hc));

        barcodeScannerModeTabBtn.classList.remove(...activeSpecificClasses);
        barcodeScannerModeTabBtn.classList.add(...inactiveSpecificClasses);
        hoverClasses.forEach(hc => barcodeScannerModeTabBtn.classList.add(hc));

        manualBatchModeContentPane.classList.remove('hidden');
        barcodeScannerModeContentPane.classList.add('hidden');

        // Stop Barcode Scanner Mode if it was active
        if (isBarcodeScannerModeActive) {
            // If there's a specific function to reset/stop Barcode Scanner Mode, call it here.
            // For now, setting the flag is the primary action.
            // e.g., if a stopBarcodeScannerMode() function existed that handled UI/state for that mode specifically.
        }
        // Stop Quick Stock Update related scanners/states if any were active (OBSOLETE - quickStockUpdateStream and stopQuickStockUpdateScanner are removed)
        // if (quickStockUpdateStream && typeof stopQuickStockUpdateScanner === 'function') { // REMOVE
        //     console.log("Switching to Manual Batch: Attempting to stop quick stock update scanner."); // REMOVE
        //     stopQuickStockUpdateScanner(); // REMOVE
        // } // REMOVE
        // Stop general purpose camera stream if it's active (used by batch update, move, edit)
        if (stream) {
            if (typeof stopUpdateScanner === 'function' && document.getElementById('updateVideo') && !document.getElementById('updateVideo').classList.contains('hidden')) stopUpdateScanner();
            if (typeof stopMoveScanner === 'function' && document.getElementById('moveVideo') && !document.getElementById('moveVideo').classList.contains('hidden')) stopMoveScanner();
            if (typeof stopEditScanner === 'function' && document.getElementById('editVideo') && !document.getElementById('editVideo').classList.contains('hidden')) stopEditScanner();
        }

        isBarcodeScannerModeActive = false;
        isEditScanModeActive = false; // Ensure edit scan mode is also off
        quickStockBarcodeBuffer = ""; // Clear any potentially active buffer
        console.log("Switched to Manual Batch Mode Tab.");

    } else if (selectedTabId === 'barcodeScannerModeTab' || selectedTabId === 'barcodeScannerModeContent') {
        barcodeScannerModeTabBtn.setAttribute('aria-selected', 'true');
        manualBatchModeTabBtn.setAttribute('aria-selected', 'false');

        barcodeScannerModeTabBtn.classList.remove(...inactiveSpecificClasses);
        barcodeScannerModeTabBtn.classList.add(...activeSpecificClasses);
        hoverClasses.forEach(hc => barcodeScannerModeTabBtn.classList.add(hc));

        manualBatchModeTabBtn.classList.remove(...activeSpecificClasses);
        manualBatchModeTabBtn.classList.add(...inactiveSpecificClasses);
        hoverClasses.forEach(hc => manualBatchModeTabBtn.classList.add(hc));

        barcodeScannerModeContentPane.classList.remove('hidden');
        manualBatchModeContentPane.classList.add('hidden');
        barcodeScannerModeContentPane.focus({ preventScroll: true });

        // Stop Quick Stock Update related scanners/states if any were active (OBSOLETE - quickStockUpdateStream and stopQuickStockUpdateScanner are removed)
        // if (quickStockUpdateStream && typeof stopQuickStockUpdateScanner === 'function') { // REMOVE
        //     console.log("Switching to Barcode Scanner: Attempting to stop quick stock update scanner."); // REMOVE
        //     stopQuickStockUpdateScanner(); // REMOVE
        // } // REMOVE
        // Stop general purpose camera stream if it's active (used by batch update, move, edit)
         if (stream) {
             if (typeof stopUpdateScanner === 'function' && document.getElementById('updateVideo') && !document.getElementById('updateVideo').classList.contains('hidden')) stopUpdateScanner();
             if (typeof stopMoveScanner === 'function' && document.getElementById('moveVideo') && !document.getElementById('moveVideo').classList.contains('hidden')) stopMoveScanner();
             if (typeof stopEditScanner === 'function' && document.getElementById('editVideo') && !document.getElementById('editVideo').classList.contains('hidden')) stopEditScanner();
        }

        isBarcodeScannerModeActive = true;
        isEditScanModeActive = false;

        currentBarcodeModeProductId = null;
        const activeProductNameEl = document.getElementById('barcodeActiveProductName');
        if (activeProductNameEl) activeProductNameEl.textContent = 'None';
        setLastActionFeedback('---');
        setBarcodeStatus('Scan a Product QR Code to begin.');
        quickStockBarcodeBuffer = "";

        const productDetailsDisplay = document.getElementById('barcodeProductDetailsDisplay');
        if (productDetailsDisplay) {
            document.getElementById('barcodeProductSpecificQR').innerHTML = '';
            const imgElement = document.getElementById('barcodeProductSpecificImage');
            imgElement.src = '#';
            imgElement.classList.add('hidden');
        }
        displayBarcodeModeActionQRCodes();
        console.log("Switched to Barcode Scanner Mode Tab.");
    }
}

// Initialize and Bind Events
document.addEventListener('DOMContentLoaded', async () => {
  console.warn("If you encounter persistent 'message channel closed' errors or similar unexpected behavior, particularly after specific actions like switching modes, it might be caused by a browser extension. Try testing in an incognito window with extensions disabled, or selectively disable extensions to identify a potential conflict.");
  console.log('DOMContentLoaded fired'); 
  console.warn("Image Handling Recommendation: For optimal performance, ensure that product images are resized to thumbnails on the backend (e.g., using a Firebase Extension like 'Resize Images') and that these thumbnail URLs are stored in Firestore. The application currently lazy-loads images and displays them as thumbnails via CSS, but loading full-size images can still be inefficient.");
  initialDarkModeCheck();
  
  let initialSidebarMinimized = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
  applySidebarState(initialSidebarMinimized);

  imageModal = document.getElementById('imageModal');
  modalImage = document.getElementById('modalImage');
  closeImageModalBtn = document.getElementById('closeImageModalBtn');

  if (imageModal && modalImage && closeImageModalBtn) {
      closeImageModalBtn.addEventListener('click', () => {
          imageModal.classList.add('hidden');
          modalImage.src = '';
      });
      imageModal.addEventListener('click', (event) => {
          if (event.target === imageModal) {
              imageModal.classList.add('hidden');
              modalImage.src = '';
          }
      });
  } else {
      console.error('Image modal HTML elements not all found. Enlarging images may not work.');
  }

  const productPhotoPreviewImg = document.getElementById('productPhotoPreview');
  if (productPhotoPreviewImg) {
    productPhotoPreviewImg.addEventListener('click', () => {
      if (productPhotoPreviewImg.src && 
          !productPhotoPreviewImg.src.endsWith('#') &&
          !productPhotoPreviewImg.classList.contains('hidden') &&
          productPhotoPreviewImg.src !== window.location.href) {

        if (imageModal && modalImage) {
          modalImage.src = productPhotoPreviewImg.src;
          imageModal.classList.remove('hidden');
          console.log('Opening image modal for product form preview:', productPhotoPreviewImg.src);
        } else {
          console.error('Modal elements not available for product form image click.');
        }
      } else {
        console.log('Product photo preview clicked, but no valid image src to enlarge or image is hidden.');
      }
    });
  }

  const sidebarToggleBtnEl = document.getElementById('sidebarToggleBtn');
  if (sidebarToggleBtnEl) {
      sidebarToggleBtnEl.addEventListener('click', toggleSidebar);
  }

  try {
    initializeImageObserver();
    await ensureQRCodeIsAvailable();
    // loadInventory(); // Moved to onAuthStateChanged to prevent premature calls
    // await loadSuppliers(); // Moved to onAuthStateChanged to prevent premature calls
    // await loadLocations(); // Moved to onAuthStateChanged to prevent premature calls
    addBatchEntry(); // This might be okay here if it doesn't require auth, or it might need to move too. Assuming it's for UI setup.

    console.log('DOMContentLoaded: About to schedule collapsible section initialization.');
    setTimeout(() => {
        console.log('Initializing collapsible sections (after small delay)...');
        setupCollapsibleSection('toggleProductFormBtn', 'productFormContent', true);
        setupCollapsibleSection('toggleSupplierFormBtn', 'supplierFormContent', true);
        setupCollapsibleSection('toggleLocationFormBtn', 'locationFormContent', true);
        setupCollapsibleSection('toggleMoveProductFormBtn', 'moveProductFormContent', true);
        
        setupCollapsibleSection('toggleInventoryTableBtn', 'inventoryTableContent', true);
        setupCollapsibleSection('toggleToOrderTableBtn', 'toOrderTableContainer', true);
    }, 0);


    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('click', () => {
        if (document.documentElement.classList.contains('dark')) {
          removeDarkMode();
        } else {
          applyDarkMode();
        }
      });
    }
    document.getElementById('addBatchEntryBtn').addEventListener('click', addBatchEntry);
  document.getElementById('submitBatchUpdatesBtn').addEventListener('click', submitBatchUpdates);
  document.getElementById('startUpdateScannerBtn').addEventListener('click', startUpdateScanner);
  document.getElementById('stopUpdateScannerBtn').addEventListener('click', stopUpdateScanner);
  document.getElementById('productSubmitBtn').addEventListener('click', submitProduct);
  document.getElementById('capturePhotoBtn').addEventListener('click', startPhotoCapture);
  document.getElementById('takePhotoBtn').addEventListener('click', takePhoto);
  document.getElementById('cancelPhotoBtn').addEventListener('click', cancelPhoto);
  document.getElementById('cancelEditBtn').addEventListener('click', resetProductForm);
  document.getElementById('moveProductBtn').addEventListener('click', moveProduct);
  document.getElementById('startMoveScannerBtn').addEventListener('click', startMoveScanner);
  document.getElementById('stopMoveScannerBtn').addEventListener('click', stopMoveScanner);
  document.getElementById('scanToEditBtn').addEventListener('click', startEditScanner);
  document.getElementById('stopEditScannerBtn').addEventListener('click', stopEditScanner);
  document.getElementById('addSupplierBtn').addEventListener('click', addSupplier);

  const manualBatchModeTabBtn = document.getElementById('manualBatchModeTab');
  if (manualBatchModeTabBtn) {
    manualBatchModeTabBtn.addEventListener('click', () => switchQuickUpdateTab('manualBatchModeTab'));
  }

  const barcodeScannerModeTabBtn = document.getElementById('barcodeScannerModeTab');
  if (barcodeScannerModeTabBtn) {
    barcodeScannerModeTabBtn.addEventListener('click', () => switchQuickUpdateTab('barcodeScannerModeTab'));
  }

  const moveProductIdInput = document.getElementById('moveProductId');
  if (moveProductIdInput) {
    moveProductIdInput.addEventListener('keypress', function(event) {
      if ((event.key === 'Enter' || event.keyCode === 13) && moveProductIdInput.value.trim() !== '') {
        event.preventDefault();
        const currentVal = moveProductIdInput.value;
        stopMoveScanner();
        console.log('Enter key processed for moveProductId. Value:', currentVal);
      }
    });
  }

  const addLocationBtn = document.getElementById('addLocationBtn');
  if (addLocationBtn) {
    addLocationBtn.addEventListener('click', addLocation);
  }

  const filterSupplierEl = document.getElementById('filterSupplier');
  const filterLocationEl = document.getElementById('filterLocation');
  const clearInventoryFiltersBtnEl = document.getElementById('clearInventoryFiltersBtn');
  const inventorySearchInputEl = document.getElementById('inventorySearchInput');

  if (filterSupplierEl) {
    filterSupplierEl.addEventListener('change', () => {
        currentPage = 1;
        applyAndRenderInventoryFilters();
    });
  }
  if (filterLocationEl) {
    filterLocationEl.addEventListener('change', () => {
        currentPage = 1;
        applyAndRenderInventoryFilters();
    });
  }
  if (inventorySearchInputEl) {
    const debouncedSearchHandler = debounce(() => {
        currentPage = 1;
        applyAndRenderInventoryFilters();
    }, 400);
    inventorySearchInputEl.addEventListener('input', debouncedSearchHandler);
  }
  if (clearInventoryFiltersBtnEl) {
    clearInventoryFiltersBtnEl.addEventListener('click', () => {
      if (filterSupplierEl) filterSupplierEl.value = '';
      if (filterLocationEl) filterLocationEl.value = '';
      if (inventorySearchInputEl) inventorySearchInputEl.value = '';
      currentPage = 1;
      applyAndRenderInventoryFilters();
    });
  }

  const filterToOrderSupplierDropdown = document.getElementById('filterToOrderSupplier');
  if (filterToOrderSupplierDropdown) {
    filterToOrderSupplierDropdown.addEventListener('change', () => {
      updateToOrderTable();
    });
  }
  
  document.getElementById('generateOrderReportBtn').addEventListener('click', generateFastOrderReportPDF);
  document.getElementById('emailOrderReportBtn').addEventListener('click', emailOrderReport);

  // Wiring for the "Generate Detailed Order Report with QR Codes (Slow)" button
  const generateDetailedOrderReportBtnEl = document.getElementById('generateDetailedOrderReportBtn');
  if (generateDetailedOrderReportBtnEl) {
    generateDetailedOrderReportBtnEl.addEventListener('click', generateDetailedOrderReportPDFWithQRCodes);
  } else {
    console.error("Button with ID 'generateDetailedOrderReportBtn' not found in DOM.");
  }

  const qrCodePDFBtn = document.getElementById('generateQRCodePDFBtn');
  if (qrCodePDFBtn) {
    qrCodePDFBtn.addEventListener('click', generateQRCodePDF);
  } else {
    console.warn('QR Code PDF button not found in DOM');
  }

  console.log('Button element (generateQRCodePDFBtn):', document.getElementById('generateQRCodePDFBtn'));

  const generateLocationQRCodePDFBtnEl = document.getElementById('generateLocationQRCodePDFBtn');
  if (generateLocationQRCodePDFBtnEl) {
    generateLocationQRCodePDFBtnEl.addEventListener('click', generateQRCodePDF);
  }

  const generateSupplierOrderQRCodePDFBtn = document.getElementById('generateSupplierOrderQRCodePDFBtn');
  if (generateSupplierOrderQRCodePDFBtn) {
    generateSupplierOrderQRCodePDFBtn.addEventListener('click', generateSupplierOrderQRCodePDF);
  } else {
    console.warn('Button with ID generateSupplierOrderQRCodePDFBtn not found.');
  }

  const emailSupplierOrderBtn = document.getElementById('emailSupplierOrderBtn');
  if (emailSupplierOrderBtn) {
    emailSupplierOrderBtn.addEventListener('click', emailSupplierOrder);
  } else {
    console.warn('Button with ID emailSupplierOrderBtn not found.');
  }

  const exportInventoryCSVBtnEl = document.getElementById('exportInventoryCSVBtn');
  if (exportInventoryCSVBtnEl) {
    exportInventoryCSVBtnEl.addEventListener('click', exportInventoryToCSV);
  }

  const toggleInventoryIDBtn = document.getElementById('toggleInventoryIDColumnBtn');
  if (toggleInventoryIDBtn) {
    toggleInventoryIDBtn.addEventListener('click', () => {
      const idCells = document.querySelectorAll('#inventoryTableContent .id-column');
      let isHiddenAfterToggle = false;
      idCells.forEach(cell => {
        cell.classList.toggle('hidden');
        if (cell.classList.contains('hidden')) {
          isHiddenAfterToggle = true; 
        }
      });
      if (isHiddenAfterToggle) {
        toggleInventoryIDBtn.textContent = 'Show IDs';
      } else {
        toggleInventoryIDBtn.textContent = 'Hide IDs';
      }
    });
  }

  const toggleToOrderIDBtn = document.getElementById('toggleToOrderIDColumnBtn');
  if (toggleToOrderIDBtn) {
    toggleToOrderIDBtn.addEventListener('click', () => {
      const idCells = document.querySelectorAll('#toOrderTableContent .to-order-id-column');
      let isHiddenAfterToggle = false;
      idCells.forEach(cell => {
        cell.classList.toggle('hidden');
        if (cell.classList.contains('hidden')) {
          isHiddenAfterToggle = true;
        }
      });
      if (isHiddenAfterToggle) {
        toggleToOrderIDBtn.textContent = 'Show IDs';
      } else {
        toggleToOrderIDBtn.textContent = 'Hide IDs';
      }
    });
  }

  const menuInventory = document.getElementById('menuInventory');
  const menuSuppliers = document.getElementById('menuSuppliers');
  const menuOrders = document.getElementById('menuOrders');
  const menuReports = document.getElementById('menuReports');
  const menuQuickStockUpdate = document.getElementById('menuQuickStockUpdate');
  const menuUserManagement = document.getElementById('menuUserManagement'); // Added

  const menuItems = [menuInventory, menuSuppliers, menuOrders, menuReports, menuQuickStockUpdate, menuUserManagement].filter(item => item !== null); // Added menuUserManagement

  // Attach event listener for creating orders
  const createOrderForm = document.getElementById('createOrderForm');
  if (createOrderForm) {
    createOrderForm.addEventListener('submit', handleCreateOrder);
  } else {
    console.warn('Create Order Form (createOrderForm) not found. Order creation will not work.');
  }

  // Event listeners for order status update modal
  const confirmUpdateStatusBtn = document.getElementById('confirmUpdateStatusBtn');
  if (confirmUpdateStatusBtn) {
    confirmUpdateStatusBtn.addEventListener('click', handleUpdateOrderStatus);
  } else {
    console.warn('Confirm Update Status Button (confirmUpdateStatusBtn) not found.');
  }

  const cancelUpdateStatusModalBtn = document.getElementById('cancelUpdateStatusModalBtn');
  if (cancelUpdateStatusModalBtn) {
    cancelUpdateStatusModalBtn.addEventListener('click', handleCancelUpdateStatusModal);
  } else {
    console.warn('Cancel Update Status Modal Button (cancelUpdateStatusModalBtn) not found.');
  }

  const inventoryViewContainer = document.getElementById('inventoryViewContainer');
  const suppliersSectionContainer = document.getElementById('suppliersSectionContainer');
  const ordersSectionContainer = document.getElementById('ordersSectionContainer');
  const reportsSectionContainer = document.getElementById('reportsSectionContainer');
  const quickStockUpdateContainer = document.getElementById('quickStockUpdateContainer');
  const userManagementSectionContainer = document.getElementById('userManagementSectionContainer'); // Added

  const allViewContainers = [
      inventoryViewContainer,
      suppliersSectionContainer,
      ordersSectionContainer,
      reportsSectionContainer,
      quickStockUpdateContainer,
      userManagementSectionContainer // Added
  ].filter(container => container !== null);

  // Add event listener for the order status filter
  const filterOrderStatusDropdown = document.getElementById('filterOrderStatus');
  if (filterOrderStatusDropdown) {
    filterOrderStatusDropdown.addEventListener('change', () => {
      console.log('Order status filter changed to:', filterOrderStatusDropdown.value);
      if (typeof loadAndDisplayOrders === 'function') {
        loadAndDisplayOrders();
      } else {
        console.error('loadAndDisplayOrders function not available when trying to filter orders.');
      }
    });
  } else {
    console.warn('Order status filter dropdown (filterOrderStatus) not found in DOM.');
  }

  const activeMenuClasses = ['bg-gray-300', 'dark:bg-slate-700', 'font-semibold', 'text-gray-900', 'dark:text-white'];
  const inactiveMenuClasses = ['text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-300', 'dark:hover:bg-slate-700'];

  function setActiveMenuItem(clickedItemId) {
      menuItems.forEach(item => {
          if (item.id === clickedItemId) {
              inactiveMenuClasses.forEach(cls => item.classList.remove(cls));
              activeMenuClasses.forEach(cls => item.classList.add(cls));
              const icon = item.querySelector('svg');
              if (icon) {
                  icon.classList.remove('text-gray-500', 'dark:text-gray-400', 'group-hover:text-gray-700', 'dark:group-hover:text-gray-200');
                  icon.classList.add('text-gray-700', 'dark:text-gray-100');
              }
          } else {
              activeMenuClasses.forEach(cls => item.classList.remove(cls));
              inactiveMenuClasses.forEach(cls => item.classList.add(cls));
              const icon = item.querySelector('svg');
              if (icon) {
                  icon.classList.remove('text-gray-700', 'dark:text-gray-100');
                  icon.classList.add('text-gray-500', 'dark:text-gray-400', 'group-hover:text-gray-700', 'dark:group-hover:text-gray-200');
              }
          }
      });
  }

  // The original showView function definition has been cut from here and moved to the top of the file.

  // START: Order Creation Logic
  async function handleCreateOrder(event) {
    event.preventDefault();
    console.log('[handleCreateOrder] Attempting to create new order.');

    const productId = document.getElementById('orderProductId').value;
    const quantityInput = document.getElementById('orderQuantity');
    const quantity = parseInt(quantityInput.value);

    if (!productId) {
      alert('Please select a product.');
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    const submitOrderBtn = document.getElementById('submitOrderBtn');
    submitOrderBtn.disabled = true;
    submitOrderBtn.textContent = 'Submitting...';

    try {
      // Fetch product name for denormalization (optional, but good for display)
      let productName = productId; // Default to ID if name not found
      const productDoc = await db.collection('inventory').doc(productId).get();
      if (productDoc.exists) {
        productName = productDoc.data().name || productId;
      } else {
        console.warn(`[handleCreateOrder] Product document not found for ID: ${productId} when fetching name.`);
      }

      // 1. Create the order document
      const newOrderRef = await db.collection('orders').add({
        productId: productId,
        productName: productName, // Store product name
        quantity: quantity,
        status: 'Pending', // Initial status
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: firebase.auth().currentUser ? firebase.auth().currentUser.uid : null // Track who created it
      });
      console.log('[handleCreateOrder] New order created with ID:', newOrderRef.id);

      // 2. Update inventory: increment quantityOrdered
      const inventoryRef = db.collection('inventory').doc(productId);
      await db.runTransaction(async (transaction) => {
        const productSnapshot = await transaction.get(inventoryRef);
        if (!productSnapshot.exists) {
          throw new Error(`Product with ID ${productId} not found in inventory for updating quantityOrdered.`);
        }
        const currentQuantityOrdered = productSnapshot.data().quantityOrdered || 0;
        transaction.update(inventoryRef, {
          quantityOrdered: currentQuantityOrdered + quantity
        });
      });
      console.log(`[handleCreateOrder] Incremented quantityOrdered for product ${productId} by ${quantity}.`);

      alert('Order created successfully!');
      document.getElementById('createOrderForm').reset(); // Reset form

      // 3. Refresh displays
      if (typeof loadAndDisplayOrders === 'function') loadAndDisplayOrders();
      if (typeof updateToOrderTable === 'function') updateToOrderTable(); // This lists items needing reorder

    } catch (error) {
      console.error('[handleCreateOrder] Error creating order or updating inventory:', error);
      alert(`Failed to create order: ${error.message}`);
    } finally {
      submitOrderBtn.disabled = false;
      submitOrderBtn.textContent = 'Submit Order';
    }
  }
  // END: Order Creation Logic

  // START: Order Status Update Logic
  let currentEditingOrderId = null; // To store the ID of the order being edited via modal

  // Function to be called by the "View" button on each order row
  // Declared globally so inline onclick attribute can find it
  window.viewOrderDetails = async (orderId) => {
    console.log(`[viewOrderDetails] Editing order: ${orderId}`);
    currentEditingOrderId = orderId;
    const modal = document.getElementById('updateOrderStatusModal');
    const statusDropdown = document.getElementById('modalNewOrderStatus');

    if (!modal || !statusDropdown) {
      console.error('[viewOrderDetails] Modal or status dropdown not found.');
      alert('Error: Could not open order status modal.');
      return;
    }

    try {
      const orderDoc = await db.collection('orders').doc(orderId).get();
      if (orderDoc.exists) {
        const orderData = orderDoc.data();
        statusDropdown.value = orderData.status || 'Pending'; // Set current status in dropdown
      } else {
        console.error(`[viewOrderDetails] Order ${orderId} not found.`);
        alert('Error: Order not found.');
        return;
      }
    } catch (error) {
      console.error(`[viewOrderDetails] Error fetching order ${orderId}:`, error);
      alert(`Error fetching order details: ${error.message}`);
      return;
    }

    modal.classList.remove('hidden');
  };

  async function handleUpdateOrderStatus() {
    console.log('[handleUpdateOrderStatus] Attempting to update order status.');
    if (!currentEditingOrderId) {
      alert('Error: No order selected for update.');
      return;
    }

    const newStatus = document.getElementById('modalNewOrderStatus').value;
    const modal = document.getElementById('updateOrderStatusModal');
    const confirmBtn = document.getElementById('confirmUpdateStatusBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Updating...';

    try {
      const orderRef = db.collection('orders').doc(currentEditingOrderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        throw new Error(`Order ${currentEditingOrderId} not found.`);
      }
      const orderData = orderDoc.data();
      const productId = orderData.productId;
      const orderQuantity = orderData.quantity;

      // Update order status in Firestore
      await orderRef.update({ status: newStatus });
      console.log(`[handleUpdateOrderStatus] Order ${currentEditingOrderId} status updated to ${newStatus}.`);

      // If status is 'Fulfilled', adjust inventory
      if (newStatus === 'Fulfilled' || newStatus === 'fulfilled') {
        console.log(`[handleUpdateOrderStatus] Order ${currentEditingOrderId} is Fulfilled. Adjusting inventory for product ${productId}.`);
        const inventoryRef = db.collection('inventory').doc(productId);

        await db.runTransaction(async (transaction) => {
          const productSnapshot = await transaction.get(inventoryRef);
          if (!productSnapshot.exists) {
            throw new Error(`Product with ID ${productId} not found in inventory for final stock adjustment.`);
          }

          const currentInventoryQuantity = productSnapshot.data().quantity || 0;
          const currentQuantityOrdered = productSnapshot.data().quantityOrdered || 0;

          let newInventoryQuantity = currentInventoryQuantity + orderQuantity;
          let newQuantityOrdered = currentQuantityOrdered - orderQuantity;
          if (newQuantityOrdered < 0) {
            console.warn(`[handleUpdateOrderStatus] quantityOrdered for product ${productId} would go below zero. Setting to 0. Was: ${currentQuantityOrdered}, Subtracting: ${orderQuantity}`);
            newQuantityOrdered = 0;
          }

          transaction.update(inventoryRef, {
            quantity: newInventoryQuantity,
            quantityOrdered: newQuantityOrdered
          });
        });
        console.log(`[handleUpdateOrderStatus] Inventory for product ${productId} updated: quantity increased by ${orderQuantity}, quantityOrdered decreased by ${orderQuantity}.`);
      }

      alert('Order status updated successfully!');
      if (modal) modal.classList.add('hidden');
      currentEditingOrderId = null;

      // Refresh displays
      if (typeof loadAndDisplayOrders === 'function') loadAndDisplayOrders();
      if (typeof updateToOrderTable === 'function') updateToOrderTable();

    } catch (error) {
      console.error('[handleUpdateOrderStatus] Error updating order status or inventory:', error);
      alert(`Failed to update order status: ${error.message}`);
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Update Status';
      }
    }
  }

  function handleCancelUpdateStatusModal() {
    const modal = document.getElementById('updateOrderStatusModal');
    if (modal) {
      modal.classList.add('hidden');
    }
    currentEditingOrderId = null;
    console.log('[handleCancelUpdateStatusModal] Order status update cancelled, modal closed.');
  }
  // END: Order Status Update Logic


  if (menuInventory) {
      menuInventory.addEventListener('click', (e) => {
          e.preventDefault();
          showView('inventoryViewContainer', menuInventory.id);
      });
  }

  if (menuSuppliers) {
      menuSuppliers.addEventListener('click', (e) => {
          e.preventDefault();
          showView('suppliersSectionContainer', menuSuppliers.id);
      });
  }

  if (menuOrders) {
      menuOrders.addEventListener('click', (e) => {
          e.preventDefault();
          showView('ordersSectionContainer', menuOrders.id);
      });
  }

  if (menuReports) {
      menuReports.addEventListener('click', (e) => {
          e.preventDefault();
          showView('reportsSectionContainer', menuReports.id);
          updateInventoryDashboard();
      });
  }

  if (menuQuickStockUpdate) {
    menuQuickStockUpdate.addEventListener('click', (e) => {
        e.preventDefault();
        showView('quickStockUpdateContainer', menuQuickStockUpdate.id);
        ensureQRCodeIsAvailable().then(() => {
            // displayActionQRCodes(); // OLD - This was for the now-removed "Quick Scan Mode" tab's general actions
            displayBarcodeModeActionQRCodes(); // NEW - Display actions specific to "Barcode Scanner Mode"
        }).catch(error => {
            console.error("QRCode library not available for Quick Stock Update (Barcode Mode Actions):", error);
            // The container for barcode mode actions is 'barcodeModeActionQRCodesContainer'
            const container = document.getElementById('barcodeModeActionQRCodesContainer');
            if(container) container.innerHTML = "<p class='text-red-500 col-span-full'>Error: QR Code library failed to load. Cannot display action QR codes.</p>";
        });
    });
  }

  if (menuUserManagement) {
    menuUserManagement.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof showView === 'function') {
        showView('userManagementSectionContainer', 'menuUserManagement');
      } else {
        console.error('showView function is not defined when trying to open User Management.');
      }
    });
  }
  
  if (inventoryViewContainer && menuInventory) {
      showView('inventoryViewContainer', menuInventory.id); 
  } else {
      console.error("Default view 'inventoryViewContainer' or 'menuInventory' not found on page load.");
      const firstAvailableView = allViewContainers.length > 0 ? allViewContainers[0] : null;
      const firstAvailableMenuItem = menuItems.length > 0 ? menuItems[0] : null;
      if (firstAvailableView && firstAvailableMenuItem) {
          showView(firstAvailableView.id, firstAvailableMenuItem.id);
          console.warn(`Default inventory view/menu missing, showing first available: ${firstAvailableView.id}, ${firstAvailableMenuItem.id}`);
      } else {
          console.error("No view containers or menu items found. Page might be empty or IDs are incorrect.");
      }
  }

  document.addEventListener('keypress', (event) => {
    const imageModalVisible = imageModal && !imageModal.classList.contains('hidden');
    if (imageModalVisible) {
        return;
    }

    // const quickStockUpdateContainerEl = document.getElementById('quickStockUpdateContainer'); // No longer needed directly here
    // const quickStockUpdateContainerVisible = quickStockUpdateContainerEl && !quickStockUpdateContainerEl.classList.contains('hidden'); // No longer needed
    // const quickScanModeTabActive = document.getElementById('quickScanModeTab')?.getAttribute('aria-selected') === 'true'; // No longer exists

    if (event.key === 'Enter' || event.keyCode === 13) {
      // The specific keypress logic for Quick Scan Mode (isQuickStockBarcodeActive && quickScanModeTabActive etc.) is removed.
      // The Barcode Scanner Mode keypress logic remains.
      // START: Barcode Scanner Mode - Enter Key Pressed
      if (isBarcodeScannerModeActive && quickStockBarcodeBuffer.trim() !== '') {
        try {
          event.preventDefault();
          const scannedValue = quickStockBarcodeBuffer.trim();
          quickStockBarcodeBuffer = ""; // Clear buffer immediately

          const activeProductEl = document.getElementById('barcodeActiveProductName');

          if (scannedValue.startsWith('ACTION_')) { // It's an Action QR
              if (!currentBarcodeModeProductId) {
                  setBarcodeStatus('Error: Scan a Product QR first before scanning an action.', true);
                  setLastActionFeedback('---', false); // Reset feedback to neutral
                  return;
              }
              db.collection('inventory').doc(currentBarcodeModeProductId).get().then(docSnapshot => {
                  if (!docSnapshot.exists) {
                      setBarcodeStatus('Error: Active product not found in database. Please rescan product.', true);
                      currentBarcodeModeProductId = null;
                      if(activeProductEl) activeProductEl.textContent = 'None';
                      setLastActionFeedback('---', false);
                      // Clear product specific display
                      document.getElementById('barcodeProductSpecificQR').innerHTML = '';
                      const imgElement = document.getElementById('barcodeProductSpecificImage');
                      imgElement.src = '#';
                      imgElement.classList.add('hidden');
                      return;
                  }
                  const product = { id: docSnapshot.id, ...docSnapshot.data() };
                  let currentQuantity = product.quantity;
                  let newQuantity = currentQuantity;

                  if (scannedValue === 'ACTION_ADD_1') newQuantity = currentQuantity + 1;
                  else if (scannedValue === 'ACTION_SUB_1') newQuantity = currentQuantity - 1;
                  else if (scannedValue === 'ACTION_ADD_2') newQuantity = currentQuantity + 2;
                  else if (scannedValue === 'ACTION_SUB_2') newQuantity = currentQuantity - 2;
                  else if (scannedValue === 'ACTION_ADD_3') newQuantity = currentQuantity + 3;
                  else if (scannedValue === 'ACTION_SUB_3') newQuantity = currentQuantity - 3;
                  else if (scannedValue === 'ACTION_ADD_4') newQuantity = currentQuantity + 4;
                  else if (scannedValue === 'ACTION_SUB_4') newQuantity = currentQuantity - 4;
                  else if (scannedValue === 'ACTION_ADD_5') newQuantity = currentQuantity + 5;
                  else if (scannedValue === 'ACTION_SUB_5') newQuantity = currentQuantity - 5;
                  else if (scannedValue === 'ACTION_ADD_10') newQuantity = currentQuantity + 10;
                  else if (scannedValue === 'ACTION_SUB_10') newQuantity = currentQuantity - 10;
                  else if (scannedValue === 'ACTION_SET_0') newQuantity = 0;
                  else if (scannedValue === 'ACTION_SET_1') newQuantity = 1;
                  else if (scannedValue === 'ACTION_SET_5') newQuantity = 5;
                  else if (scannedValue === 'ACTION_SET_10') newQuantity = 10;
                  else if (scannedValue === 'ACTION_SET_20') newQuantity = 20;
                  else if (scannedValue === 'ACTION_SET_30') newQuantity = 30;
                  else if (scannedValue === 'ACTION_SET_40') newQuantity = 40;
                  else if (scannedValue === 'ACTION_CANCEL') {
                      setBarcodeStatus(`Action cancelled for ${product.name}. Scan action or new product.`);
                      setLastActionFeedback(`Cancelled. ${product.name} Qty: ${currentQuantity}`, false); // Neutral feedback
                      return;
                  } else {
                      setBarcodeStatus(`Error: Unknown action QR: ${scannedValue}`, true);
                      setLastActionFeedback('---', false);
                      return;
                  }

                  if (newQuantity < 0) newQuantity = 0;

                  db.collection('inventory').doc(currentBarcodeModeProductId).update({ quantity: newQuantity })
                      .then(() => {
                          setLastActionFeedback(`${product.name}: ${scannedValue}. New Qty: ${newQuantity}`, false); // Success is default (false)
                          setBarcodeStatus(`Scan next Action for ${product.name} or new Product QR.`);
                          const invItem = inventory.find(p => p.id === currentBarcodeModeProductId);
                          if (invItem) invItem.quantity = newQuantity;
                          updateToOrderTable();
                      })
                      .catch(err => {
                          setBarcodeStatus(`Error updating ${product.name}: ${err.message}`, true);
                          setLastActionFeedback('Update Failed!', true);
                      });
              }).catch(err => {
                   setBarcodeStatus(`Error fetching product ${currentBarcodeModeProductId}: ${err.message}`, true);
                   setLastActionFeedback('Error!', true);
              });

          } else { // It's a Product ID
              db.collection('inventory').doc(scannedValue).get().then(docSnapshot => {
                  const productSpecificQRDiv = document.getElementById('barcodeProductSpecificQR');
                  const productSpecificImg = document.getElementById('barcodeProductSpecificImage');

                  if (docSnapshot.exists) {
                      const product = { id: docSnapshot.id, ...docSnapshot.data() };
                      currentBarcodeModeProductId = product.id;
                      if(activeProductEl) activeProductEl.textContent = `${product.name} (Qty: ${product.quantity})`;
                      setBarcodeStatus(`Scan Action QR for ${product.name}.`);
                      setLastActionFeedback('---', false);

                      // Display product's own QR
                      productSpecificQRDiv.innerHTML = '';
                      try {
                          new QRCode(productSpecificQRDiv, {
                              text: product.id,
                              width: 96,
                              height: 96,
                              colorDark: '#000000',
                              colorLight: '#ffffff',
                              correctLevel: QRCode.CorrectLevel.M
                          });
                      } catch (e) {
                          console.error('Error generating product specific QR for Barcode Mode:', e);
                          productSpecificQRDiv.textContent = 'QR Error';
                      }

                      // Display product image
                      if (product.photo) {
                          productSpecificImg.src = product.photo;
                          productSpecificImg.classList.remove('hidden');
                      } else {
                          productSpecificImg.src = '#';
                          productSpecificImg.classList.add('hidden');
                      }

                  } else {
                      currentBarcodeModeProductId = null;
                      if(activeProductEl) activeProductEl.textContent = 'None';
                      setBarcodeStatus(`Error: Product ID '${scannedValue}' Not Found. Scan valid Product QR.`, true);
                      setLastActionFeedback('---', false);
                      productSpecificQRDiv.innerHTML = '';
                      productSpecificImg.src = '#';
                      productSpecificImg.classList.add('hidden');
                  }
              }).catch(err => {
                  currentBarcodeModeProductId = null;
                  if(activeProductEl) activeProductEl.textContent = 'None';
                  setBarcodeStatus(`Error fetching product ID '${scannedValue}': ${err.message}`, true);
                  setLastActionFeedback('---', false);
                  document.getElementById('barcodeProductSpecificQR').innerHTML = '';
                  const imgElement = document.getElementById('barcodeProductSpecificImage');
                  imgElement.src = '#';
                  imgElement.classList.add('hidden');
              });
          }
        } catch (error) {
          console.error("Synchronous error in keypress listener for Barcode Scanner Mode:", error);
        }
      }
      // END: Barcode Scanner Mode - Enter Key Pressed
      else if (isEditScanModeActive && editScanInputBuffer.trim() !== '') {
        event.preventDefault();
        const scannedId = editScanInputBuffer.trim();
        console.log('Enter key processed by global listener for editScan. Buffer:', scannedId);
        editProduct(scannedId);
        stopEditScanner(); 
      }
      editScanInputBuffer = "";
    } else {
      if (isBarcodeScannerModeActive) {
        try { // Outer try for the buffering part
          const activeElement = document.activeElement;
          if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA' && activeElement.tagName !== 'SELECT')) {
             quickStockBarcodeBuffer += event.key;
          }
        } catch (error) { // Catch for the buffering part
          console.error("Synchronous error in keypress listener for Barcode Scanner Mode:", error);
        }
      // All logic related to isQuickStockBarcodeActive has been removed.
      // The Barcode Scanner Mode handles its own buffering if active and no input is focused.
      // The Edit Scan Mode handles its own buffering if active and no input is focused.
      } else if (isEditScanModeActive) {
        const activeElement = document.activeElement;
        if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA' && activeElement.tagName !== 'SELECT')) {
            editScanInputBuffer += event.key;
        }
      }
      // No other general buffering for quickStockBarcodeBuffer is needed here,
      // as it's specifically for modes that are active (Barcode Scanner) or was for Quick Scan.
    }
  });

  // Event listeners for quickScanProductIdField, quickScanQuantityInput, interactiveProductSearch,
  // startQuickStockScannerBtn, stopQuickStockScannerBtn, scanForProductBtn, and submitQuickScanUpdateBtn
  // have been removed because their corresponding HTML elements (quickScanModeContent and its children) were removed in a previous task,
  // and the functions they called (like handleProductSearch, handleSubmitQuickScanUpdate, processQuickStockScan etc.) have also been deleted.
  // The DOMContentLoaded listener no longer attempts to attach listeners to these non-existent elements.

    // Logout Button Functionality
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        if (firebase && firebase.auth) {
          firebase.auth().signOut().then(() => {
            console.log('User signed out successfully.');
            // UI updates are handled by onAuthStateChanged
          }).catch((error) => {
            console.error('Sign out error:', error);
            alert('Error signing out: ' + error.message);
          });
        } else {
          console.error('Firebase auth instance not available for sign out.');
          alert('Critical error: Firebase not correctly initialized. Cannot sign out.');
        }
      });
    } else {
      console.warn('Logout button (logoutButton) not found in DOM.');
    }

    initializeImageObserver();

    // Test PDFLib functionality
    console.log("Attempting to test PDFLib integration...");
    (async () => {
      try {
        await ensurePDFLibIsAvailable();
        console.log("window.PDFLib is defined after ensuring availability.");
        // You could potentially call a lightweight PDFLib function here for a quick test
        // For example, trying to create a dummy document (optional)
        // const { PDFDocument } = window.PDFLib;
        // await PDFDocument.create();
        // console.log("PDFLib basic functionality (e.g., PDFDocument.create) seems to work.");
        // The original generateFastOrderReportPDF() call is likely too heavy for this initial test.
        // If you still want to call it, ensure it's properly handled:
        // generateFastOrderReportPDF();
        console.log("PDFLib seems available. Further calls to functions using PDFLib should now work.");
      } catch (error) {
        console.error("PDFLib availability check failed or basic test failed:", error);
      }
    })();

  } catch (error) {
    console.error('Initialization failed:', error);
    const body = document.querySelector('body');
    if (body) {
      const errorDiv = document.createElement('div');
      errorDiv.textContent = 'Critical error: Application setup failed. Some features might not work. Please refresh or check console.';
      errorDiv.style.color = 'red';
      errorDiv.style.backgroundColor = 'white';
      errorDiv.style.padding = '10px';
      errorDiv.style.textAlign = 'center';
      errorDiv.style.border = '1px solid red';
      body.prepend(errorDiv);
    }
  }
});