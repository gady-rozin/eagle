const worker = new Worker("worker.js", { type: "module" });

const statusEl = document.getElementById("status");

let globalValues = [];
let globalTimestamps = [];

document.getElementById("fileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    statusEl.innerText = "Reading CSV...";

    const text = await file.text();
    const { values, timestamps } = parseCSV(text);

    globalValues = values;
    globalTimestamps = timestamps;

    statusEl.innerText = `Loaded ${values.length} rows. Processing...`;

    worker.postMessage({
        values: Float64Array.from(values),
        timestamps
    });
});

worker.onmessage = (e) => {
    const { changePoints, stats } = e.data;

    statusEl.innerText = `Done. Found ${changePoints.length} change points`;

    console.log("Stats:", stats);
    console.log("changePoints:", changePoints);

    drawChart(globalTimestamps, globalValues, changePoints);
};

function parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(/\t|,/);

    const tsIndex = headers.indexOf("timestamp_real");
    const valIndex = headers.indexOf("PM_N");


    const values = [];
    const timestamps = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        // const cols = lines[i].split(/\t|,/);

        if (cols.length < 2) continue;

        const ts = cols[tsIndex];
        const value = parseFloat(cols[valIndex]);

        if (!isNaN(value) && ts) {
            values.push(value);
            timestamps.push(ts);
        }
    }

    return { values, timestamps };
}

// 🔥 IMPORTANT for 100K+
function downsample(data, maxPoints = 2000) {
    if (data.length <= maxPoints) return data;

    const factor = Math.ceil(data.length / maxPoints);
    const result = [];

    for (let i = 0; i < data.length; i += factor) {
        result.push(data[i]);
    }

    return result;
}

function drawChart(labels, data, cps) {
  const ctx = document.getElementById("chart");

  //if (ctx) ctx.destroy();

  const datasets = [{
    label: "PM_N",
    data,
    borderColor: "blue",
    fill: false
  }];

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets
    },
    /*
    options: {
      responsive: true,
      plugins: {
        annotation: {
          annotations: cps.reduce((acc, cp, i) => {
            acc["cp" + i] = {
              type: "line",
              xMin: labels[cp],
              xMax: labels[cp],
              borderColor: "red",
              borderWidth: 2
            };
            return acc;
          }, {})
        }
      }
    }*/
  });
}