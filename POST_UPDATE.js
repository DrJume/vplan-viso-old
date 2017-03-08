const shell = require('child_process').exec;

console.log("Das neue Update wird nun installiert...");
shell('npm install', function (error, stdout, stderr) {
  if (error) {
    console.error(error);
    return;
  }
  console.log("Es wird versucht das neue System zu starten...");
  shell('npm start', function (error, stdout, stderr) {
    if (error) {
      console.error(error);
      return;
    }
    console.log("Starten erfolgreich!");
    console.log("Das System wurde erfolgreich geupdatet!");

    // SEND PUSHOVER

    const https = require('https');
    const querystring = require('querystring');
    const moment = require('moment');

    var postBody = querystring.stringify({
      token: "a7d78cherf7xjw8cyzb5ohjeck4fzi",
      user: "uosg3juoskcsjpfhiw7htjjn8iejyg",
      message: "System successfully updated!\n" + moment().format("dddd, MMMM Do YYYY, h:mm:ss a")
    });

    var options = {
      hostname: 'api.pushover.net',
      port: 443,
      path: '/1/messages.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postBody)
      }
    };

    var req = https.request(options, function (res) {
      console.log('statusCode:', res.statusCode);

      res.on('data', function (d) {
        console.log(d.toString('utf8'));
      });
    });

    req.on('error', function (e) {
      console.error(e);
    });
    req.write(postBody);
    req.end();

    // SEND PUSHOVER

  });
});