const worker = new Worker("worker.js", { type: "module" });

const statusEl = document.getElementById("status");

let globalValues = [];
let globalTimestamps = [];

document.getElementById("fileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    cachedData = parseCSV(text);

    document.getElementById("status").innerText = "CSV loaded. Click Run.";
});

document.getElementById("runBtn").addEventListener("click", () => {
    if (!cachedData) {
        alert("Please load a CSV first");
        return;
    }

    const params = {
        algo: document.getElementById("algo").value,
        window: parseInt(document.getElementById("window").value),
        penalty: parseInt(document.getElementById("penalty").value),
        smooth: parseInt(document.getElementById("smooth").value)
    };

    document.getElementById("status").innerText = "Processing...";

    worker.postMessage({
        values: Float64Array.from(cachedData.values),
        timestamps: cachedData.timestamps,
        USE_RBL: params.algo === "rbf",
        WINDOW: params.window,
        PENALTY: params.penalty,
        SMOOTH_WIN: params.smooth
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
    }
  });
}