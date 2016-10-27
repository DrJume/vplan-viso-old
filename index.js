var express = require('express');
var exphbs = require('express-handlebars');
var bodyParser = require('body-parser');
var moment = require('moment');
var app = express();
var Datastore = require('nedb');
var db = new Datastore({ filename: 'db/files.db', autoload: true });
var fs = require('fs');
xml2js = require('xml2js');
var parser = new xml2js.Parser();
var xmlData;
var timeParameters;
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

app.use('/public', express.static('public'));

function readVplan() {
  db.findOne({ active: true }, function (err, doc) {
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
        xmlData = result;
      });
    });
  });
}
readVplan();

app.post('/file', function (req, res) {
  upload(req, res, function (err) {
    if (err) {
      if (err.code == "LIMIT_FILE_SIZE") {
        res.send("FILE_TO_BIG");
      }
      return;
    }
    if (!req.file) {
      res.send("NO_FILE");
      return;
    }
    db.insert({
      filename: req.file.filename,
      active: false
    }, function (err) {
      if (err) {
        console.log(err);
        return;
      }
      res.redirect("/dashboard");
    });

  });
});

app.delete('/file', function (req, res) {
  if (req.body.id === "") {
    res.send("NOTHING_SELECTED");
    return;
  }
  fs.unlink(__dirname + "/uploads/" + req.body.name, function () {
    db.remove({ _id: req.body.id }, function (err) {
      if (err) {
        res.send("ERROR");
        console.log(err);
        return;
      }
      res.send("SELECTION_DELETED");
    });
  });
});

app.get('/file', function (req, res) {
  db.find({}, function (err, docs) {
    res.send(docs);
  });
});

app.put('/file', function (req, res) {
  db.update({ active: true }, { $set: { active: false } }, function (err) {
    if (err) {
      res.send("ERROR");
      console.log(err);
      return;
    }
    db.update({ _id: req.body.id }, { $set: { active: true } }, function (err) {
      if (err) {
        res.send("ERROR");
        console.log(err);
        return;
      }
      readVplan();
      res.send("VPLAN_SELECTED");
    });
  });
});



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

app.get('/', function (req, res) {
  res.redirect('/0?a=' + req.query.a + '&b=' + req.query.b + '&c=' + req.query.c);
});

app.get('/loops', function (req, res) {
  var data = xmlData.vp.haupt[0].aktion;
  res.send(Math.ceil((data.length) / 20).toString());
});

app.get('/:offset', function (req, res) {
  readVplan();
  if (xmlData === undefined) {
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
  var data = xmlData.vp.haupt[0].aktion;
  var array = [];
  for (var i = (offset * 20); i < ((offset + 1) * 20) && i < data.length; i++) {
    array.push(data[i]);
  }
  res.render('vplan', {
    data: array
  });

});

app.listen(4000, function () {
  console.log('Example app listening on port 4000!');
});
