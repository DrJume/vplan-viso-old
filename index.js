// create uploads/ if not exist
const fs = require('fs')
const path = require('path')

if (!fs.existsSync(__dirname, '/uploads/')) {
  console.log('Creating uploads/ directories')
  fs.mkdir(path.join(__dirname, '/uploads/'), () => {
    fs.mkdir(path.join(__dirname, '/uploads/schueler/'), () => {

    })
    fs.mkdir(path.join(__dirname, '/uploads/lehrer/'), () => {

    })
  })
}

// config
const config = require('./package').config

// view middleware
const express = require('express')
const exphbs = require('express-handlebars')
const bodyParser = require('body-parser')
const favicon = require('serve-favicon')

const app = express()

// storage middleware
const DB = require('./modules/DB-Connection.js')

DB.settings.findOne({}, (err, doc) => {
  if (err) {
    console.log(err)
    return
  }
  if (doc === null) {
    DB.settings.insert({
      displayTime: {
        '0-25': 3,
        '25-50': 6,
        '50-75': 8,
        '75-100': 12,
      },
    }, (err) => {
      if (err) {
        console.log(err)
      }
    })
  }
})

// scheduling middleware
const nodeSchedule = require('node-schedule')

// router middleware
const settings = require('./routes/settings')
const dashboard = require('./routes/dashboard')
const api = require('./routes/api')
const schueler = require('./routes/schueler')
const lehrer = require('./routes/lehrer')

// Handlebars engine initialisation
const hbs = exphbs.create({
  defaultLayout: 'main',
  // Specify helpers which are only registered on this instance.
  helpers: {
    isActivePage(page, activePage) {
      if (page === activePage) {
        return 'active'
      }
      return ''
    },
    socketUrl() {
      return `http://${config.ip}:${config.socket_port}`
    },
  },
})
app.engine('handlebars', hbs.engine)
app.set('view engine', 'handlebars')

// serve favicon.ico
app.use(favicon(path.join(__dirname, '/public/favicon.png')))

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }))
// parse application/json
app.use(bodyParser.json())

// API for public assets
app.use('/public', express.static('public'))

// move up schedule at 2:00 (AM)
const moveUpVplan = nodeSchedule.scheduleJob('0 2 * * *', () => {
  console.log('Vertretungsplan-Tagesanpassung um 2 Uhr')

  DB.schueler.update({ forDay: 'heute' }, { $set: { forDay: '' } }, (err) => {
    if (err) {
      console.log(err)
      return
    }

    DB.schueler.update({ forDay: 'morgen' }, { $set: { forDay: 'heute' } }, (err) => {
      if (err) {
        console.log(err)
        return
      }

      console.log('Vertretungsplan-Tagesanpassung für Schüler durchgeführt')
    })
  })

  DB.lehrer.update({ forDay: 'heute' }, { $set: { forDay: '' } }, (err) => {
    if (err) {
      console.log(err)
      return
    }

    DB.lehrer.update({ forDay: 'morgen' }, { $set: { forDay: 'heute' } }, (err) => {
      if (err) {
        console.log(err)
        return
      }

      console.log('Vertretungsplan-Tagesanpassung für Lehrer durchgeführt')
    })
  })
})

// app routes

app.get('/', (req, res) => {
  res.render('about')
})

// settings route
app.use('/settings', settings)

// placeholder route
app.use('/placeholder', express.static('views/placeholder.html'))

// api route
app.use('/api', api)

// dashboard route
app.use('/dashboard', dashboard)

// view display system
app.use('/schueler', schueler)
app.use('/lehrer', lehrer)

// display a not found page
app.get('*', (req, res) => {
  res.redirect('/')
})

// app start
app.listen(config.app_port, () => {
  console.log(`ManosVplan listening on port ${config.app_port}!`)
})
