// view middleware
var express = require('express');
var exphbs = require('express-handlebars');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');
var app = express();

// storage middleware
var fs = require('fs');
var DB = require('./modules/DB-Connection.js');
DB.settings.findOne({}, function (err, doc) {
  if (doc === null) {
    DB.settings.insert({
      displayAmount: 20,
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
var vplans = require('./routes/vplans');
var view = require('./routes/view');


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
var moveUpVplan = nodeSchedule.scheduleJob('* 2 0 0 0', function () {
  console.log("Vplan move up at 2:00");
  DB.vplans.update({ forDay: "heute" }, { $set: { forDay: "" } }, function (err) {
    if (err) {
      console.log(err);
      return;
    }

    DB.vplans.update({ forDay: "morgen" }, { $set: { forDay: "heute" } }, function (err) {
      if (err) {
        console.log(err);
        return;
      }

      console.log("Successfully moved up Vplan");
    });
  });
});


// app routes

app.get('/', function (req, res) {
  res.send("Nutze /heute|morgen");
});

// settings route
app.use('/settings', settings);

// placeholder route
app.use('/placeholder', express.static('views/placeholder.html'));

// vplans route
app.use('/vplans', vplans);

// dashboard route
app.use('/dashboard', dashboard);

// view display system
app.use('/heute', view);
app.use('/morgen', view);

// display a not found page
app.get('*', function (req, res) {
  res.redirect('/');
});

// app start on port 80
app.listen(80, function () {
  console.log("Example app listening on port 80!");
});
