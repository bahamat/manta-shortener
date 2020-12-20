#!/usr/bin/env node --abort-on-uncaught-exception

'use strict';

var bunyan = require('bunyan');
var crypto = require('crypto');
var errs = require('restify-errors');
var forwarded = require('forwarded-parse');
var restify = require('restify');
var errors = require('restify-errors');

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

var hash = function (s) {
    var sha = crypto.createHash('sha1');
    var sum;
    sha.update(conf.salt + s);
    sum = sha.digest('hex');
    return (sum.substr(0,16));
}

var ping = function (req, res, next) {
    res.send({ping: "pong"});
    return next();
};

var shorten = function (req, res, next) {
    var url = req.params.url;
    var key = hash(url);
    var proto = 'http';
    var link;

    if (url == undefined) {
        res.send(new errors.BadRequestError('No URL provided'));
        return;
    }

    if (typeof req.headers.forwarded !== 'undefined') {
        proto = forwarded(req.headers.forwarded)[0].proto;
    } else if (req.isSecure()) {
        proto == 'https';
    }

    log.trace({body: req.body, params: req.params}, 'request received');
    data[key] = url;
    log.trace({data: data}, 'All the urls now');
    link = proto + '://' + req.headers.host + '/' + key;
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
server.get({path: '/--ping', version: '1.0.0'}, ping);
server.post({path: '/', version: '1.0.0'}, validateUrl, shorten, saveUrl);
server.get({path: '/s', version: '1.0.0'}, shorten, saveUrl);
server.get({path: '/:key', version: '1.0.0'}, validateKey, loadUrl, expand);

server.listen(8080, '::', function () {
    log.info('%s listening at %s', server.name, server.url);
});
