// Express Backend API with CSV / Excel Upload & SLA Calculator Endpoint
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Setup Multer memory storage for Excel/CSV file uploads
const upload = multer({ storage: multer.memoryStorage() });

// API Endpoint to process Excel / CSV and compute SLA Percentage
app.post('/api/sla/calculate-file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No CSV or Excel file uploaded' });
    }

    // Read workbook buffer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rawData || rawData.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty' });
    }

    let totalOperating = 0;
    let totalExclusions = 0;
    let totalExpected = 0;

    rawData.forEach(row => {
      const op = parseFloat(row.OperatingMinutes || row.operating_minutes || (row.Status === 'ONLINE' ? 1440 : 0));
      const excl = parseFloat(row.ExclusionMinutes || row.exclusion_minutes || 0);
      const total = parseFloat(row.TotalMinutes || row.total_minutes || 1440);

      totalOperating += op;
      totalExclusions += excl;
      totalExpected += total;
    });

    if (totalExpected === 0) totalExpected = rawData.length * 1440;

    const grossUptimePercent = parseFloat(((totalOperating / totalExpected) * 100).toFixed(2));
    const netSlaUptimePercent = parseFloat((((totalOperating + totalExclusions) / totalExpected) * 100).toFixed(2));

    res.json({
      success: true,
      fileName: req.file.originalname,
      rowCount: rawData.length,
      metrics: {
        totalOperatingMinutes: totalOperating,
        totalExclusionMinutes: totalExclusions,
        totalExpectedMinutes: totalExpected,
        grossUptimePercent: Math.min(100, grossUptimePercent),
        netSlaUptimePercent: Math.min(100, netSlaUptimePercent)
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error parsing Excel/CSV file' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Camera Uptime SLA API Server running on port ${PORT}`);
});
