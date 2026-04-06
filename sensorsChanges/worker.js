import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.mjs";

let pyodideReady = loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"
});

let initialized = false;

self.onmessage = async (event) => {
    const { values, timestamps, USE_RBL, WINDOW, PENALTY, SMOOTH_WIN } = event.data;
    const pyodide = await pyodideReady;

    if (!initialized) {
        // 1. Install dependencies
        await pyodide.loadPackage(["micropip", "pandas", "numpy"]);
        const micropip = pyodide.pyimport("micropip");
        await micropip.install("ruptures");

        // 2. Fetch your external .py file
        // Ensure the path is correct relative to your server root
        const response = await fetch("./analysis.py"); 
        const pythonCode = await response.text();

        // 3. Write the code to Pyodide's internal file system
        pyodide.FS.writeFile("analysis_module.py", pythonCode);

        initialized = true;
    }

    // Pass data to Python globals
    pyodide.globals.set("values", values.toPy ? values.toPy() : values);
    pyodide.globals.set("timestamps", timestamps.toPy ? timestamps.toPy() : timestamps);
    pyodide.globals.set("timestamps", timestamps.toPy ? timestamps.toPy() : timestamps);
    pyodide.globals.set("USE_RBL", USE_RBL);
    pyodide.globals.set("WINDOW", WINDOW);
    pyodide.globals.set("PENALTY", PENALTY);
    pyodide.globals.set("SMOOTH_WIN", SMOOTH_WIN);

    // 4. Run the code by importing the written module
    // We use importlib.reload to ensure changes to the .py file are picked up if it changes
    const result = pyodide.runPython(`
        import analysis_module
        import importlib
        importlib.reload(analysis_module)
        
        # This assumes your logic is wrapped in a function inside analysis.py
        # Or you can just run specific logic from the module
        analysis_module.run_analysis(values, timestamps,USE_RBL=USE_RBL, WINDOW=WINDOW, PENALTY=PENALTY, SMOOTH_WIN=SMOOTH_WIN)
    `);

    self.postMessage(result.toJs());
};