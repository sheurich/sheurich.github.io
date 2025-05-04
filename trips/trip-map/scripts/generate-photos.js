const fs = require("fs").promises;
const path = require("path");
const { Worker } = require("worker_threads");

async function main() {
  const photosDir = path.join(__dirname, "../photos");
  const files = await fs.readdir(photosDir);
  const workerPath = path.join(__dirname, "worker.js");

  // spawn a worker per image file
  const tasks = files
    .filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".jpg", ".jpeg", ".png"].includes(ext);
    })
    .map((file) => {
      const filePath = path.join(photosDir, file);
      return new Promise((resolve) => {
        const worker = new Worker(workerPath, {
          workerData: { filePath, fileName: file },
        });
        worker.on("message", (result) => resolve(result));
        worker.on("error", (err) =>
          resolve({ fileName: file, error: err.message })
        );
        worker.on("exit", (code) => {
          if (code !== 0)
            resolve({
              fileName: file,
              error: `Worker stopped with exit code ${code}`,
            });
        });
      });
    });

  const results = await Promise.all(tasks);

  // filter out failures and build output array
  const out = results
    .filter((r) => !r.error)
    .map(({ fileName, latitude, longitude, time }) => ({
      filename: fileName,
      url: `photos/${fileName}`,
      latitude,
      longitude,
      time,
    }));

  const dest = path.join(__dirname, "../photos.json");
  await fs.writeFile(dest, JSON.stringify(out, null, 2));
  console.log(`✔ Generated photos.json (${out.length} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
