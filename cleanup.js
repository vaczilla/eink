const { exec } = require("child_process");

function cleanup() {
  exec("rm -rf .git", (error, stdout, stderr) => {
    if (error) {
      console.error(`Eroare: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return;
    }
    console.log("Fișierul .git a fost șters cu succes!");
  });
}

// Rulează cleanup la fiecare 24 de ore
setInterval(cleanup, 24 * 60 * 60 * 1000);

// Rulează cleanup și la pornirea scriptului
cleanup();
