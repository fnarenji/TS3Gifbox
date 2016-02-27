/**
 *
 * Author: sknz
 * Purpose: Manages a rotation of GIF files on TeamSpeak (GFX Banner)
 * TODO:
 *  - Pipeline doesn't track temp files correctly in case of error
 *
 **/

// Imports
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var Promise = require('bluebird');
var TeamspeakClient = require('node-teamspeak');
var RotationLoop = require('./RotationLoop');
var MessageLoop = require('./MessageLoop');
var config = require('./config');

var main = async (function () {
    var client = new TeamspeakClient(config.SQ_SERVER, config.SQ_PORT);
    Promise.promisifyAll(client);

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
            MessageLoop.runAsync(client,
                config.CHANNEL_NAME,
                config.MAX_CONTENT_SIZE_BYTES,
                config.GIFBOX_FOLDER),
            // Launch gfx rotation
            RotationLoop.runAsync(client,
                config.GIFBOX_URI,
                config.GIFBOX_FOLDER,
                config.ROTATION_INTERVAL_MS)
    ]);
});

main();
