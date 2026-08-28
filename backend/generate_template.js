const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function generateTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGAP - Universidad CESMAG';
    workbook.lastModifiedBy = 'SIGAP';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Plantilla Importación Usuarios', {
        views: [{ showGridLines: true }]
    });

    // Anchos de Columna
    worksheet.columns = [
        { key: 'nombres', width: 24 },
        { key: 'apellidos', width: 24 },
        { key: 'tipo_documento', width: 18 },
        { key: 'numero_documento', width: 22 },
        { key: 'correo', width: 34 },
        { key: 'roles', width: 28 },
        { key: 'programa', width: 30 }
    ];

    // Logo CESMAG (Filas 1 a 4, Columnas A a B)
    const logoPath = path.join(__dirname, '..', 'frontend', 'public', 'logo_cesmag.png');
    if (fs.existsSync(logoPath)) {
        const imageId = workbook.addImage({
            filename: logoPath,
            extension: 'png',
        });
        worksheet.addImage(imageId, {
            tl: { col: 0.1, row: 0.2 },
            br: { col: 1.9, row: 4.8 }
        });
    }

    // Encabezado Banner Titulo (Unir C1:G4)
    worksheet.mergeCells('C1:G4');
    const headerCell = worksheet.getCell('C1');
    headerCell.value = {
        richText: [
            { text: 'UNIVERSIDAD CESMAG\n', font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' } },
            { text: 'SISTEMA INTEGRADO DE GESTIÓN ACADÉMICA (SIGAP)\n', font: { bold: true, size: 11, color: { argb: 'FFE2E8F0' }, name: 'Calibri' } },
            { text: 'Plantilla Oficial de Importación Masiva de Usuarios / Docentes', font: { italic: true, size: 10, color: { argb: 'FFCBD5E1' }, name: 'Calibri' } }
        ]
    };
    headerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A2744' } // Azul marino institucional
    };
    headerCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Fila 5: Espacio en blanco
    worksheet.getRow(5).height = 10;

    // Fila 6: Fila de Instrucciones (Unir A6:G6)
    worksheet.mergeCells('A6:G6');
    const instructionCell = worksheet.getCell('A6');
    instructionCell.value = '📌 INSTRUCCIONES: Los campos marcados con (*) son obligatorios. En "Roles" puede especificar uno o varios roles separados por coma (ej. Docente, Director). Para usuarios que sean solo Consultor o Planeación, la columna "Programa Académico" puede quedar como "No aplica".';
    instructionCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
    };
    instructionCell.font = { italic: true, size: 9, color: { argb: 'FF334155' } };
    instructionCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    worksheet.getRow(6).height = 28;

    // Fila 7: Espacio
    worksheet.getRow(7).height = 8;

    // Fila 8: Encabezados de la Tabla
    const headers = [
        'Nombres *',
        'Apellidos *',
        'Tipo Documento *',
        'Número Documento *',
        'Correo Institucional *',
        'Roles *',
        'Programa Académico'
    ];
    const headerRow = worksheet.getRow(8);
    headerRow.height = 26;

    headers.forEach((hText, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = hText;
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1A2744' }
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'medium', color: { argb: 'FF0F172A' } },
            bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
            left: { style: 'thin', color: { argb: 'FF334155' } },
            right: { style: 'thin', color: { argb: 'FF334155' } }
        };
    });

    // Filas de Datos de Ejemplo
    const sampleData = [
        ['Juan Carlos', 'Pérez Gómez', 'CC', '1085123456', 'jperez@cesmag.edu.co', 'Docente', 'Ingeniería de Sistemas'],
        ['María Elena', 'Rodríguez López', 'CC', '1085987654', 'mrodriguez@cesmag.edu.co', 'Docente, Director', 'Ingeniería Electrónica'],
        ['Carlos Andrés', 'Benavides Rosero', 'CC', '1085112233', 'cbenavides@cesmag.edu.co', 'Consultor, Planeación', 'No aplica'],
        ['Ana Milena', 'Torres Burbano', 'CC', '1085445566', 'atorres@cesmag.edu.co', 'Docente', 'Ingeniería Industrial'],
        ['Luis Fernando', 'Díaz Salazar', 'CE', '1085778899', 'ldiaz@cesmag.edu.co', 'Director', 'Ingeniería Industrial']
    ];

    sampleData.forEach((rowValues, rowIndex) => {
        const rowNum = 9 + rowIndex;
        const row = worksheet.getRow(rowNum);
        row.height = 20;

        const isEven = rowIndex % 2 === 0;
        const bgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        rowValues.forEach((val, colIndex) => {
            const cell = row.getCell(colIndex + 1);
            cell.value = val;
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: bgColor }
            };
            cell.font = { size: 9.5, color: { argb: 'FF1E293B' } };
            cell.alignment = {
                vertical: 'middle',
                horizontal: colIndex === 2 ? 'center' : 'left'
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
    });

    const outputPath = path.join(__dirname, '..', 'frontend', 'public', 'plantilla_docentes_SIGAP.xlsx');
    await workbook.xlsx.writeFile(outputPath);
    console.log('✅ Plantilla Excel generada exitosamente en:', outputPath);
}

generateTemplate().catch(console.error);
