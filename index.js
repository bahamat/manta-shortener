#!/usr/bin/env node --abort-on-uncaught-exception

// Q: Why is djb2 a strong hash?
// A: https://crypto.stackexchange.com/questions/18340/reversing-djb2-hashes

'use strict';

var bunyan = require('bunyan');
var djb2 = require('djb2');
var errs = require('restify-errors');
var restify = require('restify');

var store = require('./lib/store');

var log = bunyan.createLogger({
    name: 'shortener',
    src: true,
    level: 'trace',
    serializers: bunyan.stdSerializers
});

var data = {};

var USE_MANTA_BACKEND = false;

var storage;
if (USE_MANTA_BACKEND) {
    storage = new store.Storage();
}

var hash = function (s) {
    var salt = 'blarg';
    // var buf = Buffer.from(djb2(salt + s).toString());
    // return(buf.toString('base64'));
    // return(buf.toString('base64').replace(/=+$/, ''));
    return ((djb2(salt + s) >>> 0).toString());
};

var shorten = function (req, res, next) {
    var url = req.params.url;
    var key = hash(url);

    log.trace({body: req.body, params: req.params}, 'request received');
    data[key] = url;
    log.trace({data: data}, 'All the urls now');
    res.send({url: url, link: req.isSecure() ? 'https' : 'http'  + '://' + req.headers.host
        + '/' + key});
    return next();
};

var expand = function (req, res, next) {
    log.trace({params: req.params}, 'Expand request received');
    if (data[req.params.key] === undefined) {
        return next(new errs.NotFoundError('%s does not refer to a URL', req.params.key));
    } else if (req.params.preview === 'true') {
        res.send({location: data[req.params.key]});
    } else {
        return res.redirect(data[req.params.key], next);
    }
    return next();
};

var save = function (req, res, next) {
    if (USE_MANTA_BACKEND) {
        storage.save(data, next);
    } else {
        next();
    }
};

var server = restify.createServer({
    log: log,
});

server.use(restify.plugins.bodyParser({mapParams: true}));
server.use(restify.plugins.queryParser({mapParams: true}));

server.get({path: '/', version: '1.0.0'}, restify.plugins.serveStatic({
    directory: 'html',
    default: 'index.html'
}));
server.post({path: '/', version: '1.0.0'}, shorten, save);
server.get({path: '/s', version: '1.0.0'}, shorten, save);
server.get({path: '/:key', version: '1.0.0'}, expand);

function listen() {
    server.listen(8080, '::', function () {
        log.info('%s listening at %s', server.name, server.url);
    });
}

if (USE_MANTA_BACKEND) {
    storage.load(function (err, storedData) {
        if (err) {
            throw err;
        }

        data = storedData;
        listen();
    });
} else {
    listen();
}
