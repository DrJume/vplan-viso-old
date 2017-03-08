const shell = require('child_process').exec;

shell('npm install', function (error, stdout, stderr) {
  if (error) {
    console.error(error);
    return;
  }
  console.log("Neues update wird installiert...");
  shell('npm start', function (error, stdout, stderr) {
    if (error) {
      console.error(error);
      return;
    }
    console.log("Neues update wird gestartet!");
  });
});