// Import the UI enhancement manager
import { uiEnhancementManager } from './modules/ui-enhancements.js';

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
let productIdsWithClientBackorders = []; // Added for new highlighting logic

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

// Helper functions for Barcode Scanner Mode
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
    const db = firebase.firestore();
    const inventorySnapshot = await db.collection('inventory').get();
    const dropdown = document.getElementById('orderProductId');

    if (!dropdown) {
      console.error('Dropdown element with ID "orderProductId" not found in orders section');
      return;
    }
    dropdown.innerHTML = ''; // Clear existing options

    const products = inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const productsToOrder = products.filter(item =>
      (item.quantity + (item.quantityOrdered || 0) + (item.productQuantityBackordered || 0)) <= item.minQuantity && item.minQuantity > 0
      // Added item.minQuantity > 0 to ensure items with no min quantity set (or set to 0) aren't accidentally included if their stock is 0.
    );

    if (productsToOrder.length === 0) {
      const noProductsOption = document.createElement('option');
      noProductsOption.value = "";
      noProductsOption.text = "No products currently need reordering";
      noProductsOption.disabled = true;
      noProductsOption.selected = true;
      dropdown.appendChild(noProductsOption);
      console.log('Products dropdown: No products need reordering.');
    } else {
      const defaultOption = document.createElement('option');
      defaultOption.value = "";
      defaultOption.text = "Select a Product to Order";
      defaultOption.disabled = true;
      defaultOption.selected = true;
      dropdown.appendChild(defaultOption);

      productsToOrder.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id)); // Sort for better UX

      productsToOrder.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.text = product.name || product.id;
        dropdown.appendChild(option);
      });
      console.log(`Products dropdown populated with ${productsToOrder.length} items needing reorder.`);
    }
  } catch (error) {
    console.error('Error populating products dropdown:', error);
    const dropdown = document.getElementById('orderProductId');
    if (dropdown) {
        dropdown.innerHTML = '<option value="" disabled selected>Error loading products</option>';
    }
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
      // Ensure 'Backordered' status uses the correct value 'backordered' if that's what's stored in Firestore
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
      } else if (status === 'Backordered' || status === 'backordered') { // New condition for backordered
        cellStatus.classList.add('status-backordered');
      }
      else {
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
    console.error('[loadAndDisplayOrders] Error loading and displaying orders:', error.message, error.stack);
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
        productQuantityBackordered: quantityBackordered, // Ensure field name consistency
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
            // The original 'addBatchEntry()' call here might have been too aggressive.
            // addBatchEntry(); // This might be too aggressive if not the last line.
            // Let's make it focus quantity first, then if enter on quantity of last line, add new.
            // For now, just focus quantity. The original code was: addBatchEntry();
            // The original logic was: stopUpdateScanner(); console.log(...); addBatchEntry();
            // This means after typing ID and enter, it immediately added a new blank row.
            // Let's keep that original behavior for speed.
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

// Missing PDF Generation Functions (Stubs for now)
async function generateFastOrderReportPDF() {
  try {
    uiEnhancementManager.showToast('PDF Report generation is not yet implemented', 'warning');
    console.log('generateFastOrderReportPDF called - function stub');
  } catch (error) {
    console.error('Error in generateFastOrderReportPDF:', error);
    alert('Failed to generate PDF report: ' + error.message);
  }
}

async function generateDetailedOrderReportPDFWithQRCodes() {
  try {
    uiEnhancementManager.showToast('Detailed PDF Report generation is not yet implemented', 'warning');
    console.log('generateDetailedOrderReportPDFWithQRCodes called - function stub');
  } catch (error) {
    console.error('Error in generateDetailedOrderReportPDFWithQRCodes:', error);
    alert('Failed to generate detailed PDF report: ' + error.message);
  }
}

async function exportInventoryToCSV() {
  try {
    uiEnhancementManager.showToast('CSV Export is not yet implemented', 'warning');
    console.log('exportInventoryToCSV called - function stub');
  } catch (error) {
    console.error('Error in exportInventoryToCSV:', error);
    alert('Failed to export to CSV: ' + error.message);
  }
}

async function emailOrderReport() {
  try {
    uiEnhancementManager.showToast('Email Order Report is not yet implemented', 'warning');
    console.log('emailOrderReport called - function stub');
  } catch (error) {
    console.error('Error in emailOrderReport:', error);
    alert('Failed to email order report: ' + error.message);
  }
}

async function generateQRCodePDF() {
  try {
    uiEnhancementManager.showToast('QR Code PDF generation is not yet implemented', 'warning');
    console.log('generateQRCodePDF called - function stub');
  } catch (error) {
    console.error('Error in generateQRCodePDF:', error);
    alert('Failed to generate QR Code PDF: ' + error.message);
  }
}

async function generateSupplierOrderQRCodePDF() {
  try {
    uiEnhancementManager.showToast('Supplier Order QR Code PDF generation is not yet implemented', 'warning');
    console.log('generateSupplierOrderQRCodePDF called - function stub');
  } catch (error) {
    console.error('Error in generateSupplierOrderQRCodePDF:', error);
    alert('Failed to generate Supplier Order QR Code PDF: ' + error.message);
  }
}

async function emailSupplierOrder() {
  try {
    uiEnhancementManager.showToast('Email Supplier Order is not yet implemented', 'warning');
    console.log('emailSupplierOrder called - function stub');
  } catch (error) {
    console.error('Error in emailSupplierOrder:', error);
    alert('Failed to email supplier order: ' + error.message);
  }
}

// Inventory Management
let productIdsWithPendingOrders = []; // Global or module-scoped variable

async function loadInventory() {
  try {
    console.log('Fetching inventory from Firestore...');
    const snapshot = await db.collection('inventory').get();
    console.log('Inventory snapshot:', snapshot.size, 'documents');
    
    inventory = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    console.log('Inventory loaded:', inventory.length, 'items');

    // Initialize dashboard when inventory is loaded
    uiEnhancementManager.updateDashboard({
      totalProducts: inventory.length,
      lowStockItems: inventory.filter(item => item.quantity <= item.minQuantity).length,
      outOfStockItems: inventory.filter(item => item.quantity === 0).length,
      totalValue: inventory.reduce((sum, item) => sum + (item.quantity * item.cost || 0), 0)
    });

    console.log('Fetching pending orders...');
    const ordersSnapshot = await db.collection('orders').where('status', '==', 'pending').get();
    productIdsWithPendingOrders = ordersSnapshot.docs.map(doc => doc.data().productId);
    console.log('Product IDs with pending orders:', productIdsWithPendingOrders);
    
    console.log('Fetching client backorders...');
    const clientBackordersSnapshot = await db.collection('inventory').where('productQuantityBackordered', '>', 0).get();
    productIdsWithClientBackorders = clientBackordersSnapshot.docs.map(doc => doc.data().id);
    console.log('Product IDs with client backorders:', productIdsWithClientBackorders);

    displayInventory();
    updateToOrderTable();
  } catch (error) {
    console.error('Error loading inventory:', error);
    alert('Failed to load inventory: ' + error.message);
  }
}

function displayInventory() {
  const tableBody = document.getElementById('inventoryTable');
  if (!tableBody) {
    console.error('Inventory table body not found');
    return;
  }

  let filteredInventory = [...inventory];
  
  // Apply filters if they exist
  const supplierFilter = document.getElementById('filterSupplier')?.value;
  const locationFilter = document.getElementById('filterLocation')?.value;
  const searchInput = document.getElementById('inventorySearchInput')?.value?.toLowerCase();

  if (supplierFilter) {
    filteredInventory = filteredInventory.filter(item => item.supplier === supplierFilter);
  }
  
  if (locationFilter) {
    filteredInventory = filteredInventory.filter(item => item.location === locationFilter);
  }
  
  if (searchInput) {
    filteredInventory = filteredInventory.filter(item => 
      (item.name || '').toLowerCase().includes(searchInput) ||
      (item.id || '').toLowerCase().includes(searchInput)
    );
  }

  // Handle pagination
  totalFilteredItems = filteredInventory.length;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = filteredInventory.slice(startIndex, endIndex);

  console.log('Updating inventory table with:', paginatedItems.length, 'items');

  // Use UI enhancement manager for modern table
  if (typeof uiEnhancementManager !== 'undefined') {
    uiEnhancementManager.updateTable('inventoryTable', paginatedItems);
  } else {
    // Fallback to basic table update
    tableBody.innerHTML = '';
    paginatedItems.forEach((item, index) => {
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td class="id-column hidden">${item.id}</td>
        <td>${item.name}</td>
        <td class="text-center">${item.quantity}</td>
        <td class="text-center">${item.minQuantity}</td>
        <td class="text-right">${(item.cost || 0).toFixed(2)}</td>
        <td>${item.supplier || ''}</td>
        <td>${item.location || ''}</td>
        <td class="text-center">
          <button onclick="editProduct('${item.id}')" class="text-blue-500 hover:underline">Edit</button>
          <button onclick="deleteProduct('${item.id}')" class="text-red-500 hover:underline ml-2">Delete</button>
        </td>
      `;
    });
  }

  console.log('Inventory table updated with modern UI, rows:', paginatedItems.length);
  
  // Attach event listeners after table update
  attachTableEventListeners();
  
  // Update pagination info
  updatePaginationControls();

  console.log('QR code generation skipped for performance - use QR Code action in dropdown');
}

// Add the missing main initialization
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded fired');
  
  // Initialize dark mode
  initialDarkModeCheck();

  // Set up menu navigation
  const menuInventory = document.getElementById('menuInventory');
  const menuSuppliers = document.getElementById('menuSuppliers');
  const menuOrders = document.getElementById('menuOrders');
  const menuReports = document.getElementById('menuReports');
  const menuQuickStockUpdate = document.getElementById('menuQuickStockUpdate');
  const menuUserManagement = document.getElementById('menuUserManagement');

  const allViewContainers = [
    document.getElementById('inventoryViewContainer'),
    document.getElementById('suppliersSectionContainer'),
    document.getElementById('ordersSectionContainer'),
    document.getElementById('reportsSectionContainer'),
    document.getElementById('quickStockUpdateContainer'),
    document.getElementById('userManagementSectionContainer')
  ].filter(container => container !== null);

  console.log('Found view containers:', allViewContainers.length);
  console.log('Found menu items:', [menuInventory, menuSuppliers, menuOrders, menuReports, menuQuickStockUpdate, menuUserManagement].filter(item => item !== null).length);

  // Navigation event listeners
  if (menuInventory) {
    menuInventory.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Inventory menu clicked');
      showView('inventoryViewContainer', menuInventory.id);
    });
  } else {
    console.error('menuInventory element not found');
  }

  if (menuSuppliers) {
    menuSuppliers.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Suppliers menu clicked');
      showView('suppliersSectionContainer', menuSuppliers.id);
    });
  } else {
    console.error('menuSuppliers element not found');
  }

  if (menuOrders) {
    menuOrders.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Orders menu clicked');
      showView('ordersSectionContainer', menuOrders.id);
    });
  } else {
    console.error('menuOrders element not found');
  }

  if (menuReports) {
    menuReports.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Reports menu clicked');
      showView('reportsSectionContainer', menuReports.id);
    });
  } else {
    console.error('menuReports element not found');
  }

  if (menuQuickStockUpdate) {
    menuQuickStockUpdate.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Quick Stock Update menu clicked');
      showView('quickStockUpdateContainer', menuQuickStockUpdate.id);
    });
  } else {
    console.error('menuQuickStockUpdate element not found');
  }

  if (menuUserManagement) {
    menuUserManagement.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('User Management menu clicked');
      showView('userManagementSectionContainer', menuUserManagement.id);
    });
  } else {
    console.error('menuUserManagement element not found');
  }

  // Other event listeners
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

  // Form event listeners
  const productSubmitBtn = document.getElementById('productSubmitBtn');
  if (productSubmitBtn) {
    productSubmitBtn.addEventListener('click', submitProduct);
  }

  const moveProductBtn = document.getElementById('moveProductBtn');
  if (moveProductBtn) {
    moveProductBtn.addEventListener('click', moveProduct);
  }

  const addSupplierBtn = document.getElementById('addSupplierBtn');
  if (addSupplierBtn) {
    addSupplierBtn.addEventListener('click', addSupplier);
  }

  const addLocationBtn = document.getElementById('addLocationBtn');
  if (addLocationBtn) {
    addLocationBtn.addEventListener('click', addLocation);
  }

  // Set up collapsible sections
  setTimeout(() => {
    console.log('Initializing collapsible sections...');
    setupCollapsibleSection('toggleProductFormBtn', 'productFormContent', true);
    setupCollapsibleSection('toggleMoveProductFormBtn', 'moveProductFormContent', true);
    setupCollapsibleSection('toggleInventoryTableBtn', 'inventoryTableContent', true);
  }, 100);

  console.log('DOMContentLoaded initialization complete');
});

// Add pagination functions
function updatePaginationControls() {
  const totalPages = Math.ceil(totalFilteredItems / ITEMS_PER_PAGE);
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (pageInfo) {
    pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${totalFilteredItems} items)`;
  }
  
  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
    prevBtn.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        displayInventory();
      }
    };
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.onclick = () => {
      if (currentPage < totalPages) {
        currentPage++;
        displayInventory();
      }
    };
  }
}

// Missing Scanner Functions (Stubs for now)
async function startUpdateScanner() {
  try {
    uiEnhancementManager.showToast('Update Scanner is not yet implemented', 'warning');
    console.log('startUpdateScanner called - function stub');
  } catch (error) {
    console.error('Error in startUpdateScanner:', error);
    alert('Failed to start update scanner: ' + error.message);
  }
}

async function stopUpdateScanner() {
  try {
    uiEnhancementManager.showToast('Update Scanner stopped', 'info');
    console.log('stopUpdateScanner called - function stub');
  } catch (error) {
    console.error('Error in stopUpdateScanner:', error);
  }
}

async function startMoveScanner() {
  try {
    uiEnhancementManager.showToast('Move Scanner is not yet implemented', 'warning');
    console.log('startMoveScanner called - function stub');
  } catch (error) {
    console.error('Error in startMoveScanner:', error);
    alert('Failed to start move scanner: ' + error.message);
  }
}

async function stopMoveScanner() {
  try {
    uiEnhancementManager.showToast('Move Scanner stopped', 'info');
    console.log('stopMoveScanner called - function stub');
  } catch (error) {
    console.error('Error in stopMoveScanner:', error);
  }
}

async function startEditScanner() {
  try {
    uiEnhancementManager.showToast('Edit Scanner is not yet implemented', 'warning');
    console.log('startEditScanner called - function stub');
  } catch (error) {
    console.error('Error in startEditScanner:', error);
    alert('Failed to start edit scanner: ' + error.message);
  }
}

async function stopEditScanner() {
  try {
    uiEnhancementManager.showToast('Edit Scanner stopped', 'info');
    console.log('stopEditScanner called - function stub');
  } catch (error) {
    console.error('Error in stopEditScanner:', error);
  }
}

// Missing Dashboard and Report Functions (Stubs)
async function updateInventoryDashboard() {
  try {
    console.log('updateInventoryDashboard called - function stub');
    // This could use the UI enhancement manager's dashboard update
    if (typeof uiEnhancementManager !== 'undefined') {
      uiEnhancementManager.updateDashboard({
        totalProducts: inventory.length,
        lowStockItems: inventory.filter(item => item.quantity <= item.minQuantity).length,
        outOfStockItems: inventory.filter(item => item.quantity === 0).length,
        totalValue: inventory.reduce((sum, item) => sum + (item.quantity * item.cost || 0), 0)
      });
    }
  } catch (error) {
    console.error('Error in updateInventoryDashboard:', error);
  }
}

async function generateSupplierOrderSummaries() {
  try {
    uiEnhancementManager.showToast('Supplier Order Summaries generation is not yet implemented', 'warning');
    console.log('generateSupplierOrderSummaries called - function stub');
  } catch (error) {
    console.error('Error in generateSupplierOrderSummaries:', error);
  }
}

async function populateTrendProductSelect() {
  try {
    console.log('populateTrendProductSelect called - function stub');
    const select = document.getElementById('trendProductSelect');
    if (select) {
      select.innerHTML = '<option value="">Select a product...</option>';
      inventory.slice(0, 10).forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name || item.id;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error in populateTrendProductSelect:', error);
  }
}

async function generateProductUsageChart(productId) {
  try {
    uiEnhancementManager.showToast('Product Usage Chart generation is not yet implemented', 'warning');
    console.log('generateProductUsageChart called with productId:', productId);
  } catch (error) {
    console.error('Error in generateProductUsageChart:', error);
  }
}

// Batch entry functions
function removeBatchEntry(entryId) {
  try {
    const entryElement = document.querySelector(`[data-entry-id="${entryId}"]`)?.closest('div');
    if (entryElement) {
      entryElement.remove();
      // Remove from batchUpdates array
      const index = batchUpdates.indexOf(entryId);
      if (index > -1) {
        batchUpdates.splice(index, 1);
      }
    }
  } catch (error) {
    console.error('Error in removeBatchEntry:', error);
  }
}