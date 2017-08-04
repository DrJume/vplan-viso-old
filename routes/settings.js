const express = require('express')
const DB = require('../modules/DB-Connection.js')
const ReloadSocket = require('../modules/ReloadSocket.js')

const router = express.Router()

// settings update route
router.put('/', (req, res) => {
  DB.settings.update({}, {
    displayTime: {
      '0-25': parseFloat(req.body.displayTime['0-25']),
      '25-50': parseFloat(req.body.displayTime['25-50']),
      '50-75': parseFloat(req.body.displayTime['50-75']),
      '75-100': parseFloat(req.body.displayTime['75-100']),
    },
  }, {}, (err) => {
    if (err) {
      console.log(err)
      res.json(['ERROR', 'Speicherung der Einstellungen fehlgeschlagen'])
      return
    }

    res.json(['SUCCESS', 'Einstellungen übernommen'])
    ReloadSocket('all')
  })
})

// settings api route
router.get('/', (req, res) => {
  DB.settings.findOne({}, (err, settings) => {
    if (err) {
      console.log(err)
      return
    }
    res.json(settings)
  })
})

module.exports = router
