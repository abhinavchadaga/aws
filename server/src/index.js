const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const unzipper = require("unzipper");
const { spawn } = require("child_process");
const cors = require("cors");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const port = 3000;
const UPLOAD_DIR = path.join(__dirname, "../uploads");

/**
 * Ensures that the upload folder exists before any upload requests are handled
 *
 * @param req Request object
 * @param res Response object
 * @param next next middleware function to run
 */
function createUploadFolder(req, res, next) {
  if (!fs.existsSync(UPLOAD_DIR)) {
    console.log(`creating ${UPLOAD_DIR}...`);
    fs.mkdirSync(UPLOAD_DIR);
  }
  next();
}

app.use(createUploadFolder);

// Multer storage object to place uploaded files
// in the uploads folder and rename them with a timestamp
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // create a new filename using the original file name and a timestamp
    const suffix = Date.now();
    const parsedFilename = path.parse(file.originalname);
    cb(null, `${parsedFilename.name}_${suffix}${parsedFilename.ext}`);
  },
});

/**
 * Multer file filter to only allow zip and csv files
 *
 * @param req Request
 * @param file Uploaded file
 * @param cb callback to call when file is accepted or rejected
 */
function fileFilter(req, file, cb) {
  // only zips and csv files are allowed
  const allowedExtensions = new Set([".zip", ".csv"]);
  const ext = path.extname(file.originalname);
  if (allowedExtensions.has(ext)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
}

// multer object to handle uploads
const upload = multer({ storage, fileFilter });

/**
 * Allows only one user to be using server at a time
 * @param res Response object
 * @param req Request object
 * @param next next middleware function to run
 */
function checkAvailability(req, res, next) {
  const uploads = fs.readdirSync(UPLOAD_DIR);
  if (uploads.length > 0) {
    res.status(400).json({ message: "server is busy! please try again later" });
    return;
  }
  next();
}

/**
 * POST route to upload dataset to server
 */
app.post(
  "/dataset/upload",
  checkAvailability,
  upload.single("dataset"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "file upload failed" });
    }

    // unzip to same location and delete zip
    if (req.file.mimetype === "application/zip") {
      const files = fs.readdirSync(UPLOAD_DIR);
      const path_to_zip = path.join(UPLOAD_DIR, files[0]);
      fs.createReadStream(path_to_zip)
        .pipe(unzipper.Extract({ path: UPLOAD_DIR }))
        .on("close", () => {
          fs.unlinkSync(path_to_zip);
          res.json({
            message: `successfully uploaded ${req.file.originalname}`,
          });
        });
    } else {
      // uploaded file was a csv file
      res.json({ message: `successfully uploaded ${req.file.originalname}` });
    }
  }
);

app.delete("/dataset/delete", (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR);
  if (files.length === 0) {
    return res.json({ message: "nothing to delete" });
  }

  const path_to_dataset = path.join(UPLOAD_DIR, files[0]);
  if (fs.lstatSync(path_to_dataset).isDirectory()) {
    fs.rmSync(path_to_dataset, { recursive: true });
  } else {
    fs.unlinkSync(path_to_dataset);
  }
  res.json({ message: `successfully deleted ${files[0]}` });
});

let ARCH = null;
/**
 * POST route to select the architecture of the model to train
 */
app.post("/select-arch", (req, res) => {
  const validArchitectures = new Set(["alexnet", "vgg", "resnet"]);
  if (req.body.arch && validArchitectures.has(req.body.arch)) {
    ARCH = req.body.arch;
    return res.json({ message: `selected ${ARCH} architecture` });
  }
  return res.status(400).json({ message: "invalid selection" });
});

const progress = { progress: 0 };
let pythonProcess = null;

app.post("/train/start", (req, res) => {
  if (ARCH === null) {
    return res.status(400).json({ message: "no architecture selected" });
  }

  if (pythonProcess !== null) {
    return res.status(400).json({ message: "training already in progress" });
  }

  const pythonEnv = "/Users/abhinavchadaga/miniforge3/envs/py39/bin/python3";
  pythonProcess = spawn(pythonEnv, ["./src/train.py"]);

  // write initial progress to python process
  pythonProcess.stdin.write(JSON.stringify(progress));
  pythonProcess.stdin.end();

  // update progress event
  pythonProcess.stdout.on("data", (data) => {
    const update = JSON.parse(data);
    progress.progress = update.progress;
    console.log(`progress: ${progress.progress}`);
  });

  // register exit event
  pythonProcess.on("close", (code) => {
    console.log(`child process exited with code ${code}`);
  });

  // register error event
  pythonProcess.on("error", (err) => {
    console.log(err);
  });

  res.status(203).json({ message: "training started" });
});

app.get("/train/progress", (req, res) => {
  if (pythonProcess === null) {
    return res.status(400).json({ message: "no training in progress" });
  }
  // create SSE stream
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // send progress updates
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify(progress)}\n\n`);
  }, 1000);

  // close SSE stream when training is complete
  pythonProcess.on("close", () => {
    clearInterval(interval);
    pythonProcess = null;
    res.write("data: training complete\n\n");
    res.end();
  });
});

app.listen(port, () => console.log(`listening on ${port}`));
