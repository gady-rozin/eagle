// פונקציה לטעינת המידע האחרון מה-localStorage כשנפתח הדף
window.onload = function() {
    const lastDirectory = localStorage.getItem('lastProcessedDirectory');
    const lastDirectoryInfoDiv = document.getElementById('lastDirectoryInfo');
    if (lastDirectory) {
        lastDirectoryInfoDiv.textContent = `התיקייה האחרונה שעובדה: "${lastDirectory}"`;
    } else {
        lastDirectoryInfoDiv.textContent = 'עדיין לא עובדה אף תיקייה.';
    }
};

async function processFiles() {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'ממתין לבחירת תיקייה...';

    try {
        // בקשת גישה לתיקייה מהמשתמש
        const directoryHandle = await window.showDirectoryPicker();
        
        // שמירת שם התיקייה ב-localStorage
        localStorage.setItem('lastProcessedDirectory', directoryHandle.name);
        
        statusDiv.textContent = 'התיקייה נבחרה. מתחיל עיבוד קבצים...';
        
        // יצירת תיקיית פלט (אם אינה קיימת)
        const outputDirectoryHandle = await directoryHandle.getDirectoryHandle('processed_files', { create: true });
        
        let processedCount = 0;
        let fileCount = 0;

        // לולאה על כל הקבצים בתיקייה
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.csv')) {
                fileCount++;
                try {
                    const file = await entry.getFile();
                    const text = await file.text();
                    const newContent = processCsvContent(text);
                    
                    // יצירת קובץ חדש בתיקיית הפלט
                    const newFileName = 'processed_' + entry.name;
                    const newFileHandle = await outputDirectoryHandle.getFileHandle(newFileName, { create: true });
                    const writable = await newFileHandle.createWritable();
                    await writable.write(newContent);
                    await writable.close();
                    
                    processedCount++;
                    statusDiv.textContent = `מעבד קבצים... ${processedCount} מתוך ${fileCount} הושלמו.`;

                } catch (err) {
                    console.error(`שגיאה בעיבוד הקובץ ${entry.name}:`, err);
                    statusDiv.textContent = `שגיאה בעיבוד הקובץ ${entry.name}. אנא בדוק את קונסולת המפתחים לפרטים.`;
                }
            }
        }
        
        statusDiv.textContent = `סיום העיבוד. ${processedCount} קבצים עובדו בהצלחה. הקבצים החדשים נוצרו בתיקייה "processed_files".`;
        
    } catch (err) {
        if (err.name === 'AbortError') {
            statusDiv.textContent = 'הפעולה בוטלה על ידי המשתמש.';
        } else {
            console.error('אירעה שגיאה כללית:', err);
            statusDiv.textContent = 'אירעה שגיאה. אנא בדוק את קונסולת המפתחים לפרטים.';
        }
    }
}

/**
 * מעבד את תוכן ה-CSV ומחזיר את התוכן בפורמט החדש.
 * @param {string} csvText - תוכן קובץ ה-CSV המקורי.
 * @returns {string} - תוכן ה-CSV בפורמט החדש.
 * "#1 - Merkaz Mevakrim", 2025-09-05, 23:20:00, 63.45
 */
function processCsvContent(csvText) {
    const lines = csvText.split('\n');
    const newLines = [];

    // מתחילים מהשורה השלישית (אינדקס 2) כדי לדלג על שתי שורות הכותרת
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
            // מפצלים את השורה לפי ';'
            const parts = line.split(';');

            // מוודאים שיש לפחות 4 חלקים בשורה
            if (parts.length >= 4) {
                // חילוץ הנתונים לפי סדר השדות
                const device = parts[0].replace(/"/g, '').trim();
                const dateTime = parts[1].replace(/"/g, '').trim();
                const tsp = parts[2].replace(/"/g, '').trim();
                
                // פיצול התאריך והשעה
                const [date, time] = dateTime.split(' ');
                
                // החלפת פסיק בנקודה בערך ה-TSP
                const formattedTsp = tsp.replace(',', '.');

                // יצירת השורה החדשה בפורמט המבוקש
                const newRow = `"${device}", ${date}, ${time}, ${formattedTsp}`;
                newLines.push(newRow);
            }
        }
    }
    
    return newLines.join('\n');
}
