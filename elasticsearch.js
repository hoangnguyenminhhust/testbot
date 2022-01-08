var elasticsearch = require('@elastic/elasticsearch');
require('dotenv').config()
var elastic = new elasticsearch.Client({
    node: "http://103.141.144.200:9200/khoso/sim",
    requestTimeout: 1000 * 60 * 60,
    keepAlive: false,
    // log: 'trace'
    log: [{
        type: 'stdio',
        levels: ['error'] // change these options
    }]
});

module.exports = elastic;