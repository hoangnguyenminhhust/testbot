var elasticsearch = require('@elastic/elasticsearch');
var elastic = new elasticsearch.Client({
    node: "http://10.91.1.6:9200/khoso/sim",
    requestTimeout: 1000 * 60 * 60,
    keepAlive: false,
    // log: 'trace'
    log: [{
        type: 'stdio',
        levels: ['error'] // change these options
    }]
});

module.exports = elastic;