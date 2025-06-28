// Error handling and notification system
export class NotificationManager {
    constructor() {
        if (typeof document !== 'undefined') {
            this.createNotificationContainer();
        }
    }

    createNotificationContainer() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('notification-container')) return;

        const container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(container);
    }

    show(message, type = 'info', duration = 5000) {
        if (typeof document === 'undefined') {
            // In Node.js environment, just log to console
            console.log(`[${type.toUpperCase()}] ${message}`);
            return { message, type };
        }
        
        const notification = this.createNotification(message, type);
        const container = document.getElementById('notification-container');
        container.appendChild(notification);

        // Auto-remove after duration
        setTimeout(() => {
            this.remove(notification);
        }, duration);

        return notification;
    }

    createNotification(message, type) {
        if (typeof document === 'undefined') {
            // Return a mock notification object for Node.js
            return { message, type, innerHTML: message };
        }
        
        const notification = document.createElement('div');
        notification.className = `
            max-w-md p-4 rounded-lg shadow-lg transform transition-all duration-300
            ${this.getTypeClasses(type)}
        `;

        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <div class="shrink-0">
                        ${this.getIcon(type)}
                    </div>
                    <div class="ml-3">
                        <p class="text-sm font-medium">${message}</p>
                    </div>
                </div>
                <button class="ml-4 shrink-0 text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `;

        return notification;
    }

    getTypeClasses(type) {
        const classes = {
            success: 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-200',
            error: 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200',
            warning: 'bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200',
            info: 'bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200'
        };
        return classes[type] || classes.info;
    }

    getIcon(type) {
        const icons = {
            success: `<svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>`,
            error: `<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            </svg>`,
            warning: `<svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>`,
            info: `<svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
            </svg>`
        };
        return icons[type] || icons.info;
    }

    remove(notification) {
        if (notification && notification.parentNode) {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Enhanced error handling utilities
export class ErrorHandler {
    static async withErrorHandling(operation, context = 'Operation') {
        try {
            return await operation();
        } catch (error) {
            console.error(`${context} failed:`, error);
            
            // Parse Firebase errors for user-friendly messages
            const userMessage = this.parseFirebaseError(error);
            
            if (window.notificationManager) {
                window.notificationManager.error(userMessage);
            } else {
                alert(userMessage);
            }
            
            throw error;
        }
    }

    static parseFirebaseError(error) {
        const errorMappings = {
            'permission-denied': 'You do not have permission to perform this action.',
            'unauthenticated': 'Please log in to continue.',
            'not-found': 'The requested item was not found.',
            'already-exists': 'This item already exists.',
            'resource-exhausted': 'Service temporarily unavailable. Please try again later.',
            'unavailable': 'Service temporarily unavailable. Please try again later.',
            'deadline-exceeded': 'Request timed out. Please try again.',
            'invalid-argument': 'Invalid data provided. Please check your input.',
            'failed-precondition': 'Operation cannot be completed at this time.'
        };

        if (error.code && errorMappings[error.code]) {
            return errorMappings[error.code];
        }

        // Handle network errors
        if (error.message?.includes('network') || error.code === 'unavailable') {
            return 'Network error. Please check your connection and try again.';
        }

        // Default message
        return error.message || 'An unexpected error occurred. Please try again.';
    }
}
