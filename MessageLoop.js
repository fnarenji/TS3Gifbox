var async = require('asyncawait/async');
var await = require('asyncawait/await');
var Promise = require('bluebird');
var config = require('./config');
var MessagePipeline = require('./MessagePipeline.js');

module.exports.runAsync = async (function (client) {
    // Get information about self async
    var whoAmITask = client.sendAsync('whoami');

    // Search for gifbox channel
    var findChannelTask = client.sendAsync('channelfind',
            {
                pattern: config.CHANNEL_NAME
            });

    // Wait for information about self & gifbox channel
    var responses = await ({
        findChannel: findChannelTask,
        whoAmI: whoAmITask
    });

    var gifboxChannelId = responses.findChannel.cid;
    var selfId = responses.whoAmI.client_id;

    console.log('Self client id: ' + selfId);
    console.log('Gifbox channel id: ' + gifboxChannelId);

    console.log('Moving to channel...');
    console.log('Listening for messages...');
    await([
            // Move self to gifbox channel
            client.sendAsync('clientmove',
                {
                    clid: selfId,
                    cid: gifboxChannelId
                }),
            client.sendAsync('servernotifyregister', { event: 'textprivate' }),
            client.onAsync('textmessage', async (function (data) {
                // Run pipeline
                await (MessagePipeline.handleAsync(data, client, selfId));
            }))
    ]);
});

