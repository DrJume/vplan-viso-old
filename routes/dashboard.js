var express = require('express');
var router = express.Router();
var DB = require('../modules/DB-Connection.js');

// dashboard view route
router.get('/', function (req, res) {
  var activePage = "";
  switch (req.query.p) {
    case undefined: {
      res.redirect("/dashboard?p=select");
      return;
    }
    case "select": {
      activePage = "select";
      break;
    }
    case "upload": {
      activePage = "upload";
      break;
    }
    case "settings": {
      activePage = "settings";
      break;
    }
  }
  DB.vplans.find({}, function (err, docVplans) {
    DB.settings.findOne({}, function (err, docSettings) {
      res.render('dashboard', {
        activePage: activePage,
        vplanList: docVplans,
        settings: docSettings
      });
    });
  });
});

module.exports = router;