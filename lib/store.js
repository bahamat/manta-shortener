/**
 * Store the information.
 */

var mantastore = require('./manta-store');

function Storage(opts) {
    this.backend = new mantastore.MantaStorage(opts);
}

Storage.prototype.load = function _storageLoad(callback) {
    this.backend.load(callback);
};

Storage.prototype.save = function _storageSave(data, callback) {
    this.backend.save(data, callback);
};

module.exports = {
    Storage: Storage
};
