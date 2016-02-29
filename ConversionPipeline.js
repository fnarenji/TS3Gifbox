var async = require('asyncawait/async');
var await = require('asyncawait/await');
var Promise = require('bluebird');
var Pipeline = require('pipes-and-filters');
var Temp = Promise.promisifyAll(require('temp'));
var ffmpeg = require('fluent-ffmpeg');
var fs = Promise.promisifyAll(require('fs-extra'));

module.exports.convertAsync = async (function (inputFile) {
    return conversionPipeline.executeAsync(inputFile);
});

// Video to gif conversion pipeline
var conversionPipeline = Promise.promisifyAll(
        Pipeline.create('Conversion pipeline'));

// Add filters to conversion pipeline
conversionPipeline.use(async (ffmpegPaletteGen));
conversionPipeline.use(async (ffmpegPaletteuse));
function ffmpegPaletteGen(inputTempFile, next) { var tempFile = Temp.path(
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
        ffmpeg(inputTempFile)
            .videoFilters('fps=10,scale=320:-1:flags=lanczos,palettegen')
            .on('end', resolve)
            .on('error', reject)
            .addOption('-threads', '0')
            .save(tempFile);
    }));

    console.log('FFmpeg step 1 done.');

    next(null, { inputTempFile: inputTempFile, paletteTempFile: tempFile });
}

function ffmpegPaletteuse(inputTempFiles, next) {
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
                .input(inputTempFiles.inputTempFile)
                .input(inputTempFiles.paletteTempFile)
                .complexFilter([
                        'fps=10,scale=640:-1:flags=lanczos[x];[x][1:v]paletteuse'
                ])
                .on('end', resolve)
                .on('error', reject)
                .addOption('-threads', '0')
                .save(tempFile);
        }));

        console.log('FFmpeg step 2 done.');

        next(null, tempFile);
    } finally {
        // Remove the palette file, as it was consumed already
        await (fs.unlinkAsync(inputTempFiles.paletteTempFile));
    }
}
