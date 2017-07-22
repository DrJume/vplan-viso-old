var express = require('express')
var router = express.Router()
var DB = require('../modules/DB-Connection.js')

// dashboard view route
router.get('/', function (req, res) {
  var activePage = ''

  switch (req.query.p) {
    case undefined: {
      res.redirect('/dashboard?p=select')
      return
    }
    case 'select': {
      activePage = 'select'
      break
    }
    case 'upload': {
      activePage = 'upload'
      break
    }
    case 'settings': {
      activePage = 'settings'
      break
    }
    case 'edit': {
      activePage = 'edit'
      break
    }
    default: {
      res.redirect('/dashboard')
      return
    }
  }

  DB.schueler.find({}, function (err, schueler) {
    if (err) {
      console.log(err)
      return
    }
    DB.lehrer.find({}, function (err, lehrer) {
      if (err) {
        console.log(err)
        return
      }
      DB.settings.findOne({}, function (err, settings) {
        if (err) {
          console.log(err)
          return
        }
        res.render('dashboard', {
          activePage: activePage,
          schueler: schueler,
          lehrer: lehrer,
          settings: settings
        })
      })
    })
  })
})

module.exports = router
