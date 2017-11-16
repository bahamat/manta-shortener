var fs = require('fs');
var Readable = require('stream').Readable

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
    this.storagePath = '/' + process.env.MANTA_USER + '/stor/' +
        process.env.MANTA_DIR +
        '/manta-shortener.json';
}

MantaStorage.prototype.load = function _storageLoad(callback) {
    this.client.get(this.storagePath, function (err, stream) {
        if (err) {
            callback(err);
            return;
        }

        var data = '';

        stream.on('readable', function _mstreamReadable() {
            var chunk;
            while (chunk = stream.read()) {
                data += chunk.toString();
            }
        });

        stream.on('error', function _mstreamError(sErr) {
            callback(sErr);
        });

        stream.on('end', function _mstreamEnd() {
            try {
                callback(null, JSON.parse(data));
            } catch (ex) {
                callback(ex);
            }
        });
    });
};

MantaStorage.prototype.save = function _storageSave(data, callback) {
    var stream = new Readable();

    this.client.put(this.storagePath, stream, callback);
    stream.push(JSON.stringify(data));
    stream.push(null);
};

module.exports = {
    MantaStorage: MantaStorage
};
