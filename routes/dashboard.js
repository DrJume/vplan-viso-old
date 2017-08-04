const express = require('express')
const DB = require('../modules/DB-Connection.js')

const router = express.Router()

// dashboard view route
router.get('/', (req, res) => {
  let activePage = ''

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

  DB.schueler.find({}, (err, schueler) => {
    if (err) {
      console.log(err)
      return
    }
    DB.lehrer.find({}, (err, lehrer) => {
      if (err) {
        console.log(err)
        return
      }
      DB.settings.findOne({}, (err, settings) => {
        if (err) {
          console.log(err)
          return
        }
        res.render('dashboard', {
          activePage,
          schueler,
          lehrer,
          settings,
        })
      })
    })
  })
})

module.exports = router
