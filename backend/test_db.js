const pool = require('./db/connection');
const xlsx = require('xlsx');
const { importarAsignaciones } = require('./controllers/directorController');

// Creando mock req
const workbook = xlsx.utils.book_new();
const worksheet = xlsx.utils.json_to_sheet([
  {
    "INSCRIPCIÓN": "1085312456",
    "DOCENTES": "Maikol Jefersson",
    "PROGRAMAS": "HORAS ADMINISTRATIVAS",
    "ASIGNATURAS": "ESTRATEGIAS SABER PRO",
    "SEMESTRE": "11-M",
    "PERIODO": "1 / 2026",
    "VIN": "MT",
    "HORAS": 2
  }
]);
xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");
const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

const req = { file: { buffer } };
const res = {
  status: function(code) { console.log("Status:", code); this.code = code; return this; },
  json: function(data) { console.log("RES:", this.code, data); process.exit(0); }
};

importarAsignaciones(req, res).catch(console.error);
