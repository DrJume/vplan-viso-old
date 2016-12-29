var express = require('express');
var router = express.Router();
var fs = require('fs');
var DB = require('../modules/DB-Connection.js');

router.get('/', function (req, res) {
  res.render('vplan');
});

router.get('/json', function (req, res) {
  var day = req.baseUrl.split('/')[1];

  DB.vplans.findOne({ forDay: day }, function (err, doc) {
    if (err) {
      console.log(err);
      return;
    }

    if (doc === null) {
      res.json("NO_VPLAN_AVAILABLE");
      return;
    }

    fs.readFile(__dirname + '/../uploads/' + doc.filename, function (err, data) {
      if (err) {
        console.log(err);
        return;
      }

      res.json(JSON.parse(data));
    });
  });
});

module.exports = router;