var async = require('asyncawait/async');
var await = require('asyncawait/await');
var Promise = require('bluebird');

module.exports.runAsync = function (client) {
    for (;;) {
        await (client.sendAsync("version"));

        await (Promise.delay(10 * 60 * 1000));
    }
}
