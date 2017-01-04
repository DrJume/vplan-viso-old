var express = require('express');
var router = express.Router();
var fs = require('fs');
var DB = require('../modules/DB-Connection.js');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var moment = require('moment');
var ReloadSocket = require('../modules/ReloadSocket.js');

function getDataSafe(data) {
  if (data[0]._ === undefined) {
    if (data[0].$ !== undefined) {
      return "";
    } else {
      return data[0];
    }
  } else {
    return data[0]._;
  }
}

function parseSchueler(data) {
  var parsed = {};
  parsed.vplan = [];
  parsed.kopf = {};

  data.vp.haupt[0].aktion.forEach(function (item) {
    parsed.vplan.push({
      klasse: getDataSafe(item.klasse),
      stunde: getDataSafe(item.stunde),
      fach: getDataSafe(item.fach),
      lehrer: getDataSafe(item.lehrer),
      raum: getDataSafe(item.raum),
      info: getDataSafe(item.info)
    });
  });

  parsed.kopf.date = getDataSafe(data.vp.kopf[0].titel);
  parsed.kopf.time = getDataSafe(data.vp.kopf[0].datum);
  parsed.kopf.abwesend_lehrer = getDataSafe(data.vp.kopf[0].kopfinfo[0].abwesendl);
  parsed.kopf.aenderung_lehrer = getDataSafe(data.vp.kopf[0].kopfinfo[0].aenderungl);
  parsed.kopf.aenderung_klassen = getDataSafe(data.vp.kopf[0].kopfinfo[0].aenderungk);

  return parsed;
}

function parseLehrer(data) {
  var parsed = {};
  parsed.vplan = [];
  parsed.kopf = {};

  data.vp.haupt[0].aktion.forEach(function (item) {
    parsed.vplan.push({
      stunde: getDataSafe(item.stunde),
      fach: getDataSafe(item.fach),
      lehrer: getDataSafe(item.lehrer),
      klasse: getDataSafe(item.klasse),
      vfach: getDataSafe(item.vfach),
      vlehrer: getDataSafe(item.vlehrer),
      vraum: getDataSafe(item.vraum),
      info: getDataSafe(item.info)
    });
  });

  parsed.kopf.date = getDataSafe(data.vp.kopf[0].titel);
  parsed.kopf.time = getDataSafe(data.vp.kopf[0].datum);
  parsed.kopf.abwesend_lehrer = getDataSafe(data.vp.kopf[0].kopfinfo[0].abwesendl);
  parsed.kopf.abwesend_klassen = getDataSafe(data.vp.kopf[0].kopfinfo[0].abwesendk);
  parsed.kopf.aenderung_lehrer = getDataSafe(data.vp.kopf[0].kopfinfo[0].aenderungl);
  parsed.kopf.aenderung_klassen = getDataSafe(data.vp.kopf[0].kopfinfo[0].aenderungk);

  return parsed;
}

// vplan upload route
router.post('/', function (req, res) {
  if (!req.body.data || !req.body.filename) {
    res.send(["ERROR", "NO_FILE"]);
    return;
  }

  parser.parseString(req.body.data, function (err, result) {
    if (err) {
      console.log(err);
      return;
    }

    var type = "";

    if (result.vp.haupt[0].aktion[0].vlehrer) {
      type = "lehrer";
    } else if (result.vp.haupt[0].aktion[0].raum) {
      type = "schueler";
    } else {
      // Unknown xml structure
      res.send(["ERROR", "Unbekannte Datenstruktur"]);
      return;
    }


    var data = {};

    if (type == "schueler") {
      data = parseSchueler(result);
    } else {
      data = parseLehrer(result);
    }

    var newFileName = req.body.filename.split('.');
    if (newFileName.length >= 2) {
      newFileName.pop();
    }
    newFileName.join('.');
    newFileName = moment().format("D_MM_YYYY H_mm") + ' - ' + newFileName + ".json";

    fs.writeFile(__dirname + '/../uploads/' + type + '/' + newFileName, JSON.stringify(data), function (err) {
      if (err) {
        console.log(err);
        return;
      }

      DB[type].insert({
        filename: newFileName,
        forDay: ""
      }, function (err) {
        if (err) {
          console.log(err);
          return;
        }

        res.send(["SUCCESS", "Datei hochgeladen"]);
      });
    });
  });
});


function deleteVplan(type, req, res) {
  if (!req.body.id) {
    res.send(["ERROR", "Keine Datei ausgewählt"]);
    return;
  }

  DB[type].findOne({ _id: req.body.id }, function (err, doc) {
    if (!doc) {
      res.send(["ERROR", "Auswahl existiert nicht"]);
      return;
    }

    fs.unlink(__dirname + "/../uploads/" + type + '/' + doc.filename, function (err) {
      if (err) {
        res.send(["ERROR", err]);
        console.log(err);
        return;
      }

      DB[type].remove({ _id: req.body.id }, function (err) {
        if (err) {
          res.send(["ERROR", err]);
          console.log(err);
          return;
        }

        res.send(["SUCCESS", "Auswahl gelöscht"]);
        ReloadSocket(type);
      });
    });
  });
}

// vplan deletion route
router.delete('/schueler', function (req, res) {
  deleteVplan("schueler", req, res);
});

router.delete('/lehrer', function (req, res) {
  deleteVplan("lehrer", req, res);
});

// debug: get listed vplans
router.get('/schueler', function (req, res) {
  DB.schueler.find({}, function (err, docs) {
    res.send(docs);
  });
});

router.get('/lehrer', function (req, res) {
  DB.lehrer.find({}, function (err, docs) {
    res.send(docs);
  });
});


function selectVplan(type, req, res) {
  if (!req.body.id || req.body.forDay === undefined) {
    res.send(["ERROR", "Keine Datei ausgewählt"]);
    return;
  }

  DB[type].update({ forDay: req.body.forDay }, { $set: { forDay: "" } }, function (err) {
    if (err) {
      res.send(["ERROR", err]);
      console.log(err);
      return;
    }

    DB[type].update({ _id: req.body.id }, { $set: { forDay: req.body.forDay } }, function (err) {
      if (err) {
        res.send(["ERROR", err]);
        console.log(err);
        return;
      }

      if (req.body.forDay) {
        res.send(["SUCCESS", "Auswahl für " + req.body.forDay + " aktiviert"]);
      } else {
        res.send(["SUCCESS", "Auswahl deaktiviert"]);
      }
      ReloadSocket(type);
    });
  });
}

// vplan selection route
router.put('/schueler', function (req, res) {
  selectVplan("schueler", req, res);
});

router.put('/lehrer', function (req, res) {
  selectVplan("lehrer", req, res);
});

module.exports = router;