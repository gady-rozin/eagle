# analysis.py
import numpy as np
import pandas as pd
import ruptures as rpt


def run_analysis(values, timestamps, USE_RBL=True, WINDOW = 8, PENALTY=10, SMOOTH_WIN = 25):
    VALUE_COL = "value"
    DATE_COL = "timestamp"

    def smooth(signal, window):
        return np.convolve(signal, np.ones(window)/window, mode='same')

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
            if len(segment) == 0: continue
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

    def filter_changes(changes, min_size=100):
        filtered = []
        prev = 0
        for cp in changes:
            if cp - prev >= min_size:
                filtered.append(cp)
                prev = cp
        return filtered

    df = pd.DataFrame({
        VALUE_COL: values,
        DATE_COL: pd.to_datetime(timestamps, format='%d/%m/%Y %H:%M')
    })
    df = df.sort_values(DATE_COL).reset_index(drop=True)
    area_signal = local_area(data=df)
    derivative = np.gradient(area_signal)

    if USE_RBL:
        algo = rpt.Pelt(model="rbf").fit(derivative)
        changes =  algo.predict(pen=PENALTY)
        filtered_changes = [int(cp) for cp in changes if cp < len(df)]
    else:
        signal = smooth(derivative, SMOOTH_WIN)
        algo = rpt.Pelt(model="l2").fit(signal)
        changes = algo.predict(pen=PENALTY)
        filtered_changes = filter_changes(changes, min_size=100)

    stats = calculate_segment_stats(data=df, change_points=filtered_changes)
    
    # Return the result
    return {
        "changePoints": filtered_changes,
        "stats": stats
    }