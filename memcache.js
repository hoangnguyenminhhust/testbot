const Memcached = require('memcached');
const memcached = new Memcached('127.0.0.1:11211', { remove: true });
memcached.connectionIssue("Server down", function(err) {
    console.log(err);
});

const delMemcache = key => {
    return new Promise((rev, rej) => {
        memcached.del(key, function(err) {
            if (err) return rev(false);
            return rev(true);
        });
    });
};

module.exports = {
    delMemcache,
};