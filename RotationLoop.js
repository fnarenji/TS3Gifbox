var async = require('asyncawait/async');
var await = require('asyncawait/await');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var config = require('./config');

module.exports.runAsync = async (function (client) {
    var fileIndex = 0;

    for (;;) {
        // List all files in target folder
        var files = await (fs.readdirAsync(config.GIFBOX_FOLDER));

        if (fileIndex >= files.length) {
            fileIndex = 0;
            console.log("Rotation complete, restarting from 0.");
        }

        var fileName = files[fileIndex];

        var uri = config.GIFBOX_URI + fileName;

        console.log("Changing to GFX " + fileIndex + " (" + fileName + ").");
        console.log("New GFX uri: " + uri);

        await (client.sendAsync("serveredit",
                    {
                        virtualserver_hostbanner_gfx_url: uri
                    }));

        fileIndex++;

        await (Promise.delay(config.ROTATION_INTERVAL_MS));
    }
});
