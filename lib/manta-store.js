var fs = require('fs');
var Readable = require('stream').Readable;

// var assert = require('assert-plus');
var manta = require('manta');

function MantaStorage(opts) {
    // TODO: Use opts instead of process.env?
    this.client = manta.createClient({
        sign: manta.privateKeySigner({
            key: fs.readFileSync(process.env.MANTA_KEY_PATH, 'utf8'),
            keyId: process.env.MANTA_KEY_ID,
            user: process.env.MANTA_USER
        }),
        user: process.env.MANTA_USER,
        // subuser
        // role
        url: process.env.MANTA_URL
    });
    this.storageDir = '/' + process.env.MANTA_USER + '/stor/' +
        process.env.MANTA_DIR;
}

MantaStorage.prototype.getPath = function _storageLoadUrl(key) {
    var prefix = key.substr(0, 3);
    return this.storageDir + '/' + prefix + '/' + key;
};

MantaStorage.prototype.loadUrl = function _storageLoadUrl(key, callback) {
    var path = this.getPath(key);
    this.client.get(path, function (err, stream) {
        if (err) {
            callback(err);
            return;
        }

        var url = '';

        stream.on('readable', function _mstreamReadable() {
            var chunk = stream.read();
            while (chunk) {
                url += chunk.toString();
                chunk = stream.read();
            }
        });

        stream.on('error', function _mstreamError(sErr) {
            callback(sErr);
        });

        stream.on('end', function _mstreamEnd() {
            try {
                callback(null, url);
            } catch (ex) {
                callback(ex);
            }
        });
    });
};

MantaStorage.prototype.saveUrl = function _storageSaveUrl(key, url, callback) {
    var stream = new Readable();

    var path = this.getPath(key);
    this.client.put(path, stream, { mkdirs: true }, callback);
    stream.push(url);
    stream.push(null);
};

module.exports = {
    MantaStorage: MantaStorage
};
