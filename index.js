var express = require('express');
var exphbs = require('express-handlebars');
var bodyParser = require('body-parser');
var moment = require('moment');
var app = express();
var Datastore = require('nedb');
var db = new Datastore({ filename: 'db/files.db', autoload: true });
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

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

// API for public assets
app.use('/public', express.static('public'));

// end of app-initialisations

// readVplan function
function readVplan(forDay) {
  db.findOne({ forDay: forDay }, function (err, doc) {
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
var moveUpVplan = nodeSchedule.scheduleJob('* 2 * * *', function(){
  console.log("Vplan move up at 2:00");
  db.update({ forDay: "heute" }, { $set: { forDay: null } }, function (err) {
    if (err) {
      console.log(err);
      return;
    }
    db.update({ forDay: "morgen" }, { $set: { forDay: "heute" } }, function (err) {
      if (err) {
        console.log(err);
        return;
      }
    });
  });
});

// app routes

// Vplan upload route
app.post('/file', function (req, res) {
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
    db.insert({
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
app.delete('/file', function (req, res) {
  if (req.body.id === undefined) {
    res.send(["ERROR", "NO_FILE_ID_GIVEN"]);
    return;
  }
  fs.unlink(__dirname + "/uploads/" + req.body.name, function () {
    db.remove({ _id: req.body.id }, function (err) {
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
app.get('/file', function (req, res) {
  db.find({}, function (err, docs) {
    res.send(docs);
  });
});

// select Vplan
app.put('/file', function (req, res) {
  if (req.body.id === undefined) {
    res.send(["ERROR", "NO_FILE_ID_GIVEN"]);
    return;
  }
  db.update({ forDay: { $ne: null } }, { $set: { forDay: null } }, function (err) {
    if (err) {
      res.send(["ERROR", err]);
      console.log(err);
      return;
    }
    db.update({ _id: req.body.id }, { $set: { forDay: req.body.forDay } }, function (err) {
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
  }
  db.find({}, function (err, docs) {
    res.render('dashboard', {
      activePage: activePage,
      vplanList: docs
    });
  });
});

// app root route
app.get('/', function (req, res) {
  res.send("Nutze /heute|morgen/0/?a=A&b=B&c=C");
});

// Vplan display system
app.get('/heute', function (req, res) {
  res.redirect('/heute/0?a=' + req.query.a + '&b=' + req.query.b + '&c=' + req.query.c);
});

app.get('/morgen', function (req, res) {
  res.redirect('/morgen/0?a=' + req.query.a + '&b=' + req.query.b + '&c=' + req.query.c);
});

app.get('/heute/loops', function (req, res) {
  var data = heute.vp.haupt[0].aktion;
  res.send(Math.ceil((data.length) / 20).toString());
});

app.get('/morgen/loops', function (req, res) {
  var data = morgen.vp.haupt[0].aktion;
  res.send(Math.ceil((data.length) / 20).toString());
});

app.get('/heute/:offset', function (req, res) {
  if (heute === undefined) {
    res.send("NO_VPLAN_SELECTED");
    return;
  }
  timeParameters = {
    a: req.query.a,
    b: req.query.b,
    c: req.query.c
  };
  //console.log(req.params.offset);
  var offset = parseInt(req.params.offset);
  var data = heute.vp.haupt[0].aktion;
  var array = [];
  for (var i = (offset * 20); i < ((offset + 1) * 20) && i < data.length; i++) {
    array.push(data[i]);
  }
  res.render('vplan', {
    data: array
  });
});

app.get('/morgen/:offset', function (req, res) {
  if (morgen === undefined) {
    res.send("NO_VPLAN_SELECTED");
    return;
  }
  timeParameters = {
    a: req.query.a,
    b: req.query.b,
    c: req.query.c
  };
  //console.log(req.params.offset);
  var offset = parseInt(req.params.offset);
  var data = morgen.vp.haupt[0].aktion;
  var array = [];
  for (var i = (offset * 20); i < ((offset + 1) * 20) && i < data.length; i++) {
    array.push(data[i]);
  }
  res.render('vplan', {
    data: array
  });
});

// app start on port 80
app.listen(80, function () {
  console.log('Example app listening on port 80!');
});
