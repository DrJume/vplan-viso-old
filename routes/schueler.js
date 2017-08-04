const express = require('express')
const fs = require('fs')
const path = require('path')
const DB = require('../modules/DB-Connection.js')

const router = express.Router()

router.get('/', (req, res) => {
  res.json('Schueler')
})

const tabelle = (req, res) => {
  res.render('vplan/schueler/tabelle')
}

const kopf = (req, res) => {
  res.render('vplan/schueler/kopf')
}

const json = (req, res) => {
  const day = req.path.split('/')[1]

  DB.schueler.findOne({ forDay: day }, (err, doc) => {
    if (err) {
      console.log(err)
      return
    }

    if (doc === null) {
      res.json('NO_VPLAN_AVAILABLE')
      return
    }

    fs.readFile(path.join(__dirname, '/../uploads/schueler/', doc.filename), (err, data) => {
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
