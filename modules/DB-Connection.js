var Datastore = require('nedb');
var DB = {};
DB.vplans = new Datastore({ filename: 'db/vplans.db', autoload: true });
DB.settings = new Datastore({ filename: 'db/settings.db', autoload: true });

module.exports = DB;