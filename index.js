var express = require('express');
var exphbs = require('express-handlebars');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');
var moment = require('moment');
var app = express();
var Datastore = require('nedb');
var DB = {};
DB.vplans = new Datastore({ filename: 'db/vplans.db', autoload: true });
DB.settings = new Datastore({ filename: 'db/settings.db', autoload: true });
DB.settings.findOne({}, function (err, doc) {
  if (doc === null) {
    DB.settings.insert({}, function (err) {
      if (err) {
        console.log(err);
        return;
      }
    });
  }
});
var fs = require('fs');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var nodeSchedule = require('node-schedule');
var heute, morgen;
var timeParameters;
// file upload system
var multer = require('multer');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, moment().format("D.MM.YYYY H_mm") + ' - ' + file.originalname);
  }
});
var upload = multer({
  storage: storage,
  limits: { fileSize: 524288000 }
}).single('file_upload');

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

    getDataSafe: function (data) {
      if (data[0]._ === undefined) {
        if (data[0].$ !== undefined) {
          return null;
        } else {
          return data[0];
        }
      } else {
        return data[0]._;
      }
    },

    getTimeParameter: function (factor) {
      return timeParameters[factor];
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

// end of app-initialisations

// readVplan function
function readVplan(forDay) {
  DB.vplans.findOne({ forDay: forDay }, function (err, doc) {
    if (err) {
      console.log(err);
      return;
    }
    if (doc === null) {
      return;
    }
    fs.readFile(__dirname + '/uploads/' + doc.filename, function (err, xml) {
      parser.parseString(xml, function (err, result) {
        if (err) {
          console.log(err);
          return;
        }
        switch (forDay) {
          case "heute": {
            heute = result;
            break;
          }
          case "morgen": {
            morgen = result;
            break;
          }
          default: {
            return;
          }
        }
      });
    });
  });
}
// reading Vplans on startup
readVplan("heute");
readVplan("morgen");

// move up schedule at 2:00 (AM)
var moveUpVplan = nodeSchedule.scheduleJob('* 2 0 0 0', function () {
  console.log("Vplan move up at 2:00");
  DB.vplans.update({ forDay: "heute" }, { $set: { forDay: null } }, function (err) {
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

// Settings route
app.put('/settings', function (req, res) {
  DB.settings.update({}, {
    vplanItemsDisplay: parseInt(req.body.vplanItemsDisplay),
    displayTime: {
      "0-25": parseInt(req.body.displayTime['0-25']),
      "25-50": parseInt(req.body.displayTime['25-50']),
      "50-75": parseInt(req.body.displayTime['50-75']),
      "75-100": parseInt(req.body.displayTime['75-100'])
    }
  }, {}, function (err) {
    if (err) {
      console.log(err);
      res.send(["ERROR", "DB_UPDATE_FAILED"]);
      return;
    }
    res.send(["SUCCESS", "SETTINGS_APPLIED"]);
  });
});

// Vplan upload route
app.post('/vplans', function (req, res) {
  upload(req, res, function (err) {
    if (err) {
      if (err.code == "LIMIT_FILE_SIZE") {
        res.send(["ERROR", "FILE_TO_BIG"]);
      }
      return;
    }
    if (!req.file) {
      res.send(["ERROR", "NO_FILE"]);
      return;
    }
    DB.vplans.insert({
      filename: req.file.filename,
      forDay: null
    }, function (err) {
      if (err) {
        console.log(err);
        return;
      }
      res.redirect("/dashboard");
    });

  });
});

// Vplan deletion route
app.delete('/vplans', function (req, res) {
  if (req.body.id === undefined) {
    res.send(["ERROR", "NO_FILE_ID_GIVEN"]);
    return;
  }
  fs.unlink(__dirname + "/uploads/" + req.body.name, function () {
    DB.vplans.remove({ _id: req.body.id }, function (err) {
      if (err) {
        res.send("ERROR", err);
        console.log(err);
        return;
      }
      res.send(["SUCCESS", "SELECTION_DELETED"]);
    });
  });
});

// debug: get listed Vplans
app.get('/vplans', function (req, res) {
  DB.vplans.find({}, function (err, docs) {
    res.send(docs);
  });
});

// select Vplan
app.put('/vplans', function (req, res) {
  if (req.body.id === undefined) {
    res.send(["ERROR", "NO_FILE_ID_GIVEN"]);
    return;
  }
  DB.vplans.update({ forDay: req.body.forDay }, { $set: { forDay: null } }, function (err) {
    if (err) {
      res.send(["ERROR", err]);
      console.log(err);
      return;
    }
    DB.vplans.update({ _id: req.body.id }, { $set: { forDay: req.body.forDay } }, function (err) {
      if (err) {
        res.send(["ERROR", err]);
        console.log(err);
        return;
      }
      switch (req.body.forDay) {
        case "heute": {
          readVplan("heute");
          break;
        }
        case "morgen": {
          readVplan("morgen");
          break;
        }
        default: {
          return;
        }
      }
      res.send(["SUCCESS", "VPLAN_SELECTED: " + req.body.forDay]);
    });
  });
});

// dashboard route
app.get('/dashboard', function (req, res) {
  var activePage = "";
  switch (req.query.p) {
    case undefined: {
      res.redirect("/dashboard?p=select");
      return;
    }
    case "select": {
      activePage = "select";
      break;
    }
    case "upload": {
      activePage = "upload";
      break;
    }
    case "settings": {
      activePage = "settings";
      break;
    }
  }
  DB.vplans.find({}, function (err, docVplans) {
    DB.settings.findOne({}, function (err, docSettings) {
      res.render('dashboard', {
        activePage: activePage,
        vplanList: docVplans,
        settings: docSettings
      });
    });
  });
});

// app root route
app.get('/', function (req, res) {
  res.send("Nutze /heute|morgen/0");
});

// Vplan display system
app.get('/heute', function (req, res) {
  res.redirect('/heute/0');
});

app.get('/morgen', function (req, res) {
  res.redirect('/morgen/0');
});

app.get('/heute/loops', function (req, res) {
  var data = heute.vp.haupt[0].aktion;
  DB.settings.findOne({}, function (err, settings) {
    if (err) {
      console.log(err);
      return;
    }
    res.send(Math.ceil((data.length) / settings.vplanItemsDisplay).toString());
  });
});

app.get('/morgen/loops', function (req, res) {
  var data = morgen.vp.haupt[0].aktion;
  DB.settings.findOne({}, function (err, settings) {
    if (err) {
      console.log(err);
      return;
    }
    res.send(Math.ceil((data.length) / settings.vplanItemsDisplay).toString());
  });
});

app.get('/heute/:offset', function (req, res) {
  DB.settings.findOne({}, function (err, settings) {
    if (err) {
      console.log(err);
      return;
    }

    if (heute === undefined) {
      res.send("NO_VPLAN_SELECTED");
      return;
    }

    //console.log(req.params.offset);
    var offset = parseInt(req.params.offset);
    var data = heute.vp.haupt[0].aktion;
    var array = [];

    for (var i = (offset * settings.vplanItemsDisplay); i < ((offset + 1) * settings.vplanItemsDisplay) && i < data.length; i++) {
      array.push(data[i]);
    }

    var displayTime = 5;

    if (array.length / settings.vplanItemsDisplay <= 0.25) {
      displayTime = settings.displayTime['0-25'];
    } else if (array.length / settings.vplanItemsDisplay <= 0.5) {
      displayTime = settings.displayTime['25-50'];
    } else if (array.length / settings.vplanItemsDisplay <= 0.75) {
      displayTime = settings.displayTime['50-75'];
    } else if (array.length / settings.vplanItemsDisplay <= 1) {
      displayTime = settings.displayTime['75-100'];
    }

    res.render('vplan', {
      data: array,
      displayTime: displayTime
    });
  });
});

app.get('/morgen/:offset', function (req, res) {
  DB.settings.findOne({}, function (err, settings) {
    if (err) {
      console.log(err);
      return;
    }

    if (morgen === undefined) {
      res.send("NO_VPLAN_SELECTED");
      return;
    }

    //console.log(req.params.offset);
    var offset = parseInt(req.params.offset);
    var data = morgen.vp.haupt[0].aktion;
    var array = [];

    for (var i = (offset * settings.vplanItemsDisplay); i < ((offset + 1) * settings.vplanItemsDisplay) && i < data.length; i++) {
      array.push(data[i]);
    }

    var displayTime = 5;

    if (array.length / settings.vplanItemsDisplay <= 0.25) {
      displayTime = settings.displayTime['0-25'];
    } else if (array.length / settings.vplanItemsDisplay <= 0.5) {
      displayTime = settings.displayTime['25-50'];
    } else if (array.length / settings.vplanItemsDisplay <= 0.75) {
      displayTime = settings.displayTime['50-75'];
    } else if (array.length / settings.vplanItemsDisplay <= 1) {
      displayTime = settings.displayTime['75-100'];
    }

    res.render('vplan', {
      data: array,
      displayTime: displayTime
    });
  });
});

// app start on port 80
app.listen(80, function () {
  console.log('Example app listening on port 80!');
});
