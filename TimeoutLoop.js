var async = require('asyncawait/async');
var await = require('asyncawait/await');
var Promise = require('bluebird');

module.exports.runAsync = async (function (client) {
    for (;;) {
        await (client.sendAsync("version"));
        console.log("Pinging...");

        await (Promise.delay(60 * 1000));
    }
});
