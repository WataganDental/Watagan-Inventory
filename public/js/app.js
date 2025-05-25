let stream = null;
let photoStream = null;
let inventory = [];
let suppliers = [];
let locations = []; // Added for location management
let batchUpdates = [];
let db; // Declare db globally
let storage; // Declare storage globally

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
  const app = firebase.initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully:', app.name);
  db = firebase.firestore();
  storage = firebase.storage();
  console.log('Firestore instance created:', !!db);
  console.log('Storage instance created:', !!storage);
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

// Utility to load jsPDF dynamically
async function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (typeof window.jsPDF === 'function') {
      console.log('jsPDF already loaded');
      resolve(window.jsPDF);
      return;
    }

    console.log('Dynamically loading jsPDF...');
    const script = document.createElement('script');
    script.src = '/js/jspdf.umd.min.js';
    script.async = true;

    script.onload = () => {
      console.log('jsPDF script loaded successfully');
      if (typeof window.jsPDF === 'function') {
        console.log('window.jsPDF defined:', window.jsPDF);
        resolve(window.jsPDF);
      } else {
        console.error('jsPDF script loaded but window.jsPDF is not defined');
        reject(new Error('jsPDF script loaded but window.jsPDF is not defined'));
      }
    };

    script.onerror = (error) => {
      console.error('Failed to load jsPDF script:', error);
      reject(new Error('Failed to load jsPDF script from /js/jspdf.umd.min.js'));
    };

    document.head.appendChild(script);
  });
}

// Utility to wait for jsPDF to be available
async function waitForJsPDF() {
  try {
    // First, attempt to load the script
    const JsPDF = await loadJsPDF();
    return JsPDF;
  } catch (error) {
    console.warn('Initial jsPDF load failed:', error.message);
    console.log('Attempting to load jsPDF from fallback CDN...');
    
    // Fallback: Load from CDN
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js';
      script.async = true;

      script.onload = () => {
        console.log('jsPDF fallback script loaded successfully');
        if (typeof window.jsPDF === 'function') {
          console.log('window.jsPDF defined (fallback):', window.jsPDF);
          resolve(window.jsPDF);
        } else {
          console.error('jsPDF fallback script loaded but window.jsPDF is not defined');
          reject(new Error('jsPDF fallback script loaded but window.jsPDF is not defined'));
        }
      };

      script.onerror = (error) => {
        console.error('Failed to load jsPDF fallback script:', error);
        reject(new Error('Failed to load jsPDF from fallback CDN'));
      };

      document.head.appendChild(script);
    });
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
  const supplier = document.getElementById('productSupplier').value;
  const location = document.getElementById('productLocation').value;
  const photoData = document.getElementById('productPhotoPreview').src;

  if (name && quantity >= 0 && cost >= 0 && minQuantity >= 0 && supplier && location) {
    try {
      const photoUrl = await uploadPhoto(id, photoData);
      await db.collection('inventory').doc(id).set({ 
        id, 
        name, 
        quantity, 
        cost, 
        minQuantity, 
        supplier, 
        location, 
        photo: photoUrl 
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
    document.getElementById('productSupplier').value = product.supplier;
    document.getElementById('productLocation').value = product.location;
    if (product.photo) {
      document.getElementById('productPhotoPreview').src = product.photo;
      document.getElementById('productPhotoPreview').classList.remove('hidden');
    }
    document.getElementById('productFormTitle').textContent = 'Edit Product';
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
  document.getElementById('productSupplier').value = '';
  document.getElementById('productLocation').value = 'Surgery 1';
  document.getElementById('productPhotoPreview').src = '';
  document.getElementById('productPhotoPreview').classList.add('hidden');
  document.getElementById('productFormTitle').textContent = 'Add New Product';
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
  // Stack vertically on small screens, row on sm and up. Items stretch to full width when stacked.
  entryDiv.className = 'flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-2'; 
  entryDiv.innerHTML = `
    <input id="${entryId}-id" type="text" placeholder="Product ID (from scan)" class="w-full sm:flex-1 border dark:border-gray-600 p-2 rounded dark:bg-slate-700 dark:text-gray-200 dark:placeholder-gray-400">
    <input id="${entryId}-quantity" type="number" placeholder="Quantity" class="w-full sm:w-24 border dark:border-gray-600 p-2 rounded dark:bg-slate-700 dark:text-gray-200 dark:placeholder-gray-400">
    <select id="${entryId}-action" class="w-full sm:w-32 border dark:border-gray-600 p-2 rounded dark:bg-slate-700 dark:text-gray-200">
      <option value="add">Add</option>
      <option value="remove">Remove</option>
    </select>
    <button data-entry-id="${entryId}" class="removeBatchEntryBtn w-full sm:w-auto text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 rounded border dark:border-red-500 hover:bg-red-100 dark:hover:bg-red-700/50">Remove</button>
  `;
  batchUpdatesDiv.appendChild(entryDiv);
  batchUpdates.push(entryId);
  document.querySelectorAll('.removeBatchEntryBtn').forEach(button => {
    button.addEventListener('click', () => removeBatchEntry(button.getAttribute('data-entry-id')));
  });
}

function removeBatchEntry(entryId) {
  const entryDiv = document.getElementById('batchUpdates').querySelector(`[id="${entryId}-id"]`).parentElement;
  entryDiv.remove();
  batchUpdates = batchUpdates.filter(id => id !== entryId);
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

  let filteredInventory = inventory; // Start with the full inventory

  if (supplierFilter) {
    filteredInventory = filteredInventory.filter(item => item.supplier === supplierFilter);
  }
  if (locationFilter) {
    filteredInventory = filteredInventory.filter(item => item.location === locationFilter);
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
    cell.colSpan = 10; // Number of columns in your inventory table
    cell.textContent = 'No products found matching your criteria.';
    cell.className = 'text-center p-4 dark:text-gray-400';
    return;
  }

  itemsToDisplay.forEach(item => {
    const row = document.createElement('tr');
    row.className = item.quantity <= item.minQuantity ? 'bg-red-100 dark:bg-red-800/60' : '';
    row.innerHTML = `
      <td class="border dark:border-slate-600 p-2">${item.id}</td>
      <td class="border dark:border-slate-600 p-2">${item.name}</td>
      <td class="border dark:border-slate-600 p-2">${item.quantity}</td>
      <td class="border dark:border-slate-600 p-2">${item.minQuantity}</td>
      <td class="border dark:border-slate-600 p-2">${item.cost.toFixed(2)}</td>
      <td class="border dark:border-slate-600 p-2">${item.supplier}</td>
      <td class="border dark:border-slate-600 p-2">${item.location}</td>
      <td class="border dark:border-slate-600 p-2">${item.photo ? `<img src="${item.photo}" class="w-16 h-16 object-cover mx-auto" alt="Product Photo">` : 'No Photo'}</td>
      <td class="border dark:border-slate-600 p-2"><div id="qrcode-${item.id}" class="mx-auto w-24 h-24"></div></td>
      <td class="border dark:border-slate-600 p-2">
        <button data-id="${item.id}" class="editProductBtn text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mr-2">Edit</button>
        <button data-id="${item.id}" class="deleteProductBtn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);

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
  const toOrderItems = snapshot.docs.map(doc => doc.data()).filter(item => item.quantity <= item.minQuantity);
  const toOrderTable = document.getElementById('toOrderTable');
  toOrderTable.innerHTML = '';
  if (toOrderItems.length > 0) {
    alert(`Warning: ${toOrderItems.length} product(s) need reordering!`);
  }
  toOrderItems.forEach(item => {
    const row = document.createElement('tr');
    // Row background will be default (likely dark:bg-slate-800 from parent container), text inherited.
    // Highlighted low-stock rows in the main inventory table are handled by `updateInventoryTable`.
    // This table just lists items to order, so no special row.className needed here for dark mode beyond cell borders.
    row.innerHTML = `
      <td class="border dark:border-slate-600 p-2">${item.id}</td>
      <td class="border dark:border-slate-600 p-2">${item.name}</td>
      <td class="border dark:border-slate-600 p-2">${item.quantity}</td>
      <td class="border dark:border-slate-600 p-2">${item.minQuantity}</td>
      <td class="border dark:border-slate-600 p-2">${item.supplier}</td>
    `;
    toOrderTable.appendChild(row);
  });
}

// QR Code PDF Generation
async function generateQRCodePDF() {
  try {
    await ensureQRCodeIsAvailable(); // Ensure QRCode library is loaded
    if (typeof window.QRCode !== 'function') {
      throw new Error('QRCode library is not loaded');
    }

    const JsPDF = await waitForJsPDF();
    const snapshot = await db.collection('inventory').orderBy('location').get(); // Order by location
    const products = snapshot.docs.map(doc => doc.data());

    if (products.length === 0) {
      alert('No products in inventory to generate QR codes for.');
      return;
    }

    // Group products by location
    const productsByLocation = products.reduce((acc, product) => {
      const location = product.location || 'Unassigned'; // Handle products with no location
      if (!acc[location]) {
        acc[location] = [];
      }
      acc[location].push(product);
      return acc;
    }, {});

    const doc = new JsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    // A4 dimensions: 595.28 x 841.89 pt
    const pageWidth = 595.28;
    // const pageHeight = 841.89; // Not directly used for fixed item grid
    const margin = 40;
    const qrSize = 113.39; // ~40mm
    const qrSpacing = 20;
    const textHeight = 20; // Approximate height for product name text
    // const cellWidth = (pageWidth - 2 * margin - 3 * qrSpacing) / 4; // Not directly used
    const cellHeight = qrSize + textHeight + 15; // QR + text + padding
    const cols = 4; // Number of QR codes per row
    const rowsPerPage = 6; // Number of QR code rows per page

    let firstPage = true;
    let overallPageNumber = 1;

    // Iterate over each location
    for (const locationName in productsByLocation) {
      if (productsByLocation.hasOwnProperty(locationName)) {
        const locationProducts = productsByLocation[locationName];
        let productIndexInLocation = 0;

        if (locationProducts.length === 0) {
          // Skip locations with no items
          continue;
        }
        
        let locationPageNumber = 1; // Page number specific to this location's items

        while (productIndexInLocation < locationProducts.length) {
          if (!firstPage) {
            doc.addPage();
            overallPageNumber++;
          } else {
            firstPage = false;
          }

          // Page header
          doc.setFontSize(16);
          doc.text(`Watagan Dental QR Codes - Location: ${locationName}`, margin, margin - 10);
          doc.setFontSize(10);
          doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, margin + 5);
          doc.text(`Page ${locationPageNumber} (Overall: ${overallPageNumber})`, pageWidth - margin - 50, margin -10);


          // Loop for rows on the current page
          for (let row = 0; row < rowsPerPage && productIndexInLocation < locationProducts.length; row++) {
            // Loop for columns in the current row
            for (let col = 0; col < cols && productIndexInLocation < locationProducts.length; col++) {
              const product = locationProducts[productIndexInLocation];

              if (!product.id || !product.name) {
                console.warn('Invalid product data for location', locationName, 'at index', productIndexInLocation, product);
                productIndexInLocation++;
                continue; 
              }

              const x = margin + col * (qrSize + qrSpacing);
              const y = margin + 40 + row * cellHeight; // Adjusted starting y for QR codes

              const canvas = document.createElement('canvas');
              canvas.width = qrSize;
              canvas.height = qrSize;
              
              try {
                 new window.QRCode(canvas, {
                    text: product.id,
                    width: qrSize,
                    height: qrSize,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: window.QRCode.CorrectLevel.L
                });
              } catch (qrError) {
                console.error("QR Code generation failed for product:", product.id, qrError);
                doc.setFontSize(8);
                doc.setFillColor(255,0,0); 
                doc.rect(x, y, qrSize, qrSize, 'F'); 
                doc.setTextColor(255,255,255); 
                doc.text("QR Error", x + qrSize/2, y + qrSize/2, { align: 'center', baseline: 'middle' });
                doc.setTextColor(0,0,0); 
                productIndexInLocation++;
                continue;
              }

              const qrImage = canvas.toDataURL('image/png');
              doc.addImage(qrImage, 'PNG', x, y, qrSize, qrSize);

              doc.setFontSize(8); 
              let productNameToDisplay = product.name;
              const textWidth = doc.getTextWidth(productNameToDisplay);
              const textX = x + (qrSize - textWidth) / 2; 
              
              if (textWidth > qrSize) {
                  const approxCharsPerLine = productNameToDisplay.length * (qrSize / textWidth);
                  // Attempt to split into two lines if too long, very basic split
                  if (productNameToDisplay.length > approxCharsPerLine * 1.5) { // If it's much longer
                    let splitPoint = productNameToDisplay.indexOf(' ', Math.floor(approxCharsPerLine) -1 );
                    if (splitPoint === -1 || splitPoint > approxCharsPerLine * 1.8) splitPoint = Math.floor(approxCharsPerLine);
                    
                    const line1 = productNameToDisplay.substring(0, splitPoint);
                    const line2 = productNameToDisplay.substring(splitPoint).trim();
                    const textWidthL1 = doc.getTextWidth(line1);
                    const textXL1 = x + (qrSize - textWidthL1) / 2;
                    doc.text(line1, textXL1, y + qrSize + 10);

                    const textWidthL2 = doc.getTextWidth(line2);
                    const textXL2 = x + (qrSize - textWidthL2) / 2;
                    doc.text(line2, textXL2, y + qrSize + 10 + 8); // 8pt font size + 2pt spacing
                  } else { // Simple truncation if not extremely long or no good split point
                    productNameToDisplay = productNameToDisplay.substring(0, Math.floor(approxCharsPerLine) - 3) + "...";
                    const finalTextWidth = doc.getTextWidth(productNameToDisplay);
                    const finalTextX = x + (qrSize - finalTextWidth) / 2;
                    doc.text(productNameToDisplay, finalTextX, y + qrSize + 10);
                  }
              } else {
                  doc.text(productNameToDisplay, textX, y + qrSize + 10);
              }
              productIndexInLocation++;
            }
          }
          locationPageNumber++;
        }
      }
    }

    doc.save('Watagan_Dental_QR_Codes_By_Location.pdf');
  } catch (error) {
    console.error('Failed to generate QR Code PDF by location:', error.message, error.stack);
    alert('Failed to generate QR Code PDF by location: ' + error.message);
  }
}

// Order Reports
async function generateOrderReport() {
  try {
    const JsPDF = await waitForJsPDF();
    const snapshot = await db.collection('inventory').get(); // Fetch all inventory
    const toOrderItems = snapshot.docs.map(doc => doc.data()).filter(item => item.quantity <= item.minQuantity);

    if (toOrderItems.length === 0) {
      alert('No products need reordering.');
      return;
    }

    // Group items by supplier
    const itemsBySupplier = toOrderItems.reduce((acc, item) => {
      const supplierName = item.supplier || 'Supplier Not Assigned'; // Default for items with no supplier
      if (!acc[supplierName]) {
        acc[supplierName] = [];
      }
      acc[supplierName].push(item);
      return acc;
    }, {});

    const doc = new JsPDF({
      orientation: 'portrait',
      unit: 'pt', // Use points for measurements
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40; // 40pt margin
    const lineHeight = 12; // 12pt line height for item details
    const sectionSpacing = 20; // Space between supplier sections
    let yPosition = margin; // Start yPosition for content

    // Function to add page header
    const addPageHeader = (pageNumber) => {
      doc.setFontSize(16);
      doc.text('Watagan Dental Order Report', margin, margin - 10); // Main title
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, margin + 5);
      doc.text(`Page ${pageNumber}`, pageWidth - margin - 30, margin -10);
      yPosition = margin + 20; // Reset yPosition for content after header
    };
    
    // Function to add a new page if needed
    const checkAndAddPage = (itemHeight = lineHeight) => {
      if (yPosition + itemHeight > pageHeight - margin) { // Check if content exceeds page
        doc.addPage();
        currentPage++;
        addPageHeader(currentPage);
        return true; // Page was added
      }
      return false; // No page added
    };

    let currentPage = 1;
    addPageHeader(currentPage);

    const supplierNames = Object.keys(itemsBySupplier).sort(); // Sort supplier names alphabetically

    for (const supplierName of supplierNames) {
      const items = itemsBySupplier[supplierName];
      if (items.length === 0) continue;

      // Check for page break before supplier header
      const estimatedSectionHeight = lineHeight * 2 + sectionSpacing + lineHeight; 
      if(checkAndAddPage(estimatedSectionHeight)) {
        // If a page break happened, header is already added by addPageHeader.
      }

      // Supplier Header
      doc.setFontSize(14); 
      doc.setFontStyle('bold');
      doc.text(supplierName, margin, yPosition);
      yPosition += lineHeight + (lineHeight / 2); 
      doc.setFontStyle('normal');

      // Column Headers for items
      doc.setFontSize(10);
      doc.setFontStyle('bold');
      doc.text('ID', margin, yPosition);
      doc.text('Name', margin + 80, yPosition); 
      doc.text('Qty', margin + 300, yPosition, {align: 'right'});
      doc.text('Min Qty', margin + 350, yPosition, {align: 'right'});
      yPosition += lineHeight;
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2); 
      yPosition += 5; 
      doc.setFontStyle('normal');

      // List items for the current supplier
      for (const item of items) {
        if (checkAndAddPage(lineHeight)) { 
          doc.setFontSize(14);
          doc.setFontStyle('bold');
          doc.text(`${supplierName} (continued)`, margin, yPosition);
          yPosition += lineHeight + (lineHeight / 2);
          doc.setFontStyle('normal');

          doc.setFontSize(10);
          doc.setFontStyle('bold');
          doc.text('ID', margin, yPosition);
          doc.text('Name', margin + 80, yPosition);
          doc.text('Qty', margin + 300, yPosition, {align: 'right'});
          doc.text('Min Qty', margin + 350, yPosition, {align: 'right'});
          yPosition += lineHeight;
          doc.setLineWidth(0.5);
          doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
          yPosition += 5;
          doc.setFontStyle('normal');
        }

        doc.setFontSize(10);
        let itemName = item.name;
        try {
            const maxNameWidth = 210; 
            if (doc.getTextWidth(itemName) > maxNameWidth) {
                let splitText = doc.splitTextToSize(itemName, maxNameWidth);
                itemName = Array.isArray(splitText) ? splitText[0] : splitText;
                if (itemName.length < item.name.length && !itemName.endsWith("...")) {
                    itemName = itemName.trim() + "...";
                }
            }
        } catch(e) {
            console.warn("Error processing item name for PDF: ", item.name, e);
        }

        doc.text(item.id, margin, yPosition);
        doc.text(itemName, margin + 80, yPosition);
        doc.text(item.quantity.toString(), margin + 300, yPosition, {align: 'right'});
        doc.text(item.minQuantity.toString(), margin + 350, yPosition, {align: 'right'});
        yPosition += lineHeight;
      }
      yPosition += sectionSpacing; 
    }

    doc.save('Watagan_Dental_Order_Report_By_Supplier.pdf');
  } catch (error) {
    console.error('Failed to generate Order Report PDF by Supplier:', error.message, error.stack);
    alert('Failed to generate Order Report PDF by Supplier: ' + error.message);
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
    emailBody += 'ID | Name | Quantity | Min Quantity | Supplier\n';
    emailBody += '----------------------------------------\n';
    toOrderItems.forEach(item => {
      emailBody += `${item.id} | ${item.name} | ${item.quantity} | ${item.minQuantity} | ${item.supplier}\n`;
    });

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
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera access not supported by this browser.');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('moveVideo');
    video.srcObject = stream;
    video.classList.remove('hidden');
    video.play();
    Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: video,
        constraints: { facingMode: 'environment' }
      },
      decoder: { readers: ['code_128_reader', 'qrcode_reader'] }
    }, function(err) {
      if (err) {
        console.error('Error initializing scanner:', err);
        alert('Error initializing scanner: ' + err.message);
        return;
      }
      Quagga.start();
    });
    Quagga.onDetected(function(result) {
      const code = result.codeResult.code;
      document.getElementById('moveScanResult').textContent = `Scanned Code: ${code}`;
      document.getElementById('moveProductId').value = code;
      Quagga.stop();
      stopMoveScanner();
    });
  } catch (err) {
    console.error('Error accessing camera:', err);
    alert('Error accessing camera: ' + err.message);
  }
}

function stopMoveScanner() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    document.getElementById('moveVideo').srcObject = null;
    document.getElementById('moveVideo').classList.add('hidden');
    document.getElementById('moveScanResult').textContent = '';
  }
  Quagga.stop();
}

async function startUpdateScanner() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera access not supported by this browser.');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('updateVideo');
    video.srcObject = stream;
    video.classList.remove('hidden');
    video.play();
    Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: video,
        constraints: { facingMode: 'environment' }
      },
      decoder: { readers: ['code_128_reader', 'qrcode_reader'] }
    }, function(err) {
      if (err) {
        console.error('Error initializing scanner:', err);
        alert('Error initializing scanner: ' + err.message);
        return;
      }
      Quagga.start();
    });
    Quagga.onDetected(function(result) {
      const code = result.codeResult.code;
      document.getElementById('updateScanResult').textContent = `Scanned Code: ${code}`;
      addBatchEntry();
      document.getElementById(`batch-${batchUpdates.length - 1}-id`).value = code;
      Quagga.stop();
      stopUpdateScanner();
    });
  } catch (err) {
    console.error('Error accessing camera:', err);
    alert('Error accessing camera: ' + err.message);
  }
}

function stopUpdateScanner() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    document.getElementById('updateVideo').srcObject = null;
    document.getElementById('updateVideo').classList.add('hidden');
    document.getElementById('updateScanResult').textContent = '';
  }
  Quagga.stop();
}

// Initialize and Bind Events
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded fired');
  initialDarkModeCheck(); // Apply dark mode preferences early

  try {
    await ensureQRCodeIsAvailable(); // Wait for QRCode to be ready
    // Initialize parts of the app that depend on QRCode
    // loadInventory will call applyAndRenderInventoryFilters, which calls updateInventoryTable
    loadInventory(); 
    
    // Other initializations that don't depend on QRCode can be here or remain
    loadSuppliers(); // This will also populate filterSupplier dropdown
    loadLocations(); // This will also populate filterLocation dropdown
    addBatchEntry(); 

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
  document.getElementById('addSupplierBtn').addEventListener('click', addSupplier);
  const addLocationBtn = document.getElementById('addLocationBtn');
  if (addLocationBtn) {
    addLocationBtn.addEventListener('click', addLocation);
  }

  // Inventory Filter Event Listeners
  const filterSupplierEl = document.getElementById('filterSupplier');
  const filterLocationEl = document.getElementById('filterLocation');
  const clearInventoryFiltersBtnEl = document.getElementById('clearInventoryFiltersBtn');

  if (filterSupplierEl) {
    filterSupplierEl.addEventListener('change', applyAndRenderInventoryFilters);
  }
  if (filterLocationEl) {
    filterLocationEl.addEventListener('change', applyAndRenderInventoryFilters);
  }
  if (clearInventoryFiltersBtnEl) {
    clearInventoryFiltersBtnEl.addEventListener('click', () => {
      if (filterSupplierEl) filterSupplierEl.value = '';
      if (filterLocationEl) filterLocationEl.value = '';
      applyAndRenderInventoryFilters();
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

  } catch (error) {
    console.error('Initialization failed:', error);
    // Optionally, display an error message to the user in the UI
    const body = document.querySelector('body');
    if (body) {
      const errorDiv = document.createElement('div');
      errorDiv.textContent = 'Critical error: QRCode library failed to load. Some features might not work. Please refresh or check your internet connection.';
      errorDiv.style.color = 'red';
      errorDiv.style.backgroundColor = 'white';
      errorDiv.style.padding = '10px';
      errorDiv.style.textAlign = 'center';
      errorDiv.style.border = '1px solid red';
      body.prepend(errorDiv);
    }
  }
});