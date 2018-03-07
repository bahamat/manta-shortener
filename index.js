#!/usr/bin/env node --abort-on-uncaught-exception

// Q: Why is djb2 a strong hash?
// A: https://crypto.stackexchange.com/questions/18340/reversing-djb2-hashes

'use strict';

var bunyan = require('bunyan');
var djb2 = require('djb2');
var errs = require('restify-errors');
var restify = require('restify');

var store = require('./lib/store');
var conf = require('./config');

var log = bunyan.createLogger({
    name: 'shortener',
    src: true,
    level: 'trace',
    serializers: bunyan.stdSerializers
});

var data = {};

var USE_MANTA_BACKEND = false;

var storage;

var validateConfig = function (conf) {
    var requiredKeys = [
        "MANTA_USER",
        "MANTA_KEY_ID",
        "MANTA_KEY_PATH",
        "MANTA_URL",
        "MANTA_DIR",
        "salt"
    ];
    var missingKeys = [];

    conf.MANTA_USER = conf.MANTA_USER || process.env.MANTA_USER;
    conf.MANTA_SUBUSER = conf.MANTA_SUBUSER || process.env.MANTA_SUBUSER;
    conf.MANTA_KEY_ID = conf.MANTA_KEY_ID || process.env.MANTA_KEY_ID;
    conf.MANTA_KEY_PATH = conf.MANTA_KEY_PATH || process.env.MANTA_KEY_PATH;
    conf.MANTA_ROLE = conf.MANTA_ROLE || process.env.MANTA_ROLE;
    conf.MANTA_URL = conf.MANTA_URL || process.env.MANTA_URL;
    conf.MANTA_DIR = conf.MANTA_DIR || process.env.MANTA_DIR;

    USE_MANTA_BACKEND = conf.USE_MANTA_BACKEND || USE_MANTA_BACKEND;

    if (USE_MANTA_BACKEND) {
        requiredKeys.forEach(function (item) {
            if (conf[item] === undefined) {
                missingKeys.push(item);
            }
        });
        if (missingKeys.length > 0) {
            log.error({conf: conf, missing: missingKeys}, 'Exiting due to missing config');
            process.exit(1);
        }
    }
    log.info({conf: conf, useManta: USE_MANTA_BACKEND}, 'Configuration');
};

var unsign = function (i) {
    // Convert a signed 32-bit negative integer to unsigned.
    if (i < 0) {
        // Add Math.pow(2,32)
        i += 4294967296;
    }
    return i;
};

var hash = function (s) {
    // var buf = Buffer.from(djb2(salt + s).toString());
    // return(buf.toString('base64'));
    // return(buf.toString('base64').replace(/=+$/, ''));
    return (unsign(djb2(conf.salt + s)).toString());
};

var shorten = function (req, res, next) {
    var url = req.params.url;
    var key = hash(url);

    log.trace({body: req.body, params: req.params}, 'request received');
    data[key] = url;
    log.trace({data: data}, 'All the urls now');
    var link = req.isSecure() ? 'https' : 'http'  + '://' + req.headers.host +
        '/' + key;
    res.send({url: url, link: link});
    req.key = key;
    return next();
};

var validateKey = function (req, res, next) {
    if (!req.params || !req.params.key) {
        return next(new errs.NotFoundError('no short url was provided'));
    }
    next();
};

var loadUrl = function (req, res, next) {
    if (!USE_MANTA_BACKEND) {
        return next();
    }

    var key = req.params.key;

    if (data[key] !== undefined) {
        next();
        return;
    }

    // Check if database has entry.
    storage.loadUrl(key, function (err, entry) {
        if (err) {
            next(err);
            return;
        }
        data[key] = entry;
        next();
    });
};

var validateUrl = function (req, res, next) {
    if (!req.params || !req.params.url) {
        return next(new errs.NotFoundError('no long url was provided'));
    }
    next();
};

var expand = function (req, res, next) {
    log.trace({params: req.params}, 'Expand request received');
    var key = req.params.key;
    var url = data[key];

    if (!url) {
        return next(new errs.NotFoundError('%s does not refer to a URL', key));
    } else if (req.params.preview === 'true') {
        res.send({location: url});
    } else {
        return res.redirect(url, next);
    }
    return next();
};

var saveUrl = function (req, res, next) {
    if (!USE_MANTA_BACKEND) {
        next();
        return;
    }

    storage.saveUrl(req.key, req.params.url, next);
};

var server = restify.createServer({
    log: log,
});

validateConfig(conf);

if (USE_MANTA_BACKEND) {
    storage = new store.Storage(conf);
}

server.use(restify.plugins.bodyParser({mapParams: true}));
server.use(restify.plugins.queryParser({mapParams: true}));

server.get({path: '/', version: '1.0.0'}, restify.plugins.serveStatic({
    directory: 'html',
    default: 'index.html'
}));
server.post({path: '/', version: '1.0.0'}, validateUrl, shorten, saveUrl);
server.get({path: '/s', version: '1.0.0'}, shorten, saveUrl);
server.get({path: '/:key', version: '1.0.0'}, validateKey, loadUrl, expand);

server.listen(8080, '::', function () {
    log.info('%s listening at %s', server.name, server.url);
});
