/**
 * Store the information.
 */

var mantastore = require('./manta-store');

function Storage(opts) {
    this.backend = new mantastore.MantaStorage(opts);
}

Storage.prototype.loadUrl = function _storageLoadUrl(key, callback) {
    this.backend.loadUrl(key, callback);
};

Storage.prototype.saveUrl = function _storageSaveUrl(key, data, callback) {
    this.backend.saveUrl(key, data, callback);
};

module.exports = {
    Storage: Storage
};
