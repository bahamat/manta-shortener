#!/usr/bin/env node

var process = require('process');
var djb2 = require('djb2');

console.log(JSON.stringify(process.argv));

var salt = process.argv[3] || '';
var string = process.argv[2];
var buf = Buffer.from(djb2(string).toString());
var sbuf = Buffer.from(djb2(salt + string).toString());

console.log('unhashed: ' + salt + string);
console.log('unsalted: ' + buf.toString('base64').replace(/=+$/, ''));
console.log('salted:   ' + sbuf.toString('base64').replace(/=+$/, ''));
