// A Node “worker thread” that parses one image’s EXIF and sends back the data

const { parentPort, workerData } = require("worker_threads");
const exifr = require("exifr");

(async () => {
  try {
    const { filePath, fileName } = workerData;
    const data = await exifr.parse(filePath, { gps: true, exif: true });

    const timeValue =
      data?.DateTimeOriginal ?? data?.CreateDate ?? data?.ModifyDate ?? data?.DateTime;
    const time = new Date(timeValue);
    if (!Number.isFinite(time.getTime())) {
      throw new Error("No valid EXIF time found");
    }

    parentPort.postMessage({
      fileName,
      latitude: data.latitude,
      longitude: data.longitude,
      time: time.toISOString(),
    });
  } catch (err) {
    parentPort.postMessage({
      fileName: workerData.fileName,
      error: err.message,
    });
  }
})();
