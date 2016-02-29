var config = require('./config');
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var Promise = require('bluebird');
var Pipeline = require('pipes-and-filters');
var ContentDisposition = require('content-disposition');
var ValidUrl = require('valid-url');
var fs = Promise.promisifyAll(require('fs'));
var Temp = Promise.promisifyAll(require('temp'));
var HttpReq = Promise.promisifyAll(require('httpreq'));
var fs = Promise.promisifyAll(require('fs-extra'));
var mmm = require('mmmagic');
var url = require('url');
var path = require('path');
var ConversionPipeline = require('./ConversionPipeline');

module.exports.handleAsync = async (function (data, client, selfId) {
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
    };

    await (messagePipeline.executeAsync(context));
});

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

    // File size is required in headers
    if (typeof contentLength === undefined) {
        console.log('File size couldn\'t be read !');

        await (context.answer('La taille du fichier n\'a pu être lue.'));

        return next(null, Pipeline.break);
    }

    // File size check
    if (contentLength > config.MAX_CONTENT_SIZE_BYTES) {
        console.log('File too big !');

        await (context.answer(
                    'Fichier trop gros (> '
                        + config.MAX_CONTENT_SIZE_BYTES + ') !'));

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

    // Accept videos and images
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

        // Run conversion
        var outputTempFile =
            await (ConversionPipeline.convertAsync(inputTempFile));

        // Get output file path from conversion pipeline 
        context.outputTempFile = outputTempFile;

        await (context.answer('Vidéo convertie.'));
        context.isVideo = true;
    } else {
        console.log("Unexpected mime type " + mimeType + "...");
        await (context.answer('Format de fichier non-supporté.'));
        return next(null, Pipeline.break);
    }

    next(null, context);
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

    // Final file is situated in GIFBOX folder, build path
    var outputFile = path.normalize(path.join(config.GIFBOX_FOLDER, outputFileName));

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

