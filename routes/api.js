const express = require('express')
const fs = require('fs')
const DB = require('../modules/DB-Connection.js')
const xml2js = require('xml2js')
const moment = require('moment')
const ReloadSocket = require('../modules/ReloadSocket.js')
const path = require('path')

const parser = new xml2js.Parser()
const router = express.Router()

moment.defineLocale('de-custom', {
  monthsShort: 'Jan_Feb_März_Apr_Mai_Jun_Jul_Aug_Sept_Okt_Nov_Dez'.split('_'),
  parentLocale: 'de',
})
moment().locale('de-custom').format()


function Fehler(res, err, title) {
  res.json(['ERROR', title, err])
  console.log(err)
}

function getDataSafe(data) {
  if (!data) return ''

  if (data[0]._ === undefined) {
    if (data[0].$ !== undefined) {
      return ''
    }
    return data[0]
  }
  return data[0]._
}

function parseSchueler(data) {
  const parsed = {}
  parsed.vplan = []
  parsed.kopf = {}

  data.vp.haupt[0].aktion.forEach((item) => {
    parsed.vplan.push({
      klasse: getDataSafe(item.klasse),
      stunde: getDataSafe(item.stunde),
      fach: getDataSafe(item.fach),
      lehrer: getDataSafe(item.lehrer),
      raum: getDataSafe(item.raum),
      info: getDataSafe(item.info),
    })
  })

  parsed.kopf.date = getDataSafe(data.vp.kopf[0].titel)
  parsed.kopf.time = getDataSafe(data.vp.kopf[0].datum)
  parsed.kopf.abwesend_lehrer = getDataSafe(data.vp.kopf[0].kopfinfo[0].abwesendl)
  parsed.kopf.aenderung_lehrer = getDataSafe(data.vp.kopf[0].kopfinfo[0].aenderungl)
  parsed.kopf.aenderung_klassen = getDataSafe(data.vp.kopf[0].kopfinfo[0].aenderungk)

  return parsed
}

function parseLehrer(data) {
  const parsed = {}
  parsed.vplan = []
  parsed.kopf = {}
  parsed.aufsicht = []

  data.vp.haupt[0].aktion.forEach((item) => {
    parsed.vplan.push({
      stunde: getDataSafe(item.stunde),
      fach: getDataSafe(item.fach),
      lehrer: getDataSafe(item.lehrer),
      klasse: getDataSafe(item.klasse),
      vfach: getDataSafe(item.vfach),
      vlehrer: getDataSafe(item.vlehrer),
      vraum: getDataSafe(item.vraum),
      info: getDataSafe(item.info),
    })
  })

  parsed.kopf.date = getDataSafe(data.vp.kopf[0].titel)
  parsed.kopf.time = getDataSafe(data.vp.kopf[0].datum)
  parsed.kopf.abwesend_lehrer = getDataSafe(data.vp.kopf[0].kopfinfo[0].abwesendl)
  parsed.kopf.abwesend_klassen = getDataSafe(data.vp.kopf[0].kopfinfo[0].abwesendk)
  parsed.kopf.aenderung_lehrer = getDataSafe(data.vp.kopf[0].kopfinfo[0].aenderungl)
  parsed.kopf.aenderung_klassen = getDataSafe(data.vp.kopf[0].kopfinfo[0].aenderungk)

  if (data.vp.aufsichten !== undefined) {
    data.vp.aufsichten[0].aufsichtzeile.forEach((item) => {
      parsed.aufsicht.push({
        info: item.aufsichtinfo[0],
      })
    })
  }

  return parsed
}

// vplan upload route
router.post('/', (req, res) => {
  if (!req.body.data || !req.body.filename) {
    res.json(['ERROR', 'NO_FILE'])
    return
  }

  parser.parseString(req.body.data, (err, result) => {
    if (err) {
      Fehler(res, err, 'Fehler beim Übersetzen des XML-Formats')
      return
    }

    let type = ''

    if (result.vp.haupt[0].aktion[0].vlehrer) {
      type = 'lehrer'
    } else if (result.vp.haupt[0].aktion[0].raum) {
      type = 'schueler'
    } else {
      // Unknown xml structure
      res.json(['ERROR', 'Unbekannte Datenstruktur'])
      return
    }

    let data = {}

    if (type === 'schueler') {
      data = parseSchueler(result)
    } else {
      data = parseLehrer(result)
    }

    let newFileName = req.body.filename.split('.')
    if (newFileName.length >= 2) {
      newFileName.pop()
    }
    newFileName.join('.')
    newFileName = `${moment().locale('de-custom').format('dd D_MMM H_mm_ss')} - ${newFileName}.json`

    fs.writeFile(path.join(__dirname, '/../uploads/', type, '/', newFileName), JSON.stringify(data), (err) => {
      if (err) {
        Fehler(res, err, 'Fehler beim Schreiben der Datei')
        return
      }

      DB[type].insert({
        filename: newFileName,
        forDay: '',
      }, (err) => {
        if (err) {
          Fehler(res, err, 'Datenbankfehler')
          return
        }

        res.json(['SUCCESS', 'Datei hochgeladen'])
      })
    })
  })
})

function deleteVplan(type, req, res) {
  if (!req.body.id) {
    res.json(['ERROR', 'Keine Datei ausgewählt'])
    return
  }

  DB[type].findOne({
    _id: req.body.id,
  }, (err, doc) => {
    if (err) {
      Fehler(res, err, 'Datenbankfehler')
      return
    }

    if (!doc) {
      res.json(['ERROR', 'Auswahl existiert nicht'])
      return
    }

    fs.unlink(path.join(__dirname, '/../uploads/', type, '/', doc.filename), (err) => {
      if (err) {
        Fehler(res, err, 'Fehler beim Löschen der Datei')
        return
      }

      DB[type].remove({
        _id: req.body.id,
      }, (err) => {
        if (err) {
          Fehler(res, err, 'Datenbankfehler')
          return
        }

        res.json(['SUCCESS', 'Auswahl gelöscht'])
        ReloadSocket(type)
      })
    })
  })
}

// vplan deletion route
router.delete('/schueler', (req, res) => {
  deleteVplan('schueler', req, res)
})

router.delete('/lehrer', (req, res) => {
  deleteVplan('lehrer', req, res)
})

// vplan edit (update, new) route

function updateVplan(type, req, res) {
  if (!req.body.data || !req.body.filename || !req.body.id) {
    return
  }

  DB[type].findOne({
    _id: req.body.id,
  }, (err, doc) => {
    if (!doc) {
      res.json(['ERROR', 'Auswahl existiert nicht'])
      return
    }

    if (err) {
      Fehler(res, err, 'Datenbankfehler')
      return
    }

    fs.unlink(path.join(__dirname, '/../uploads/', type, '/', doc.filename), (err) => {
      if (err) {
        Fehler(res, err, 'Fehler beim Löschen der Datei')
        return
      }

      const newFileName = `${moment().locale('de-custom').format('dd D_MMM H_mm_ss')} - ${req.body.filename}.json`

      fs.writeFile(path.join(__dirname, '/../uploads/', type, '/', newFileName), JSON.stringify(req.body.data), (err) => {
        if (err) {
          Fehler(res, err, 'Fehler beim Schreiben der Datei')
          return
        }

        DB[type].update({
          _id: doc._id,
        }, {
          $set: {
            filename: newFileName,
          },
        }, (err) => {
          if (err) {
            Fehler(res, err, 'Datenbankfehler')
            return
          }

          res.json(['SUCCESS', 'Vertretungsplan aktualisiert'])
          ReloadSocket(type)
        })
      })
    })
  })
}

router.post('/schueler', (req, res) => {
  updateVplan('schueler', req, res)
})

router.post('/lehrer', (req, res) => {
  updateVplan('lehrer', req, res)
})

// get vplans for id

function getVplan(type, req, res) {
  if (!req.query.id) {
    DB[type].find({}, (err, docs) => {
      if (err) {
        Fehler(res, err, 'Datenbankfehler')
        return
      }

      res.json(docs)
    })

    return
  }

  DB[type].findOne({
    _id: req.query.id,
  }, (err, doc) => {
    if (err) {
      Fehler(res, err, 'Datenbankfehler')
      return
    }

    if (!doc) {
      res.json(['ERROR', 'DB_NOT_FOUND'])
      return
    }

    fs.readFile(path.join(__dirname, '/../uploads/', type, '/', doc.filename), (err, data) => {
      if (err) {
        Fehler(res, err, 'Fehler beim Lesen der Datei')
        return
      }

      res.json({
        filename: doc.filename.replace(`${doc.filename.split(' - ', 1)} - `, '').split('.json')[0],
        data: JSON.parse(data),
      })
    })
  })
}

router.get('/schueler', (req, res) => {
  getVplan('schueler', req, res)
})

router.get('/lehrer', (req, res) => {
  getVplan('lehrer', req, res)
})

function selectVplan(type, req, res) {
  if (!req.body.id || req.body.forDay === undefined) {
    res.json(['ERROR', 'Keine Datei ausgewählt'])
    return
  }

  DB[type].update({
    forDay: req.body.forDay,
  }, {
    $set: {
      forDay: '',
    },
  }, (err) => {
    if (err) {
      Fehler(res, err, 'Datenbankfehler')
      return
    }

    DB[type].update({
      _id: req.body.id,
    }, {
      $set: {
        forDay: req.body.forDay,
      },
    }, (err) => {
      if (err) {
        Fehler(res, err, 'Datenbankfehler')
        return
      }

      if (req.body.forDay) {
        res.json(['SUCCESS', `Auswahl für ${req.body.forDay} aktiviert`])
      } else {
        res.json(['SUCCESS', 'Auswahl deaktiviert'])
      }
      ReloadSocket(type)
    })
  })
}

// vplan selection route
router.put('/schueler', (req, res) => {
  selectVplan('schueler', req, res)
})

router.put('/lehrer', (req, res) => {
  selectVplan('lehrer', req, res)
})

module.exports = router
