// Import the UI enhancement manager
import { uiEnhancementManager } from './modules/ui-enhancements.js';
import { InventoryManager } from './modules/inventory.js';

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
let inventoryManager; // Declare inventory manager globally
let originalPhotoUrlForEdit = ''; // Stores the original photo URL when editing a product

// Global variables for Quick Stock Update
let quickStockBarcodeBuffer = ""; // Used by Manual Batch (indirectly via keypress), and Barcode Scanner modes

// Global State Variables for Barcode Scanner Mode
let currentBarcodeModeProductId = null;
let isBarcodeScannerModeActive = false;
let qsuStream = null; // Stream for the Quick Stock Update QR Scanner
let qsuAnimationLoopId = null; // For controlling the requestAnimationFrame loop of QR scanner

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


// Debug function to check UI container visibility
function debugUIContainers() {
  const containers = [
    'authContainer',
    'appNavbar', 
    'appMainContainer',
    'mainContent',
    'dashboardViewContainer',
    'inventoryViewContainer'
  ];
  
  console.log('=== UI CONTAINER DEBUG ===');
  containers.forEach(containerId => {
    const element = document.getElementById(containerId);
    if (element) {
      const isHidden = element.classList.contains('hidden');
      const computedStyle = window.getComputedStyle(element);
      const display = computedStyle.display;
      const visibility = computedStyle.visibility;
      const opacity = computedStyle.opacity;
      
      console.log(`${containerId}:`, {
        exists: true,
        hidden: isHidden,
        display: display,
        visibility: visibility,
        opacity: opacity,
        classList: Array.from(element.classList)
      });
    } else {
      console.log(`${containerId}: NOT FOUND`);
    }
  });
  console.log('=== END DEBUG ===');
}

// Add debug function to window for console access
window.debugUIContainers = debugUIContainers;

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
    document.getElementById('dashboardViewContainer'),
    document.getElementById('inventoryViewContainer'),
    document.getElementById('suppliersSectionContainer'),
    document.getElementById('ordersSectionContainer'),
    document.getElementById('reportsSectionContainer'),
    document.getElementById('quickStockUpdateContainer'),
    document.getElementById('suppliersAndLocationsContainer'), // Corrected ID to match HTML
    document.getElementById('ordersSectionContainer'),
    document.getElementById('reportsSectionContainer'),
    document.getElementById('quickStockUpdateContainer'),
    document.getElementById('userManagementSectionContainer')
  ].filter(container => container !== null);

  let viewFound = false;
  allViewContainers.forEach(container => {
      if (container.id === viewIdToShow) {
          container.classList.remove('hidden');
          viewFound = true;
          console.log(`Showing: ${container.id}`);
          // VIEW SPECIFIC INITIALIZATIONS
          if (container.id === 'inventoryViewContainer') {
              console.log('[showView] inventoryViewContainer selected. Refreshing inventory display and dashboard.');
              console.log('[showView] Calling displayInventory() for inventoryViewContainer.');
              if (typeof displayInventory === 'function') displayInventory(); else console.error("[showView] displayInventory is not defined");
              console.log('[showView] Calling updateInventoryDashboard() for inventoryViewContainer.');
              if (typeof updateInventoryDashboard === 'function') updateInventoryDashboard(); else console.error("[showView] updateInventoryDashboard is not defined");
              console.log('[showView] Calling updateToOrderTable() for inventoryViewContainer.');
              if (typeof updateToOrderTable === 'function') updateToOrderTable(); else console.error("[showView] updateToOrderTable is not defined");
          } else if (container.id === 'dashboardViewContainer') {
              console.log('[showView] dashboardViewContainer selected. Calling updateEnhancedDashboard.');
              if (typeof updateEnhancedDashboard === 'function') updateEnhancedDashboard(); else console.error("[showView] updateEnhancedDashboard is not defined");
          }
          // END VIEW SPECIFIC INITIALIZATIONS
          // Original if-else chain continues below for other views, slightly refactored to include the above specific initializations first.

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
            // Call report functions with defensive checks
            console.log('Reports section is being shown - calling report functions');
            
            // Update inventory dashboard (low stock alerts) - Note: This is already called when inventoryViewContainer is shown if that's part of reports
            // This might be redundant or specific to a part of the reports view
            setTimeout(() => {
              try {
                // Check if updateInventoryDashboard is truly needed here or if it's covered by inventory view logic
                // updateInventoryDashboard();
              } catch (error) {
                console.error('Error calling updateInventoryDashboard from reports section:', error);
              }
            }, 100);
            
            // Generate supplier order summaries
            setTimeout(() => {
              try {
                generateSupplierOrderSummaries();
              } catch (error) {
                console.error('Error calling generateSupplierOrderSummaries:', error);
              }
            }, 200);
            
            // Populate trend product select
            setTimeout(() => {
              try {
                populateTrendProductSelect();
              } catch (error) {
                console.error('Error calling populateTrendProductSelect:', error);
              }
            }, 300);
            
            // Generate product usage chart
            setTimeout(() => {
              try {
                generateProductUsageChart('');
              } catch (error) {
                console.error('Error calling generateProductUsageChart:', error);
              }
            }, 400);
            
            // Also load orders when reports view is shown
            setTimeout(() => {
              try {
                loadAndDisplayOrders();
              } catch (error) {
                console.error('Error calling loadAndDisplayOrders for reports view:', error);
              }
            }, 500);
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
          document.getElementById('menuDashboard'),
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

initialDarkModeCheck();

// Stub functions for missing functionalities to prevent ReferenceErrors
function toggleSidebar() {
    console.log('[toggleSidebar] Called - Not fully implemented.');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent'); // Assuming this is the main content area that needs to adjust
    const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');

    if (sidebar && mainContent && sidebarToggleIcon) {
        sidebar.classList.toggle('w-64'); // Full width
        sidebar.classList.toggle('w-16'); // Minimized width (example)
        mainContent.classList.toggle('ml-64');
        mainContent.classList.toggle('ml-16'); // Adjust margin based on sidebar width

        // Toggle menu text visibility
        const menuTexts = sidebar.querySelectorAll('.menu-text');
        menuTexts.forEach(text => {
            text.classList.toggle('hidden'); // Or more sophisticated animation
        });

        // Change icon
        if (sidebar.classList.contains('w-16')) { // Minimized
            sidebarToggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />`; // Hamburger
            localStorage.setItem(SIDEBAR_STATE_KEY, 'true');
        } else { // Maximized
            sidebarToggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5" />`; // Chevron left (original)
            localStorage.setItem(SIDEBAR_STATE_KEY, 'false');
        }
        console.log('[toggleSidebar] Sidebar toggled. Minimized:', sidebar.classList.contains('w-16'));
    } else {
        console.error('[toggleSidebar] Sidebar, mainContent, or toggleIcon element not found.');
    }
}

function minimizeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
    if (sidebar && mainContent && sidebarToggleIcon && !sidebar.classList.contains('w-16')) {
        sidebar.classList.add('w-16');
        sidebar.classList.remove('w-64');
        mainContent.classList.add('ml-16');
        mainContent.classList.remove('ml-64');
        sidebar.querySelectorAll('.menu-text').forEach(text => text.classList.add('hidden'));
        sidebarToggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />`; // Hamburger
    }
}

function maximizeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
     if (sidebar && mainContent && sidebarToggleIcon && sidebar.classList.contains('w-16')) {
        sidebar.classList.remove('w-16');
        sidebar.classList.add('w-64');
        mainContent.classList.remove('ml-16');
        mainContent.classList.add('ml-64');
        sidebar.querySelectorAll('.menu-text').forEach(text => text.classList.remove('hidden'));
        sidebarToggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5" />`; // Chevron
    }
}


function startEditScanner() {
    console.log('[startEditScanner] Called - Not implemented.');
    // Basic placeholder:
    const editVideo = document.getElementById('editVideo');
    const scanResultEl = document.getElementById('editScanResult');
    if(editVideo) editVideo.classList.remove('hidden');
    if(scanResultEl) scanResultEl.textContent = 'Edit scanner started (feature not fully implemented).';
    // In a real scenario, this would involve QuaggaJS or similar to use the camera.
}

function stopEditScanner() {
    console.log('[stopEditScanner] Called - Not implemented (related to startEditScanner).');
    const editVideo = document.getElementById('editVideo');
    if(editVideo) editVideo.classList.add('hidden');
    // Stop camera stream if active
}


function emailReport() {
    console.log('[emailReport] Called - Not implemented.');
    alert('Email report functionality is not yet implemented.');
}

function initiateImageModalVars() {
    console.log('[initiateImageModalVars] Called.');
    imageModal = document.getElementById('imageModal');
    modalImage = document.getElementById('modalImage');
    closeImageModalBtn = document.getElementById('closeImageModalBtn'); // Listener for this is in DOMContentLoaded
    if (!imageModal || !modalImage || !closeImageModalBtn) {
        console.warn('[initiateImageModalVars] One or more image modal elements not found.');
    }
}

function openImageModal(imageUrl) {
    console.log('[openImageModal] Called with URL:', imageUrl);
    if (imageModal && modalImage) {
        modalImage.src = imageUrl;
        imageModal.classList.remove('hidden');
        imageModal.classList.add('flex'); // Assuming flex is used to center it
    } else {
        console.error('[openImageModal] Modal elements not initialized or found.');
    }
}

function closeImageModal() {
    console.log('[closeImageModal] Called.');
    if (imageModal) {
        imageModal.classList.add('hidden');
        imageModal.classList.remove('flex');
        if(modalImage) modalImage.src = ''; // Clear image
    } else {
        console.error('[closeImageModal] imageModal element not found.');
    }
}

function updateEnhancedDashboard() {
    console.log('[updateEnhancedDashboard] Called.');
    // This is a stub. A real implementation would update:
    // dashboardTotalProducts, dashboardLowStockItems, dashboardOutOfStockItems, dashboardTotalValue, recentActivityList
    const dashboardTotalProductsEl = document.getElementById('dashboardTotalProducts');
    const dashboardLowStockItemsEl = document.getElementById('dashboardLowStockItems');
    const dashboardOutOfStockItemsEl = document.getElementById('dashboardOutOfStockItems');
    const dashboardTotalValueEl = document.getElementById('dashboardTotalValue');
    const recentActivityListEl = document.getElementById('recentActivityList');

    if (dashboardTotalProductsEl) dashboardTotalProductsEl.textContent = inventory ? inventory.length : '0';
    if (dashboardLowStockItemsEl) dashboardLowStockItemsEl.textContent = inventory ? inventory.filter(item => item.quantity <= item.minQuantity && item.minQuantity > 0).length : '0';
    if (dashboardOutOfStockItemsEl) dashboardOutOfStockItemsEl.textContent = inventory ? inventory.filter(item => item.quantity === 0).length : '0';
    if (dashboardTotalValueEl) {
        const totalVal = inventory ? inventory.reduce((sum, item) => sum + (item.quantity * (item.cost || 0)), 0) : 0;
        dashboardTotalValueEl.textContent = `$${totalVal.toFixed(2)}`;
    }
    if (recentActivityListEl) {
        recentActivityListEl.innerHTML = '<div>No recent activity (stub).</div>'; // Placeholder
    }
    console.log('[updateEnhancedDashboard] Stub updated dashboard elements.');
}

// +++++ START OF STUB FUNCTIONS TO RESOLVE REFERENCEERRORS +++++

function startUpdateScanner() { console.log('startUpdateScanner called - STUB'); }
function stopUpdateScanner() { console.log('stopUpdateScanner called - STUB'); }
function startMoveScanner() { console.log('startMoveScanner called - STUB'); }
function stopMoveScanner() { console.log('stopMoveScanner called - STUB'); }

async function startQuickStockBarcodeScanner() {
    console.log('startQuickStockBarcodeScanner called');
    const video = document.getElementById('qsuVideo');
    const canvasElement = document.getElementById('qsuCanvas');
    const scanResultElement = document.getElementById('qsuScanResult');
    const startBtn = document.getElementById('qsuScanProductBtn');
    const stopBtn = document.getElementById('qsuStopScanBtn');
    const scannedProductInfoEl = document.getElementById('qsuScannedProductInfo');

    if (!video || !canvasElement || !scanResultElement || !startBtn || !stopBtn || !scannedProductInfoEl) {
        console.error('QSU Scanner: One or more UI elements are missing.');
        setBarcodeStatus('Scanner UI elements missing. Cannot start.', true);
        return;
    }

    // Hide previously scanned product info
    scannedProductInfoEl.classList.add('hidden');
    setBarcodeStatus('Initializing scanner...', false);

    if (qsuStream) { // If a stream already exists, stop it first
        qsuStream.getTracks().forEach(track => track.stop());
    }
    if (qsuAnimationLoopId) {
        cancelAnimationFrame(qsuAnimationLoopId);
    }

    try {
        qsuStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = qsuStream;
        video.classList.remove('hidden');
        video.play(); // Important for some browsers

        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        isBarcodeScannerModeActive = true;
        setBarcodeStatus('Scanner active. Point camera at a product QR code.', false);
        scanResultElement.textContent = '';

        const canvas = canvasElement.getContext('2d', { willReadFrequently: true });

        function tick() {
            if (!isBarcodeScannerModeActive || !qsuStream) return; // Stop loop if scanner stopped

            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvasElement.height = video.videoHeight;
                canvasElement.width = video.videoWidth;
                canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
                const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code) {
                    scanResultElement.textContent = `Found QR: ${code.data}`;
                    // uiEnhancementManager.showToast(`QR Scanned: ${code.data}`, 'success', 1000); // Short toast
                    // Stop the scanner and handle the code
                    // stopQuickStockBarcodeScanner(); // Stop first to prevent multiple quick scans
                    handleQuickStockScan(code.data); // Process the scanned code
                    // Note: handleQuickStockScan might call stopQuickStockBarcodeScanner itself
                    return; // Exit tick loop once code is found and handled
                }
            }
            if (isBarcodeScannerModeActive) { // Only continue if still active
                qsuAnimationLoopId = requestAnimationFrame(tick);
            }
        }
        qsuAnimationLoopId = requestAnimationFrame(tick);

    } catch (err) {
        console.error("Error starting QSU barcode scanner:", err);
        setBarcodeStatus(`Error: ${err.message}`, true);
        scanResultElement.textContent = `Error: ${err.message}`;
        isBarcodeScannerModeActive = false;
        if (qsuStream) {
            qsuStream.getTracks().forEach(track => track.stop());
        }
        video.classList.add('hidden');
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
    }
}

function stopQuickStockBarcodeScanner() {
    console.log('stopQuickStockBarcodeScanner called');
    const video = document.getElementById('qsuVideo');
    const startBtn = document.getElementById('qsuScanProductBtn');
    const stopBtn = document.getElementById('qsuStopScanBtn');
    const scanResultElement = document.getElementById('qsuScanResult');
    const scannedProductInfoEl = document.getElementById('qsuScannedProductInfo');

    if (qsuStream) {
        qsuStream.getTracks().forEach(track => track.stop());
        qsuStream = null;
    }
    if (qsuAnimationLoopId) {
        cancelAnimationFrame(qsuAnimationLoopId);
        qsuAnimationLoopId = null;
    }

    if (video) video.classList.add('hidden');
    if (startBtn) startBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');

    isBarcodeScannerModeActive = false;
    // currentBarcodeModeProductId = null; // Clearing this might be premature if an action is pending
                                        // Let handleQuickStockScan or other logic decide when to clear it.

    setBarcodeStatus('Scan a Product QR Code to begin.', false); // Reset status
    if(scanResultElement) scanResultElement.textContent = '';
    if(scannedProductInfoEl) scannedProductInfoEl.classList.add('hidden'); // Hide product info
}

async function handleQuickStockScan(productId) {
    console.log("handleQuickStockScan called with Product ID:", productId);
    setBarcodeStatus(`Processing ID: ${productId}...`, false);

    // Stop the scanner once a valid QR is found and we start processing it.
    // This prevents continuous scanning while user might be interacting or system is fetching data.
    if (isBarcodeScannerModeActive) {
        stopQuickStockBarcodeScanner();
    }

    currentBarcodeModeProductId = productId; // Set the global active product ID for this mode

    const product = inventory.find(p => p.id === productId); // Check against loaded global inventory

    const productNameEl = document.getElementById('qsuProductName');
    const currentStockEl = document.getElementById('qsuCurrentStock');
    const scannedProductInfoEl = document.getElementById('qsuScannedProductInfo');
    const productSpecificQREl = document.getElementById('barcodeProductSpecificQR'); // From main barcode mode UI
    const productSpecificImageEl = document.getElementById('barcodeProductSpecificImage'); // From main barcode mode UI

    if (!productNameEl || !currentStockEl || !scannedProductInfoEl || !productSpecificQREl || !productSpecificImageEl) {
        console.error("handleQuickStockScan: One or more UI elements for displaying product info are missing.");
        setBarcodeStatus("UI error displaying product info.", true);
        return;
    }

    if (product) {
        productNameEl.textContent = product.name;
        currentStockEl.textContent = product.quantity;
        scannedProductInfoEl.classList.remove('hidden');

        setBarcodeStatus(`Product: ${product.name}. Adjust quantity or scan action.`, false);
        setLastActionFeedback("Product identified.", false);

        // Display product's own QR and image in the designated spots
        productSpecificQREl.innerHTML = ''; // Clear previous
        if (typeof QRCode !== 'undefined') {
            new QRCode(productSpecificQREl, {
                text: product.id,
                width: 80,
                height: 80,
                colorDark: document.documentElement.classList.contains('dark') ? "#FFFFFF" : "#000000",
                colorLight: document.documentElement.classList.contains('dark') ? "#4A5568" : "#FFFFFF", // Adjust dark bg
            });
        }
        if (product.photo) {
            productSpecificImageEl.src = product.photo;
            productSpecificImageEl.classList.remove('hidden');
        } else {
            productSpecificImageEl.classList.add('hidden');
        }

        // Ensure action QRs are visible (these are for +1, -1 type actions)
        await displayBarcodeModeActionQRCodes(); // This function populates barcodeModeActionQRCodesContainer

    } else {
        productNameEl.textContent = 'N/A';
        currentStockEl.textContent = 'N/A';
        scannedProductInfoEl.classList.add('hidden'); // Hide if product not found
        productSpecificQREl.innerHTML = '<span class="text-xs">N/A</span>';
        productSpecificImageEl.classList.add('hidden');

        setBarcodeStatus(`Product ID "${productId}" not found in inventory.`, true);
        setLastActionFeedback(`Failed to find product: ${productId}`, true);
        currentBarcodeModeProductId = null; // Clear if product not found
    }
}

async function adjustScannedProductQuantity(adjustmentType, quantityToAdjustStr) {
    const quantityToAdjust = parseInt(quantityToAdjustStr);

    if (!currentBarcodeModeProductId) {
        setLastActionFeedback("No active product selected for quantity adjustment.", true);
        return;
    }
    if (isNaN(quantityToAdjust) || quantityToAdjust <= 0) {
        setLastActionFeedback("Invalid quantity for adjustment.", true);
        return;
    }

    try {
        const productRef = db.collection('inventory').doc(currentBarcodeModeProductId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
            setLastActionFeedback(`Product ${currentBarcodeModeProductId} not found.`, true);
            return;
        }

        const productData = productDoc.data();
        let currentQuantity = productData.quantity;
        let newQuantity;

        if (adjustmentType === 'increment') {
            newQuantity = currentQuantity + quantityToAdjust;
            await productRef.update({ quantity: newQuantity });
            setLastActionFeedback(`Added ${quantityToAdjust} to ${productData.name}. New stock: ${newQuantity}`, false);
        } else if (adjustmentType === 'decrement') {
            if (currentQuantity >= quantityToAdjust) {
                newQuantity = currentQuantity - quantityToAdjust;
                await productRef.update({ quantity: newQuantity });
                setLastActionFeedback(`Removed ${quantityToAdjust} from ${productData.name}. New stock: ${newQuantity}`, false);
            } else {
                setLastActionFeedback(`Cannot remove ${quantityToAdjust}. Only ${currentQuantity} in stock for ${productData.name}.`, true);
                return; // Don't update UI stock if operation failed
            }
        } else {
            setLastActionFeedback("Invalid adjustment type.", true);
            return;
        }

        // Update local inventory array and UI
        const inventoryIndex = inventory.findIndex(p => p.id === currentBarcodeModeProductId);
        if (inventoryIndex !== -1) {
            inventory[inventoryIndex].quantity = newQuantity;
        }

        // Update displayed stock in QSU
        const currentStockEl = document.getElementById('qsuCurrentStock');
        if (currentStockEl) {
            currentStockEl.textContent = newQuantity;
        }

        // Refresh main inventory table if it's visible
        if (document.getElementById('inventoryViewContainer') && !document.getElementById('inventoryViewContainer').classList.contains('hidden')) {
            displayInventory();
        }
        updateInventoryDashboard(); // Update dashboard stats
        updateToOrderTable(); // Update "to order" list

    } catch (error) {
        console.error("Error adjusting product quantity:", error);
        setLastActionFeedback(`Error updating stock: ${error.message}`, true);
    }
}


function addQuickStockManualEntry() { console.log('addQuickStockManualEntry called - STUB'); }
function submitQuickStockBatch() { console.log('submitQuickStockBatch called - STUB'); }
function handleQuickStockProductSearch() { console.log('handleQuickStockProductSearch called - STUB'); }
function handleQuickStockFileUpload() { console.log('handleQuickStockFileUpload called - STUB'); }
function processQuickStockUploadedFile() { console.log('processQuickStockUploadedFile called - STUB'); }
function handleAddOrder() { console.log('handleAddOrder called - STUB'); }
function switchQuickUpdateTab(tabId) {
    // List of all QSU tab IDs and their corresponding content container IDs
    const tabToContent = {
        manualBatchModeTab: 'manualBatchModeContent',
        barcodeScannerModeTab: 'barcodeScannerModeContent',
        fileUploadModeTab: 'fileUploadModeContent'
    };
    // Remove 'active' class from all tabs and hide all contents
    Object.keys(tabToContent).forEach(id => {
        const tabEl = document.getElementById(id);
        const contentEl = document.getElementById(tabToContent[id]);
        if (tabEl) tabEl.classList.remove('btn-primary', 'tab-active');
        if (contentEl) contentEl.classList.add('hidden');
    });
    // Show the selected tab's content and mark tab as active
    const selectedTab = document.getElementById(tabId);
    const selectedContent = document.getElementById(tabToContent[tabId]);
    if (selectedTab) selectedTab.classList.add('btn-primary', 'tab-active');
    if (selectedContent) selectedContent.classList.remove('hidden');
    // Optionally, focus the first input in the shown content for better UX
    if (selectedContent) {
        const firstInput = selectedContent.querySelector('input, textarea, select');
        if (firstInput) firstInput.focus();
    }
    console.log(`switchQuickUpdateTab: Switched to tab ${tabId}`);
}
function generateFastOrderReportPDF() { console.log('generateFastOrderReportPDF called - STUB'); }
function generateOrderReportPDFWithQRCodes() { console.log('generateOrderReportPDFWithQRCodes called - STUB'); }
function generateAllQRCodesPDF() { console.log('generateAllQRCodesPDF called - STUB'); }
function generateProductUsageChart(productId) { console.log(`generateProductUsageChart called for ${productId} - STUB`); }
function viewOrderDetails(orderId) { console.log(`viewOrderDetails called for ${orderId} - STUB`); }
function populateTrendProductSelect() { console.log('populateTrendProductSelect called - STUB'); }

// +++++ END OF STUB FUNCTIONS +++++

// +++++ START OF NEWLY ADDED/RESTORED FUNCTIONS +++++

function displayInventory(searchTerm = '', supplierFilter = '', locationFilter = '') {
    const inventoryTableBody = document.getElementById('inventoryTable');
    // Adjusted to use existing DaisyUI loading spinner and error display if possible
    const loadingEl = document.getElementById('inventoryLoading');
    const errorEl = document.getElementById('inventoryError'); // General error display
    const emptyStateEl = document.getElementById('inventoryEmptyState'); // From old root, might need to add to public/index.html if not present

    const currentPageDisplay = document.getElementById('currentPageDisplay'); // From public/index.html
    const prevPageBtn = document.getElementById('prevPageBtn'); // From public/index.html
    const nextPageBtn = document.getElementById('nextPageBtn'); // From public/index.html

    if (!inventoryTableBody) {
        console.error("displayInventory: inventoryTable body not found.");
        if(errorEl) {
            errorEl.textContent = "Inventory table element not found in HTML.";
            errorEl.classList.remove('hidden');
        }
        return;
    }

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (emptyStateEl) emptyStateEl.classList.add('hidden'); // Hide empty state initially
    inventoryTableBody.innerHTML = ''; // Clear previous items

    // 1. Filter Data
    let filteredInventory = inventory; // Use the global inventory array

    if (!Array.isArray(inventory)) {
        console.error("Global inventory data is not loaded or not an array.");
        if (loadingEl) loadingEl.classList.add('hidden');
        if (errorEl) {
            errorEl.textContent = "Inventory data is not available. Please try reloading.";
            errorEl.classList.remove('hidden');
        }
        return;
    }

    const searchTermVal = document.getElementById('inventorySearchInput')?.value.toLowerCase() || searchTerm.toLowerCase();
    const supplierFilterVal = document.getElementById('filterSupplier')?.value || supplierFilter;
    const locationFilterVal = document.getElementById('filterLocation')?.value || locationFilter;

    if (searchTermVal) {
        filteredInventory = filteredInventory.filter(item =>
            (item.name && item.name.toLowerCase().includes(searchTermVal)) ||
            (item.id && item.id.toLowerCase().includes(searchTermVal))
        );
    }
    if (supplierFilterVal) {
        filteredInventory = filteredInventory.filter(item => item.supplier === supplierFilterVal);
    }
    if (locationFilterVal) {
        filteredInventory = filteredInventory.filter(item => item.location === locationFilterVal);
    }

    totalFilteredItems = filteredInventory.length;

    // 2. Paginate Data
    const totalPages = Math.ceil(totalFilteredItems / ITEMS_PER_PAGE) || 1;
    currentPage = Math.max(1, Math.min(currentPage, totalPages));

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedItems = filteredInventory.slice(startIndex, endIndex);

    if (loadingEl) loadingEl.classList.add('hidden');

    if (paginatedItems.length === 0) {
        if (emptyStateEl) { // Use dedicated empty state from public/index.html if available
            emptyStateEl.classList.remove('hidden');
        } else { // Fallback to simple message in table
            inventoryTableBody.innerHTML = `<tr><td colspan="10" class="text-center p-4">
                <div role="alert" class="alert alert-info justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span>No products found matching your criteria.</span>
                </div>
            </td></tr>`;
        }
    } else {
        paginatedItems.forEach(item => {
            const row = inventoryTableBody.insertRow();
            // Determine row class based on stock levels (similar to lowStockAlerts styling)
            let rowClass = 'hover:bg-gray-50 dark:hover:bg-slate-750'; // Default hover
            if (item.quantity === 0) {
                rowClass = 'bg-error/20 hover:bg-error/30'; // Out of stock
            } else if (item.quantity <= item.minQuantity && item.minQuantity > 0) {
                rowClass = 'bg-warning/20 hover:bg-warning/30'; // Low stock
            }
            row.className = rowClass;

            // Columns based on public/index.html thead for inventoryTable:
            // ID, Name, Qty, Min.Qty, Cost, Supplier, Location, Photo, QR, Actions
            row.innerHTML = `
                <td class="px-2 py-1 text-xs align-middle">${item.id}</td>
                <td class="px-2 py-1 font-medium align-middle">${item.name}</td>
                <td class="px-2 py-1 text-center align-middle">${item.quantity}</td>
                <td class="px-2 py-1 text-center align-middle">${item.minQuantity || 0}</td>
                <td class="px-2 py-1 text-right align-middle">$${(item.cost || 0).toFixed(2)}</td>
                <td class="px-2 py-1 align-middle">${item.supplier || 'N/A'}</td>
                <td class="px-2 py-1 align-middle">${item.location || 'N/A'}</td>
                <td class="px-2 py-1 text-center align-middle">
                    ${item.photo ? `<img src="${item.photo}" alt="${item.name}" class="w-10 h-10 object-cover rounded cursor-pointer product-photo-thumb mx-auto" data-img-url="${item.photo}">` : '<span class="text-xs text-gray-400">No Photo</span>'}
                </td>
                <td class="px-2 py-1 text-center align-middle">
                    <div id="qr-${item.id}" class="inline-block mx-auto" style="width:40px; height:40px;"></div>
                </td>
                <td class="px-2 py-1 text-center align-middle whitespace-nowrap">
                    <button class="btn btn-xs btn-outline btn-primary edit-product-btn" data-product-id="${item.id}" title="Edit">Edit</button>
                    <button class="btn btn-xs btn-outline btn-error delete-product-btn" data-product-id="${item.id}" title="Delete">Del</button>
                    <button class="btn btn-xs btn-outline btn-info move-product-action-btn" data-product-id="${item.id}" title="Move">Move</button>
                </td>
            `;
            const qrCellDiv = row.querySelector(`#qr-${item.id}`);
            if (qrCellDiv && typeof QRCode !== 'undefined') {
                new QRCode(qrCellDiv, {
                    text: item.id,
                    width: 40,
                    height: 40,
                    colorDark: document.documentElement.classList.contains('dark') ? "#FFFFFF" : "#000000",
                    colorLight: document.documentElement.classList.contains('dark') ? "#334155" : "#FFFFFF", // slate-700 for dark bg
                    correctLevel: QRCode.CorrectLevel.L
                });
            } else if (qrCellDiv) {
                 qrCellDiv.innerHTML = `<span class="text-xs text-gray-400">QR Err</span>`;
            }
        });
    }

    // 3. Update Pagination Controls
    if (currentPageDisplay) currentPageDisplay.textContent = `${currentPage} / ${totalPages}`;
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;

    const pageInfo = document.getElementById('pageInfo'); // From root index.html, public/index.html has currentPageDisplay
    if(pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}. Total items: ${totalFilteredItems}`;


    // 4. Attach Event Listeners
    attachTableEventListeners();
}

function attachTableEventListeners() {
    // Remove existing listeners to prevent duplicates if table is re-rendered often
    // This is a simple approach; a more robust way might involve checking if listeners already exist or using a single delegated listener.
    const table = document.getElementById('inventoryTable');
    if (!table) return;

    // For simplicity in this context, we'll re-query and add.
    // If performance becomes an issue, event delegation is better.

    table.querySelectorAll('.edit-product-btn').forEach(button => {
        // Clone and replace to remove old listeners if any
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', (e) => {
            const productId = e.currentTarget.dataset.productId;
            const productFormSection = document.getElementById('productManagement'); // Section containing the form
            if (productFormSection) productFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            const formCheckbox = document.getElementById('toggleProductFormCheckbox');
            if (formCheckbox) formCheckbox.checked = true; // Ensure DaisyUI collapse is open

            editProduct(productId); // This function should populate the form
        });
    });

    table.querySelectorAll('.delete-product-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', (e) => deleteProduct(e.currentTarget.dataset.productId));
    });

    table.querySelectorAll('.move-product-action-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener('click', (e) => {
            const productId = e.currentTarget.dataset.productId;
            console.log(`Move action for ${productId}`);
            // Logic to open the move product modal/form section
            // This should interact with the "Move Product Location" form in the "Product Tools" section
            const moveProductIdInput = document.getElementById('moveProductId');
            const moveProductFormContent = document.getElementById('moveProductFormContent');
            const batchActionsSection = document.getElementById('batchActions'); // Card containing the move form
            const toggleMoveProductFormCheckbox = document.getElementById('toggleMoveProductFormBtn'); // This is the input type=checkbox

            if (moveProductIdInput && moveProductFormContent && batchActionsSection && toggleMoveProductFormCheckbox) {
                moveProductIdInput.value = productId;
                batchActionsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                toggleMoveProductFormCheckbox.checked = true; // Open the collapse
                setTimeout(() => document.getElementById('newLocation')?.focus(), 150);
            } else {
                uiEnhancementManager.showToast('Move product UI elements not found.', 'error');
                console.error('Move product UI elements missing:', {moveProductIdInput, moveProductFormContent, batchActionsSection, toggleMoveProductFormCheckbox});
            }
        });
    });

    table.querySelectorAll('.product-photo-thumb').forEach(img => {
        const newImg = img.cloneNode(true);
        img.parentNode.replaceChild(newImg, img);
        newImg.addEventListener('click', (e) => {
            const imageUrl = e.currentTarget.dataset.imgUrl;
            if (imageUrl && typeof openImageModal === 'function') {
                openImageModal(imageUrl);
            } else {
                console.warn("No image URL or openImageModal function not available for product photo.");
            }
        });
    });
}

// +++++ END OF NEWLY ADDED/RESTORED FUNCTIONS +++++

