// Inventory management module
export class InventoryManager {
    constructor(db, storage) {
        this.db = db;
        this.storage = storage;
        this.inventory = [];
        this.currentPage = 1;
        this.itemsPerPage = 25;
    }

    async loadInventory() {
        try {
            console.log('Fetching inventory from Firestore...');
            const inventorySnapshot = await this.db.collection('inventory').get();
            this.inventory = inventorySnapshot.docs.map(doc => doc.data());
            console.log('Inventory loaded:', this.inventory.length, 'items');
            return this.inventory;
        } catch (error) {
            console.error('Error loading inventory:', error);
            throw error;
        }
    }

    async addProduct(productData) {
        try {
            const id = productData.id || this.generateUUID();
            await this.db.collection('inventory').doc(id).set({
                ...productData,
                id,
                name_lowercase: productData.name.toLowerCase(),
                name_words_lc: productData.name.toLowerCase().split(' ').filter(word => word.length > 0)
            });
            return id;
        } catch (error) {
            console.error('Error adding product:', error);
            throw error;
        }
    }

    async updateProduct(id, updates) {
        try {
            await this.db.collection('inventory').doc(id).update(updates);
        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    }

    async deleteProduct(id) {
        try {
            await this.db.collection('inventory').doc(id).delete();
            // Also delete photo if exists
            try {
                await this.storage.ref(`products/${id}.jpg`).delete();
            } catch (photoError) {
                console.log('No photo to delete or error deleting photo:', photoError);
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            throw error;
        }
    }

    generateUUID() {
        return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    filterInventory(filters) {
        let filtered = [...this.inventory];
        
        if (filters.supplier) {
            filtered = filtered.filter(item => item.supplier === filters.supplier);
        }
        
        if (filters.location) {
            filtered = filtered.filter(item => item.location === filters.location);
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filtered = filtered.filter(item => 
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.id && item.id.toLowerCase().includes(searchTerm)) ||
                (item.supplier && item.supplier.toLowerCase().includes(searchTerm))
            );
        }
        
        return filtered;
    }

    getPagedResults(filteredItems) {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return filteredItems.slice(startIndex, endIndex);
    }
}
