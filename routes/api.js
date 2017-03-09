var express = require('express');
var router = express.Router();
var fs = require('fs');
var DB = require('../modules/DB-Connection.js');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var moment = require('moment');
moment.defineLocale('de-custom', {
  monthsShort: "Jan_Feb_März_Apr_Mai_Jun_Jul_Aug_Sept_Okt_Nov_Dez".split("_"),
  parentLocale: 'de'
});
moment().locale('de-custom').format();
var ReloadSocket = require('../modules/ReloadSocket.js');

function Fehler(res, err, title) {
  res.json(["ERROR", title, err]);
  console.log(err);
}

function getDataSafe(data) {
  if (!data) return "";

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
  parsed.aufsicht = [];

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

  if (data.vp.aufsichten !== undefined) {
    data.vp.aufsichten[0].aufsichtzeile.forEach(function (item) {
      parsed.aufsicht.push({
        info: item.aufsichtinfo[0]
      });
    });
  }

  return parsed;
}

// vplan upload route
router.post('/', function (req, res) {
  if (!req.body.data || !req.body.filename) {
    res.json(["ERROR", "NO_FILE"]);
    return;
  }

  parser.parseString(req.body.data, function (err, result) {
    if (err) {
      Fehler(res, err, "Fehler beim Übersetzen des XML-Formats");
      return;
    }

    var type = "";

    if (result.vp.haupt[0].aktion[0].vlehrer) {
      type = "lehrer";
    } else if (result.vp.haupt[0].aktion[0].raum) {
      type = "schueler";
    } else {
      // Unknown xml structure
      res.json(["ERROR", "Unbekannte Datenstruktur"]);
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
    newFileName = moment().locale('de-custom').format("dd D_MMM H_mm_ss") + ' - ' + newFileName + ".json";

    fs.writeFile(__dirname + '/../uploads/' + type + '/' + newFileName, JSON.stringify(data), function (err) {
      if (err) {
        Fehler(res, err, "Fehler beim Schreiben der Datei");
        return;
      }

      DB[type].insert({
        filename: newFileName,
        forDay: ""
      }, function (err) {
        if (err) {
          Fehler(res, err, "Datenbankfehler");
          return;
        }

        res.json(["SUCCESS", "Datei hochgeladen"]);
      });
    });
  });
});


function deleteVplan(type, req, res) {
  if (!req.body.id) {
    res.json(["ERROR", "Keine Datei ausgewählt"]);
    return;
  }

  DB[type].findOne({
    _id: req.body.id
  }, function (err, doc) {
    if (err) {
      Fehler(res, err, "Datenbankfehler");
      return;
    }

    if (!doc) {
      res.json(["ERROR", "Auswahl existiert nicht"]);
      return;
    }

    fs.unlink(__dirname + "/../uploads/" + type + '/' + doc.filename, function (err) {
      if (err) {
        Fehler(res, err, "Fehler beim Löschen der Datei");
        return;
      }

      DB[type].remove({
        _id: req.body.id
      }, function (err) {
        if (err) {
          Fehler(res, err, "Datenbankfehler");
          return;
        }

        res.json(["SUCCESS", "Auswahl gelöscht"]);
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

// vplan edit (update, new) route

function updateVplan(type, req, res) {
  if (!req.body.data || !req.body.filename || !req.body.id) {
    return;
  }

  DB[type].findOne({
    _id: req.body.id
  }, function (err, doc) {
    if (!doc) {
      res.json(["ERROR", "Auswahl existiert nicht"]);
      return;
    }

    if (err) {
      Fehler(res, err, "Datenbankfehler");
      return;
    }

    fs.unlink(__dirname + "/../uploads/" + type + '/' + doc.filename, function (err) {
      if (err) {
        Fehler(res, err, "Fehler beim Löschen der Datei");
        return;
      }

      var newFileName = moment().locale('de-custom').format("dd D_MMM H_mm_ss") + ' - ' + req.body.filename + ".json";

      fs.writeFile(__dirname + '/../uploads/' + type + '/' + newFileName, JSON.stringify(req.body.data), function (err) {
        if (err) {
          Fehler(res, err, "Fehler beim Schreiben der Datei");
          return;
        }

        DB[type].update({
          _id: doc._id
        }, {
          $set: {
            filename: newFileName
          }
        }, function (err) {
          if (err) {
            Fehler(res, err, "Datenbankfehler");
            return;
          }

          res.json(["SUCCESS", "Vertretungsplan aktualisiert"]);
          ReloadSocket(type);
        });
      });
    });
  });
}

router.post('/schueler', function (req, res) {
  updateVplan("schueler", req, res);
});

router.post('/lehrer', function (req, res) {
  updateVplan("lehrer", req, res);
});

// get vplans for id

function getVplan(type, req, res) {
  if (!req.query.id) {
    DB[type].find({}, function (err, docs) {
      if (err) {
        Fehler(res, err, "Datenbankfehler");
        return;
      }

      res.json(docs);
    });

    return;
  }

  DB[type].findOne({
    _id: req.query.id
  }, function (err, doc) {
    if (err) {
      Fehler(res, err, "Datenbankfehler");
      return;
    }

    if (!doc) {
      res.json(["ERROR", "DB_NOT_FOUND"]);
      return;
    }

    fs.readFile(__dirname + "/../uploads/" + type + "/" + doc.filename, function (err, data) {
      if (err) {
        Fehler(res, err, "Fehler beim Lesen der Datei");
        return;
      }

      res.json({
        filename: doc.filename.replace(doc.filename.split(" - ", 1) + " - ", "").split(".json")[0],
        data: JSON.parse(data)
      });
    });
  });
}

router.get('/schueler', function (req, res) {
  getVplan("schueler", req, res);
});

router.get('/lehrer', function (req, res) {
  getVplan("lehrer", req, res);
});


function selectVplan(type, req, res) {
  if (!req.body.id || req.body.forDay === undefined) {
    res.json(["ERROR", "Keine Datei ausgewählt"]);
    return;
  }

  DB[type].update({
    forDay: req.body.forDay
  }, {
    $set: {
      forDay: ""
    }
  }, function (err) {
    if (err) {
      Fehler(res, err, "Datenbankfehler");
      return;
    }

    DB[type].update({
      _id: req.body.id
    }, {
      $set: {
        forDay: req.body.forDay
      }
    }, function (err) {
      if (err) {
        Fehler(res, err, "Datenbankfehler");
        return;
      }

      if (req.body.forDay) {
        res.json(["SUCCESS", "Auswahl für " + req.body.forDay + " aktiviert"]);
      } else {
        res.json(["SUCCESS", "Auswahl deaktiviert"]);
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