const SIDEBAR_STATE_KEY = 'sidebarMinimized';

// Global variables for edit scan mode
let isEditScanModeActive = false;
let editScanInputBuffer = "";

let stream = null;
let photoStream = null;
let inventory = [];
let suppliers = [];
let locations = []; // Added for location management
let batchUpdates = [];
let db; // Declare db globally
let storage; // Declare storage globally
let originalPhotoUrlForEdit = ''; // Stores the original photo URL when editing a product

// Global variables for Quick Stock Update
let currentScannedProductId = null;
let quickScanState = 'IDLE'; // States: IDLE, WAITING_FOR_PRODUCT, WAITING_FOR_ACTION
let quickStockUpdateStream = null;
let quickStockUpdateCanvas = null; // For jsQR
let quickStockUpdateAnimationFrameId = null;
let quickStockBarcodeBuffer = "";
let isQuickStockBarcodeActive = false;

// START OF FUNCTIONS TO ADD

async function displayActionQRCodes() {
  const container = document.getElementById('actionQRCodesContainer');
  if (!container) {
    console.error('Action QR Codes container not found.');
    return;
  }
  container.innerHTML = ''; // Clear previous QRs

  const actions = [
    // Additions
    { label: '+1 Unit', data: 'ACTION_ADD_1', type: 'add' },
    { label: '-1 Unit', data: 'ACTION_SUB_1', type: 'subtract' },
    { label: '+2 Units', data: 'ACTION_ADD_2', type: 'add' },
    { label: '-2 Units', data: 'ACTION_SUB_2', type: 'subtract' },
    { label: '+3 Units', data: 'ACTION_ADD_3', type: 'add' },
    { label: '-3 Units', data: 'ACTION_SUB_3', type: 'subtract' },
    { label: '+4 Units', data: 'ACTION_ADD_4', type: 'add' },
    { label: '-4 Units', data: 'ACTION_SUB_4', type: 'subtract' },
    { label: '+5 Units', data: 'ACTION_ADD_5', type: 'add' },
    { label: '-5 Units', data: 'ACTION_SUB_5', type: 'subtract' },
    { label: '+10 Units', data: 'ACTION_ADD_10', type: 'add' },
    { label: '-10 Units', data: 'ACTION_SUB_10', type: 'subtract' },
    // Set actions
    { label: 'Set to 0', data: 'ACTION_SET_0', type: 'set' },
    { label: 'Set to 1', data: 'ACTION_SET_1', type: 'set' },
    { label: 'Set to 5', data: 'ACTION_SET_5', type: 'set' },
    { label: 'Set to 10', data: 'ACTION_SET_10', type: 'set' },
    { label: 'Set to 20', data: 'ACTION_SET_20', type: 'set' },
    { label: 'Set to 30', data: 'ACTION_SET_30', type: 'set' },
    { label: 'Set to 40', data: 'ACTION_SET_40', type: 'set' },
    // Cancel
    { label: 'Cancel Action', data: 'ACTION_CANCEL', type: 'cancel' }
  ];

  if (typeof QRCode === 'undefined') {
    console.error('QRCode library is not loaded. Cannot display action QR codes.');
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
    }
    actionDiv.className = `flex flex-col items-center p-2 border dark:border-slate-600 rounded-md shadow ${bgColorClass} transition-colors duration-150`;

    const qrCodeElem = document.createElement('div');
    qrCodeElem.id = `action-qr-${action.data}`;
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
      console.error(`Error generating QR code for action ${action.label}:`, e);
      qrCodeElem.textContent = 'Error';
    }
  });
  console.log('Action QR codes displayed with new actions and colors.');
}

function stopQuickStockUpdateScanner() {
  console.log('Stopping Quick Stock Update Scanner...');
  if (quickStockUpdateStream) {
    quickStockUpdateStream.getTracks().forEach(track => track.stop());
    quickStockUpdateStream = null;
  }

  if (quickStockUpdateAnimationFrameId) {
    cancelAnimationFrame(quickStockUpdateAnimationFrameId);
    quickStockUpdateAnimationFrameId = null;
  }

  const video = document.getElementById('quickStockUpdateVideo');
  if (video) {
    video.srcObject = null;
    video.classList.add('hidden');
  }

  const startBtn = document.getElementById('startQuickStockScannerBtn');
  const stopBtn = document.getElementById('stopQuickStockScannerBtn');
  if (startBtn) startBtn.classList.remove('hidden');
  if (stopBtn) stopBtn.classList.add('hidden');

  const feedbackElem = document.getElementById('quickStockUpdateFeedback');
  if (feedbackElem) {
    const quickScanModeTabActive = document.getElementById('quickScanModeTab')?.getAttribute('aria-selected') === 'true';
    if (quickScanModeTabActive) {
        feedbackElem.textContent = 'Scan Product QR with Camera or Barcode Scanner.';
    }
  }

  quickScanState = 'IDLE';
  currentScannedProductId = null;
  quickStockBarcodeBuffer = "";

  const quickScanModeTabActive = document.getElementById('quickScanModeTab')?.getAttribute('aria-selected') === 'true';
  const quickStockUpdateContainerVisible = !document.getElementById('quickStockUpdateContainer')?.classList.contains('hidden');

  if (quickStockUpdateContainerVisible && quickScanModeTabActive) {
    isQuickStockBarcodeActive = true;
  } else {
    isQuickStockBarcodeActive = false;
  }
  console.log('Quick Stock Update Scanner stopped. State reset.');
}

async function startQuickStockUpdateScanner() {
  console.log('Attempting to start Quick Stock Update Scanner...');

  if (typeof jsQR === 'undefined') {
    console.error('jsQR library not found.');
    alert('QR code scanning library (jsQR) is not available.');
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera access not supported by this browser.');
    return;
  }

  const video = document.getElementById('quickStockUpdateVideo');
  const feedbackElem = document.getElementById('quickStockUpdateFeedback');
  const startBtn = document.getElementById('startQuickStockScannerBtn');
  const stopBtn = document.getElementById('stopQuickStockScannerBtn');

  const canvasElement = document.createElement('canvas');
  const canvas = canvasElement.getContext('2d', { willReadFrequently: true });

  async function processQuickStockScan(scannedData) {
    if (!scannedData) return;
    console.log(`Processing scanned data: ${scannedData}, current state: ${quickScanState}`);

    if (scannedData === 'ACTION_CANCEL') {
        feedbackElem.textContent = 'Action cancelled. Scan Product QR.';
        stopQuickStockUpdateScanner();
        return;
    }

    if (quickScanState === 'IDLE' || quickScanState === 'WAITING_FOR_PRODUCT') {
        currentScannedProductId = scannedData;
        quickScanState = 'WAITING_FOR_ACTION';
        isQuickStockBarcodeActive = false;
        quickStockBarcodeBuffer = "";
        feedbackElem.textContent = `Product ID: ${currentScannedProductId}. Scan Action QR (e.g., +1, -1).`;
    } else if (quickScanState === 'WAITING_FOR_ACTION') {
        stopQuickStockUpdateScanner();

        const action = scannedData;
        const productId = currentScannedProductId;

        if (!productId) {
            feedbackElem.textContent = 'Error: Product ID was not captured. Please rescan product.';
            return;
        }
        feedbackElem.textContent = `Processing action '${action}' for product ${productId}...`;
        try {
            const productRef = db.collection('inventory').doc(productId);
            const doc = await productRef.get();
            if (!doc.exists) {
                feedbackElem.textContent = `Error: Product ID ${productId} not found.`;
                return;
            }
            let currentQuantity = doc.data().quantity;
            let newQuantity = currentQuantity;

                if (action === 'ACTION_ADD_1') newQuantity += 1;
                else if (action === 'ACTION_SUB_1') newQuantity -= 1;
                else if (action === 'ACTION_ADD_2') newQuantity += 2;
                else if (action === 'ACTION_SUB_2') newQuantity -= 2;
                else if (action === 'ACTION_ADD_3') newQuantity += 3;
                else if (action === 'ACTION_SUB_3') newQuantity -= 3;
                else if (action === 'ACTION_ADD_4') newQuantity += 4;
                else if (action === 'ACTION_SUB_4') newQuantity -= 4;
                else if (action === 'ACTION_ADD_5') newQuantity += 5;
                else if (action === 'ACTION_SUB_5') newQuantity -= 5;
                else if (action === 'ACTION_ADD_10') newQuantity += 10;
                else if (action === 'ACTION_SUB_10') newQuantity -= 10;
                else if (action === 'ACTION_SET_0') newQuantity = 0;
                else if (action === 'ACTION_SET_1') newQuantity = 1;
                else if (action === 'ACTION_SET_5') newQuantity = 5;
                else if (action === 'ACTION_SET_10') newQuantity = 10;
                else if (action === 'ACTION_SET_20') newQuantity = 20;
                else if (action === 'ACTION_SET_30') newQuantity = 30;
                else if (action === 'ACTION_SET_40') newQuantity = 40;
                else {
                    feedbackElem.textContent = `Unknown action: ${action}. Rescan Product QR.`;
                    return;
                }
            if (newQuantity < 0) newQuantity = 0;
            await productRef.update({ quantity: newQuantity });
            feedbackElem.textContent = `Success! Product ${doc.data().name} (ID: ${productId}) quantity updated to ${newQuantity}. Scan next Product QR.`;
            if (typeof loadInventory === 'function') {
                await loadInventory();
            }
        } catch (error) {
            console.error('Error updating product quantity:', error);
            feedbackElem.textContent = `Error updating product ${productId}: ${error.message}. Rescan Product QR.`;
        }
    }
  }

  function tickQuickStockScanner() {
    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      canvasElement.height = video.videoHeight;
      canvasElement.width = video.videoWidth;
      canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
      const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code && code.data) {
        processQuickStockScan(code.data);
      }
    }
    if (quickStockUpdateAnimationFrameId) {
      quickStockUpdateAnimationFrameId = requestAnimationFrame(tickQuickStockScanner);
    }
  }

  try {
    quickStockUpdateStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = quickStockUpdateStream;
    video.setAttribute('playsinline', true);
    await video.play();
    video.classList.remove('hidden');
    if (startBtn) startBtn.classList.add('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');

    if (quickScanState === 'IDLE' || quickScanState === 'WAITING_FOR_PRODUCT') {
        feedbackElem.textContent = 'Scanning for Product QR Code...';
        isQuickStockBarcodeActive = false;
    } else if (quickScanState === 'WAITING_FOR_ACTION') {
        feedbackElem.textContent = `Product ID: ${currentScannedProductId}. Scanning for Action QR Code...`;
        isQuickStockBarcodeActive = false;
    }

    if (quickStockUpdateAnimationFrameId) {
        cancelAnimationFrame(quickStockUpdateAnimationFrameId);
    }
    quickStockUpdateAnimationFrameId = requestAnimationFrame(tickQuickStockScanner);

  } catch (err) {
    console.error('Error starting Quick Stock Update scanner:', err);
    feedbackElem.textContent = 'Error accessing camera: ' + err.message;
    if (video) video.classList.add('hidden');
    if (startBtn) startBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    quickStockUpdateStream = null;
    isQuickStockBarcodeActive = true;
  }
}

// END OF FUNCTIONS TO ADD

function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

function displaySearchResults(products) {
  const resultsContainer = document.getElementById('productSearchResults');
  resultsContainer.innerHTML = ''; // Clear previous results

  if (products.length === 0) {
    resultsContainer.innerHTML = '<p class="p-2 text-gray-500 dark:text-gray-400">No products found.</p>';
    return;
  }

  products.forEach(product => {
    const resultItem = document.createElement('div');
    resultItem.className = 'p-2 hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer border-b dark:border-slate-500';
    resultItem.textContent = `${product.name} (Qty: ${product.quantity}, ID: ${product.id})`; // Display some info
    resultItem.addEventListener('click', () => {
      handleProductSelection(product); // This function will be created in the next plan step
      resultsContainer.innerHTML = ''; // Clear results after selection
      document.getElementById('interactiveProductSearch').value = product.name; // Fill search bar with selected name
    });
    resultsContainer.appendChild(resultItem);
  });
}

async function handleProductSearch(searchTerm) {
  const resultsContainer = document.getElementById('productSearchResults');
  if (!searchTerm.trim()) {
    resultsContainer.innerHTML = '';
    return;
  }

  console.log(`Searching for: ${searchTerm}`);
  resultsContainer.innerHTML = '<p class="p-2 text-gray-500 dark:text-gray-400">Searching...</p>';

  try {
    console.log("DEBUG: Querying with name >= '" + searchTerm + "' AND name <= '" + searchTerm + "\uf8ff" + "'");
    const productsRef = db.collection('inventory');
    const snapshot = await productsRef
      .where('name', '>=', searchTerm)
      .where('name', '<=', searchTerm + '\uf8ff')
      .limit(10)
      .get();

    const products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });

    displaySearchResults(products);

  } catch (error) {
    console.error('Error searching products:', error);
    resultsContainer.innerHTML = '<p class="p-2 text-red-500 dark:text-red-400">Error during search.</p>';
  }
}

function handleProductSelection(product) {
  console.log('Product selected for QR display and action:', product);
  currentScannedProductId = product.id; // Store the selected product's ID

  const qrDisplayContainer = document.getElementById('searchedProductQRDisplay');
  const feedbackElem = document.getElementById('quickStockUpdateFeedback');
  const productSearchInput = document.getElementById('interactiveProductSearch');
  const searchResultsContainer = document.getElementById('productSearchResults');

  // Clear previous content (e.g., placeholder text or old QR)
  qrDisplayContainer.innerHTML = '';

  if (!product || !product.id) {
    const errorText = document.createElement('span');
    errorText.className = 'text-xs text-red-500 dark:text-red-400';
    errorText.textContent = 'Error: Invalid product selected.';
    qrDisplayContainer.appendChild(errorText);
    if(feedbackElem) feedbackElem.textContent = "Error selecting product. Please try again.";
    return;
  }

  // Div to hold the QR Code (QRCode.js will append canvas/img to this)
  const qrCodeElement = document.createElement('div');
  qrDisplayContainer.appendChild(qrCodeElement);

  try {
    new QRCode(qrCodeElement, { // Target the new inner div
      text: product.id,
      width: 100, // Slightly smaller to give space for text below
      height: 100,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  } catch (e) {
    console.error('Error generating product QR code:', e);
    qrCodeElement.innerHTML = '<span class="text-xs text-red-500">QR Error</span>';
  }

  // Create and append the product name paragraph below the QR code
  const nameParagraph = document.createElement('p');
  nameParagraph.textContent = product.name;
  nameParagraph.className = 'text-xs mt-1 text-center dark:text-gray-200'; // Added text-center
  qrDisplayContainer.appendChild(nameParagraph);


  if (feedbackElem) {
    feedbackElem.textContent = `Product '${product.name}' selected. Scan an Action QR with camera.`;
  }

  quickScanState = 'WAITING_FOR_ACTION';
  isQuickStockBarcodeActive = false;
  quickStockBarcodeBuffer = "";

  if(productSearchInput) productSearchInput.value = product.name;
  if(searchResultsContainer) searchResultsContainer.innerHTML = '';
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
    applyDarkMode(); // Apply if system preference is dark and no user preference
  } else {
    removeDarkMode(); // Default to light if no preference and no system preference for dark
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
    app = firebase.app(); // Get the default app
    console.log('Using existing Firebase app:', app.name);
  }
  db = firebase.firestore();
  storage = firebase.storage(); // If using Firebase Storage
  console.log('Firestore instance created:', !!db);
  console.log('Storage instance created:', !!storage);
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

// Utility to load jsPDF dynamically with polling
async function loadJsPDF(scriptSrc = '/js/jspdf.umd.min.js') {
  return new Promise((resolve, reject) => {
    // Check if already loaded (covers cases where script might have been loaded by other means or previous attempts)
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
      const maxWaitTime = 2000; // 2 seconds
      const pollInterval = 50; // 50 milliseconds

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
      // Re-throw the CDN error or a more generic error
      throw new Error(`Failed to load jsPDF from both local path and CDN: ${cdnError.message}`);
    }
  }
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
        setTimeout(checkQRCode, 100); // Check every 100ms
      }
    };
    checkQRCode();
  });
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
    li.className = 'flex justify-between items-center'; // Text color should be inherited
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
    // Try to restore previously selected value if it still exists
    if (suppliers.includes(currentValue)) {
      dropdown.value = currentValue;
    }
  };

  populate(productSupplierDropdown, false);
  populate(filterSupplierDropdown, true);
  populate(filterToOrderSupplierDropdown, true); // Added this line
  console.log('Supplier dropdowns updated.');
}

// Location Management
async function loadLocations() {
  try {
    console.log('Fetching locations from Firestore...');
    const snapshot = await db.collection('locations').orderBy('name').get(); // Assuming 'name' field for ordering
    locations = snapshot.docs.map(doc => doc.data()); // Store full location object
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
    li.className = 'flex justify-between items-center dark:text-gray-200'; // Ensure text is visible in dark mode
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
    // Check if location is in use
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
     // Optional: default to first location for productLocation if no selection and locations exist
     else if (dropdown.id === 'productLocation' && !currentValue && locations.length > 0 && !includeAllOption) {
      // dropdown.value = locations[0].name; 
     }
  };

  populate(productLocationDropdown, false);
  populate(newLocationDropdown, false); // Typically, specific selection is desired here too
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
    try {
      let photoUrlToSave;
      const productIdValue = document.getElementById('productId').value; // Check if it's an edit

      if (currentPhotoSrc.startsWith('data:image')) { // New photo taken/selected
        photoUrlToSave = await uploadPhoto(id, currentPhotoSrc);
      } else if (productIdValue && currentPhotoSrc === originalPhotoUrlForEdit) { // Editing and photo hasn't changed from original
        photoUrlToSave = originalPhotoUrlForEdit;
      } else if (!currentPhotoSrc) { // Photo preview is empty (photo removed or never added)
        photoUrlToSave = ''; 
      } else {
        // Fallback: if currentPhotoSrc is some other URL (e.g. user pasted one, or it's an old product with a URL not matching originalPhotoUrlForEdit)
        // This will attempt to "upload" it. uploadPhoto should ideally handle http URLs gracefully or this might fail if it's not a valid data URL.
        // For the specific bug, the conditions above are the most important.
        photoUrlToSave = await uploadPhoto(id, currentPhotoSrc);
      }

      await db.collection('inventory').doc(id).set({
        id,
        name,
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
      await loadInventory(); // loadInventory now calls updateToOrderTable internally
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
      originalPhotoUrlForEdit = product.photo; // Store original photo URL
      document.getElementById('productPhotoPreview').src = product.photo;
      document.getElementById('productPhotoPreview').classList.remove('hidden');
    } else {
      originalPhotoUrlForEdit = ''; // Clear if no photo
    }
    document.getElementById('toggleProductFormBtn').textContent = 'Edit Product'; // Updated ID
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
  originalPhotoUrlForEdit = ''; // Clear stored original photo URL
  document.getElementById('toggleProductFormBtn').textContent = 'Add New Product'; // Updated ID
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
  entryDiv.className = 'flex gap-2 items-center';
  entryDiv.innerHTML = `
    <input id="${entryId}-id" type="text" placeholder="Product ID (from scan)" class="border dark:border-gray-600 p-2 rounded flex-1 dark:bg-slate-700 dark:text-gray-200 dark:placeholder-gray-400">
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
    productIdInput.focus(); // Focus the new product ID input

    productIdInput.addEventListener('keypress', function(event) {
      if ((event.key === 'Enter' || event.keyCode === 13) && productIdInput.value.trim() !== '') {
        event.preventDefault();
        stopUpdateScanner(); // Stop camera if active
        console.log('Enter in batch Product ID ' + entryId + '. Value: ' + productIdInput.value + '. Adding new row.');
        addBatchEntry(); // Add a new row and focus its ID field
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
      updateToOrderTable(); // Refresh the table
    });
  }

  // The keypress listener for quantityInput has been removed as per the requirement.

  // Attach listener to the new remove button directly
  const newRemoveButton = entryDiv.querySelector('.removeBatchEntryBtn');
  if (newRemoveButton) {
      newRemoveButton.addEventListener('click', () => {
          removeBatchEntry(newRemoveButton.getAttribute('data-entry-id'));
      });
  }

  // The old loop for attaching listeners to all remove buttons has been removed.
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
async function loadInventory() {
  try {
    console.log('Fetching inventory from Firestore...');
    const snapshot = await db.collection('inventory').get();
    console.log('Inventory snapshot:', snapshot.size, 'documents');
    inventory = snapshot.docs.map(doc => doc.data());
    console.log('Inventory loaded:', inventory);
    // updateInventoryTable(); // OLD CALL
    applyAndRenderInventoryFilters(); // NEW CALL - this will render the table
    await updateToOrderTable(); // Ensure "To Order" table is updated after initial load and filtering
  } catch (error) {
    console.error('Error loading inventory:', error);
    alert('Failed to load inventory: ' + error.message);
  }
}

function applyAndRenderInventoryFilters() {
  const supplierFilter = document.getElementById('filterSupplier') ? document.getElementById('filterSupplier').value : '';
  const locationFilter = document.getElementById('filterLocation') ? document.getElementById('filterLocation').value : '';
  const searchTerm = document.getElementById('inventorySearchInput') ? document.getElementById('inventorySearchInput').value.toLowerCase().trim() : '';

  let filteredInventory = inventory; // Start with the full inventory

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
  updateInventoryTable(filteredInventory);
}


function updateInventoryTable(itemsToDisplay) {
  const tableBody = document.getElementById('inventoryTable');
  console.log('Updating inventory table with:', itemsToDisplay);
  tableBody.innerHTML = '';

  if (!itemsToDisplay || itemsToDisplay.length === 0) {
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 13; // Number of columns in your inventory table
    cell.textContent = 'No products found matching your criteria.';
    cell.className = 'text-center p-4 dark:text-gray-400';
    return;
  }

  itemsToDisplay.forEach(item => {
    const row = document.createElement('tr');
    row.className = item.quantity <= item.minQuantity ? 'bg-red-100 dark:bg-red-800/60' : '';
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
      <td class="border dark:border-slate-600 p-2">${item.photo ? `<img src="${item.photo}" alt="Product Photo: ${item.name}" class="w-16 h-16 object-cover mx-auto cursor-pointer inventory-photo-thumbnail">` : 'No Photo'}</td>
      <td class="border dark:border-slate-600 p-2"><div id="qrcode-${item.id}" class="mx-auto w-24 h-24"></div></td>
      <td class="border dark:border-slate-600 p-2">
        <button data-id="${item.id}" class="editProductBtn text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mr-2">Edit</button>
        <button data-id="${item.id}" class="deleteProductBtn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);

    // Event listener for image thumbnail click
    if (item.photo) {
      const thumbnailImg = row.querySelector('.inventory-photo-thumbnail');
      if (thumbnailImg) {
        thumbnailImg.addEventListener('click', () => {
          // These modal elements are expected to be globally available (defined in DOMContentLoaded)
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
  let toOrderItems = snapshot.docs.map(doc => doc.data()).filter(item => item.quantity <= item.minQuantity); // Made toOrderItems mutable
  const toOrderTable = document.getElementById('toOrderTable');
  toOrderTable.innerHTML = '';

  // Filter by supplier
  const filterToOrderSupplierDropdown = document.getElementById('filterToOrderSupplier');
  const selectedSupplier = filterToOrderSupplierDropdown ? filterToOrderSupplierDropdown.value : "";
  if (selectedSupplier) {
    toOrderItems = toOrderItems.filter(item => item.supplier === selectedSupplier);
  }

  const reorderNotificationBar = document.getElementById('reorderNotificationBar');
  if (toOrderItems.length > 0) {
    reorderNotificationBar.textContent = `Products to reorder: ${toOrderItems.length}`;
    reorderNotificationBar.classList.remove('hidden');
  } else {
    reorderNotificationBar.classList.add('hidden');
    reorderNotificationBar.textContent = 'Products to reorder: 0'; // Reset text
  }

  toOrderItems.forEach(item => {
    const row = document.createElement('tr');
    // Row background will be default (likely dark:bg-slate-800 from parent container), text inherited.
    // Highlighted low-stock rows in the main inventory table are handled by `updateInventoryTable`.
    // This table just lists items to order, so no special row.className needed here for dark mode beyond cell borders.
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
    // Check if QRCode library is available
    if (typeof window.QRCode !== 'function') {
      throw new Error('QRCode library is not loaded');
    }

    const JsPDF = await waitForJsPDF();

    const filterLocationDropdown = document.getElementById('filterLocation');
    const selectedLocationFilter = filterLocationDropdown ? filterLocationDropdown.value : '';
    
    let productGroups = {};
    let productsToProcess = []; // Will hold the products for PDF generation

    if (selectedLocationFilter) {
      // Fetch products for the selected location
      const snapshot = await db.collection('inventory').where('location', '==', selectedLocationFilter).get();
      productsToProcess = snapshot.docs.map(doc => doc.data());
      if (productsToProcess.length > 0) {
        productGroups[selectedLocationFilter] = productsToProcess;
      }
    } else {
      // Fetch all products and group them by location
      const snapshot = await db.collection('inventory').get();
      const allProducts = snapshot.docs.map(doc => doc.data());
      if (allProducts.length > 0) {
        productGroups = allProducts.reduce((acc, product) => {
          const location = product.location || 'Unassigned'; // Handle products with no location
          if (!acc[location]) {
            acc[location] = [];
          }
          acc[location].push(product);
          return acc;
        }, {});

        // Sort location names alphabetically for consistent PDF output
        const sortedLocationNames = Object.keys(productGroups).sort();
        const sortedProductGroups = {};
        for (const locationName of sortedLocationNames) {
          sortedProductGroups[locationName] = productGroups[locationName];
        }
        productGroups = sortedProductGroups;
      }
    }

    if (Object.keys(productGroups).length === 0) {
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

    // Layout Constants
    const COLS = 4;
    const ROWS = 3; // Adjusted from 6
    const PRODUCTS_PER_PAGE = COLS * ROWS;
    const MARGIN = 40; // points
    const QR_SIZE = 60; // points, fixed size for QR code
    const NAME_FONT_SIZE = 8;
    const TEXT_AREA_HEIGHT = 20; // Space for product name below QR
    const ADDITIONAL_VERTICAL_PADDING_POINTS = 113.4; // 4cm converted to points (1 cm = 28.3465 points)
    const CELL_PADDING_VERTICAL = 10 + ADDITIONAL_VERTICAL_PADDING_POINTS; // Space between product name and the QR code of the row below

    const USABLE_WIDTH = pageWidth - 2 * MARGIN;
    const QR_SPACING_HORIZONTAL = (USABLE_WIDTH - COLS * QR_SIZE) / (COLS - 1);
    
    // CELL_HEIGHT defines the total vertical space one item (QR + name) occupies
    const CELL_HEIGHT = QR_SIZE + TEXT_AREA_HEIGHT + CELL_PADDING_VERTICAL; 

    let pageNumber = 0;
    // let overallProductIndex = 0; // Removed as it was only for commented-out debug canvas IDs

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
      return MARGIN + 55; // Y offset for content start
    };
    
    const generationDate = new Date().toLocaleDateString();
    const locationNames = Object.keys(productGroups); // Already sorted from previous step

    for (let i = 0; i < locationNames.length; i++) {
      const locationName = locationNames[i];
      const productsInLocation = productGroups[locationName];
      let productCountInLocationOnPage = 0;
      let currentYOffset = 0; // Will be set by drawPageHeaders

      for (let j = 0; j < productsInLocation.length; j++) {
        const product = productsInLocation[j];
        // overallProductIndex++; // Removed as it was only for commented-out debug canvas IDs

        if (productCountInLocationOnPage === 0) { // Start of a new page for this location or first product
          pageNumber++;
          if (pageNumber > 1) { // Add new page if not the very first page of PDF
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
          // Optionally draw a placeholder or skip this cell
          productCountInLocationOnPage++;
          if (productCountInLocationOnPage >= PRODUCTS_PER_PAGE) {
            productCountInLocationOnPage = 0;
          }
          continue;
        }
        
        // Create a temporary, off-screen div for QRCode.js to render into
        const tempDiv = document.createElement('div');
        tempDiv.id = `temp-qr-div-${product.id}`;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';
        tempDiv.style.width = QR_SIZE + 'px';
        tempDiv.style.height = QR_SIZE + 'px';
        document.body.appendChild(tempDiv);

        let qrImageFromCanvas = ''; // To store the data URI

        try {
          const qrOptions = {
              text: product.id,
              width: QR_SIZE,
              height: QR_SIZE,
              colorDark: '#000000',
              colorLight: '#ffffff',
              correctLevel: window.QRCode.CorrectLevel.L // Using full options now
          };

          new window.QRCode(tempDiv, qrOptions); // QRCode.js will append a canvas (or img) to tempDiv

          const qrCanvas = tempDiv.querySelector('canvas');
          
          if (qrCanvas) {
            qrImageFromCanvas = qrCanvas.toDataURL('image/png');
          } else {
            const qrImgTag = tempDiv.querySelector('img');
            if (qrImgTag) {
                console.error('QRCode.js did not create a canvas, found img instead. Image data extraction from img.src needs review for jsPDF compatibility.');
                qrImageFromCanvas = qrImgTag.src; // This might still be problematic for jsPDF
            } else {
                console.error('QRCode.js did not create a canvas or img in tempDiv for product: ' + product.id);
                document.body.removeChild(tempDiv);
                continue; 
            }
          }
          
          if (qrImageFromCanvas) { 
            doc.addImage(qrImageFromCanvas, 'PNG', x, y, QR_SIZE, QR_SIZE);
          } else {
            console.warn(`Skipping addImage for product ${product.id} due to missing QR image data.`);
          }

        } catch (qrError) {
          console.error('Error generating QR code for product ID', product.id, ' (DOM method):', qrError);
          doc.setFontSize(8);
          doc.text('QR Error', x + QR_SIZE / 2, y + QR_SIZE / 2, { align: 'center' });
        } finally {
            // Ensure tempDiv is always removed
            if (tempDiv.parentElement === document.body) {
                document.body.removeChild(tempDiv);
            }
        }

        // Add product name below QR code
        doc.setFontSize(NAME_FONT_SIZE);
        // Position the baseline of the text to be vertically centered within TEXT_AREA_HEIGHT
        const textYPosition = y + QR_SIZE + (TEXT_AREA_HEIGHT + NAME_FONT_SIZE) / 2;
        doc.text(product.name, x + QR_SIZE / 2, textYPosition, {
            align: 'center',
            maxWidth: QR_SIZE // Constrain name text to QR code width
        });

        productCountInLocationOnPage++;
        if (productCountInLocationOnPage >= PRODUCTS_PER_PAGE) {
          productCountInLocationOnPage = 0; // Reset for the new page
          // Next product will trigger new page creation if it exists
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
async function generateOrderReport() {
  try {
    // const JsPDF = await waitForJsPDF(); // This was the duplicate, removed.
    const snapshot = await db.collection('inventory').get();
    let toOrderItems = snapshot.docs.map(doc => doc.data()).filter(item => item.quantity <= item.minQuantity); // toOrderItems should be mutable for filtering
    if (toOrderItems.length === 0) {
      alert('No products need reordering.');
      return;
    }

    await ensureQRCodeIsAvailable(); // Ensure QRCode library is ready
    const JsPDF = await waitForJsPDF(); // Ensure JsPDF is loaded
    const doc = new JsPDF();

    const margin = 20; // Page margin
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const bottomMargin = 20;
    const QR_CODE_SIZE_IN_PDF = 30; // points
    const ROW_HEIGHT = QR_CODE_SIZE_IN_PDF + 5; // Reduced padding
    const TEXT_FONT_SIZE = 10;
    const HEADER_FONT_SIZE = 12;
    const SUPPLIER_HEADER_FONT_SIZE = 14;


    // Define x-coordinates for columns
    let xQr = margin; // Typically 20
    let xName = xQr + QR_CODE_SIZE_IN_PDF + 5; // 55 (remains unchanged)
    let xQty = xName + 80 + 5; // New: 55 + 80 + 5 = 140 (Name maxWidth becomes 80)
    let xQtyOrdered = xQty + 30 + 5; // New: 140 + 30 + 5 = 175
    let xQtyBackordered = xQtyOrdered + 40 + 5; // New: 175 + 40 + 5 = 220
    let xReorderQty = xQtyBackordered + 40 + 5; // New: 220 + 40 + 5 = 265
    let xSupplier = xReorderQty + 40 + 5; // New: 265 + 40 + 5 = 310

    let y = margin + 20; // Initial y position

    function drawPageHeaders(docInstance, currentY) {
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
        docInstance.text('BACKORDER_PDF', xQtyBackordered, currentY, { align: 'right' });
        docInstance.text('ReorderQ', xReorderQty, currentY, { align: 'right' });
        docInstance.text('Supplier', xSupplier, currentY);
        docInstance.setFont("helvetica", "normal");
        
        currentY += 7;
        docInstance.setLineWidth(0.5);
        docInstance.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 10;
        return currentY;
    }

    y = drawPageHeaders(doc, y);

    // Apply supplier filter if selected
    const filterToOrderSupplierDropdown = document.getElementById('filterToOrderSupplier');
    const selectedSupplierFilter = filterToOrderSupplierDropdown ? filterToOrderSupplierDropdown.value : "";
    if (selectedSupplierFilter) {
      toOrderItems = toOrderItems.filter(item => item.supplier === selectedSupplierFilter);
    }

    const itemsBySupplierGroup = toOrderItems.reduce((acc, item) => {
      const supplierName = item.supplier || 'Supplier Not Assigned';
      if (!acc[supplierName]) {
        acc[supplierName] = [];
      }
      acc[supplierName].push(item);
      return acc;
    }, {});

    const sortedSupplierNames = Object.keys(itemsBySupplierGroup).sort();

    for (const supplierName of sortedSupplierNames) {
        const items = itemsBySupplierGroup[supplierName];
        if (items.length === 0) continue;

        if (y + 20 > pageHeight - bottomMargin) { // Check for page break before supplier header
            doc.addPage();
            y = drawPageHeaders(doc, margin + 30); // Redraw headers on new page
        }
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(SUPPLIER_HEADER_FONT_SIZE);
        doc.text(supplierName, margin, y);
        y += SUPPLIER_HEADER_FONT_SIZE; 
        doc.setFont("helvetica", "normal");
        doc.setFontSize(TEXT_FONT_SIZE);

        for (const item of items) {
            if (y + ROW_HEIGHT > pageHeight - bottomMargin) { // Check space for the next item
                doc.addPage();
                y = drawPageHeaders(doc, margin + 30);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(SUPPLIER_HEADER_FONT_SIZE);
                doc.text(`${supplierName} (continued)`, margin, y);
                y += SUPPLIER_HEADER_FONT_SIZE;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(TEXT_FONT_SIZE);
            }

            // Generate QR Code
            const tempDivId = `temp-qr-order-${item.id}`;
            const tempDiv = document.createElement('div');
            tempDiv.id = tempDivId;
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px'; // Off-screen
            tempDiv.style.width = `${QR_CODE_SIZE_IN_PDF}px`;
            tempDiv.style.height = `${QR_CODE_SIZE_IN_PDF}px`;
            document.body.appendChild(tempDiv);

            let qrImageFromCanvas = '';
            try {
                new window.QRCode(tempDiv, {
                    text: item.id,
                    width: QR_CODE_SIZE_IN_PDF,
                    height: QR_CODE_SIZE_IN_PDF,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: window.QRCode.CorrectLevel.L
                });
                const qrCanvas = tempDiv.querySelector('canvas');
                if (qrCanvas) {
                    qrImageFromCanvas = qrCanvas.toDataURL('image/png');
                } else {
                     console.error('QR Canvas not found for item:', item.id);
                     doc.text('QR Error', xQr + QR_CODE_SIZE_IN_PDF / 2, y + QR_CODE_SIZE_IN_PDF / 2, { align: 'center' });
                }
            } catch (qrError) {
                console.error('Error generating QR code for order report, item ID', item.id, ':', qrError);
                doc.text('QR Error', xQr + QR_CODE_SIZE_IN_PDF / 2, y + QR_CODE_SIZE_IN_PDF / 2, { align: 'center' });
            } finally {
                if (document.getElementById(tempDivId)) {
                    document.body.removeChild(tempDiv);
                }
            }
            
            if (qrImageFromCanvas) {
                doc.addImage(qrImageFromCanvas, 'PNG', xQr, y, QR_CODE_SIZE_IN_PDF, QR_CODE_SIZE_IN_PDF);
            }

            // Calculate y position for text to be positioned closer below the QR code
            // The QR code is drawn at `y`. Text should start slightly below the QR code's bottom edge.
            // QR code bottom edge is y + QR_CODE_SIZE_IN_PDF.
            // Add a small gap (e.g., 2 points) plus half the text height (approximated by TEXT_FONT_SIZE / 2)
            // to roughly align the baseline of the text.
            // A simpler approach: place text baseline slightly below QR code.
            // Let's try placing the text baseline a few points below the QR code itself.
            // If QR is at y, and is QR_CODE_SIZE_IN_PDF high, text starts at y + QR_CODE_SIZE_IN_PDF + some_offset.
            // However, the existing textY was relative to y (top of QR code).
            // The old textY was: y + 15 + 3.33 = y + 18.33 (for QR_SIZE=30, FONT_SIZE=10)
            // The QR image is drawn at `y`. We want the text to appear just below it.
            // Let's position the text baseline a bit below the QR.
            // If QR is at `y` and has height `QR_CODE_SIZE_IN_PDF`, its bottom is `y + QR_CODE_SIZE_IN_PDF`.
            // We want text to start just below this. `TEXT_FONT_SIZE` is the height of the text.
            // So, `textY` (baseline) should be `y + QR_CODE_SIZE_IN_PDF + TEXT_FONT_SIZE * 0.75` (approx) or simply a fixed offset.
            // Let's try a simpler adjustment: The original textY was aiming for vertical centering within the old ROW_HEIGHT.
            // The QR code itself takes `QR_CODE_SIZE_IN_PDF` (30 points).
            // The new ROW_HEIGHT is 30 + 5 = 35.
            // We want the text to sit closely under the QR.
            // Let's try positioning the text baseline relative to the QR code's `y` position.
            // If the QR code is drawn at `y`, its height is `QR_CODE_SIZE_IN_PDF`.
            // The text should start just below the QR code.
            // Let's make textY = y + QR_CODE_SIZE_IN_PDF - (TEXT_FONT_SIZE / 2) + 5;
            // This aims to place the center of the text line slightly below the QR code.
            // The original textY = y + (QR_CODE_SIZE_IN_PDF / 2) + (TEXT_FONT_SIZE / 3)
            // textY = y + 15 + 3.33 = y + 18.33
            // The QR code is drawn from y to y + 30.
            // Text was drawn with its baseline at y + 18.33. This means most of the text was within the QR's vertical span.
            // To move it closer *underneath*, textY needs to be > y + QR_CODE_SIZE_IN_PDF.
            // No, textY is the baseline. If textY = y, text is *on top* of QR.
            // If textY = y + QR_CODE_SIZE_IN_PDF, baseline is at bottom of QR.
            // If textY = y + QR_CODE_SIZE_IN_PDF + TEXT_FONT_SIZE, text is fully below QR.
            // Let's try:
            const textY = y + QR_CODE_SIZE_IN_PDF - (TEXT_FONT_SIZE / 2) + 2; // Position text more tightly under the QR

            doc.text(item.name, xName, textY, {maxWidth: xQty - xName - 5}); 
            doc.text((item.quantity || 0).toString(), xQty, textY, { align: 'right' });
            doc.text((item.quantityOrdered || 0).toString(), xQtyOrdered, textY, { align: 'right' });
            doc.text('BO:' + (item.quantityBackordered || 0).toString(), xQtyBackordered, textY, { align: 'right' });
            doc.text((item.reorderQuantity || 0).toString(), xReorderQty, textY, { align: 'right' });
            doc.text(item.supplier || 'N/A', xSupplier, textY, {maxWidth: pageWidth - xSupplier - margin});
            
            y += ROW_HEIGHT;
        }
        y += 10; // Extra space between supplier groups
    }

    doc.save('Watagan_Dental_Order_Report_With_QR.pdf');
  } catch (error) {
    console.error('Failed to generate Order Report PDF (jsPDF):', error.message, error.stack);
    alert('Failed to generate Order Report PDF (jsPDF): ' + error.message);
  }
}


// Order Reports - Alternative PDF generation with pdf-lib.js
async function generateOrderReportWithPdfLib() {
  if (!window.PDFLib) {
    alert('Error: PDFLib library is not loaded. Cannot generate PDF.');
    console.error('PDFLib library not found on window object.');
    return;
  }

  const { PDFDocument, StandardFonts, rgb, PageSizes } = window.PDFLib;

  try {
    const snapshot = await db.collection('inventory').get();
    let toOrderItems = snapshot.docs.map(doc => doc.data()).filter(item => item.quantity <= item.minQuantity);

    const filterToOrderSupplierDropdown = document.getElementById('filterToOrderSupplier');
    const selectedSupplier = filterToOrderSupplierDropdown ? filterToOrderSupplierDropdown.value : "";

    if (selectedSupplier) {
      toOrderItems = toOrderItems.filter(item => item.supplier === selectedSupplier);
    }
    
    if (toOrderItems.length === 0) {
      alert('No products need reordering for the selected supplier (pdf-lib).');
      return;
    }

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
    let yPosition = height - margin;
    const lineHeight = 14; // For 12pt font + spacing
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

      // Check if new page is needed for supplier header
      if (yPosition < margin + (headerFontSize + lineHeight * 2)) { // Supplier header + column headers + one item
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

      // Column Headers for items
      page.drawText("ID", { x: margin, y: yPosition, font: boldFont, size: regularFontSize });
      page.drawText("Name", { x: margin + 80, y: yPosition, font: boldFont, size: regularFontSize });
      page.drawText("Qty", { x: margin + 350, y: yPosition, font: boldFont, size: regularFontSize });
      page.drawText("Min Qty", { x: margin + 400, y: yPosition, font: boldFont, size: regularFontSize });
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
        const maxNameWidth = 250; 
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
          
          page.drawText("ID", { x: margin, y: yPosition, font: boldFont, size: regularFontSize });
          page.drawText("Name", { x: margin + 80, y: yPosition, font: boldFont, size: regularFontSize });
          page.drawText("Qty", { x: margin + 350, y: yPosition, font: boldFont, size: regularFontSize });
          page.drawText("Min Qty", { x: margin + 400, y: yPosition, font: boldFont, size: regularFontSize });
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
        page.drawText(item.id, { x: margin, y: currentLineY, font: font, size: regularFontSize });
        nameLines.forEach((line, index) => {
            page.drawText(line, { x: margin + 80, y: currentLineY, font: font, size: regularFontSize });
            if (index < nameLines.length -1) currentLineY -= lineHeight;
        });
        page.drawText(item.quantity.toString(), { x: margin + 350, y: yPosition, font: font, size: regularFontSize }); 
        page.drawText(item.minQuantity.toString(), { x: margin + 400, y: yPosition, font: font, size: regularFontSize }); 
        
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
    alert('Failed to generate Order Report PDF with pdf-lib: ' + error.message);
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

    // Group items by supplier
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
      emailBody += '---------------------------------------------------------------------------\n'; // Adjusted separator
      const items = itemsBySupplier[supplierName];
      items.forEach(item => {
        emailBody += `${item.name} | Qty: ${item.quantity} | Ordered: ${item.quantityOrdered || 0} | Backordered: ${item.quantityBackordered || 0} | Reorder: ${item.reorderQuantity || 0} | Supp: ${item.supplier}\n`;
      });
      emailBody += '\n'; // Add a blank line between supplier groups
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
  document.getElementById('moveProductId').focus(); // Focus the input field
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
  const canvasElement = document.createElement('canvas'); // Create canvas dynamically
  const canvas = canvasElement.getContext('2d', { willReadFrequently: true });
  let animationFrameId; // To store the requestAnimationFrame ID

  // Function to continuously scan for QR codes
  function scanMoveQR() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvasElement.height = video.videoHeight;
      canvasElement.width = video.videoWidth;
      canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
      const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
      
      // Use the correctly referenced jsQR
      const code = qrScanner(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert', // Optional: speeds up scanning if codes are not inverted
      });

      if (code) {
        document.getElementById('moveProductId').value = code.data;
        document.getElementById('moveScanResult').textContent = `Scanned Code: ${code.data}`;
        stopMoveScanner(); // Call stopMoveScanner to clean up and stop the loop
        // No need to explicitly cancel animationFrameId here as stopMoveScanner will handle it
      } else {
        // If no code is found, continue the loop
        animationFrameId = requestAnimationFrame(scanMoveQR);
      }
    } else {
      // If video data is not ready, try again on the next frame
      animationFrameId = requestAnimationFrame(scanMoveQR);
    }
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.classList.remove('hidden');
    video.setAttribute('playsinline', true); // Important for iOS to play inline
    video.play();
    // Start the scanning loop
    animationFrameId = requestAnimationFrame(scanMoveQR); 
    // Store animationFrameId globally or in a way stopMoveScanner can access it
    window.moveScannerAnimationFrameId = animationFrameId; 
  } catch (err) {
    console.error('Error accessing camera:', err);
    alert('Error accessing camera: ' + err.message);
    if (animationFrameId) { // Ensure to cancel frame if error occurs after starting
        cancelAnimationFrame(animationFrameId);
    }
  }
}

function stopMoveScanner() {
  console.log('stopMoveScanner called. Stream and UI cleanup executed.');
  // Cancel the animation frame loop using the stored ID
  if (window.moveScannerAnimationFrameId) {
    cancelAnimationFrame(window.moveScannerAnimationFrameId);
    window.moveScannerAnimationFrameId = null; // Clear the ID
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null; // Clear the stream reference
    const video = document.getElementById('moveVideo');
    if (video) {
        video.srcObject = null;
        video.classList.add('hidden');
    }
    const scanResult = document.getElementById('moveScanResult');
    if (scanResult) {
        scanResult.textContent = ''; // Clear the scan result text
    }
  }
  // Quagga.stop(); // Quagga is no longer used in this function, so this line is removed.
}

async function startUpdateScanner() {
  // Ensure there's an entry to work with and focus its ID field
  if (batchUpdates.length === 0) {
    addBatchEntry(); // This will also focus the new entry's ID field
  } else {
    const lastEntryArrayId = batchUpdates[batchUpdates.length - 1];
    const lastProductIdInput = document.getElementById(`${lastEntryArrayId}-id`);
    if (lastProductIdInput) {
      lastProductIdInput.focus();
    } else {
      // If the last input doesn't exist for some reason, add a new entry
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
  const canvasElement = document.createElement('canvas'); // Create canvas dynamically
  const canvas = canvasElement.getContext('2d', { willReadFrequently: true });
  let animationFrameId; // To store the requestAnimationFrame ID

  // Function to continuously scan for QR codes
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
        
        // Populate the ID field of the last batch entry (which should be focused or just added)
        if (batchUpdates.length > 0) {
          const lastEntryArrayId = batchUpdates[batchUpdates.length - 1];
          const targetInputId = `${lastEntryArrayId}-id`;
          const targetInput = document.getElementById(targetInputId);
          if (targetInput) {
            targetInput.value = code.data;
            // Move focus to the quantity field of the same entry
            const quantityInput = document.getElementById(`${lastEntryArrayId}-quantity`);
            if (quantityInput) {
              quantityInput.focus();
            }
          } else {
            console.warn(`Target input ${targetInputId} not found for scanned QR code.`);
            // Fallback: if the target input wasn't found, maybe add a new entry with this code
            // addBatchEntry(); // This will create a new row
            // const newLastEntryArrayId = batchUpdates[batchUpdates.length - 1];
            // document.getElementById(`${newLastEntryArrayId}-id`).value = code.data;
            // document.getElementById(`${newLastEntryArrayId}-quantity`).focus();
          }
        }
        
        stopUpdateScanner(); // Clean up and stop the loop
      } else {
        // If no code is found, continue the loop
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
  // Quagga.stop(); // Quagga is no longer used here.
}

function applySidebarState(isMinimized) {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
    const reorderNotificationBar = document.getElementById('reorderNotificationBar'); // Get the reorder bar

    if (!sidebar || !mainContent || !sidebarToggleIcon || !reorderNotificationBar) {
        console.error('Sidebar, main content, toggle icon, or reorder notification bar not found for state application.');
        return;
    }

    if (isMinimized) {
        sidebar.classList.add('sidebar-minimized');
        mainContent.classList.add('main-content-expanded');
        reorderNotificationBar.classList.add('text-transparent'); // Hide text, keep background
        // Change icon to "expand" (e.g., right chevron)
        sidebarToggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5" />';
        localStorage.setItem(SIDEBAR_STATE_KEY, 'true');
    } else {
        sidebar.classList.remove('sidebar-minimized');
        mainContent.classList.remove('main-content-expanded');
        reorderNotificationBar.classList.remove('text-transparent'); // Show text again
        // Change icon to "collapse" (e.g., left chevron)
        sidebarToggleIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5" />';
        localStorage.setItem(SIDEBAR_STATE_KEY, 'false');
    }
}

function toggleSidebar() {
    let isMinimized = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
    applySidebarState(!isMinimized); // Apply the opposite state
}

function exportInventoryToCSV() {
    // Get the currently filtered and searched inventory data.
    const supplierFilter = document.getElementById('filterSupplier') ? document.getElementById('filterSupplier').value : '';
    const locationFilter = document.getElementById('filterLocation') ? document.getElementById('filterLocation').value : '';
    const searchInput = document.getElementById('inventorySearchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let itemsToExport = [...inventory]; // Start with a copy of the full inventory

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

    // Define CSV headers
    const headers = [
        "ID", "Name", "Quantity", "Cost", "Min Quantity", 
        "Quantity Ordered", "Quantity Backordered", "Reorder Quantity",
        "Supplier", "Location", "Photo URL"
    ];
    // Define the order of keys corresponding to headers
    const keys = [
        "id", "name", "quantity", "cost", "minQuantity",
        "quantityOrdered", "quantityBackordered", "reorderQuantity",
        "supplier", "location", "photo"
    ];

    let csvContent = headers.join(",") + "\n";

    itemsToExport.forEach(item => {
        const row = keys.map(key => {
            let cellValue = item[key] === undefined || item[key] === null ? '' : item[key];
            // Handle potential commas in cell values by enclosing in double quotes
            if (typeof cellValue === 'string' && cellValue.includes(',')) {
                cellValue = `"${cellValue.replace(/"/g, '""')}"`; // Escape existing double quotes
            }
            return cellValue;
        });
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { // Feature detection
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

    // Use existing global 'inventory' array if it's kept up-to-date.
    // For this phase, we assume 'inventory' is reasonably current.
    // If not, consider fetching fresh data or ensuring loadInventory() is called appropriately.

    const lowStockItems = inventory.filter(item => item.quantity <= item.minQuantity);

    lowStockAlertsTableBody.innerHTML = ''; // Clear previous entries

    if (lowStockItems.length === 0) {
        const row = lowStockAlertsTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6; // Number of columns in the low-stock table
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
  // scanResultP is already declared at the beginning of the function.
  console.log('[EditScanner] DOM elements obtained:', { video, stopBtn, startBtn, scanResultP });

  // Dynamically create canvas, it's not in HTML for this scanner
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
        editProduct(code.data); // Call existing function to populate form
        stopEditScanner(); // Stop scanner, cleanup, and UI reset
        // No need to explicitly cancel animationFrameId here as stopEditScanner will handle it.
        return; // Exit loop
      } else {
        console.log('[EditScanner Loop] No QR code found in this frame.');
      }
    }
    // Continue loop if no code or video not ready
    window.editScannerAnimationFrameId = requestAnimationFrame(scanEditQR);
  }

  try {
    console.log('[EditScanner] Requesting camera access...');
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    console.log('[EditScanner] Camera access granted. Stream:', stream);
    video.srcObject = stream;
    console.log('[EditScanner] Video properties before play:', { srcObject: video.srcObject, videoWidth: video.videoWidth, videoHeight: video.videoHeight, readyState: video.readyState });
    video.setAttribute('playsinline', true); // For iOS
    video.play(); // Wait for play to start to ensure videoWidth/Height are available
    console.log('[EditScanner] video.play() resolved. Video properties after play:', { videoWidth: video.videoWidth, videoHeight: video.videoHeight, readyState: video.readyState });

    // Update UI
    video.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.remove('hidden');
    if (startBtn) startBtn.classList.add('hidden');
    if (scanResultP) scanResultP.textContent = 'Scanning...';


    // Start the scanning loop
    window.editScannerAnimationFrameId = requestAnimationFrame(scanEditQR);

  } catch (err) {
    console.error('[EditScanner] Error during scanner setup or operation:', err, 'Error name:', err.name, 'Error message:', err.message);
    alert('Error starting QR scanner: ' + err.message);
    // Ensure cleanup if error occurs during setup
    if (window.editScannerAnimationFrameId) {
      cancelAnimationFrame(window.editScannerAnimationFrameId);
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    video.classList.add('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    if (startBtn) startBtn.classList.remove('hidden'); // Show start button again
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
  if (startBtn) startBtn.classList.remove('hidden'); // Show the start button again
  // Optionally clear the scan result text, or leave it showing the last scan
  if (scanResultP) scanResultP.textContent = ''; 
}

// --- TAB SWITCHING LOGIC FOR QUICK STOCK UPDATE & BATCH ENTRY ---
function switchQuickUpdateTab(selectedTabId) {
  const quickScanModeTabBtn = document.getElementById('quickScanModeTab');
  const manualBatchModeTabBtn = document.getElementById('manualBatchModeTab');
  const quickScanModeContentPane = document.getElementById('quickScanModeContent');
  const manualBatchModeContentPane = document.getElementById('manualBatchModeContent');
  const quickStockUpdateFeedbackElem = document.getElementById('quickStockUpdateFeedback');


  // Ensure all elements are present before proceeding
  if (!quickScanModeTabBtn || !manualBatchModeTabBtn || !quickScanModeContentPane || !manualBatchModeContentPane) {
    console.error("Tab switching UI elements not all found. Tab switching aborted.");
    return;
  }

  const activeSpecificClasses = ['border-blue-600', 'text-blue-600', 'dark:border-blue-500', 'dark:text-blue-500', 'font-semibold'];
  const inactiveSpecificClasses = ['border-transparent', 'text-gray-500', 'dark:text-gray-400'];
  const hoverClasses = ['hover:text-gray-700', 'hover:border-gray-300', 'dark:hover:text-gray-300', 'dark:hover:border-gray-600'];

  if (selectedTabId === 'quickScanModeTab' || selectedTabId === 'quickScanModeContent') {
      quickScanModeTabBtn.setAttribute('aria-selected', 'true');
      manualBatchModeTabBtn.setAttribute('aria-selected', 'false');

      quickScanModeTabBtn.classList.remove(...inactiveSpecificClasses);
      quickScanModeTabBtn.classList.add(...activeSpecificClasses);
      hoverClasses.forEach(hc => quickScanModeTabBtn.classList.add(hc));

      manualBatchModeTabBtn.classList.remove(...activeSpecificClasses);
      manualBatchModeTabBtn.classList.add(...inactiveSpecificClasses);
      hoverClasses.forEach(hc => manualBatchModeTabBtn.classList.add(hc));

      quickScanModeContentPane.classList.remove('hidden');
      manualBatchModeContentPane.classList.add('hidden');

      if (typeof stopUpdateScanner === 'function') {
          const batchVideo = document.getElementById('updateVideo');
          const batchScanResult = document.getElementById('updateScanResult');
          if (batchVideo && !batchVideo.classList.contains('hidden')) { // Check if batch scanner is active
              console.log("Switching to Quick Scan: Attempting to stop batch update scanner.");
              stopUpdateScanner();
          } else if (batchScanResult && batchScanResult.textContent !== '') {
              batchScanResult.textContent = ''; // Clear leftover batch scanner text
          }
      }
      isQuickStockBarcodeActive = true;
      if (quickStockUpdateFeedbackElem && (quickScanState === 'IDLE' || quickScanState === 'WAITING_FOR_PRODUCT')) {
          quickStockUpdateFeedbackElem.textContent = 'Scan Product QR with Camera or Barcode Scanner.';
      } else if (quickStockUpdateFeedbackElem && quickScanState === 'WAITING_FOR_ACTION' && currentScannedProductId) {
           quickStockUpdateFeedbackElem.textContent = `Product ID: ${currentScannedProductId}. Use CAMERA to scan Action QR.`;
      }
      console.log("Switched to Quick Scan Mode Tab.");

  } else if (selectedTabId === 'manualBatchModeTab' || selectedTabId === 'manualBatchModeContent') {
      manualBatchModeTabBtn.setAttribute('aria-selected', 'true');
      quickScanModeTabBtn.setAttribute('aria-selected', 'false');

      manualBatchModeTabBtn.classList.remove(...inactiveSpecificClasses);
      manualBatchModeTabBtn.classList.add(...activeSpecificClasses);
      hoverClasses.forEach(hc => manualBatchModeTabBtn.classList.add(hc));

      quickScanModeTabBtn.classList.remove(...activeSpecificClasses);
      quickScanModeTabBtn.classList.add(...inactiveSpecificClasses);
      hoverClasses.forEach(hc => quickScanModeTabBtn.classList.add(hc));

      manualBatchModeContentPane.classList.remove('hidden');
      quickScanModeContentPane.classList.add('hidden');

      if (quickScanState !== 'IDLE' && typeof stopQuickStockUpdateScanner === 'function') {
          console.log("Switching to Manual Batch: Attempting to stop quick stock update scanner.");
          stopQuickStockUpdateScanner();
      }
      isQuickStockBarcodeActive = false;
      quickStockBarcodeBuffer = "";
      const batchScanResult = document.getElementById('updateScanResult');
      const batchVideo = document.getElementById('updateVideo');
      if(batchScanResult && batchVideo && batchVideo.classList.contains('hidden')) {
         // Optional: Set a default message for batch scanner if it's not running
         // batchScanResult.textContent = "Ready for batch scanning or manual entry.";
      }
      console.log("Switched to Manual Batch Mode Tab.");
  }
}

// Initialize and Bind Events
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded fired'); 
  initialDarkModeCheck(); // Apply dark mode preferences early
  
  // Initialize Sidebar State on Load
  let initialSidebarMinimized = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';
  applySidebarState(initialSidebarMinimized);

  // Assign Modal DOM Elements to module-scoped variables
  imageModal = document.getElementById('imageModal');
  modalImage = document.getElementById('modalImage');
  closeImageModalBtn = document.getElementById('closeImageModalBtn');

  if (imageModal && modalImage && closeImageModalBtn) {
      // Listener for the close button
      closeImageModalBtn.addEventListener('click', () => {
          imageModal.classList.add('hidden');
          modalImage.src = ''; // Clear the image src when modal is closed
      });

      // Listener for clicking on the modal overlay (to close it)
      imageModal.addEventListener('click', (event) => {
          // If the click is directly on the imageModal (the overlay)
          // and not on any of its children (like the image content area)
          if (event.target === imageModal) {
              imageModal.classList.add('hidden');
              modalImage.src = ''; // Clear the image src
          }
      });
  } else {
      console.error('Image modal HTML elements not all found. Enlarging images may not work.');
  }

  // Make Product Form Preview Image Clickable
  const productPhotoPreviewImg = document.getElementById('productPhotoPreview');
  if (productPhotoPreviewImg) {
    productPhotoPreviewImg.addEventListener('click', () => {
      if (productPhotoPreviewImg.src && 
          !productPhotoPreviewImg.src.endsWith('#') && // Check for placeholder/empty src
          !productPhotoPreviewImg.classList.contains('hidden') && // Check if image is visible
          productPhotoPreviewImg.src !== window.location.href) { // Check if src is not just the page URL

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

  // Add Event Listener for the Toggle Button
  const sidebarToggleBtnEl = document.getElementById('sidebarToggleBtn');
  if (sidebarToggleBtnEl) {
      sidebarToggleBtnEl.addEventListener('click', toggleSidebar);
  }

  try {
    await ensureQRCodeIsAvailable(); // Wait for QRCode to be ready
    // Initialize parts of the app that depend on QRCode
    // loadInventory will call applyAndRenderInventoryFilters, which calls updateInventoryTable
    loadInventory(); 
    
    // Other initializations that don't depend on QRCode can be here or remain
    await loadSuppliers(); // This will also populate filterSupplier dropdown
    await loadLocations(); // This will also populate filterLocation dropdown
    addBatchEntry(); 

    console.log('DOMContentLoaded: About to schedule collapsible section initialization.');
    // Setup collapsible sections
    setTimeout(() => {
        console.log('Initializing collapsible sections (after small delay)...');
        // Forms expanded by default as per new requirement
        setupCollapsibleSection('toggleProductFormBtn', 'productFormContent', true);
        setupCollapsibleSection('toggleSupplierFormBtn', 'supplierFormContent', true);
        setupCollapsibleSection('toggleLocationFormBtn', 'locationFormContent', true);
        setupCollapsibleSection('toggleMoveProductFormBtn', 'moveProductFormContent', true);
        // setupCollapsibleSection('toggleUpdateProductFormBtn', 'updateProductFormContent', true); // Added this line
        
        // Tables expanded by default (remains true)
        setupCollapsibleSection('toggleInventoryTableBtn', 'inventoryTableContent', true);
        setupCollapsibleSection('toggleToOrderTableBtn', 'toOrderTableContainer', true);
    }, 0);


    // Event Listeners
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
    // Bind other events (these are fine as they are user-triggered)
    document.getElementById('addBatchEntryBtn').addEventListener('click', addBatchEntry);
  document.getElementById('submitBatchUpdatesBtn').addEventListener('click', submitBatchUpdates);
  // startUpdateScannerBtn and stopUpdateScannerBtn are now for the batch tab, keep original functions
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

  // Quick Stock Update Button Listeners (Camera for Quick Scan Tab)
  // Renamed button IDs in HTML were startQuickStockScannerBtn / stopQuickStockScannerBtn
  const startQuickStockCameraBtn = document.getElementById('startQuickStockScannerBtn');
  if (startQuickStockCameraBtn) {
    startQuickStockCameraBtn.addEventListener('click', startQuickStockUpdateScanner);
  }
  const stopQuickStockCameraBtn = document.getElementById('stopQuickStockScannerBtn');
  if (stopQuickStockCameraBtn) {
    stopQuickStockCameraBtn.addEventListener('click', stopQuickStockUpdateScanner);
  }

  // Tab Button Event Listeners for Quick Stock Update & Batch Entry Section
  const quickScanModeTabBtn = document.getElementById('quickScanModeTab');
  if (quickScanModeTabBtn) {
    quickScanModeTabBtn.addEventListener('click', () => switchQuickUpdateTab('quickScanModeTab'));
  }
  const manualBatchModeTabBtn = document.getElementById('manualBatchModeTab');
  if (manualBatchModeTabBtn) {
    manualBatchModeTabBtn.addEventListener('click', () => switchQuickUpdateTab('manualBatchModeTab'));
  }

  // Handle "Enter" key in moveProductId input field
  const moveProductIdInput = document.getElementById('moveProductId');
  if (moveProductIdInput) {
    moveProductIdInput.addEventListener('keypress', function(event) {
      if ((event.key === 'Enter' || event.keyCode === 13) && moveProductIdInput.value.trim() !== '') {
        event.preventDefault(); // Prevent default form submission
        const currentVal = moveProductIdInput.value; // Capture value before stopMoveScanner might clear it indirectly
        stopMoveScanner(); // Stop camera if active
        console.log('Enter key processed for moveProductId. Value:', currentVal);
        // The existing moveProduct() function will be called by the user clicking the "Move Product" button
        // or could be called here if direct submission on Enter is desired.
        // For now, just stopping scanner and logging. User still needs to click "Move Product".
      }
    });
  }

  const addLocationBtn = document.getElementById('addLocationBtn');
  if (addLocationBtn) {
    addLocationBtn.addEventListener('click', addLocation);
  }

  // Inventory Filter Event Listeners
  const filterSupplierEl = document.getElementById('filterSupplier');
  const filterLocationEl = document.getElementById('filterLocation');
  const clearInventoryFiltersBtnEl = document.getElementById('clearInventoryFiltersBtn');
  const inventorySearchInputEl = document.getElementById('inventorySearchInput');

  if (filterSupplierEl) {
    filterSupplierEl.addEventListener('change', applyAndRenderInventoryFilters);
  }
  if (filterLocationEl) {
    filterLocationEl.addEventListener('change', applyAndRenderInventoryFilters);
  }
  if (inventorySearchInputEl) {
    inventorySearchInputEl.addEventListener('input', applyAndRenderInventoryFilters);
  }
  if (clearInventoryFiltersBtnEl) {
    clearInventoryFiltersBtnEl.addEventListener('click', () => {
      if (filterSupplierEl) filterSupplierEl.value = '';
      if (filterLocationEl) filterLocationEl.value = '';
      if (inventorySearchInputEl) inventorySearchInputEl.value = '';
      applyAndRenderInventoryFilters();
    });
  }

  // Event listener for the "Products to Order" supplier filter
  const filterToOrderSupplierDropdown = document.getElementById('filterToOrderSupplier');
  if (filterToOrderSupplierDropdown) {
    filterToOrderSupplierDropdown.addEventListener('change', () => {
      updateToOrderTable(); // Refresh the table with the new filter
    });
  }
  
  document.getElementById('generateOrderReportBtn').addEventListener('click', generateOrderReport);
  document.getElementById('emailOrderReportBtn').addEventListener('click', emailOrderReport);

  const qrCodePDFBtn = document.getElementById('generateQRCodePDFBtn');
  if (qrCodePDFBtn) {
    qrCodePDFBtn.addEventListener('click', generateQRCodePDF);
  } else {
    console.warn('QR Code PDF button not found in DOM');
  }

  // Log button element after all initializations
  console.log('Button element (generateQRCodePDFBtn):', document.getElementById('generateQRCodePDFBtn'));

  const generateLocationQRCodePDFBtnEl = document.getElementById('generateLocationQRCodePDFBtn');
  if (generateLocationQRCodePDFBtnEl) {
    generateLocationQRCodePDFBtnEl.addEventListener('click', generateQRCodePDF);
  }

  const exportInventoryCSVBtnEl = document.getElementById('exportInventoryCSVBtn');
  if (exportInventoryCSVBtnEl) {
    exportInventoryCSVBtnEl.addEventListener('click', exportInventoryToCSV);
  }

  const toggleInventoryIDBtn = document.getElementById('toggleInventoryIDColumnBtn');
  if (toggleInventoryIDBtn) {
    toggleInventoryIDBtn.addEventListener('click', () => {
      const idCells = document.querySelectorAll('#inventoryTableContent .id-column'); // Targets both th and td
      let isHiddenAfterToggle = false;
      idCells.forEach(cell => {
        cell.classList.toggle('hidden');
        if (cell.classList.contains('hidden')) {
          isHiddenAfterToggle = true; 
        }
      });
      // Update button text based on whether the column is now hidden
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

  // --- START NEW NAVIGATION LOGIC ---
  const menuInventory = document.getElementById('menuInventory');
  const menuSuppliers = document.getElementById('menuSuppliers');
  const menuOrders = document.getElementById('menuOrders');
  const menuReports = document.getElementById('menuReports');
  const menuQuickStockUpdate = document.getElementById('menuQuickStockUpdate'); // Added for new menu item

  const menuItems = [menuInventory, menuSuppliers, menuOrders, menuReports, menuQuickStockUpdate].filter(item => item !== null);

  const inventoryViewContainer = document.getElementById('inventoryViewContainer');
  const suppliersSectionContainer = document.getElementById('suppliersSectionContainer');
  const locationsAdminSectionContainer = document.getElementById('locationsAdminSectionContainer'); // Keep for future
  const ordersSectionContainer = document.getElementById('ordersSectionContainer');
  const reportsSectionContainer = document.getElementById('reportsSectionContainer');
  const quickStockUpdateContainer = document.getElementById('quickStockUpdateContainer'); // Added for new section

  const allViewContainers = [
      inventoryViewContainer,
      suppliersSectionContainer,
      // locationsAdminSectionContainer, // Removed as it's now part of suppliersSectionContainer
      ordersSectionContainer,
      reportsSectionContainer,
      quickStockUpdateContainer // Added for new section
  ].filter(container => container !== null); 

  // Define CSS classes for active and inactive states
  const activeMenuClasses = ['bg-gray-300', 'dark:bg-slate-700', 'font-semibold', 'text-gray-900', 'dark:text-white'];
  const inactiveMenuClasses = ['text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-300', 'dark:hover:bg-slate-700'];
  // Note: 'rounded-md' and 'flex', 'items-center', 'p-2' are base classes and should remain on all.

  function setActiveMenuItem(clickedItemId) {
      menuItems.forEach(item => {
          if (item.id === clickedItemId) {
              // Apply active classes
              inactiveMenuClasses.forEach(cls => item.classList.remove(cls));
              activeMenuClasses.forEach(cls => item.classList.add(cls));
              // Ensure SVG icon within active item also gets appropriate color if needed
              const icon = item.querySelector('svg');
              if (icon) {
                  icon.classList.remove('text-gray-500', 'dark:text-gray-400', 'group-hover:text-gray-700', 'dark:group-hover:text-gray-200');
                  icon.classList.add('text-gray-700', 'dark:text-gray-100'); // Active icon color
              }
          } else {
              // Apply inactive classes (restore default)
              activeMenuClasses.forEach(cls => item.classList.remove(cls));
              inactiveMenuClasses.forEach(cls => item.classList.add(cls));
               // Restore default icon color and hover for inactive items
              const icon = item.querySelector('svg');
              if (icon) {
                  icon.classList.remove('text-gray-700', 'dark:text-gray-100'); // Remove active icon color
                  icon.classList.add('text-gray-500', 'dark:text-gray-400', 'group-hover:text-gray-700', 'dark:group-hover:text-gray-200');
              }
          }
      });
  }

  function showView(viewIdToShow, clickedMenuId) {
      console.log(`Attempting to show view: ${viewIdToShow} triggered by ${clickedMenuId}`);
      let viewFound = false;
      allViewContainers.forEach(container => {
          if (container.id === viewIdToShow) {
              container.classList.remove('hidden');
              viewFound = true;
              console.log(`Showing: ${container.id}`);
              if (container.id === 'quickStockUpdateContainer') {
                // Default to Quick Scan tab when the main section is shown
                switchQuickUpdateTab('quickScanModeTab');
                // Set isQuickStockBarcodeActive for the global keypress listener.
                // Feedback text is now handled by switchQuickUpdateTab.
                isQuickStockBarcodeActive = true;
              }
          } else {
              // If hiding the Quick Stock Update container, ensure its scanner is stopped and barcode input is deactivated
              if (container.id === 'quickStockUpdateContainer') {
                  isQuickStockBarcodeActive = false;
                  quickStockBarcodeBuffer = ""; // Clear buffer when navigating away
                  if (quickScanState !== 'IDLE') {
                    stopQuickStockUpdateScanner(); // This also sets quickScanState to IDLE
                  }
              }
              container.classList.add('hidden');
              console.log(`Hiding: ${container.id}`);
          }
      });
      if (viewFound) {
          setActiveMenuItem(clickedMenuId);
      } else if (viewIdToShow) { 
          console.warn(`View with ID '${viewIdToShow}' not found among registered containers.`);
      }
  }

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
          updateInventoryDashboard(); // Call to update dashboard data
      });
  }

  if (menuQuickStockUpdate) { // Added for new menu item
    menuQuickStockUpdate.addEventListener('click', (e) => {
        e.preventDefault();
        showView('quickStockUpdateContainer', menuQuickStockUpdate.id);
        // Ensure QRCode library is available before calling displayActionQRCodes
        ensureQRCodeIsAvailable().then(() => {
            displayActionQRCodes(); // Generate QR codes when this view is shown
        }).catch(error => {
            console.error("QRCode library not available for Quick Stock Update:", error);
            const container = document.getElementById('actionQRCodesContainer');
            if(container) container.innerHTML = "<p class='text-red-500'>Error: QR Code library failed to load. Cannot display action QR codes.</p>";
        });
    });
  }
  
  // Initial View State: Show Inventory View by default and set its menu item active.
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
  // --- END NEW NAVIGATION LOGIC ---

  // --- START QUICK STOCK UPDATE SCANNER FUNCTIONS ---
  // ... (Quick Stock Update scanner functions: startQuickStockUpdateScanner, tickQuickStockScanner, processQuickStockScan, stopQuickStockUpdateScanner)
  // ... (displayActionQRCodes function)
  // These functions were added in previous subtasks and are assumed to be present and correct.
  // The switchQuickUpdateTab function was also added previously.
  // --- END QUICK STOCK UPDATE SCANNER FUNCTIONS ---

  // Event listener for interactive product search
  const productSearchInput = document.getElementById('interactiveProductSearch');
  if (productSearchInput) {
    const debouncedSearchHandler = debounce(async () => {
      await handleProductSearch(productSearchInput.value);
    }, 400); // 400ms debounce delay
    productSearchInput.addEventListener('input', debouncedSearchHandler);
  }

  // Global keypress listener for barcode scanner input (both edit mode and quick stock)
  document.addEventListener('keypress', (event) => {
    const quickStockUpdateContainerEl = document.getElementById('quickStockUpdateContainer');
    const quickStockUpdateContainerVisible = quickStockUpdateContainerEl && !quickStockUpdateContainerEl.classList.contains('hidden');
    const quickScanModeTabActive = document.getElementById('quickScanModeTab')?.getAttribute('aria-selected') === 'true';

    if (event.key === 'Enter' || event.keyCode === 13) {
      // Priority to Quick Stock Barcode Input if its specific conditions are met
      if (isQuickStockBarcodeActive && quickStockUpdateContainerVisible && quickScanModeTabActive &&
          (quickScanState === 'WAITING_FOR_PRODUCT' || quickScanState === 'IDLE') &&
          quickStockBarcodeBuffer.trim() !== '') {

        event.preventDefault();
        const scannedId = quickStockBarcodeBuffer.trim();
        quickStockBarcodeBuffer = "";
        const feedbackElem = document.getElementById('quickStockUpdateFeedback');

        if (quickScanState === 'WAITING_FOR_PRODUCT' || quickScanState === 'IDLE') {
            currentScannedProductId = scannedId;
            quickScanState = 'WAITING_FOR_ACTION';
            if(feedbackElem) feedbackElem.textContent = `Product ID: ${currentScannedProductId}. Use CAMERA to scan Action QR.`;
            isQuickStockBarcodeActive = false;

            if (!quickStockUpdateStream && feedbackElem) {
                 feedbackElem.textContent += ' Press Start Scanner for Action QR.';
            }
        }
        return;
      }

      // Existing Edit Product Barcode Input
      if (isEditScanModeActive && editScanInputBuffer.trim() !== '') {
        event.preventDefault();
        const scannedId = editScanInputBuffer.trim();
        console.log('Enter key processed by global listener for editScan. Buffer:', scannedId);
        editProduct(scannedId);
        stopEditScanner(); 
      }
      editScanInputBuffer = "";
    } else {
      // Append other characters to respective buffers based on active state
      if (isQuickStockBarcodeActive && quickStockUpdateContainerVisible && quickScanModeTabActive &&
          (quickScanState === 'WAITING_FOR_PRODUCT' || quickScanState === 'IDLE')) {
        quickStockBarcodeBuffer += event.key;
      } else if (isEditScanModeActive) {
        const activeElement = document.activeElement;
        if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA' && activeElement.tagName !== 'SELECT')) {
             event.preventDefault();
        }
        editScanInputBuffer += event.key;
      }
    }
  });

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