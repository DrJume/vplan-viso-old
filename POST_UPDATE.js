const shell = require('child_process').exec;

console.log("Das neue Update wird nun installiert...");
shell('npm install', function (error, stdout, stderr) {
  if (error) {
    console.error(error);
    return;
  }
  console.log("Es wird versucht das neue System zu starten...");
  shell('npm start', function (error, stdout, stderr) {
    if (error) {
      console.error(error);
      return;
    }
    console.log("Starten erfolgreich!");
    console.log("Das System wurde erfolgreich geupdatet!");
  });
});