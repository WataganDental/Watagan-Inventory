// Enhanced search functionality with fuzzy matching
export class SearchEngine {
    constructor() {
        this.searchIndex = new Map();
        this.stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    }

    // Build search index for products
    buildIndex(products) {
        this.searchIndex.clear();
        
        products.forEach(product => {
            const searchableText = [
                product.name,
                product.supplier,
                product.location,
                product.id
            ].join(' ').toLowerCase();

            const tokens = this.tokenize(searchableText);
            
            tokens.forEach(token => {
                if (!this.searchIndex.has(token)) {
                    this.searchIndex.set(token, new Set());
                }
                this.searchIndex.get(token).add(product.id);
            });
        });
    }

    tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 1 && !this.stopWords.has(token));
    }

    // Fuzzy search with scoring
    search(query, products, options = {}) {
        const {
            threshold = 0.3,
            maxResults = 50,
            fuzzyMatch = true
        } = options;

        if (!query || query.length < 2) {
            return products;
        }

        const queryTokens = this.tokenize(query);
        const scores = new Map();

        // Exact matches get highest score
        products.forEach(product => {
            let score = 0;
            const productText = [
                product.name,
                product.supplier,
                product.location,
                product.id
            ].join(' ').toLowerCase();

            // Exact phrase match
            if (productText.includes(query.toLowerCase())) {
                score += 10;
            }

            // Individual token matches
            queryTokens.forEach(token => {
                if (productText.includes(token)) {
                    score += 3;
                }

                // Fuzzy matching using Levenshtein distance
                if (fuzzyMatch) {
                    const productTokens = this.tokenize(productText);
                    productTokens.forEach(productToken => {
                        const distance = this.levenshteinDistance(token, productToken);
                        const similarity = 1 - (distance / Math.max(token.length, productToken.length));
                        
                        if (similarity > threshold) {
                            score += similarity * 2;
                        }
                    });
                }
            });

            if (score > 0) {
                scores.set(product.id, score);
            }
        });

        // Sort by score and return top results
        return products
            .filter(product => scores.has(product.id))
            .sort((a, b) => scores.get(b.id) - scores.get(a.id))
            .slice(0, maxResults);
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    // Search suggestions based on partial input
    getSuggestions(partialQuery, products, limit = 5) {
        if (!partialQuery || partialQuery.length < 2) {
            return [];
        }

        const suggestions = new Set();
        const query = partialQuery.toLowerCase();

        products.forEach(product => {
            [product.name, product.supplier, product.location].forEach(field => {
                if (field && field.toLowerCase().includes(query)) {
                    suggestions.add(field);
                }
            });
        });

        return Array.from(suggestions)
            .sort((a, b) => {
                // Prioritize suggestions that start with the query
                const aStarts = a.toLowerCase().startsWith(query);
                const bStarts = b.toLowerCase().startsWith(query);
                
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                // Then sort by length (shorter suggestions first)
                return a.length - b.length;
            })
            .slice(0, limit);
    }
}
