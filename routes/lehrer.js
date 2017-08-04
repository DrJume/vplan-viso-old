const express = require('express')
const fs = require('fs')
const path = require('path')
const DB = require('../modules/DB-Connection.js')

const router = express.Router()

router.get('/', (req, res) => {
  res.json('Lehrer')
})

const tabelle = (req, res) => {
  res.render('vplan/lehrer/tabelle')
}

const kopf = (req, res) => {
  res.render('vplan/lehrer/kopf')
}

const aufsicht = (req, res) => {
  res.render('vplan/lehrer/aufsicht')
}

const json = (req, res) => {
  const day = req.path.split('/')[1]

  DB.lehrer.findOne({ forDay: day }, (err, doc) => {
    if (err) {
      console.log(err)
      return
    }

    if (doc === null) {
      res.json('NO_VPLAN_AVAILABLE')
      return
    }

    fs.readFile(path.join(__dirname, '/../uploads/lehrer/', doc.filename), (err, data) => {
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

router.get('/heute/aufsicht', aufsicht)
router.get('/morgen/aufsicht', aufsicht)

module.exports = router
