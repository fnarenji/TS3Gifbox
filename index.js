const SQ_USER = '';
const SQ_PASSWORD = '';
const CHANNEL_NAME = 'Gifbox';
const GIFBOX_FOLDER = '';
const GIFBOX_URI = '';
const EOL = require('os').EOL;
const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10 Mo in bytes

// Regex that matches things like // [URL]blabla[/URL]
// blabla
// will give group 1 = blabla
const URL_TAG_REGEX  = /(?:^\[URL\])?(.*?)(?=(?:\[\/URL\]$|$))/; 

// Imports
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var Promise = require('bluebird');
var TeamspeakClient = require('node-teamspeak');
var Pipeline = require('pipes-and-filters');
var ValidUrl = require('valid-url');
var Temp = Promise.promisifyAll(require('temp'));
var HttpReq = Promise.promisifyAll(require('httpreq'));
var fs = Promise.promisifyAll(require('fs-extra'));
var mmm = require('mmmagic');
var ffmpeg = require('fluent-ffmpeg');
var url = require('url');
var path = require('path');
var contentDisposition = require('content-disposition');

// Video to gif conversion pipeline
var conversionPipeline = Promise.promisifyAll(
        Pipeline.create('Conversion pipeline'));

var main = async (function () {
    var client = new TeamspeakClient('127.0.0.1', '10011');
    Promise.promisifyAll(client);

    console.log('Logging in...');
    // Log in
    await (client.sendAsync('login',
                {
                    client_login_name: SQ_USER,
                    client_login_password: SQ_PASSWORD
                }));

    // Select virtualserver async
    var selectVirtualServerTask = client.sendAsync('use', {sid: 1});

    // Get information about self async
    var whoAmITask = client.sendAsync('whoami');

    // Await virtual server selection
    await (selectVirtualServerTask);

    // Search for gifbox channel
    var findChannelTask = client.sendAsync('channelfind',
            {
                pattern: CHANNEL_NAME
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
            // Register for private message notifications
            client.sendAsync('servernotifyregister',
                {
                    event: 'textprivate'
                })
    ]);

    console.log('Building message handling pipeline...');

    // Message handling pipeline
    var pipeline = Promise.promisifyAll(Pipeline.create('Message pipeline'));

    // Add filters to pipeline
    pipeline.use(filterOthers);
    pipeline.use(sendAcknowledgment);
    pipeline.use(validateInput);
    pipeline.use(fetch);
    pipeline.use(validateData);
    pipeline.use(add);
    pipeline.use(cleanup);

    // Add filters to conversion pipeline
    conversionPipeline.use(ffmpegPaletteGen);
    conversionPipeline.use(ffmpegPaletteuse);

    console.log('Listening for messages...');
    client.onAsync('textmessage', async (function (data) {
        // Build context for pipeline
        var context = {
            data: data,
            client: client,
            selfId: selfId,
            answer: function (msg) {
                return client.sendAsync('sendtextmessage',
                        {
                            targetmode: 1,
                            target: data.invokerid,
                            msg: msg
                        });
            }
        };

        // Run pipeline
        await (pipeline.executeAsync(context));
    }));
});

var filterOthers = async (function (context, next) {
    var sender = context.data.invokerid;
    var target = context.data.target;

    if (sender !== context.selfId && target === context.selfId) {
        // If sent by someone else to me
        next(null, context);
    } else {
        // Otherwise, not my business
        next(null, Pipeline.break);
    }
});

var sendAcknowledgment = async (function (context, next) {
    // Send an ack
    await (context.answer('Bien reçu !'));
    next(null, context);
});

var validateInput = async (function (context, next) {
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
            next(null, context);
            return;
        } else {
            // If not, send error message to user
            // and abort pipeline
            await (context.answer('Lien invalide !'));
        }
    }

    next(null, Pipeline.break);
});

var fetch = async (function (context, next) {
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

        next(null, Pipeline.break);
        return;
    }

    if (contentLength > MAX_CONTENT_SIZE) {
        console.log('File too big !');

        await (context.answer(
                    'Fichier trop gros (> '
                    + MAX_CONTENT_SIZE + ') !'));

        next(null, Pipeline.break);
        return;
    }

    // If we have content-disposition
    // The server might specify a filename, which we'd want to save
    if (headers.hasOwnProperty('content-disposition')) {
        var parsedDisposition =
            contentDisposition.parse(headers['content-disposition']);
        context.serverProvidedFileName = parsedDisposition.parameters.filename;
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

        next(null, Pipeline.break);
        return;
    }

    // Add info about temp file to context
    context.inputTempFile = tempFile;

    next(null, context);
});

var validateData = async(function (context, next) {
    var inputTempFile = context.inputTempFile;

    var magic = Promise.promisifyAll(
            new mmm.Magic(mmm.MAGIC_MIME_TYPE));
    
    // Get mime type of file
    var mimeType = await (magic.detectFileAsync(inputTempFile));

    // If it's an image, and not a gif
    if (mimeType.startsWith('image/')
            && mimeType !== 'image/gif') {
        console.log('Already an image, nothing to be done !');
        context.outputTempFile = inputTempFile;

    // If its a video, or a gif
    } else if (mimeType.startsWith('video/')
                || mimeType === 'image/gif') {
        console.log('Got video. Converting.');

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
    } else {
        console.log("Invalid file type...");
        await (context.answer('Format de fichier non-supporté.'));
        next(null, Pipeline.break);
        return;
    }

    next(null, context);
});

var ffmpegPaletteGen = async (function (context, next) {
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
});

var ffmpegPaletteuse = async (function (context, next) {
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
});

var add = async (function (context, next) {

    // Parse the url
    var urlData = url.parse(context.uri);
    // Get everything that comes between / and ?
    var urlPathName = urlData.pathname;

    // Set outputFileName to that
    var outputFileName = urlPathName;

    // If the server had provided a file name
    if (context.hasOwnProperty('serverProvidedFileName')
        // Check if not empty
        && context.serverProvidedFileName.length != 0
        // Check if not blank
        && context.serverProvidedFileName.trim()) {
        // Set as target
        outputFileName = context.serverProvidedFileName;
    }
    
    // Get file name without extension, appends gif extension
    outputFileName =
        path.basename(outputFileName, path.extname(outputFileName))
        + ".gif";

    var outputFile = path.normalize(path.join(GIFBOX_FOLDER, outputFileName));
    console.log("Final file path: " + outputFile);
    console.log("From: " + context.outputTempFile);

    // Move file to final pos
    // Clobber = overwrite
    await (fs.moveAsync(context.outputTempFile, outputFile, {clobber: true}));

    console.log("File moved.");

    await (context.answer('Ajoutée à la collection :)'));

    next(null, context);
});

var cleanup = async (function (context, next) {
    try { await (fs.unlinkAsync(context.inputTempFile)); }
    catch (e) { }
    try { await (fs.unlinkAsync(context.outputTempFile)); }
    catch (e) { }

    console.log('Cleaned up !');
});

main();
