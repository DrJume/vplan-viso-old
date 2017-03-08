const https = require('https');
const fs = require('fs');
const shell = require('child_process').exec;

var options = {
  hostname: 'api.github.com',
  port: 443,
  path: '/repos/DrJume/manosVplan/releases/latest',
  method: 'GET',
  headers: {
    "User-Agent": "DrJume"
  }
};

var str = "";

var req = https.request(options, function (res) {
  res.on('data', (chunk) => {
    str += chunk;
  });
  res.on('end', function () {
    if (!(res.statusCode == 200)) {
      console.log("API hat nicht mit 200 (OK) geantwortet!");
      return;
    }
    response(JSON.parse(str));
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.end();

function response(res) {
  console.log(res);
  fs.readFile(__dirname + "/VERSION", 'utf-8', function (err, data) {
    if (err) {
      console.error("Derzeitige Version konnte nicht gelesen werden!");
      console.error(err);
      return;
    }
    var readableTagName = "";
    readableTagName = res.tag_name.slice(1);
    readableTagName = readableTagName.split('-')[0];
    console.log(readableTagName + " neuer als " + data + " ? --> " + isNewerVersion(readableTagName, data));
    if (isNewerVersion(readableTagName, data)) {
      console.log("Eine neue Version des Systems ist verfügbar.\nDas Update wird nun installiert...");
      doTheUpdateProcess(res.tarball_url, res.tag_name.slice(1));
    }
  });
}

function doTheUpdateProcess(tarball_url, neu_ver) {
  const newFolderName = "manosVplan-" + neu_ver;
  shell('mkdir ' + newFolderName, {
    cwd: __dirname + "/../"
  }, function (error, stdout, stderr) {
    if (error) {
      console.error(error);
      return;
    }
    console.log("Das Update wird herunterladen...");
    shell('wget -qO- ' + tarball_url + ' | tar xvz -C ../' + newFolderName + ' --strip-components 1', function (error, stdout, stderr) {
      if (error) {
        console.error(error);
        return;
      }
      console.log("Es wird versucht das alte System abzuschalten...");
      shell('npm stop', function (error, stdout, stderr) {
        if (error) {
          console.error(error);
          return;
        }
        console.log("Starten der Nach-Update Prozedur...");
        shell('node POST_UPDATE.js', {
          cwd: __dirname + "/../" + newFolderName + '/'
        }, function (error, stdout, stderr) {
          console.log(stdout);
        });
      });
    });
  });
}

function isNewerVersion(neu, derzeit) {
  if (versionCompare(neu, derzeit) > 0) {
    return true;
  }
  return false;
}

function versionCompare(neu, derzeit) {
  var pa = neu.split('.');
  var pb = derzeit.split('.');
  for (var i = 0; i < 3; i++) {
    var na = Number(pa[i]);
    var nb = Number(pb[i]);
    if (na > nb) return 1;
    if (nb > na) return -1;
    if (!isNaN(na) && isNaN(nb)) return 1;
    if (isNaN(na) && !isNaN(nb)) return -1;
  }
  return 0;
};