var TeamspeakClient = require("node-teamspeak"),
    Util = require("util"),
    ValidUrl = require("valid-url"),
    HttpReq = require("httpreq"),
    ShortId = require("shortid"),
    rimraf = require("rimraf"),
    fs= require("fs"),
    ffmpeg = require("fluent-ffmpeg");

const SQ_USER = "username";
const SQ_PASSWORD = "passwd";
const SQ_NICK = "GIFFUBOTTU";
const CHANNEL_NAME = "gifbox";
const DST_PATH = "~/gifbox/";

var mkdirSync = function (path) {
    try {
        fs.mkdirSync(path);
    } catch(e) {
        if ( e.code != 'EEXIST' ) throw e;
    }
}

var client = new TeamspeakClient("127.0.0.1");
var clientId = 0;
var channelId = 0;
var fileIndex = 0;

mkdirSync("./tmp");

client.send(
        "login",
        {
            client_login_name: SQ_USER,
            client_login_password: SQ_PASSWORD
        },
        send_use);

function send_updatenick() {
    client.send("clientupdate", {client_nickname: SQ_NICK}, send_use);
}

function send_use (err, response, rawResponse) {
    client.send("use", {sid: 1}, send_whoami);

    setInterval(function () {
        var files = fs.readdirSync(DST_PATH);

        console.log("picking " + fileIndex + " (" + files[fileIndex] + ")");

        
        client.send("serveredit", {virtualserver_hostbanner_gfx_url: "https://srv0.sknz.info/gifbox/" + files[fileIndex] }, function (err, resp, full) {
            console.log(resp);
        });

        fileIndex = fileIndex + 1;
        if (fileIndex >= files.length) {
            fileIndex = 0;
        }
    }, 5555);
}

function send_whoami(err, response, rawResponse) {
    client.send("whoami", function(err, response, rawResponse) {
        clientId = response.client_id;
        console.log(response);
        console.log("SQ Client ID : " + clientId);

        send_channelfind();
    });
}

function send_channelfind() {
    client.send("channelfind", {pattern: CHANNEL_NAME}, function(err, response, rawResponse) {
        channelId = response.cid;
        console.log("Channel ID : " + channelId);

        send_clientmove();
    });
}

function send_clientmove() {
    client.send(
            "clientmove",
            {
                clid: clientId,
                cid: channelId
            },
            send_servernotifyregister);
}

function send_servernotifyregister() {
    client.send("servernotifyregister", {event: "textprivate"}, function(err, response, rawResponse) {
        console.log("Registered for messages (" + response + ")"); client.on("textmessage", handle_message);
    });
}


function handle_message (response) {
    if (response.target !== clientId || response.invokerid === clientId) 
        return;

    var sender = response.invokerid;
    console.log("Got: " + response.msg + " from " + response.invokerid + "(" + response.invokername + ")");

    var msg = response.msg.replace("[URL]", "").replace("[/URL]", "");

    if (ValidUrl.isWebUri(msg)) {
        send_message(sender, "Lien ok, fetching");
        var url = msg;

        var filename = ShortId.generate();

        HttpReq.download(
                url,
                "tmp/" + filename
                , function (err, progress){
                    if (err) return console.log(err);
                    console.log(progress);
                }, function (err, res){
                    if (err) return console.log(err);

                    console.log(res);

                    var proc = ffmpeg("tmp/" + filename)
                        .videoFilters("fps=10,scale=320:-1:flags=lanczos,palettegen")
                        .on('end', function() {
                            console.log('file has been converted succesfully');
                            send_message(sender, "Conv1 ok");
                            var proc2 = ffmpeg()
                                .input("tmp/" + filename)
                                .input("tmp/" + filename + ".png")
                                .complexFilter([
                                        "fps=10,scale=640:-1:flags=lanczos[x];[x][1:v]paletteuse"
                                ])
                                .on('end', function() {
                                    console.log('file has been converted succesfully');
                                    send_message(sender, "Conv2 ok");
                                })
                                .on('error', function(err) {
                                    console.log('an error happened: ' + err.message);
                                    send_message(sender, "Tapenade2 d'enculé");
                                })
                                .save(DST_PATH + filename + ".gif");
                        })
                        .on('error', function(err) {
                            console.log('an error happened: ' + err.message);
                            send_message(sender, "Tapenade d'enculé");
                        })
                        .save("tmp/" + filename + ".png");
                });
    } else {
        send_message(sender, "Lien refusé car malformé (un peu comme toi)");
    }
}

function send_message(user_id, msg, callback) {
    client.send("sendtextmessage",
    {
        targetmode: 1,
        target: user_id,
        msg: msg
    });
}
