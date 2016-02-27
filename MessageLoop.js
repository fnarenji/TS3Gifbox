var async = require('asyncawait/async');
var await = require('asyncawait/await');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var ValidUrl = require('valid-url');
var Temp = Promise.promisifyAll(require('temp'));
var HttpReq = Promise.promisifyAll(require('httpreq'));
var fs = Promise.promisifyAll(require('fs-extra'));
var mmm = require('mmmagic');
var ffmpeg = require('fluent-ffmpeg');
var url = require('url');
var path = require('path');
var ContentDisposition = require('content-disposition');
var Pipeline = require('pipes-and-filters');

// Regex that matches things like // [URL]blabla[/URL]
// blabla
// will give group 1 = blabla
const URL_TAG_REGEX  = /(?:^\[URL\])?(.*?)(?=(?:\[\/URL\]$|$))/; 
const EOL = require('os').EOL;

// Message handling pipeline
var messagePipeline = Promise.promisifyAll(Pipeline.create('Message pipeline'));

// Add filters to pipeline
messagePipeline.use(async(filterOthers));
messagePipeline.use(async(sendAcknowledgment));
messagePipeline.use(async(validateInput));
messagePipeline.use(async(fetch));
messagePipeline.use(async(validateData));
messagePipeline.use(async(convertData));
messagePipeline.use(async(add));
messagePipeline.use(async(cleanup));

// Video to gif conversion pipeline
var conversionPipeline = Promise.promisifyAll(
        Pipeline.create('Conversion pipeline'));

// Add filters to conversion pipeline
conversionPipeline.use(async (ffmpegPaletteGen));
conversionPipeline.use(async (ffmpegPaletteuse));

module.exports.runAsync = function (
        client,
        channelName,
        maxContentSizeBytes,
        gifboxFolder) {
    // Get information about self async
    var whoAmITask = client.sendAsync('whoami');

    // Search for gifbox channel
    var findChannelTask = client.sendAsync('channelfind',
            {
                pattern: channelName
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
    await([
            // Move self to gifbox channel
            client.sendAsync('clientmove',
                {
                    clid: selfId,
                    cid: gifboxChannelId
                }),
            setupNotifications (
                client,
                selfId,
                maxContentSizeBytes,
                gifboxFolder)
    ]);
}

function setupNotifications(client,
        selfId,
        maxContentSizeBytes,
        gifboxFolder) {
    return (async(function(client, selfId, maxContentSizeBytes, gifboxFolder) {
        // Register for private message notifications
        await (client.sendAsync('servernotifyregister',
                    {
                        event: 'textprivate'
                    }));

        console.log('Listening for messages...');

        client.onAsync('textmessage', async (function (data) {
            // Build context for pipeline
            var context = {
                data: data,
                selfId: selfId,
                answer: function (msg) {
                    return client.sendAsync('sendtextmessage',
                            {
                                targetmode: 1,
                                target: data.invokerid,
                                msg: msg
                            });
                },
                MAX_CONTENT_SIZE_BYTES: maxContentSizeBytes,
                GIFBOX_FOLDER: gifboxFolder
            };

            // Run pipeline
            await (messagePipeline.executeAsync(context));
        }));
    })) (client, selfId, maxContentSizeBytes, gifboxFolder);
}

function filterOthers(context, next) {
    var sender = context.data.invokerid;
    var target = context.data.target;

    if (sender !== context.selfId && target === context.selfId) {
        // If sent by someone else to me
        next(null, context);
    } else {
        // Otherwise, not my business
        next(null, Pipeline.break);
    }
}

function sendAcknowledgment(context, next) {
    // Send an ack
    await (context.answer('Bien reçu !'));
    next(null, context);
}

function validateInput(context, next) {
    var data = context.data;

    // Get user's message
    var msg = data.msg;
    console.log('Message: ' + msg);

    // Extract the content of the message
    var match = URL_TAG_REGEX.exec(msg);

    if (match !== null) {
        // Message contetnt
        var content = match[1];

        console.log('Message content: ' + content);

        // Check if message is well formed web uri
        if (ValidUrl.isWebUri(content)) {
            // Send OK message
            await (context.answer('Lien valide !'));

            // Add extracted uri to context
            context.uri = content;

            // Proceed with pipeline
            return next(null, context);
        } else {
            // If not, send error message to user
            // and abort pipeline
            await (context.answer('Lien invalide !'));
        }
    }

    next(null, Pipeline.break);
}

function fetch(context, next) {
    var uri = context.uri;    

    var options = {
        url: uri,
        method: 'HEAD',
        allowRedirects: true
    };

    // HEAD request,
    var headers = await (HttpReq.doRequestAsync(options)).headers;
    var contentLength = headers['content-length'];

    if (typeof contentLength === undefined) {
        console.log('File size couldn\'t be read !');

        await (context.answer('La taille du fichier n\'a pu être lue.'));

        return next(null, Pipeline.break);
    }

    if (contentLength > context.MAX_CONTENT_SIZE_BYTES) {
        console.log('File too big !');

        await (context.answer(
                    'Fichier trop gros (> '
                        + context.MAX_CONTENT_SIZE_BYTES + ') !'));

        return next(null, Pipeline.break);
    }

    // If we have content-disposition
    // The server might specify a filename, which we'd want to save
    if (typeof headers['content-disposition'] !== "undefined") {
        var disposition =
            ContentDisposition.parse(headers['content-disposition']);

        context.serverProvidedFileName = disposition.parameters.filename;
    }

    var tempFile = Temp.path('gifbox-');
    console.log(
            'Downloading to file '
            + tempFile
            + '...');

    // Download to the temp file
    console.log('Downloading ' + uri);

    try {
        await (HttpReq.downloadAsync(uri, tempFile));
        console.log('Done downloading !');
        // Send download ack to user
        await (context.answer('Téléchargé !'));
    } catch (e) {
        console.log('Download failed');
        await (context.answer(
                    'Une erreur est survenue pendant le téléchargement:' + EOL
                    + e.toString()));

        return next(null, Pipeline.break);
    }

    // Add info about temp file to context
    context.inputTempFile = tempFile;

    next(null, context);
}

function validateData(context, next) {
    var inputTempFile = context.inputTempFile;

    var magic = Promise.promisifyAll(
            new mmm.Magic(mmm.MAGIC_MIME_TYPE));

    // Get mime type of file
    var mimeType = await (magic.detectFileAsync(inputTempFile));

    if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/'))
    {
        console.log("Invalid file type...");
        await (context.answer('Format de fichier non-supporté.'));
        return next(null, Pipeline.break);
    }

    context.mimeType = mimeType;

    next(null, context);
}

function convertData(context, next) {
    var inputTempFile = context.inputTempFile;

    var mimeType = context.mimeType;

    // If it's an image, and not a gif
    if (mimeType.startsWith('image/')
            && mimeType !== 'image/gif') {
        console.log('Already an image, nothing to be done !');
        context.outputTempFile = inputTempFile;
        context.isVideo = false;

        // If its a video, or a gif
    } else if (mimeType.startsWith('video/')
            || mimeType === 'image/gif') {
        console.log('Got video. Converting.');
        context.answer('Conversion de la vidéo...');

        var conversionContext = {
            inputTempFile: inputTempFile,
            outputTempFile: '',
        };

        // Run pipeline
        conversionContext = await (
                conversionPipeline.executeAsync(conversionContext));

        // Get output file path from conversion pipeline context
        context.outputTempFile = conversionContext.outputTempFile;

        await (context.answer('Vidéo convertie.'));
        context.isVideo = true;
    } else {
        console.log("Unexpected mime type " + mimeType + "...");
        await (context.answer('Format de fichier non-supporté.'));
        return next(null, Pipeline.break);
    }

    next(null, context);
}

function ffmpegPaletteGen(context, next) {
    var tempFile = Temp.path(
            {
                prefix: 'gifbox-',
                suffix: '.png'
            });

    console.log(
            'FFmpeg step 1 will write to file '
            + tempFile
            + '...');

    await (new Promise(function (resolve, reject) {
        // Generate palette
        // FFmpeg params found on the interwebz
        ffmpeg(context.inputTempFile)
            .videoFilters('fps=10,scale=320:-1:flags=lanczos,palettegen')
            .on('end', resolve)
            .on('error', reject)
            .save(tempFile);
    }));

    console.log('FFmpeg step 1 done.');

    // Add palette path to context
    context.paletteTempFile = tempFile;

    next(null, context);
}

function ffmpegPaletteuse(context, next) {
    var tempFile = Temp.path(
            {
                prefix: 'gifbox-',
                suffix: '.gif'
            });

    console.log(
            'FFmpeg step 2 will write to file '
            + tempFile
            + '...');

    try {
        await (new Promise(function (resolve, reject) {
            // Generate palette
            // FFmpeg params found on the interwebz
            ffmpeg()
                .input(context.inputTempFile)
                .input(context.paletteTempFile)
                .complexFilter([
                        'fps=10,scale=640:-1:flags=lanczos[x];[x][1:v]paletteuse'
                ])
                .on('end', resolve)
                .on('error', reject)
                .save(tempFile);
        }));

        console.log('FFmpeg step 2 done.');

        // Add output path to context
        context.outputTempFile = tempFile;

        next(null, context);
    } finally {
        // Remove the palette file, as it was consumed already
        await (fs.unlinkAsync(context.paletteTempFile));
    }
}

function add(context, next) {

    // Parse the url
    var urlData = url.parse(context.uri);
    // Get everything that comes between / and ?
    var urlPathName = urlData.pathname;

    // Set outputFileName to that
    var outputFileName = urlPathName;

    // If the server had provided a file name
    if (context.hasOwnProperty('serverProvidedFileName') &&
            typeof context.serverProvidedFileName !== "undefined" &&
            // Check if not empty, not blank
            context.serverProvidedFileName.length != 0 && 
            context.serverProvidedFileName.trim()) {

        // Set as target
        outputFileName = context.serverProvidedFileName;
    }

    // Get file name
    var outputFileName = path.basename(outputFileName);

    // If its a video, it was converted to gif, replace extension
    if (context.isVideo) {
        outputFileName =
            // Remove current extension
            path.basename(outputFileName, path.extname(outputFileName))
            // Add gif extension
            + ".gif";
    }

    var outputFile = path.normalize(path.join(
                context.GIFBOX_FOLDER, outputFileName));

    console.log("Final file path: " + outputFile);
    console.log("From: " + context.outputTempFile);

    // Move file to final pos
    // Clobber = overwrite
    await (fs.moveAsync(context.outputTempFile, outputFile, {clobber: true}));

    console.log("File moved.");

    await (context.answer('Ajoutée à la collection :)'));

    next(null, context);
}

function cleanup(context, next) {
    try { await (fs.unlinkAsync(context.inputTempFile)); }
    catch (e) { }

    try { await (fs.unlinkAsync(context.outputTempFile)); }
    catch (e) { }

    console.log('Cleaned up !');
}

