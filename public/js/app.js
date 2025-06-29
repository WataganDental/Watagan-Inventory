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
function switchQuickUpdateTab(tabId) { console.log(`switchQuickUpdateTab called for ${tabId} - STUB`); }
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
  inventoryManager = new InventoryManager(db, storage); // Initialize inventory manager
  const auth = firebase.auth(); // Added Firebase Auth
  const ui = new firebaseui.auth.AuthUI(auth); // FirebaseUI instance
  console.log('Firestore instance created:', !!db);
  console.log('Storage instance created:', !!storage);
  console.log('InventoryManager instance created:', !!inventoryManager);
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

        // Primary attempt to set UI visibility
        // if (authContainer) authContainer.classList.add('hidden'); // Already done above
        // if (appNavbar) appNavbar.classList.remove('hidden'); // Already done above
        // if (appMainContainer) appMainContainer.classList.remove('hidden'); // Already done above
        // if (logoutBtn) logoutBtn.classList.remove('hidden'); // Already done above

        // Asynchronous data loading chain
        inventoryManager.loadInventory().then(loadedInventory => {
          inventory = loadedInventory;
          console.log('Global inventory array updated with', inventory.length, 'items');
          return loadSuppliers(); // Chain supplier loading
        }).then(() => {
          console.log('Suppliers loaded successfully.');
          return loadLocations(); // Chain location loading
        }).then(() => {
          console.log('Locations loaded successfully.');
          const userRoleRef = db.collection('user_roles').doc(user.uid);
          return userRoleRef.get(); // Chain user role fetching
        }).then(docSnapshot => {
          if (docSnapshot.exists) {
            currentUserRole = docSnapshot.data().role;
            console.log('User role loaded:', currentUserRole);
          } else {
            currentUserRole = 'staff'; // Default role
            console.log('No specific role found for user, defaulting to:', currentUserRole);
            // Optionally, create the role document here for new users if it doesn't exist
            // db.collection('user_roles').doc(user.uid).set({ role: 'staff' });
          }
          updateUserInterfaceForRole(currentUserRole);

          // Data loaded, now show the specific view
          const menuInventoryEl = document.getElementById('menuInventory');
          if (menuInventoryEl) {
            showView('inventoryViewContainer', menuInventoryEl.id);
          } else {
            console.warn("Default menu item 'menuInventory' not found after login.");
            // Fallback: Attempt to show dashboard or a generic welcome view if inventory menu is missing
            // For now, just log it. Could also try: showView('dashboardViewContainer', 'menuDashboard');
          }
        }).catch(error => {
          console.error("Error during post-login data loading or UI setup:", error);
          // Display a user-friendly error message in the main application area
          if(appMainContainer) {
            // Ensure appMainContainer is visible to show the error
            appMainContainer.classList.remove('hidden');
            // Clear any potential loading spinners or old content
            appMainContainer.innerHTML = `
              <div class="p-4 text-center">
                <h2 class="text-xl font-semibold text-red-600 dark:text-red-400">Application Error</h2>
                <p class="text-gray-700 dark:text-gray-300 mt-2">Could not load application data: ${error.message}</p>
                <p class="text-gray-500 dark:text-gray-400 mt-1">Please try refreshing the page. If the problem persists, contact support.</p>
              </div>`;
          }
          // Also ensure the auth container is hidden if an error occurs post-login attempt
          if (authContainer) authContainer.classList.add('hidden');
          if (appNavbar) appNavbar.classList.remove('hidden'); // Keep navbar visible for logout option
        });

        // Diagnostic logging after a slightly longer delay
        setTimeout(() => {
          console.log("State of UI after 1.5 seconds (for debugging):");
          debugUIContainers();

          // Check if the main container is still hidden after all primary attempts.
          // This is purely for logging to see if the primary approach failed.
          if (appMainContainer && appMainContainer.classList.contains('hidden')) {
            console.error("CRITICAL DIAGNOSTIC: appMainContainer is still hidden after 1.5s and primary logic. This indicates a persistent issue with initial visibility settings or interference from other scripts/CSS.");
          }
          if (authContainer && !authContainer.classList.contains('hidden')) {
            console.error("CRITICAL DIAGNOSTIC: authContainer is still visible after 1.5s and primary logic. Login screen should be hidden.");
          }
          if (appNavbar && appNavbar.classList.contains('hidden')) {
            console.warn("DIAGNOSTIC: appNavbar is hidden after 1.5s. It should be visible for logged-in users.");
          }

        }, 1500);

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
    // Don't show alert to user, just log the error
    console.warn('Failed to load suppliers, continuing with empty supplier list');
    suppliers = []; // Ensure suppliers array is not undefined
  }
}

function updateSupplierList() {
  const supplierList = document.getElementById('supplierList');
  console.log('Updating supplier list with:', suppliers);
  
  if (!supplierList) {
    console.log('supplierList element not found in DOM - skipping supplier list update');
    return;
  }
  
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
    console.warn('Failed to load locations, continuing with empty location list');
    locations = []; // Ensure locations array is not undefined
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
      inventory = await inventoryManager.loadInventory();
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
      inventory = await inventoryManager.loadInventory();
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
        // Let's refine to: focus quantity, and if it's the last line, add new.
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
    inventory = await inventoryManager.loadInventory();
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
      inventory = await inventoryManager.loadInventory();
      await updateToOrderTable();
      document.getElementById('moveProductId').value = '';
      uiEnhancementManager.showToast(`Product ${product.name} moved to ${newLocation}`, 'success');
    } catch (error) {
      console.error('Error moving product:', error);
      uiEnhancementManager.showToast('Failed to move product: ' + error.message, 'error');
    }
  } else {
    uiEnhancementManager.showToast('Product not found.', 'error');
  }
}

// NEW: Open Move Product Form - missing function that was being called
function openMoveProductForm(productId) {
  console.log(`Opening move product form for product: ${productId}`);
  const product = inventory.find(item => item.id === productId);
  if (!product) {
    return console.error('Product not found:', productId);
  }
  document.getElementById('moveProductId').value = productId;
  document.getElementById('newLocation').value = product.location || '';
  document.getElementById('currentLocationDisplay').textContent = product.location || 'N/A';
  document.getElementById('productNameDisplay').textContent = product.name;
  document.getElementById('productQuantityDisplay').textContent = product.quantity;
  document.getElementById('productMinQuantityDisplay').textContent = product.minQuantity;
  document.getElementById('productReorderQuantityDisplay').textContent = product.reorderQuantity;
  document.getElementById('supplierNameDisplay').textContent = product.supplier || 'Not specified';
  document.getElementById('moveProductForm').classList.remove('hidden');
  document.getElementById('appMainContainer').classList.add('blur');
  document.getElementById('appNavbar').classList.add('blur');
  setTimeout(() => {
    document.getElementById('newLocation').focus();
  }, 300);
}

// Close Move Product Form
function closeMoveProductForm() {
  document.getElementById('moveProductForm').classList.add('hidden');
  document.getElementById('appMainContainer').classList.remove('blur');
  document.getElementById('appNavbar').classList.remove('blur');
  document.getElementById('moveProductId').value = '';
  document.getElementById('newLocation').value = '';
  document.getElementById('currentLocationDisplay').textContent = '';
  document.getElementById('productNameDisplay').textContent = '';
  document.getElementById('productQuantityDisplay').textContent = '';
  document.getElementById('productMinQuantityDisplay').textContent = '';
  document.getElementById('productReorderQuantityDisplay').textContent = '';
  document.getElementById('supplierNameDisplay').textContent = '';
}

// Generate Supplier Order Summaries
async function generateSupplierOrderSummaries() {
  console.log('Generating supplier order summaries...');
  try {
    const db = firebase.firestore();
    const inventorySnapshot = await db.collection('inventory').get();
    const ordersSnapshot = await db.collection('orders').get();

    // Map to store supplier order data
    const supplierOrderData = {};

    // Process inventory data
    inventorySnapshot.docs.forEach(doc => {
      const item = doc.data();
      if (item.supplier) {
        if (!supplierOrderData[item.supplier]) {
          supplierOrderData[item.supplier] = {
            supplier: item.supplier,
            products: [],
            totalQuantity: 0
          };
        }
        supplierOrderData[item.supplier].products.push(item);
        supplierOrderData[item.supplier].totalQuantity += item.quantity;
      }
    });

    // Process orders data to adjust quantities
    ordersSnapshot.docs.forEach(doc => {
      const order = doc.data();
      if (order.productId && order.quantity) {
        const product = inventorySnapshot.docs.find(item => item.id === order.productId);
        if (product && product.data().supplier) {
          const supplierKey = product.data().supplier;
          if (supplierOrderData[supplierKey]) {
            const productInOrder = supplierOrderData[supplierKey].products.find(p => p.id === order.productId);
            if (productInOrder) {
              productInOrder.quantity -= order.quantity;
              supplierOrderData[supplierKey].totalQuantity -= order.quantity;
            }
          }
        }
      }
    });

    // Now generate the report in the desired format
    const reportData = Object.values(supplierOrderData).map(supplierData => {
      return {
        supplier: supplierData.supplier,
        totalQuantity: supplierData.totalQuantity,
        products: supplierData.products.map(product => {
          return {
            id: product.id,
            name: product.name,
            quantity: product.quantity,
            cost: product.cost
          };
        })
      };
    });

    console.log('Supplier order report data:', reportData);

    // Here you would typically create a PDF or other report format
    // For now, let's just log it and show a success message
    uiEnhancementManager.showToast('Supplier order summaries generated successfully!', 'success');
  } catch (error) {
    console.error('Error in generateSupplierOrderSummaries:', error);
  }
}

// Missing updateToOrderTable function
async function updateToOrderTable() {
    console.log('updateToOrderTable called');
    try {
        if (!inventory || inventory.length === 0) {
            console.log('No inventory data available for to-order table');
            return;
        }

        const toOrderTableElement = document.getElementById('toOrderTable'); // Corrected ID
        if (!toOrderTableElement) {
            console.log('toOrderTable element not found'); // Corrected log message
            return;
        }

        // Filter products that need ordering
        const productsToOrder = inventory.filter(item =>
            (item.quantity + (item.quantityOrdered || 0)) <= item.minQuantity && item.minQuantity > 0
        );

        console.log(`Found ${productsToOrder.length} products that need ordering`);

        // Clear existing table
        toOrderTableElement.innerHTML = ''; // Corrected variable name

        if (productsToOrder.length === 0) {
            const row = toOrderTableElement.insertRow(); // Corrected variable name
            row.innerHTML = `
                <td colspan="6" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div class="flex flex-col items-center">
                        <svg class="w-12 h-12 mb-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <h3 class="text-lg font-semibold mb-2">All products are well stocked!</h3>
                        <p class="text-sm">No items currently need reordering</p>
                    </div>
                </td>
            `;
        } else {
            productsToOrder.forEach(item => {
                const row = toOrderTableElement.insertRow(); // Corrected variable name
                const quantityNeeded = Math.max(0, item.minQuantity - item.quantity - (item.quantityOrdered || 0));
                const recommendedOrder = item.reorderQuantity || quantityNeeded;
                
                row.className = 'border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-750';
                row.innerHTML = `
                    <td class="px-4 py-2 font-medium">${item.name}</td>
                    <td class="px-4 py-2 text-center">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            ${item.quantity}
                        </span>
                    </td>
                    <td class="px-4 py-2 text-center">${item.minQuantity || 0}</td>
                    <td class="px-4 py-2 text-center">${item.quantityOrdered || 0}</td>
                    <td class="px-4 py-2">${item.supplier || 'Not specified'}</td>
                    <td class="px-4 py-2">
                        <div class="flex items-center gap-2">
                            <button onclick="createOrder('${item.id}', ${recommendedOrder})" class="btn btn-primary btn-xs">
                                Order ${recommendedOrder}
                            </button>
                            <button onclick="viewQRCode('${item.id}')" class="btn btn-secondary btn-xs">
                                QR Code
                            </button>
                        </div>
                    </td>
                `;
            });
        }

        // Update reorder notification
        const reorderNotificationBar = document.getElementById('reorderNotificationBar');
        if (reorderNotificationBar) {
            if (productsToOrder.length > 0) {
                reorderNotificationBar.textContent = `Products to reorder: ${productsToOrder.length}`;
                reorderNotificationBar.classList.remove('hidden');
            } else {
                reorderNotificationBar.classList.add('hidden');
            }
        }

        console.log('To-order table updated successfully');
    } catch (error) {
        console.error('Error in updateToOrderTable:', error);
    }
}

// Missing viewQRCode function
async function viewQRCode(productId) {
    console.log('viewQRCode called for product:', productId);
    try {
        // Find the product
        const product = inventory.find(item => item.id === productId);
        if (!product) {
            uiEnhancementManager.showToast('Product not found', 'error');
            return;
        }

        // Ensure QR code library is available
        await ensureQRCodeIsAvailable();

        // Create or get QR code modal
        let qrModal = document.getElementById('qrCodeModal');
        if (!qrModal) {
            // Create QR modal if it doesn't exist
            qrModal = document.createElement('div');
            qrModal.id = 'qrCodeModal';
            qrModal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            qrModal.innerHTML = `
                <div class="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold dark:text-white">Product QR Code</h3>
                        <button id="closeQRModal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="text-center">
                        <div id="qrCodeContainer" class="mb-4"></div>
                        <p id="qrProductName" class="font-medium dark:text-white mb-2"></p>
                        <p id="qrProductId" class="text-sm text-gray-600 dark:text-gray-400 mb-4"></p>
                        <button id="downloadQRBtn" class="btn btn-primary btn-sm">Download QR Code</button>
                    </div>
                </div>
            `;
            document.body.appendChild(qrModal);

            // Add event listeners
            document.getElementById('closeQRModal').addEventListener('click', () => {
                qrModal.classList.add('hidden');
                qrModal.classList.remove('flex');
            });

            qrModal.addEventListener('click', (e) => {
                if (e.target === qrModal) {
                    qrModal.classList.add('hidden');
                    qrModal.classList.remove('flex');
                }
            });
        }

        // Generate QR code
        const qrContainer = document.getElementById('qrCodeContainer');
        qrContainer.innerHTML = ''; // Clear previous QR code

        const qr = new QRCode(qrContainer, {
            text: productId,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });

        // Update modal content
        document.getElementById('qrProductName').textContent = product.name;
        document.getElementById('qrProductId').textContent = `ID: ${productId}`;

        // Download functionality
        document.getElementById('downloadQRBtn').onclick = () => {
            const canvas = qrContainer.querySelector('canvas');
            if (canvas) {
                const link = document.createElement('a');
                link.download = `${product.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qr.png`;
                link.href = canvas.toDataURL();
                link.click();
                uiEnhancementManager.showToast('QR code downloaded', 'success');
            }
        };

        // Show modal
        qrModal.classList.remove('hidden');
        qrModal.classList.add('flex');

        uiEnhancementManager.showToast(`QR code displayed for ${product.name}`, 'success');
    } catch (error) {
        console.error('Error in viewQRCode:', error);
        uiEnhancementManager.showToast('Failed to generate QR code: ' + error.message, 'error');
    }
}

// Strengthened updateInventoryDashboard function
function updateInventoryDashboard() {
    console.log('[updateInventoryDashboard] Called.'); // Log entry
    try {
        const totalProductsCountEl = document.getElementById('totalProductsCount');
        const lowStockCountEl = document.getElementById('lowStockCount');
        const outOfStockCountEl = document.getElementById('outOfStockCount');

        if (!totalProductsCountEl || !lowStockCountEl || !outOfStockCountEl) {
            console.error('[updateInventoryDashboard] One or more dashboard stat elements not found in the DOM.');
            // Attempt to set to 0 anyway if some exist, or just return.
            if (totalProductsCountEl) totalProductsCountEl.textContent = '0';
            if (lowStockCountEl) lowStockCountEl.textContent = '0';
            if (outOfStockCountEl) outOfStockCountEl.textContent = '0';
            return; // Exit if essential elements are missing
        }

        if (!inventory || inventory.length === 0) {
            console.log('[updateInventoryDashboard] No inventory data available or inventory is empty.');
            totalProductsCountEl.textContent = '0';
            lowStockCountEl.textContent = '0';
            outOfStockCountEl.textContent = '0';
            // updateLowStockAlerts(); // Call this to clear or show "no alerts" message
            // Ensure updateLowStockAlerts is defined and handles this case or check its existence before calling
            if (typeof updateLowStockAlerts === 'function') {
                 updateLowStockAlerts();
            } else {
                console.warn('[updateInventoryDashboard] updateLowStockAlerts function not found, cannot update alerts for empty inventory.');
            }
            return;
        }

        const totalProducts = inventory.length;
        const lowStockItems = inventory.filter(item => item.quantity <= item.minQuantity && item.minQuantity > 0);
        const outOfStockItems = inventory.filter(item => item.quantity === 0);
        // const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.cost || 0), 0); // This was for the enhanced dashboard

        console.log(`[updateInventoryDashboard] Calculated stats: Total=${totalProducts}, Low=${lowStockItems.length}, Out=${outOfStockItems.length}`);

        totalProductsCountEl.textContent = totalProducts;
        lowStockCountEl.textContent = lowStockItems.length;
        outOfStockCountEl.textContent = outOfStockItems.length;

        if (typeof updateLowStockAlerts === 'function') {
            updateLowStockAlerts(); // This updates another part of the UI
        } else {
            console.warn('[updateInventoryDashboard] updateLowStockAlerts function not found.');
        }

        console.log(`[updateInventoryDashboard] Successfully updated inventory stats in UI.`); // Final success log
    } catch (error) {
        console.error('[updateInventoryDashboard] Error caught:', error);
        // Fallback: try to set stats to 0 or placeholder if an error occurs
        try {
            const tpc = document.getElementById('totalProductsCount');
            if (tpc) tpc.textContent = '0 (err)';
            const lsc = document.getElementById('lowStockCount');
            if (lsc) lsc.textContent = '0 (err)';
            const oosc = document.getElementById('outOfStockCount');
            if (oosc) oosc.textContent = '0 (err)';
        } catch (e) {
            console.error('[updateInventoryDashboard] Error during fallback UI update:', e);
        }
    }
}

// Missing updateLowStockAlerts function (ensure it's defined elsewhere or handle its absence)
// Assuming updateLowStockAlerts is defined as it was in previous steps.
function updateLowStockAlerts() {
    console.log('updateLowStockAlerts called');
    try {
        if (!inventory || inventory.length === 0) {
            console.log('No inventory data available for low stock alerts');
            return;
        }

        const lowStockItems = inventory.filter(item => item.quantity <= item.minQuantity && item.minQuantity > 0);
        const lowStockTableBody = document.getElementById('lowStockTableBody');
        const lowStockAlert = document.getElementById('lowStockAlert');

        if (!lowStockTableBody) {
            console.log('lowStockTableBody element not found');
            return;
        }

        // Update alert badge
        if (lowStockAlert) {
            if (lowStockItems.length > 0) {
                lowStockAlert.textContent = `${lowStockItems.length} items need attention`;
                lowStockAlert.classList.remove('hidden');
            } else {
                lowStockAlert.classList.add('hidden');
            }
        }

        // Clear existing table
        lowStockTableBody.innerHTML = '';

        if (lowStockItems.length === 0) {
            const row = lowStockTableBody.insertRow();
            row.innerHTML = `
                <td colspan="6" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div class="flex flex-col items-center">
                        <svg class="w-12 h-12 mb-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <h3 class="text-lg font-semibold mb-2">All products are well stocked!</h3>
                        <p class="text-sm">No low stock alerts at this time</p>
                    </div>
                </td>
            `;
        } else {
            lowStockItems.forEach(item => {
                const row = lowStockTableBody.insertRow();
                row.className = 'border-b dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900';
                row.innerHTML = `
                    <td class="px-4 py-2 font-medium text-amber-800 dark:text-amber-200">${item.name}</td>
                    <td class="px-4 py-2 text-center">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            ${item.quantity}
                        </span>
                    </td>
                    <td class="px-4 py-2 text-center text-amber-700 dark:text-amber-300">${item.minQuantity || 0}</td>
                    <td class="px-4 py-2 text-amber-700 dark:text-amber-300">${item.location || 'Not specified'}</td>
                    <td class="px-4 py-2 text-amber-700 dark:text-amber-300">${item.supplier || 'Not specified'}</td>
                    <td class="px-4 py-2">
                        <div class="flex items-center gap-2">
                            <button onclick="createOrder('${item.id}', ${item.reorderQuantity || item.minQuantity})" class="btn btn-warning btn-xs">
                                Order Now
                            </button>
                            <button onclick="editProduct('${item.id}')" class="btn btn-secondary btn-xs">
                                Edit
                            </button>
                        </div>
                    </td>
                `;
            });
        }

        console.log(`Low stock alerts updated: ${lowStockItems.length} items`);
    } catch (error) {
        console.error('Error in updateLowStockAlerts:', error);
    }
}

// Missing createOrder function
async function createOrder(productId, quantity) {
    console.log('createOrder called for product:', productId, 'quantity:', quantity);
    try {
        const product = inventory.find(item => item.id === productId);
        if (!product) {
            uiEnhancementManager.showToast('Product not found', 'error');
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            uiEnhancementManager.showToast('User not authenticated', 'error');
            return;
        }

        // Create order document
        const orderData = {
            productId: productId,
            productName: product.name,
            quantity: quantity,
            status: 'pending',
            orderDate: firebase.firestore.Timestamp.now(),
            userId: user.uid
        };

        await db.collection('orders').add(orderData);

        // Update product quantityOrdered
        const productDoc = await db.collection('inventory').doc(productId).get();
        if (productDoc.exists) {
            const currentOrdered = productDoc.data().quantityOrdered || 0;
            await db.collection('inventory').doc(productId).update({
                quantityOrdered: currentOrdered + quantity
            });
        }

        // Refresh data
        inventory = await inventoryManager.loadInventory();
        await updateToOrderTable();

        uiEnhancementManager.showToast(`Order created for ${quantity} units of ${product.name}`, 'success');
    } catch (error) {
        console.error('Error creating order:', error);
        uiEnhancementManager.showToast('Failed to create order: ' + error.message, 'error');
    }
}

// ENHANCED REAL-TIME FUNCTIONALITY AND UI FIXES

// Ensure real-time order filters work
function setupRealTimeOrderFilters() {
    console.log('Setting up real-time order filters');
    
    // Order status filter
    const orderStatusFilter = document.getElementById('filterOrderStatus');
    if (orderStatusFilter) {
        orderStatusFilter.addEventListener('change', () => {
            console.log('Order status filter changed to:', orderStatusFilter.value);
            loadAndDisplayOrders();
            if (typeof uiEnhancementManager !== 'undefined') {
                uiEnhancementManager.showToast(`Filtering orders by: ${orderStatusFilter.value || 'all'}`, 'info');
            }
        });
        console.log('Order status filter event listener added');
    }

    // Order supplier filter
    const orderSupplierFilter = document.getElementById('filterOrderSupplierDropdown');
    if (orderSupplierFilter) {
        orderSupplierFilter.addEventListener('change', () => {
            console.log('Order supplier filter changed to:', orderSupplierFilter.value);
            loadAndDisplayOrders();
            if (typeof uiEnhancementManager !== 'undefined') {
                uiEnhancementManager.showToast(`Filtering by supplier: ${orderSupplierFilter.value || 'all'}`, 'info');
            }
        });
        console.log('Order supplier filter event listener added');
    }
}

// Enhanced dark mode functionality
function setupEnhancedDarkMode() {
    console.log('Setting up enhanced dark mode toggle');
    
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        // Update button text based on current mode
        function updateDarkModeButton() {
            const isDark = document.documentElement.classList.contains('dark');
            darkModeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
            darkModeToggle.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        }
        
        // Initial button update
        updateDarkModeButton();
        
        darkModeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isDark = document.documentElement.classList.contains('dark');
            
            if (isDark) {
                removeDarkMode();
                updateDarkModeButton();
                if (typeof uiEnhancementManager !== 'undefined') {
                    uiEnhancementManager.showToast('Light mode enabled', 'info');
                }
                console.log('Switched to light mode');
            } else {
                applyDarkMode();
                updateDarkModeButton();
                if (typeof uiEnhancementManager !== 'undefined') {
                    uiEnhancementManager.showToast('Dark mode enabled', 'info');
                }
                console.log('Switched to dark mode');
            }
        });
        console.log('Enhanced dark mode toggle setup complete');
    } else {
        console.error('darkModeToggle element not found');
    }
}

// Enhanced inventory update with automatic low stock alerts
function updateInventoryWithAlerts() {
    console.log('Updating inventory with automatic alerts');
    
    if (!inventory || inventory.length === 0) {
        console.log('No inventory data available');
        return;
    }
    
    // Update all related components
    updateInventoryDashboard();
    updateLowStockAlerts();
    updateToOrderTable();
    
    // Update enhanced dashboard if on that view
    const dashboardView = document.getElementById('dashboardViewContainer');
    if (dashboardView && !dashboardView.classList.contains('hidden')) {
        updateEnhancedDashboard();
    }
    
    console.log('Inventory update with alerts complete');
}

// Quick QR code features enhancement
function enhanceQuickQRFeatures() {
    console.log('Enhancing quick QR features');
    
    // Add QR code buttons to inventory table if not already present
    const inventoryTable = document.getElementById('inventoryTable');
    if (inventoryTable) {
        // QR features are already integrated in displayInventory function
        console.log('QR code features are integrated in inventory table');
    }
    
    // Add global QR code generation button
    const qrCodeSection = document.getElementById('qrCodeReportContainer');
    if (qrCodeSection) {
        const quickQRBtn = document.createElement('button');
        quickQRBtn.className = 'btn btn-primary btn-sm mt-2';
        quickQRBtn.innerHTML = `
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
        `;
        quickQRBtn.onclick = () => {
            if (inventory && inventory.length > 0) {
                const firstProduct = inventory[0];
                viewQRCode(firstProduct.id);
            } else {
                if (typeof uiEnhancementManager !== 'undefined') {
                    uiEnhancementManager.showToast('No products available for QR code generation', 'warning');
                }
            }
        };
        
        if (!qrCodeSection.querySelector('.btn-primary')) {
            qrCodeSection.appendChild(quickQRBtn);
        }
    }
    
    console.log('Quick QR features enhancement complete');
}

// Initialize all enhancements
function initializeAllEnhancements() {
    console.log('Initializing all enhancements');
    
    // Set up real-time filters
    setupRealTimeOrderFilters();
    
    // Set up enhanced dark mode
    setupEnhancedDarkMode();
    
    // Enhance QR features
    enhanceQuickQRFeatures();
    
    // Initialize inventory alerts if data is available
    if (inventory && inventory.length > 0) {
        updateInventoryWithAlerts();
    }
    
    console.log('All enhancements initialized');
}

// Call initialization on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('[DOMContentLoaded] Starting setup...');
    try {
        // Block 1: Navigation, Core UI, and Firebase Auth Listeners
        try {
            const logoutBtn = document.getElementById('logoutButton');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    firebase.auth().signOut().then(() => {
                        console.log('User signed out successfully.');
                    }).catch(error => {
                        console.error('Sign out error:', error);
                        alert('Error signing out: ' + error.message);
                    });
                });
            } else { console.warn('[DOMContentLoaded] logoutButton not found'); }

            const darkModeToggle = document.getElementById('darkModeToggle');
            if (darkModeToggle) {
                // Logic from setupEnhancedDarkMode integrated here or ensure setupEnhancedDarkMode is called
                function updateDarkModeButtonText() {
                    const isDark = document.documentElement.classList.contains('dark');
                    darkModeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
                    darkModeToggle.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
                }
                updateDarkModeButtonText(); // Initial text
                darkModeToggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    const isDark = document.documentElement.classList.contains('dark');
                    if (isDark) removeDarkMode(); else applyDarkMode();
                    updateDarkModeButtonText(); // Update text after change
                });
            } else { console.warn('[DOMContentLoaded] darkModeToggle not found'); }

            const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
            if (sidebarToggleBtn) {
                sidebarToggleBtn.addEventListener('click', toggleSidebar);
            } else { console.warn('[DOMContentLoaded] sidebarToggleBtn not found'); }

            // Navigation Menu Items
            const menuItemsToSetup = [
                'menuDashboard', 'menuInventory', 'menuSuppliers', 'menuOrders',
                'menuReports', 'menuQuickStockUpdate', 'menuUserManagement'
            ];
            const viewMappings = {
                'menuDashboard': 'dashboardViewContainer',
                'menuInventory': 'inventoryViewContainer',
                'menuSuppliers': 'suppliersAndLocationsContainer', // Corrected view ID
                'menuOrders': 'ordersSectionContainer',
                'menuReports': 'reportsSectionContainer',
                'menuQuickStockUpdate': 'quickStockUpdateContainer',
                'menuUserManagement': 'userManagementSectionContainer'
            };

            menuItemsToSetup.forEach(menuId => {
                const menuItemEl = document.getElementById(menuId);
                if (menuItemEl) {
                    menuItemEl.addEventListener('click', (e) => {
                        e.preventDefault();
                        const viewId = viewMappings[menuId];
                        if (viewId) {
                            showView(viewId, menuId);
                        } else {
                            console.warn(`[DOMContentLoaded] No view mapping for menu ID: ${menuId}`);
                        }
                    });
                } else {
                    console.warn(`[DOMContentLoaded] Menu item element not found: ${menuId}`);
                }
            });
            console.log('[DOMContentLoaded] Core UI, Auth, and Navigation listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching core UI/Auth/Nav listeners:', e);
        }

        // Block 2: Product Form & Management Listeners
        try {
            const productSubmitBtn = document.getElementById('productSubmitBtn');
            if (productSubmitBtn) productSubmitBtn.addEventListener('click', submitProduct);
            else console.warn("[DOMContentLoaded] productSubmitBtn not found");

            const cancelEditBtn = document.getElementById('cancelEditBtn');
            if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetProductForm);
            else console.warn("[DOMContentLoaded] cancelEditBtn not found");

            // Photo related buttons
            const capturePhotoBtn = document.getElementById('capturePhotoBtn');
            if (capturePhotoBtn) capturePhotoBtn.addEventListener('click', startPhotoCapture);
            else console.warn("[DOMContentLoaded] capturePhotoBtn not found");

            const takePhotoBtn = document.getElementById('takePhotoBtn');
            if (takePhotoBtn) takePhotoBtn.addEventListener('click', takePhoto);
            else console.warn("[DOMContentLoaded] takePhotoBtn not found");

            const cancelPhotoBtn = document.getElementById('cancelPhotoBtn');
            if (cancelPhotoBtn) cancelPhotoBtn.addEventListener('click', cancelPhoto);
            else console.warn("[DOMContentLoaded] cancelPhotoBtn not found");

            // QR Scan to Edit
            const scanToEditBtn = document.getElementById('scanToEditBtn');
            if (scanToEditBtn) scanToEditBtn.addEventListener('click', startEditScanner);
            else console.warn("[DOMContentLoaded] scanToEditBtn not found");

            const stopEditScannerBtn = document.getElementById('stopEditScannerBtn');
            if (stopEditScannerBtn) stopEditScannerBtn.addEventListener('click', stopEditScanner);
            else console.warn("[DOMContentLoaded] stopEditScannerBtn not found");

            console.log('[DOMContentLoaded] Product form listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching product form listeners:', e);
        }

        // Block 3: Supplier & Location Management
        try {
            const addSupplierBtn = document.getElementById('addSupplierBtn');
            if (addSupplierBtn) addSupplierBtn.addEventListener('click', addSupplier);
            else console.warn("[DOMContentLoaded] addSupplierBtn not found");

            const addLocationBtn = document.getElementById('addLocationBtn');
            if (addLocationBtn) addLocationBtn.addEventListener('click', addLocation);
            else console.warn("[DOMContentLoaded] addLocationBtn not found");
            console.log('[DOMContentLoaded] Supplier/Location listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching supplier/location listeners:', e);
        }

        // Block 4: Inventory Table Filters & Actions
        try {
            const filterSupplier = document.getElementById('filterSupplier');
            if (filterSupplier) filterSupplier.addEventListener('change', () => displayInventory());
            else console.warn("[DOMContentLoaded] filterSupplier dropdown not found");

            const filterLocation = document.getElementById('filterLocation');
            if (filterLocation) filterLocation.addEventListener('change', () => displayInventory());
            else console.warn("[DOMContentLoaded] filterLocation dropdown not found");

            const clearInventoryFiltersBtn = document.getElementById('clearInventoryFiltersBtn');
            if (clearInventoryFiltersBtn) {
                clearInventoryFiltersBtn.addEventListener('click', () => {
                    if(document.getElementById('filterSupplier')) document.getElementById('filterSupplier').value = '';
                    if(document.getElementById('filterLocation')) document.getElementById('filterLocation').value = '';
                    if(document.getElementById('inventorySearchInput')) document.getElementById('inventorySearchInput').value = '';
                    currentPage = 1; // Reset to first page
                    displayInventory();
                });
            } else { console.warn("[DOMContentLoaded] clearInventoryFiltersBtn not found"); }

            // Search input for inventory
            const inventorySearchInput = document.getElementById('inventorySearchInput');
            if (inventorySearchInput) {
                inventorySearchInput.addEventListener('input', debounce(() => {
                    currentPage = 1; // Reset to first page on new search
                    displayInventory(inventorySearchInput.value, document.getElementById('filterSupplier').value, document.getElementById('filterLocation').value);
                }, 300));
            } else { console.warn("[DOMContentLoaded] inventorySearchInput not found"); }

            // Pagination controls
            const prevPageBtn = document.getElementById('prevPageBtn');
            if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; displayInventory(); } });
            else console.warn("[DOMContentLoaded] prevPageBtn not found");

            const nextPageBtn = document.getElementById('nextPageBtn');
            if (nextPageBtn) nextPageBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(totalFilteredItems / ITEMS_PER_PAGE);
                if (currentPage < totalPages) { currentPage++; displayInventory(); }
            });
            else console.warn("[DOMContentLoaded] nextPageBtn not found");

            console.log('[DOMContentLoaded] Inventory filter/search/pagination listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching inventory filter/search/pagination listeners:', e);
        }

        // Block 5: Batch Actions & Move Product
        try {
            // Batch Updates
            const addBatchEntryBtn = document.getElementById('addBatchEntryBtn');
            if (addBatchEntryBtn) addBatchEntryBtn.addEventListener('click', addBatchEntry);
            else console.warn("[DOMContentLoaded] addBatchEntryBtn not found");

            const startUpdateScannerBtn = document.getElementById('startUpdateScannerBtn');
            if (startUpdateScannerBtn) startUpdateScannerBtn.addEventListener('click', startUpdateScanner);
            else console.warn("[DOMContentLoaded] startUpdateScannerBtn not found");

            const stopUpdateScannerBtn = document.getElementById('stopUpdateScannerBtn');
            if (stopUpdateScannerBtn) stopUpdateScannerBtn.addEventListener('click', stopUpdateScanner);
            else console.warn("[DOMContentLoaded] stopUpdateScannerBtn not found");

            const submitBatchUpdatesBtn = document.getElementById('submitBatchUpdatesBtn');
            if (submitBatchUpdatesBtn) submitBatchUpdatesBtn.addEventListener('click', submitBatchUpdates);
            else console.warn("[DOMContentLoaded] submitBatchUpdatesBtn not found");

            // Move Product
            const toggleMoveProductFormBtn = document.getElementById('toggleMoveProductFormBtn'); // This might be an old ID or part of a different structure
            if (toggleMoveProductFormBtn) { /* attach listener */ }


            const startMoveScannerBtn = document.getElementById('startMoveScannerBtn');
            if (startMoveScannerBtn) startMoveScannerBtn.addEventListener('click', startMoveScanner);
            else console.warn("[DOMContentLoaded] startMoveScannerBtn not found");

            const stopMoveScannerBtn = document.getElementById('stopMoveScannerBtn');
            if (stopMoveScannerBtn) stopMoveScannerBtn.addEventListener('click', stopMoveScanner);
            else console.warn("[DOMContentLoaded] stopMoveScannerBtn not found");

            const moveProductBtn = document.getElementById('moveProductBtn');
            if (moveProductBtn) moveProductBtn.addEventListener('click', moveProduct);
            else console.warn("[DOMContentLoaded] moveProductBtn not found");

            console.log('[DOMContentLoaded] Batch/Move listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching batch/move listeners:', e);
        }

        // Block 6: Reports
        try {
            const generateOrderReportBtn = document.getElementById('generateOrderReportBtn');
            if (generateOrderReportBtn) generateOrderReportBtn.addEventListener('click', () => generateFastOrderReportPDF('jspdf')); // Assuming new combined function
            else console.warn("[DOMContentLoaded] generateOrderReportBtn not found");

            // The HTML has "generateDetailedOrderReportBtn" for the slow QR version
             const generateDetailedOrderReportBtn = document.getElementById('generateDetailedOrderReportBtn');
             if (generateDetailedOrderReportBtn) generateDetailedOrderReportBtn.addEventListener('click', () => generateOrderReportPDFWithQRCodes('jspdf'));
             else console.warn("[DOMContentLoaded] generateDetailedOrderReportBtn (for QR) not found");


            const emailOrderReportBtn = document.getElementById('emailOrderReportBtn');
            if (emailOrderReportBtn) emailOrderReportBtn.addEventListener('click', emailReport);
            else console.warn("[DOMContentLoaded] emailOrderReportBtn not found");

            const generateQRCodePDFBtn = document.getElementById('generateQRCodePDFBtn'); // For all locations
            if (generateQRCodePDFBtn) generateQRCodePDFBtn.addEventListener('click', () => generateAllQRCodesPDF('jspdf'));
            else console.warn("[DOMContentLoaded] generateQRCodePDFBtn not found");

            // Trend chart related (if any buttons)
            const trendProductSelect = document.getElementById('trendProductSelect');
            if(trendProductSelect) trendProductSelect.addEventListener('change', (event) => generateProductUsageChart(event.target.value));
            else console.warn("[DOMContentLoaded] trendProductSelect not found");

            console.log('[DOMContentLoaded] Report listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching report listeners:', e);
        }

        // Block 7: Modals
        try {
            const closeImageModalBtn = document.getElementById('closeImageModalBtn');
            if (closeImageModalBtn) closeImageModalBtn.addEventListener('click', closeImageModal);
            else console.warn("[DOMContentLoaded] closeImageModalBtn not found");

            const imageModalElement = document.getElementById('imageModal');
            if(imageModalElement) imageModalElement.addEventListener('click', (e) => { if (e.target === imageModalElement) closeImageModal(); });
            else console.warn("[DOMContentLoaded] imageModal element not found");


            console.log('[DOMContentLoaded] Modal listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching modal listeners:', e);
        }

        // Block 8: Quick Stock Update (QSU) View
        try {
            const qsuTabs = ['manualBatchModeTab', 'barcodeScannerModeTab', 'fileUploadModeTab'];
            qsuTabs.forEach(tabId => {
                const tabEl = document.getElementById(tabId);
                if (tabEl) tabEl.addEventListener('click', () => switchQuickUpdateTab(tabId));
                else console.warn(`[DOMContentLoaded] QSU Tab not found: ${tabId}`);
            });

            const qsuScanProductBtn = document.getElementById('qsuScanProductBtn');
            if (qsuScanProductBtn) qsuScanProductBtn.addEventListener('click', startQuickStockBarcodeScanner);
            else console.warn("[DOMContentLoaded] qsuScanProductBtn not found");

            const qsuStopScanBtn = document.getElementById('qsuStopScanBtn');
            if (qsuStopScanBtn) qsuStopScanBtn.addEventListener('click', stopQuickStockBarcodeScanner);
            else console.warn("[DOMContentLoaded] qsuStopScanBtn not found");

            const qsuAddManualEntryBtn = document.getElementById('qsuAddManualEntryBtn');
            if (qsuAddManualEntryBtn) qsuAddManualEntryBtn.addEventListener('click', addQuickStockManualEntry);
            else console.warn("[DOMContentLoaded] qsuAddManualEntryBtn not found");

            const qsuSubmitBatchBtn = document.getElementById('qsuSubmitBatchBtn');
            if (qsuSubmitBatchBtn) qsuSubmitBatchBtn.addEventListener('click', submitQuickStockBatch);
            else console.warn("[DOMContentLoaded] qsuSubmitBatchBtn not found");

            const qsuProductSearch = document.getElementById('qsuProductSearch');
            if (qsuProductSearch) qsuProductSearch.addEventListener('input', debounce(handleQuickStockProductSearch, 300));
            else console.warn("[DOMContentLoaded] qsuProductSearch not found");

            const qsuFileUpload = document.getElementById('qsuFileUpload');
            if (qsuFileUpload) qsuFileUpload.addEventListener('change', handleQuickStockFileUpload);
            else console.warn("[DOMContentLoaded] qsuFileUpload not found");

            const qsuProcessFileBtn = document.getElementById('qsuProcessFileBtn');
            if (qsuProcessFileBtn) qsuProcessFileBtn.addEventListener('click', processQuickStockUploadedFile);
            else console.warn("[DOMContentLoaded] qsuProcessFileBtn not found");

            // Listeners for QSU quantity adjustment buttons
            const qsuAdjustIncrementBtn = document.getElementById('qsuAdjustIncrementBtn');
            if (qsuAdjustIncrementBtn) {
                qsuAdjustIncrementBtn.addEventListener('click', () => {
                    const quantityToAdjust = document.getElementById('qsuAdjustQuantity').value;
                    adjustScannedProductQuantity('increment', quantityToAdjust);
                });
            } else { console.warn("[DOMContentLoaded] qsuAdjustIncrementBtn not found"); }

            const qsuAdjustDecrementBtn = document.getElementById('qsuAdjustDecrementBtn');
            if (qsuAdjustDecrementBtn) {
                qsuAdjustDecrementBtn.addEventListener('click', () => {
                    const quantityToAdjust = document.getElementById('qsuAdjustQuantity').value;
                    adjustScannedProductQuantity('decrement', quantityToAdjust);
                });
            } else { console.warn("[DOMContentLoaded] qsuAdjustDecrementBtn not found"); }

            console.log('[DOMContentLoaded] Quick Stock Update listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching Quick Stock Update listeners:', e);
        }

        // Block 9: Dashboard View specific buttons
        try {
            const refreshDashboardBtn = document.getElementById('refreshDashboardBtn');
            if(refreshDashboardBtn) refreshDashboardBtn.addEventListener('click', updateEnhancedDashboard);
            else console.warn("[DOMContentLoaded] refreshDashboardBtn not found");

            const quickAddProductBtn = document.getElementById('quickAddProductBtn');
            if(quickAddProductBtn) quickAddProductBtn.addEventListener('click', () => {
                showView('inventoryViewContainer', 'menuInventory'); // Switch to inventory view
                setTimeout(() => { // Ensure form is visible
                    document.getElementById('productName').focus(); // Focus on product name
                    resetProductForm(); // Clear form for new product
                }, 100); // Small delay to ensure view switch
            });
            else console.warn("[DOMContentLoaded] quickAddProductBtn not found");

            const quickStockUpdateBtn = document.getElementById('quickStockUpdateBtn');
            if(quickStockUpdateBtn) quickStockUpdateBtn.addEventListener('click', () => showView('quickStockUpdateContainer', 'menuQuickStockUpdate'));
            else console.warn("[DOMContentLoaded] quickStockUpdateBtn not found");

            const quickViewReportsBtn = document.getElementById('quickViewReportsBtn');
            if(quickViewReportsBtn) quickViewReportsBtn.addEventListener('click', () => showView('reportsSectionContainer', 'menuReports'));
            else console.warn("[DOMContentLoaded] quickViewReportsBtn not found");

            console.log('[DOMContentLoaded] Dashboard view listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching Dashboard view listeners:', e);
        }

        // Block 10: Orders View specific buttons
        try {
            const addOrderBtn = document.getElementById('addOrderBtn');
            if (addOrderBtn) addOrderBtn.addEventListener('click', handleAddOrder);
            else console.warn("[DOMContentLoaded] addOrderBtn not found");

            const filterOrderStatus = document.getElementById('filterOrderStatus');
            if (filterOrderStatus) filterOrderStatus.addEventListener('change', loadAndDisplayOrders);
            else console.warn("[DOMContentLoaded] filterOrderStatus dropdown not found");

            const filterOrderSupplierDropdown = document.getElementById('filterOrderSupplierDropdown');
            if (filterOrderSupplierDropdown) filterOrderSupplierDropdown.addEventListener('change', loadAndDisplayOrders);
            else console.warn("[DOMContentLoaded] filterOrderSupplierDropdown for orders not found");

            console.log('[DOMContentLoaded] Orders view listeners attached.');
        } catch (e) {
            console.error('[DOMContentLoaded] Error attaching Orders view listeners:', e);
        }

        // Initialize other things that don't involve listeners but need DOM ready
        try {
            loadSuppliers().then(loadLocations); // Load initial supplier/location data for dropdowns
            initiateImageModalVars(); // Initialize modal vars
            // Initial UI setup based on sidebar state preference
            const sidebarMinimized = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
            if (sidebarMinimized) {
                minimizeSidebar();
            } else {
                maximizeSidebar();
            }
        } catch(e) {
            console.error('[DOMContentLoaded] Error during miscellaneous initializations:', e);
        }


        // Delayed initialization of "enhancements" - this might be redundant if specific setups are done above
        setTimeout(() => {
            console.log('[DOMContentLoaded] Initializing enhancements (after 500ms delay)...');
            if (typeof initializeAllEnhancements === 'function') { // This function calls updateInventoryWithAlerts etc.
                initializeAllEnhancements();
            } else {
                console.error('[DOMContentLoaded] initializeAllEnhancements function not found for delayed init.');
            }
        }, 500); // This delay might still cause issues if inventory isn't loaded for initializeAllEnhancements

    } catch (error) {
        console.error('[DOMContentLoaded] A major error occurred during initial setup:', error);
    }
    console.log('[DOMContentLoaded] Setup finished.'); // Final confirmation
});