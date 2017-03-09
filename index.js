// create uploads/ if not exist
var fs = require('fs');
if (!fs.existsSync(__dirname + "/uploads/")) {
  console.log("Creating uploads/ directories");
  fs.mkdir(__dirname + "/uploads/", function(){
    fs.mkdir(__dirname + "/uploads/schueler/", function(){
      
    });
    fs.mkdir(__dirname + "/uploads/lehrer/", function(){
    
    });
  });
}

// config
var config = require('./package').config;

// view middleware
var express = require('express');
var exphbs = require('express-handlebars');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');
var app = express();

// storage middleware
var DB = require('./modules/DB-Connection.js');
DB.settings.findOne({}, function (err, doc) {
  if (doc === null) {
    DB.settings.insert({
      displayTime: {
        "0-25": 3,
        "25-50": 6,
        "50-75": 8,
        "75-100": 12
      }
    }, function (err) {
      if (err) {
        console.log(err);
        return;
      }
    });
  }
});

// scheduling middleware
var nodeSchedule = require('node-schedule');

// router middleware
var settings = require('./routes/settings');
var dashboard = require('./routes/dashboard');
var api = require('./routes/api');
var schueler = require('./routes/schueler');
var lehrer = require('./routes/lehrer');


// Handlebars engine initialisation
var hbs = exphbs.create({
  defaultLayout: 'main',
  // Specify helpers which are only registered on this instance.
  helpers: {
    isActivePage: function (page, activePage) {
      if (page == activePage) {
        return "active";
      } else {
        return "";
      }
    },
    socketUrl: function () {
      return "http://" + config.ip + ':' + config.socket_port;
    }
  }
});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

// serve favicon.ico
app.use(favicon(__dirname + '/public/favicon.png'));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// parse application/json
app.use(bodyParser.json());

// API for public assets
app.use('/public', express.static('public'));

// move up schedule at 2:00 (AM)
var moveUpVplan = nodeSchedule.scheduleJob('0 2 * * *', function () {
  console.log("Vertretungsplan-Tagesanpassung um 2 Uhr");

  DB.schueler.update({ forDay: "heute" }, { $set: { forDay: "" } }, function (err) {
    if (err) {
      console.log(err);
      return;
    }

    DB.schueler.update({ forDay: "morgen" }, { $set: { forDay: "heute" } }, function (err) {
      if (err) {
        console.log(err);
        return;
      }

      console.log("Vertretungsplan-Tagesanpassung für Schüler durchgeführt");
    });
  });

  DB.lehrer.update({ forDay: "heute" }, { $set: { forDay: "" } }, function (err) {
    if (err) {
      console.log(err);
      return;
    }

    DB.lehrer.update({ forDay: "morgen" }, { $set: { forDay: "heute" } }, function (err) {
      if (err) {
        console.log(err);
        return;
      }

      console.log("Vertretungsplan-Tagesanpassung für Lehrer durchgeführt");
    });
  });
});


// app routes

app.get('/', function (req, res) {
  res.render('about');
});

// settings route
app.use('/settings', settings);

// placeholder route
app.use('/placeholder', express.static('views/placeholder.html'));

// api route
app.use('/api', api);

// dashboard route
app.use('/dashboard', dashboard);

// view display system
app.use('/schueler', schueler);
app.use('/lehrer', lehrer);

// display a not found page
app.get('*', function (req, res) {
  res.redirect('/');
});

// app start
app.listen(config.app_port, function () {
  console.log("ManosVplan listening on port " + config.app_port + "!");
});
