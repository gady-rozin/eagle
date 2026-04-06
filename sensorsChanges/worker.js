import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.mjs";

let pyodideReady = loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"
});

let initialized = false;

self.onmessage = async (event) => {
    const { values, timestamps } = event.data;

    const pyodide = await pyodideReady;

    if (!initialized) {
        await pyodide.loadPackage("micropip");
        const micropip = pyodide.pyimport("micropip");

        await micropip.install("ruptures");
        await micropip.install("pandas");

        initialized = true;
    }

    pyodide.globals.set("values", values);
    pyodide.globals.set("timestamps", timestamps);

    const result = pyodide.runPython(`
import numpy as np
import pandas as pd
import ruptures as rpt

VALUE_COL = "value"
DATE_COL = "timestamp"
WINDOW = 8
PENALTY = 10


def local_area(data, window=WINDOW):
    y = data[VALUE_COL].astype(float).values
    x = data[DATE_COL]
    time_seconds = (x - x.iloc[0]).dt.total_seconds().to_numpy()

    area_signal = np.zeros(len(y), dtype=float)

    for i in range(window, len(y)):
        y_segment = y[i-window:i]
        t_segment = time_seconds[i-window:i]
        area_signal[i] = np.trapezoid(y_segment, t_segment)

    return area_signal



def calculate_segment_stats(data, change_points):
    y = data[VALUE_COL].astype(float).values
    timestamps = data[DATE_COL]
    time_seconds = (timestamps - timestamps.iloc[0]).dt.total_seconds().to_numpy()

    boundaries = [0] + list(change_points)
    if boundaries[-1] != len(df):
        boundaries.append(len(df))

    stats = []
    for i in range(len(boundaries) - 1):
        start = boundaries[i]
        end = boundaries[i + 1]

        segment = y[start:end]
        if len(segment) == 0:
            continue

        segment_times = time_seconds[start:end]
        area_size = np.trapezoid(segment, segment_times) if len(segment) > 1 else 0.0

        stats.append({
            "start": int(start),
            "end": int(end),
            "mean": float(np.mean(segment)),
            "std": float(np.std(segment)),
            "area": float(area_size)
        })

    return stats

df = pd.DataFrame({
    VALUE_COL: values,
    DATE_COL: pd.to_datetime(timestamps, format='%d/%m/%Y %H:%M')
})

df = df.sort_values(DATE_COL).reset_index(drop=True)

area_signal = local_area(data=df)
derivative = np.gradient(area_signal)
algo = rpt.Pelt(model="rbf").fit(derivative)  # l2 OR rbf
changes =  algo.predict(pen=PENALTY)

filtered_changes = [int(cp) for cp in changes if cp < len(df)]
stats = calculate_segment_stats(data=df, change_points=filtered_changes)

{
    "changePoints": filtered_changes,
    "stats": stats
}
    `);

    self.postMessage(result.toJs());
};