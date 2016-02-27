var async = require('asyncawait/async');
var await = require('asyncawait/await');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));

module.exports.runAsync = function (client, uri, folder, interval) {
    var fileIndex = 0;

    for (;;) {
        // List all files in target folder
        var files = await (fs.readdirAsync(folder));

        if (fileIndex >= files.length) {
            fileIndex = 0;
            console.log("Rotation complete, restarting from 0.");
        }

        var fileName = files[fileIndex];

        var gifUri = uri + fileName;

        console.log("Changing to GFX " + fileIndex + " (" + fileName + ").");
        console.log("New GFX uri: " + gifUri);

        await (client.sendAsync("serveredit",
                    {
                        virtualserver_hostbanner_gfx_url: gifUri
                    }));

        fileIndex++;

        await (Promise.delay(interval));
    }
}
