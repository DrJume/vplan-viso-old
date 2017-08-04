const Datastore = require('nedb')

const DB = {}
DB.schueler = new Datastore({ filename: 'db/schueler.db', autoload: true })
DB.lehrer = new Datastore({ filename: 'db/lehrer.db', autoload: true })
DB.settings = new Datastore({ filename: 'db/settings.db', autoload: true })

module.exports = DB
