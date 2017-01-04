var express = require('express');
var router = express.Router();
var DB = require('../modules/DB-Connection.js');
var ReloadSocket = require('../modules/ReloadSocket.js');

// settings update route
router.put('/', function (req, res) {
  DB.settings.update({}, {
    displayAmount: parseInt(req.body.displayAmount),
    displayTime: {
      "0-25": parseFloat(req.body.displayTime['0-25']),
      "25-50": parseFloat(req.body.displayTime['25-50']),
      "50-75": parseFloat(req.body.displayTime['50-75']),
      "75-100": parseFloat(req.body.displayTime['75-100'])
    }
  }, {}, function (err) {
    if (err) {
      console.log(err);
      res.send(["ERROR", "Speicherung der Einstellungen fehlgeschlagen"]);
      return;
    }
    
    res.send(["SUCCESS", "Einstellungen übernommen"]);
    ReloadSocket("all");
  });
});

// settings api route
router.get('/', function (req, res) {
  DB.settings.findOne({}, function (err, settings) {
    if (err) {
      console.log(err);
      return;
    }
    res.json(settings);
  });
});

module.exports = router;