// A Node “worker thread” that parses one image’s EXIF and sends back the data

const { parentPort, workerData } = require("worker_threads");
const exifr = require("exifr");

(async () => {
  try {
    const { filePath, fileName } = workerData;
    const data = await exifr.parse(filePath, { gps: true, exif: true });
    parentPort.postMessage({
      fileName,
      latitude: data.latitude,
      longitude: data.longitude,
      time: new Date(data.DateTimeOriginal).toISOString(),
    });
  } catch (err) {
    parentPort.postMessage({
      fileName: workerData.fileName,
      error: err.message,
    });
  }
})();
