var express = require('express');
var router = express.Router();
var fs = require('fs');
var DB = require('../modules/DB-Connection.js');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var moment = require('moment');

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

    var data = {};
    data.vplan = [];

    result.vp.haupt[0].aktion.forEach(function (item) {
      data.vplan.push({
        klasse: getDataSafe(item.klasse),
        stunde: getDataSafe(item.stunde),
        fach: getDataSafe(item.fach),
        lehrer: getDataSafe(item.lehrer),
        raum: getDataSafe(item.raum),
        info: getDataSafe(item.info)
      });
    });

    var newFileName = req.body.filename.split('.');
    if (newFileName.length >= 2) {
      newFileName.pop();
    }
    newFileName.join('.');
    newFileName = moment().format("D_MM_YYYY H_mm") + ' - ' + newFileName + ".json";

    fs.writeFile(__dirname + '/../uploads/' + newFileName, JSON.stringify(data), function (err) {
      if (err) {
        console.log(err);
        return;
      }

      DB.vplans.insert({
        filename: newFileName,
        forDay: ""
      }, function (err) {
        if (err) {
          console.log(err);
          return;
        }

        res.redirect("/dashboard");
      });
    });
  });
});

// vplan deletion route
router.delete('/', function (req, res) {
  if (!req.body.id) {
    res.send(["ERROR", "NO_FILE_ID_GIVEN"]);
    return;
  }

  DB.vplans.findOne({ _id: req.body.id }, function (err, doc) {
    fs.unlink(__dirname + "/../uploads/" + doc.filename, function (err) {
      if (err){
        console.log(err);
        return;
      }

      DB.vplans.remove({ _id: req.body.id }, function (err) {
        if (err) {
          res.send("ERROR", err);
          console.log(err);
          return;
        }

        res.send(["SUCCESS", "SELECTION_DELETED"]);
      });
    });
  });

});

// debug: get listed vplans
router.get('/', function (req, res) {
  DB.vplans.find({}, function (err, docs) {
    res.send(docs);
  });
});

// vplan selection route
router.put('/', function (req, res) {
  if (!req.body.id || req.body.forDay === undefined) {
    res.send(["ERROR", "NO_FILE"]);
    return;
  }

  DB.vplans.update({ forDay: req.body.forDay }, { $set: { forDay: "" } }, function (err) {
    if (err) {
      res.send(["ERROR", err]);
      console.log(err);
      return;
    }

    DB.vplans.update({ _id: req.body.id }, { $set: { forDay: req.body.forDay } }, function (err) {
      if (err) {
        res.send(["ERROR", err]);
        console.log(err);
        return;
      }

      res.send(["SUCCESS", "VPLAN_SELECTED: " + req.body.forDay]);
    });
  });
});

module.exports = router;