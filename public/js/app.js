let stream = null;
let photoStream = null;
let inventory = [];
let suppliers = [];
let batchUpdates = [];
let db; // Declare db globally
let storage; // Declare storage globally

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
    li.innerHTML = `${supplier} <button data-supplier="${supplier}" class="deleteSupplierBtn text-red-500 hover:text-red-700">Delete</button>`;
    supplierList.appendChild(li);
  });
  console.log('Supplier list updated, items:', supplierList.children.length);
  document.querySelectorAll('.deleteSupplierBtn').forEach(button => {
    button.addEventListener('click', () => deleteSupplier(button.getAttribute('data-supplier')));
  });
}

function updateSupplierDropdown() {
  const supplierDropdown = document.getElementById('productSupplier');
  console.log('Updating supplier dropdown with:', suppliers);
  supplierDropdown.innerHTML = '<option value="">Select Supplier</option>';
  suppliers.forEach(supplier => {
    const option = document.createElement('option');
    option.value = supplier;
    option.textContent = supplier;
    supplierDropdown.appendChild(option);
  });
  console.log('Supplier dropdown updated, options:', supplierDropdown.options.length);
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
  entryDiv.className = 'flex gap-2 items-center';
  entryDiv.innerHTML = `
    <input id="${entryId}-id" type="text" placeholder="Product ID (from scan)" class="border p-2 rounded flex-1">
    <input id="${entryId}-quantity" type="number" placeholder="Quantity" class="border p-2 rounded w-24">
    <select id="${entryId}-action" class="border p-2 rounded w-32">
      <option value="add">Add</option>
      <option value="remove">Remove</option>
    </select>
    <button data-entry-id="${entryId}" class="removeBatchEntryBtn text-red-500 hover:text-red-700">Remove</button>
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
    updateInventoryTable();
  } catch (error) {
    console.error('Error loading inventory:', error);
    alert('Failed to load inventory: ' + error.message);
  }
}

function updateInventoryTable() {
  const tableBody = document.getElementById('inventoryTable');
  console.log('Updating inventory table with:', inventory);
  tableBody.innerHTML = '';
  inventory.forEach(item => {
    const row = document.createElement('tr');
    row.className = item.quantity <= item.minQuantity ? 'bg-red-100' : '';
    row.innerHTML = `
      <td class="border p-2">${item.id}</td>
      <td class="border p-2">${item.name}</td>
      <td class="border p-2">${item.quantity}</td>
      <td class="border p-2">${item.minQuantity}</td>
      <td class="border p-2">${item.cost.toFixed(2)}</td>
      <td class="border p-2">${item.supplier}</td>
      <td class="border p-2">${item.location}</td>
      <td class="border p-2">${item.photo ? `<img src="${item.photo}" class="w-16 h-16 object-cover mx-auto" alt="Product Photo">` : 'No Photo'}</td>
      <td class="border p-2"><div id="qrcode-${item.id}" class="mx-auto w-24 h-24"></div></td>
      <td class="border p-2">
        <button data-id="${item.id}" class="editProductBtn text-blue-500 hover:text-blue-700 mr-2">Edit</button>
        <button data-id="${item.id}" class="deleteProductBtn text-red-500 hover:text-red-700">Delete</button>
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
      qrCodeDiv.innerHTML = `<p class="text-red-500">QR Code generation failed: ${error.message}</p>`;
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
    row.innerHTML = `
      <td class="border p-2">${item.id}</td>
      <td class="border p-2">${item.name}</td>
      <td class="border p-2">${item.quantity}</td>
      <td class="border p-2">${item.minQuantity}</td>
      <td class="border p-2">${item.supplier}</td>
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
    const snapshot = await db.collection('inventory').get();
    const products = snapshot.docs.map(doc => doc.data());
    if (products.length === 0) {
      alert('No products in inventory to generate QR codes for.');
      return;
    }

    const doc = new JsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    // A4 dimensions: 595.28 x 841.89 pt
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 40; // Margin around the page
    const qrSize = 113.39; // ~40mm at 72 DPI
    const qrSpacing = 20; // Space between QR codes
    const textHeight = 20; // Space for product name
    const cellWidth = (pageWidth - 2 * margin - 3 * qrSpacing) / 4; // 4 columns
    const cellHeight = qrSize + textHeight + 10; // QR code + text + padding
    const cols = 4;
    const rows = 6;

    doc.setFontSize(16);
    doc.text('Watagan Dental QR Codes', margin, 30);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 50);

    let x, y, productIndex = 0;

    for (let i = 0; productIndex < products.length; i++) {
      if (i > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text(`Watagan Dental QR Codes (Page ${i + 1})`, margin, 30);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 50);
      }

      for (let row = 0; row < rows && productIndex < products.length; row++) {
        for (let col = 0; col < cols && productIndex < products.length; col++) {
          const product = products[productIndex];
          if (!product.id || !product.name) {
            console.warn('Invalid product data at index', productIndex, product);
            productIndex++;
            continue;
          }

          x = margin + col * (qrSize + qrSpacing);
          y = margin + 60 + row * cellHeight;

          // Create a temporary canvas for QR code
          const canvas = document.createElement('canvas');
          canvas.width = qrSize;
          canvas.height = qrSize;
          const qrCode = new window.QRCode(canvas, {
            text: product.id,
            width: qrSize,
            height: qrSize,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.L
          });

          // Add QR code to PDF
          const qrImage = canvas.toDataURL('image/png');
          doc.addImage(qrImage, 'PNG', x, y, qrSize, qrSize);

          // Add product name below QR code
          doc.setFontSize(10);
          const textWidth = doc.getTextWidth(product.name);
          const textX = x + (qrSize - textWidth) / 2; // Center text
          doc.text(product.name, textX, y + qrSize + 15);

          productIndex++;
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
    const JsPDF = await waitForJsPDF();
    const snapshot = await db.collection('inventory').get();
    const toOrderItems = snapshot.docs.map(doc => doc.data()).filter(item => item.quantity <= item.minQuantity);
    if (toOrderItems.length === 0) {
      alert('No products need reordering.');
      return;
    }

    const doc = new JsPDF();
    doc.setFontSize(16);
    doc.text('Watagan Dental Order Report', 10, 10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 20);

    let y = 30;
    doc.text('ID | Name | Quantity | Min Quantity | Supplier', 10, y);
    y += 10;
    doc.line(10, y, 200, y);
    y += 10;

    toOrderItems.forEach(item => {
      doc.text(`${item.id} | ${item.name} | ${item.quantity} | ${item.minQuantity} | ${item.supplier}`, 10, y);
      y += 10;
    });

    doc.save('Watagan_Dental_Order_Report.pdf');
  } catch (error) {
    console.error('Failed to generate Order Report PDF:', error, error.stack);
    alert('Failed to generate Order Report PDF: ' + error.message);
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
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired');
  console.log('Button element:', document.getElementById('generateQRCodePDFBtn'));

  loadSuppliers();
  loadInventory();
  addBatchEntry();

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
  document.getElementById('generateOrderReportBtn').addEventListener('click', generateOrderReport);
  document.getElementById('emailOrderReportBtn').addEventListener('click', emailOrderReport);

  const qrCodePDFBtn = document.getElementById('generateQRCodePDFBtn');
  if (qrCodePDFBtn) {
    qrCodePDFBtn.addEventListener('click', generateQRCodePDF);
  } else {
    console.warn('QR Code PDF button not found in DOM');
  }
});