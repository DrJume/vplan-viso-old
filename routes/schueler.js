var express = require('express')
var router = express.Router()
var fs = require('fs')
var path = require('path')
var DB = require('../modules/DB-Connection.js')

router.get('/', function (req, res) {
  res.json('Schueler')
})

var tabelle = function (req, res) {
  res.render('vplan/schueler/tabelle')
}

var kopf = function (req, res) {
  res.render('vplan/schueler/kopf')
}

var json = function (req, res) {
  var day = req.path.split('/')[1]

  DB.schueler.findOne({ forDay: day }, function (err, doc) {
    if (err) {
      console.log(err)
      return
    }

    if (doc === null) {
      res.json('NO_VPLAN_AVAILABLE')
      return
    }

    fs.readFile(path.join(__dirname, '/../uploads/schueler/', doc.filename), function (err, data) {
      if (err) {
        console.log(err)
        return
      }

      res.json(JSON.parse(data))
    })
  })
}

router.get('/heute', json)
router.get('/morgen', json)

router.get('/heute/tabelle', tabelle)
router.get('/morgen/tabelle', tabelle)

router.get('/heute/kopf', kopf)
router.get('/morgen/kopf', kopf)

module.exports = router
