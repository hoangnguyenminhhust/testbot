#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
const {
    executeNextJob
} = require('./index')
require('dotenv').config()

var elasticsearch = require('@elastic/elasticsearch');
var elastic = new elasticsearch.Client({
    node: process.env.DB_ES,
    requestTimeout: 1000 * 60 * 60,
    keepAlive: false,
    // log: 'trace'
    log: [{
        type: 'stdio',
        levels: ['error'] // change these options
    }]
});
console.log(elastic)
const mongoose = require('mongoose');

const connectionString = `mongodb://${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_NAME}`;
const options = {
    keepAlive: 1,
    connectTimeoutMS: 30000,
    // reconnectTries: Number.MAX_VALUE,
    // reconnectInterval: 1000,
    autoIndex: false,
    useNewUrlParser: true,
    useUnifiedTopology: true
};
options.user = process.env.MONGO_USER
options.pass = process.env.MONGO_PASS
options.auth = {
    authdb: process.env.MONGO_NAME
}


mongoose.connect(connectionString, options, error => {
    if (error) {
        console.log("Mongo not connected to: ", process.env.MONGO_NAME);
    } else {
        console.log("Mongo connected to: ", process.env.MONGO_NAME);
    }
});

amqp.connect('amqp://admin:Appsim2020@103.141.144.199:5672', function (error0, connection) {
    if (error0) {
        throw error0;
    }
    connection.createChannel(async function (error1, channel) {
        if (error1) {
            throw error1;
        }
        var queue = 'job-deletesim';

        channel.assertQueue(queue, {
            durable: true
        });
        channel.prefetch(1);
        console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queue);
        channel.consume(queue, async function (msg) {
            console.log(" [x] Received %s");
            const job = JSON.parse(msg.content.toString())
            await executeNextJob(job)
            channel.ack(msg);
        }, {
            noAck: false
        });

    });
});