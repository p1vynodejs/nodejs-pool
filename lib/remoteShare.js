"use strict";
const express = require('express');        // call express
const app = express();                 // define our app using express
const cluster = require('cluster');
const debug = require("debug")("remoteShare");
let concat = require('concat-stream');

let threadName = "";
let workerList = [];
if (cluster.isMaster) {
    threadName = "(Master) ";
} else {
    threadName = "(Worker " + cluster.worker.id + " - " + process.pid + ") ";
}

// Websocket Stuffs.
app.use(function(req, res, next){
    req.pipe(concat(function(data){
        req.body = data;
        next();
    }));
});

app.post('/leafApi', function (req, res) {
    try {
        let msgData = global.protos.WSData.decode(req.body);
        if (msgData.key !== global.config.api.authKey) {
            return res.status(403).end();
        }
        switch (msgData.msgType) {
            case global.protos.MESSAGETYPE.SHARE:
                global.database.storeShare(msgData.exInt, msgData.msg, function(data){
                    if (!data){
                        return res.status(400).end();
                    } else {
                        return res.json({'success': true});
                    }
                });
                break;
            case global.protos.MESSAGETYPE.BLOCK:
                global.database.storeBlock(msgData.exInt, msgData.msg, function(data){
                    if (!data){
                        return res.status(400).end();
                    } else {
                        return res.json({'success': true});
                    }
                });
                break;
            case global.protos.MESSAGETYPE.INVALIDSHARE:
                global.database.storeInvalidShare(msgData.msg, function(data){
                    if (!data){
                        return res.status(400).end();
                    } else {
                        return res.json({'success': true});
                    }
                });
                break;
            default:
                return res.status(400).end();
        }
    } catch (e) {
        console.log("Invalid WS frame");
        return res.status(400).end();
    }
});

if (cluster.isMaster) {
    let numWorkers = require('os').cpus().length;
    console.log('Master cluster setting up ' + numWorkers + ' workers...');

    for (let i = 0; i < numWorkers; i++) {
        let worker = cluster.fork();
        workerList.push(worker);
    }

    cluster.on('online', function (worker) {
        console.log('Worker ' + worker.process.pid + ' is online');
    });

    cluster.on('exit', function (worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
        console.log('Starting a new worker');
        worker = cluster.fork();
        workerList.push(worker);
    });
} else {
    app.listen(8000, function () {
        console.log('Process ' + process.pid + ' is listening to all incoming requests');
    });
}