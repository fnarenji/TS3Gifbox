/**
 *
 * Author: sknz
 * Purpose: Manages a rotation of GIF files on TeamSpeak (GFX Banner)
 * TODO:
 *  - Pipeline doesn't track temp files correctly in case of error
 *  - Replace the conversion pipeline with a producer/consumer model
 *
 **/

// Imports
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var Promise = require('bluebird');
require("console-stamp")(console,
        {
            pattern : "dd/mm/yyyy HH:MM:ss",
            label: false
        });

// Modules
var config = require('./config');
var TeamspeakClient = require('node-teamspeak');
var RotationLoop = require('./RotationLoop');
var MessageLoop = require('./MessageLoop');
var TimeoutLoop = require('./TimeoutLoop');


var main = async (function () {
    var client = new TeamspeakClient(config.SQ_SERVER, config.SQ_PORT);
    Promise.promisifyAll(client);

    client.on('error', function (err) {
        console.log('ERROR !');
        console.log(err);
    });

    client.on('closed', function () {
        console.log('Socket closed !');
        process.exit(1);
    });

    console.log('Logging in...');
    // Log in
    await (client.sendAsync('login',
                {
                    client_login_name: config.SQ_USER,
                    client_login_password: config.SQ_PASSWORD
                }));

    // Select virtualserver
    await (client.sendAsync('use', {sid: config.VIRTUAL_SERVER_ID}));

    // Change nickname
    await (client.sendAsync('clientupdate',
                {
                    client_nickname: config.BOT_NAME 
                }));

    await([ 
            // Launch message listener loop
            MessageLoop.runAsync(client),
            // Launch anti timeout loop
            TimeoutLoop.runAsync(client),
            // Launch gfx rotation
            RotationLoop.runAsync(client)
    ]);
});

main();
