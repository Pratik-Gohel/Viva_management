// Configuration for API URLs based on deployment mode
const config = {
    getApiBaseUrl: function() {
        // Check if we're running locally
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return isLocal ? 'http://localhost:3000' : '';
    }
};

// Freeze the configuration to prevent modifications
Object.freeze(config);
