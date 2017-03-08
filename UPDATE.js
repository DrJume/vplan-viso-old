const https = require('https');
const fs = require('fs');
const shell = require('child_process').exec;

var options = {
  hostname: 'api.github.com',
  port: 443,
  path: '/repos/DrJume/manosVplan/releases',
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
    response(JSON.parse(str)[0]);
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
    console.log(readableTagName);
    console.log(data);
    console.log(isNewerVersion(readableTagName, data));
    if (isNewerVersion(readableTagName, data)) {
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
    shell('wget -qO- ' + tarball_url + ' | tar xvz -C ../' + newFolderName + ' --strip-components 1', function (error, stdout, stderr) {
      if (error) {
        console.error(error);
        return;
      }
      shell('npm stop', function (error, stdout, stderr) {
        if (error) {
          console.error(error);
          return;
        }
        console.log("Alte Version wird heruntergefahren...");
        shell('node POST_UPDATE.js', {
          cwd: __dirname + "/../" + newFolderName + '/'
        }, function (error, stdout, stderr) {
          console.log("Starten der Nach-Update prozedur...");
        });
      });
    });
  });
}

function isNewerVersion(neu, derzeit) {
  var result = versionCompare(neu, derzeit);
  if (result > 0) {
    return true;
  }
  return false;
}


function versionCompare(v1, v2, options) {
  var lexicographical = options && options.lexicographical,
    zeroExtend = options && options.zeroExtend,
    v1parts = v1.split('.'),
    v2parts = v2.split('.');

  function isValidPart(x) {
    return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
  }
  if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
    return NaN;
  }
  if (zeroExtend) {
    while (v1parts.length < v2parts.length) v1parts.push("0");
    while (v2parts.length < v1parts.length) v2parts.push("0");
  }
  if (!lexicographical) {
    v1parts = v1parts.map(Number);
    v2parts = v2parts.map(Number);
  }
  for (var i = 0; i < v1parts.length; ++i) {
    if (v2parts.length == i) {
      return 1;
    }
    if (v1parts[i] == v2parts[i]) {
      continue;
    } else if (v1parts[i] > v2parts[i]) {
      return 1;
    } else {
      return -1;
    }
  }
  if (v1parts.length != v2parts.length) {
    return -1;
  }
  return 0;
}