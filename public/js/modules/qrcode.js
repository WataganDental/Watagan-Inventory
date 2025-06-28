// QR Code and Barcode Scanner utility module
export class QRCodeManager {
    constructor() {
        this.isQRCodeLibraryLoaded = false;
        this.isJsQRLoaded = false;
    }

    async ensureQRCodeLibrary() {
        if (this.isQRCodeLibraryLoaded && typeof window.QRCode === 'function') {
            return window.QRCode;
        }

        if (typeof window.QRCode === 'function') {
            this.isQRCodeLibraryLoaded = true;
            return window.QRCode;
        }

        // Load QRCode library if not available
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
            script.onload = () => {
                this.isQRCodeLibraryLoaded = true;
                resolve(window.QRCode);
            };
            script.onerror = () => reject(new Error('Failed to load QRCode library'));
            document.head.appendChild(script);
        });
    }

    async ensureJsQRLibrary() {
        if (this.isJsQRLoaded && (typeof window.jsQR === 'function' || typeof jsQR === 'function')) {
            return window.jsQR || jsQR;
        }

        // Load jsQR library if not available
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
            script.onload = () => {
                this.isJsQRLoaded = true;
                resolve(window.jsQR);
            };
            script.onerror = () => reject(new Error('Failed to load jsQR library'));
            document.head.appendChild(script);
        });
    }

    async generateQRCode(element, text, options = {}) {
        const QRCode = await this.ensureQRCodeLibrary();
        const defaultOptions = {
            width: 96,
            height: 96,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        };
        
        return new QRCode(element, {
            text,
            ...defaultOptions,
            ...options
        });
    }

    async generateQRCodeDataURL(text, options = {}) {
        const QRCode = await this.ensureQRCodeLibrary();
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        try {
            const qr = await this.generateQRCode(tempDiv, text, options);
            const canvas = tempDiv.querySelector('canvas');
            const dataURL = canvas ? canvas.toDataURL('image/png') : '';
            return dataURL;
        } finally {
            document.body.removeChild(tempDiv);
        }
    }

    createBarcodeScanner(videoElement, onScan, onError) {
        return new BarcodeScanner(videoElement, onScan, onError, this);
    }
}

class BarcodeScanner {
    constructor(videoElement, onScan, onError, qrManager) {
        this.video = videoElement;
        this.onScan = onScan;
        this.onError = onError;
        this.qrManager = qrManager;
        this.stream = null;
        this.animationId = null;
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    async start() {
        try {
            const jsQR = await this.qrManager.ensureJsQRLibrary();
            
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            
            this.video.srcObject = this.stream;
            this.video.setAttribute('playsinline', true);
            this.video.play();
            
            this.animationId = requestAnimationFrame(() => this.scanFrame(jsQR));
            
        } catch (error) {
            console.error('Error starting barcode scanner:', error);
            this.onError(error);
        }
    }

    scanFrame(jsQR) {
        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            this.canvas.height = this.video.videoHeight;
            this.canvas.width = this.video.videoWidth;
            this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
            });

            if (code) {
                this.onScan(code.data);
                return;
            }
        }
        
        this.animationId = requestAnimationFrame(() => this.scanFrame(jsQR));
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.video) {
            this.video.srcObject = null;
        }
    }
}
